import { Router } from "express";
import { db } from "@workspace/db";
import { phonesTable, searchesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { analyzeLayer1, analyzeLayer2, analyzeLayer3 } from "../lib/ai-analysis.js";

const router = Router();

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { imei, imageBase64, brand, model, confirmedImei } = req.body as {
    imei?: string;
    imageBase64?: string;
    brand?: string;
    model?: string;
    confirmedImei?: string;
  };

  if (!imei || !imageBase64) {
    res.status(400).json({ error: "validation_error", message: "IMEI and image are required" });
    return;
  }

  if (!/^\d{15}$/.test(imei)) {
    res.status(400).json({ error: "validation_error", message: "IMEI must be exactly 15 digits" });
    return;
  }

  // Run Layer 1 — real Tesseract OCR, with optional manual confirmation
  const layer1 = await analyzeLayer1(imei, imageBase64, confirmedImei);

  // If manual confirmation is still needed, return early so the frontend
  // can show the confirmation field to the user
  if (layer1.needsManualConfirmation && !confirmedImei) {
    res.status(200).json({
      success: false,
      imei,
      layer1,
      layer2: null,
      layer3: null,
      trustScore: 0,
      finalVerdict: "pending_confirmation",
      message: layer1.message,
      savedToDatabase: false,
      needsManualConfirmation: true,
    });
    return;
  }

  // Hard fail if Layer 1 not verified even after confirmation attempt
  if (!layer1.verified) {
    res.status(200).json({
      success: false,
      imei,
      layer1,
      layer2: null,
      layer3: null,
      trustScore: 0,
      finalVerdict: "rejected",
      message: layer1.message,
      savedToDatabase: false,
      needsManualConfirmation: layer1.needsManualConfirmation,
    });
    return;
  }

  // Run Layer 2 (sync, uses real match score + manual confirmation flag)
  const layer2 = analyzeLayer2(
    imei, imageBase64, layer1.matchPercentage,
    layer1.ocrConfidence, layer1.manuallyConfirmed, brand, model,
  );

  // Run Layer 3 (sync, uses OCR confidence + candidate list)
  const imeiCandidates = layer1.extractedImei && layer1.extractedImei.length === 15
    ? [layer1.extractedImei]
    : [];
  const layer3 = analyzeLayer3(imageBase64, layer1.ocrConfidence, imeiCandidates);

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
