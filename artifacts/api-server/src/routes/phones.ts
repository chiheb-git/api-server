import { Router } from "express";
import { db } from "@workspace/db";
import { phonesTable, searchesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { analyzeLayer1, analyzeLayer2, analyzeLayer3 } from "../lib/ai-analysis.js";

const router = Router();

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

  // Run Layer 1 analysis
  const layer1 = analyzeLayer1(imei, imageBase64);

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

  // Run Layer 2 analysis
  const layer2 = analyzeLayer2(imei, imageBase64, layer1.matchPercentage, brand, model);

  // Run Layer 3 analysis
  const layer3 = analyzeLayer3(imageBase64);

  // Final decision engine
  const allLayersPassed = layer1.verified && layer2.score > 70 && !layer3.forgeryDetected;
  const finalVerdict = allLayersPassed ? "verified" : "rejected";

  let message: string;
  let savedToDatabase = false;

  if (allLayersPassed) {
    // Save to database
    const existing = await db.select({ id: phonesTable.id }).from(phonesTable).where(eq(phonesTable.imei, imei)).limit(1);

    if (existing.length > 0) {
      // Update verification count
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

  // Check if phone is in database (flagged as registered/reported)
  const [phone] = await db.select().from(phonesTable).where(eq(phonesTable.imei, imei)).limit(1);

  // Count how many times this IMEI was searched
  const searchLogs = await db.select().from(searchesTable).where(eq(searchesTable.imei, imei));
  const searchCount = searchLogs.length + 1;

  // Log this search
  await db.insert(searchesTable).values({
    imei,
    searchedBy: null,
    result: phone ? "found" : "not_found",
    trustScore: phone?.trustScore ?? null,
    ipAddress: req.ip ?? null,
  });

  if (phone) {
    // Update verification count
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
