import { Router } from "express";
import { db } from "@workspace/db";
import { phonesTable, searchesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { analyzeLayer1, analyzeLayer2, analyzeLayer3 } from "../lib/ai-analysis.js";
import { createWorker } from "tesseract.js";

const router = Router();

/**
 * Run Tesseract OCR once and return all extracted text and IMEI candidates.
 * We share the single OCR run across Layer 1, 2, and 3 to avoid running
 * Tesseract multiple times on the same image.
 */
async function runOCR(base64Data: string): Promise<{ text: string; confidence: number; imeiCandidates: string[] }> {
  const imageBuffer = Buffer.from(base64Data, "base64");
  const worker = await createWorker("eng");
  try {
    await worker.setParameters({ tessedit_char_whitelist: "0123456789 \n" });
    const { data } = await worker.recognize(imageBuffer);
    const text = data.text ?? "";
    const imeiPattern = /\b\d{15}\b/g;
    const candidates = text.match(imeiPattern) ?? [];
    return { text, confidence: data.confidence, imeiCandidates: candidates };
  } finally {
    await worker.terminate();
  }
}

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { imei, imageBase64, brand, model } = req.body as {
    imei?: string;
    imageBase64?: string;
    brand?: string;
    model?: string;
  };

  if (!imei || !imageBase64) {
    res.status(400).json({ error: "validation_error", message: "IMEI and image are required" });
    return;
  }

  if (!/^\d{15}$/.test(imei)) {
    res.status(400).json({ error: "validation_error", message: "IMEI must be exactly 15 digits" });
    return;
  }

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  // Run Layer 1 (real Tesseract OCR)
  const layer1 = await analyzeLayer1(imei, imageBase64);

  if (!layer1.verified) {
    res.status(400).json({
      error: "layer1_failed",
      message: layer1.message,
      success: false,
      imei,
      layer1,
      layer2: null,
      layer3: null,
      trustScore: 0,
      finalVerdict: "rejected",
      savedToDatabase: false,
    });
    return;
  }

  // Run OCR again to get full text and candidates for Layer 3
  // (Layer 1 already ran OCR; re-run for Layer 3 context since we need candidates list)
  let ocrText = "";
  let ocrConfidence = layer1.ocrConfidence;
  let imeiCandidates: string[] = [];
  try {
    const ocr = await runOCR(base64Data);
    ocrText = ocr.text;
    ocrConfidence = ocr.confidence;
    imeiCandidates = ocr.imeiCandidates;
  } catch {
    ocrText = "";
    ocrConfidence = layer1.ocrConfidence;
    imeiCandidates = [layer1.extractedImei];
  }

  // Run Layer 2 analysis (sync, uses real OCR match score)
  const layer2 = analyzeLayer2(imei, imageBase64, layer1.matchPercentage, ocrConfidence, brand, model);

  // Run Layer 3 analysis (sync, uses OCR confidence + candidates)
  const layer3 = analyzeLayer3(imageBase64, ocrText, ocrConfidence, imeiCandidates);

  // Final decision engine
  const allLayersPassed = layer1.verified && layer2.score > 70 && !layer3.forgeryDetected;
  const finalVerdict = allLayersPassed ? "verified" : "rejected";

  let message: string;
  let savedToDatabase = false;

  if (allLayersPassed) {
    const existing = await db.select({ id: phonesTable.id }).from(phonesTable).where(eq(phonesTable.imei, imei)).limit(1);
    if (existing.length > 0) {
      await db.update(phonesTable)
        .set({ verificationCount: sql`${phonesTable.verificationCount} + 1` })
        .where(eq(phonesTable.imei, imei));
    } else {
      await db.insert(phonesTable).values({
        userId: req.userId!,
        imei,
        brand: brand ?? null,
        model: model ?? null,
        imageBase64,
        trustScore: layer2.score,
        layer1Score: layer1.matchPercentage,
        layer2Score: layer2.score,
        layer3Result: layer3.message,
        finalVerdict,
        verificationCount: 1,
      });
    }
    savedToDatabase = true;
    message = "Phone successfully added and verified";
  } else {
    const failedLayers: string[] = [];
    if (!layer1.verified) failedLayers.push(`Layer 1: ${layer1.message}`);
    if (layer2.score <= 70) failedLayers.push(`Layer 2: Trust score too low (${layer2.score}/100)`);
    if (layer3.forgeryDetected) failedLayers.push(`Layer 3: ${layer3.message}`);
    message = `Verification failed. ${failedLayers.join(". ")}`;
  }

  res.json({
    success: allLayersPassed,
    imei,
    layer1,
    layer2,
    layer3,
    trustScore: layer2.score,
    finalVerdict,
    message,
    savedToDatabase,
  });
});

router.post("/search", async (req, res) => {
  const { imei } = req.body as { imei?: string };

  if (!imei || !/^\d{15}$/.test(imei)) {
    res.status(400).json({ error: "validation_error", message: "IMEI must be exactly 15 digits" });
    return;
  }

  const [phone] = await db.select().from(phonesTable).where(eq(phonesTable.imei, imei)).limit(1);
  const searchLogs = await db.select().from(searchesTable).where(eq(searchesTable.imei, imei));
  const searchCount = searchLogs.length + 1;

  await db.insert(searchesTable).values({
    imei,
    searchedBy: null,
    result: phone ? "found" : "not_found",
    trustScore: phone?.trustScore ?? null,
    ipAddress: req.ip ?? null,
  });

  if (phone) {
    await db.update(phonesTable)
      .set({ verificationCount: sql`${phonesTable.verificationCount} + 1` })
      .where(eq(phonesTable.imei, imei));

    res.json({
      found: true,
      imei,
      isSecure: false,
      message: "This device has been reported",
      searchCount,
      phone: {
        id: phone.id,
        imei: phone.imei,
        brand: phone.brand,
        model: phone.model,
        trustScore: phone.trustScore,
        layer1Score: phone.layer1Score,
        layer2Score: phone.layer2Score,
        layer3Result: phone.layer3Result,
        finalVerdict: phone.finalVerdict,
        verificationCount: phone.verificationCount + 1,
        createdAt: phone.createdAt.toISOString(),
      },
    });
  } else {
    res.json({
      found: false,
      imei,
      isSecure: true,
      message: "This device has not been reported",
      searchCount,
    });
  }
});

export default router;
