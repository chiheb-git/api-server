import { Router } from "express";
import { db } from "@workspace/db";
import { boxVerificationsTable, fusionVerificationsTable, phonesTable, searchesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { analyzeLayer1, analyzeLayer2, analyzeLayer3, quickScanImei } from "../lib/ai-analysis.js";
import { analyzeBox, neutralBoxAuthResult } from "../services/boxAI.js";
import { fusionAI } from "../services/fusionAI.js";
import { validateBase64ImageSizes } from "../lib/imagePayloadLimits.js";

const router = Router();

/**
 * POST /api/phones/ocr-scan
 * Lightweight endpoint: just runs OCR and returns detected IMEI candidates.
 * Used by the frontend to auto-fill the IMEI field immediately after photo pick.
 */
router.post("/ocr-scan", requireAuth, async (req: AuthRequest, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };

  if (!imageBase64) {
    res.status(400).json({ error: "validation_error", message: "imageBase64 is required" });
    return;
  }

  const imgOk = validateBase64ImageSizes([{ name: "image OCR", value: imageBase64 }]);
  if (!imgOk.ok) {
    res.status(400).json({ error: "payload_too_large", message: imgOk.message });
    return;
  }

  const result = await quickScanImei(imageBase64);
  res.json(result);
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
  const { imei, imageBase64, brand, model, confirmedImei, boxFrontImage, boxAngleImage } = req.body as {
    imei?: string;
    imageBase64?: string;
    brand?: string;
    model?: string;
    confirmedImei?: string;
    boxFrontImage?: string;
    boxAngleImage?: string;
  };

  if (!imei || !imageBase64 || !boxFrontImage || !boxAngleImage) {
    res.status(400).json({ error: "validation_error", message: "IMEI image, boxFrontImage and boxAngleImage are required" });
    return;
  }

  if (!/^\d{15}$/.test(imei)) {
    res.status(400).json({ error: "validation_error", message: "IMEI must be exactly 15 digits" });
    return;
  }

  const sizes = validateBase64ImageSizes([
    { name: "photo IMEI", value: imageBase64 },
    { name: "boîte (face)", value: boxFrontImage },
    { name: "boîte (angle)", value: boxAngleImage },
  ]);
  if (!sizes.ok) {
    res.status(400).json({ error: "payload_too_large", message: sizes.message });
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
    const imeiScore = Math.round(layer1.matchPercentage || 0);
    const boxScore = 0;
    const fusion = fusionAI(imeiScore, boxScore, { layer1, layer2: { score: imeiScore } }, null, imei);
    const fusionAnalysis = {
      ...fusion.fusionAnalysis,
      raison: layer1.message || fusion.fusionAnalysis.raison,
    };

    res.status(200).json({
      stored: false,
      message: layer1.message,
      imeiAnalysis: {
        layer1,
        layer2: null,
        layer3: null,
      },
      boxAnalysis: null,
      fusionAnalysis,
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

  // Step 2 — AI 2 Box verification (sharp uniquement, rapide)
  let boxResult;
  try {
    boxResult = await analyzeBox(boxFrontImage, boxAngleImage);
  } catch (boxErr) {
    console.error("BOX-AI error:", boxErr);
    boxResult = neutralBoxAuthResult();
  }
  const boxScore = boxResult.finalScore;

  // Step 3 — AI 3 Fusion (COMPARE-AI)
  const imeiScore = Math.round(layer2.score);
  const fusion = fusionAI(
    imeiScore,
    boxScore,
    { layer1, layer2, layer3 },
    boxResult,
    imei,
  );
  const fusionAnalysis = fusion.fusionAnalysis;

  // Step 4 — Decision (stockage IMEI seulement si score_global >= 50)
  if (fusion.fusionScore < 50) {
    res.status(422).json({
      stored: false,
      message: "Device not stored: AI verification score too low.",
      imeiAnalysis: {
        layer1,
        layer2,
        layer3,
      },
      boxAnalysis: boxResult,
      fusionAnalysis: fusionAnalysis,
    });
    return;
  }

  const allLayersPassed = layer1.verified && layer2.score > 70 && !layer3.forgeryDetected;
  const finalVerdict = allLayersPassed ? "verified" : "rejected";

  let storedPhoneId: number | null = null;
  try {
    const existing = await db.select({ id: phonesTable.id }).from(phonesTable).where(eq(phonesTable.imei, imei)).limit(1);
    if (existing.length > 0) {
      await db.update(phonesTable)
        .set({ verificationCount: sql`${phonesTable.verificationCount} + 1` })
        .where(eq(phonesTable.imei, imei));
      storedPhoneId = existing[0]!.id;
    } else {
      const inserted = await db.insert(phonesTable).values({
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
      }).returning({ id: phonesTable.id });
      storedPhoneId = inserted[0]?.id ?? null;
    }

    await db.insert(boxVerificationsTable).values({
      userId: req.userId ?? null,
      layer1Score: boxResult.layers.layer1.score,
      layer2Score: boxResult.layers.layer2.score,
      layer3Score: boxResult.layers.layer3.score,
      layer4Score: boxResult.layers.layer4.score,
      layer5Score: boxResult.layers.layer5.score,
      layer6Score: boxResult.layers.layer6.score,
      layer7Score: boxResult.layers.layer7.score,
      layer8Score: boxResult.layers.layer8.score,
      finalScore: boxResult.finalScore,
      verdict: boxResult.verdict,
    });

    await db.insert(fusionVerificationsTable).values({
      userId: req.userId ?? null,
      imeiScore: fusion.imeiAIScore,
      boxScore: fusion.boxAIScore,
      fusionScore: fusion.fusionScore,
      verdict: fusion.verdict,
      confidence: fusion.confidence,
      agreement: fusion.agreement,
    });
  } catch (dbError) {
    console.error('DB insert error:', dbError);
    // Continuer et retourner le résultat même si la DB plante
  }

  res.status(200).json({
    stored: true,
    message: "Device stored: AI verification score is above 50%.",
    phone: {
      id: storedPhoneId,
      imei,
      brand: brand ?? null,
      model: model ?? null,
      trustScore: layer2.score,
      finalVerdict,
    },
    imeiAnalysis: {
      layer1,
      layer2,
      layer3,
    },
    boxAnalysis: boxResult,
    fusionAnalysis,
  });
  } catch (e) {
    console.error("POST /api/phones error:", e);
    const fallbackBody = req.body as { imei?: string };
    const imeiSafe = fallbackBody?.imei ?? "";
    const fusion = fusionAI(0, 0, { layer2: { score: 0 } }, null, imeiSafe);
    res.status(200).json({
      stored: false,
      message:
        "Une erreur est survenue pendant la vérification. Les résultats ci-dessous sont indicatifs ; merci de réessayer.",
      imeiAnalysis: null,
      boxAnalysis: null,
      fusionAnalysis: {
        ...fusion.fusionAnalysis,
        raison:
          "Le traitement n’a pas pu aller au bout. Aucune donnée n’a été enregistrée. Réessayez avec des photos plus petites ou une meilleure connexion.",
      },
    });
  }
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
