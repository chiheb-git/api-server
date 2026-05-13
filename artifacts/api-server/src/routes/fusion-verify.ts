import { Router } from "express";
import { db, fusionVerificationsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { fusionAI } from "../services/fusionAI.js";

const router = Router();

/**
 * POST /api/fusion-verify
 * Body: { imeiScore: number, boxScore: number, imeiData?: any, boxData?: any, imei?: string }
 *
 * curl example:
 * curl -X POST http://localhost:3000/api/fusion-verify \
 *  -H "Content-Type: application/json" \
 *  -H "Authorization: Bearer YOUR_TOKEN" \
 *  -d "{\"imeiScore\":84,\"boxScore\":78,\"imei\":\"123456789012345\"}"
 */
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { imeiScore, boxScore, imeiData, boxData, imei } = req.body as {
      imeiScore?: number;
      boxScore?: number;
      imeiData?: unknown;
      boxData?: unknown;
      imei?: string;
    };

    if (typeof imeiScore !== "number" || typeof boxScore !== "number") {
      res.status(400).json({ error: "validation_error", message: "imeiScore and boxScore must be numbers" });
      return;
    }
    if (imeiScore < 0 || imeiScore > 100 || boxScore < 0 || boxScore > 100) {
      res.status(400).json({ error: "validation_error", message: "Scores must be between 0 and 100" });
      return;
    }

    const result = fusionAI(Math.round(imeiScore), Math.round(boxScore), imeiData, boxData, imei);

    if (result.fusionScore >= 50) {
      try {
        await db.insert(fusionVerificationsTable).values({
          userId: req.userId ?? null,
          imeiScore: result.imeiAIScore,
          boxScore: result.boxAIScore,
          fusionScore: result.fusionScore,
          verdict: result.verdict,
          confidence: result.confidence,
          agreement: result.agreement,
        });
      } catch (dbErr) {
        console.error("fusion-verify DB:", dbErr);
      }
    }

    res.status(200).json(result);
  } catch (e) {
    console.error("fusion-verify:", e);
    const fallback = fusionAI(0, 0, {}, null, "");
    res.status(200).json({
      ...fallback,
      fusionAnalysis: {
        ...fallback.fusionAnalysis,
        raison: "Erreur interne évitée — aucune donnée enregistrée. Réessayez.",
      },
    });
  }
});

export default router;
