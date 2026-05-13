import { Router } from "express";
import { db, boxVerificationsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { analyzeBoxAuthenticity, neutralBoxAuthResult } from "../services/boxAI.js";
import { validateBase64ImageSizes } from "../lib/imagePayloadLimits.js";

const router = Router();

/**
 * POST /api/box-verify
 * Body: { frontImage: string, angleImage: string }
 *
 * curl example:
 * curl -X POST http://localhost:3000/api/box-verify \
 *  -H "Content-Type: application/json" \
 *  -H "Authorization: Bearer YOUR_TOKEN" \
 *  -d "{\"frontImage\":\"data:image/jpeg;base64,...\",\"angleImage\":\"data:image/jpeg;base64,...\"}"
 */
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { frontImage, angleImage } = req.body as { frontImage?: string; angleImage?: string };

  if (!frontImage || !angleImage) {
    res.status(400).json({ error: "validation_error", message: "frontImage and angleImage are required" });
    return;
  }

  const sizes = validateBase64ImageSizes([
    { name: "face", value: frontImage },
    { name: "angle", value: angleImage },
  ]);
  if (!sizes.ok) {
    res.status(400).json({ error: "payload_too_large", message: sizes.message });
    return;
  }

  try {
    const result = await analyzeBoxAuthenticity(frontImage, angleImage);

    try {
      await db.insert(boxVerificationsTable).values({
        userId: req.userId ?? null,
        layer1Score: result.layers.layer1.score,
        layer2Score: result.layers.layer2.score,
        layer3Score: result.layers.layer3.score,
        layer4Score: result.layers.layer4.score,
        layer5Score: result.layers.layer5.score,
        layer6Score: result.layers.layer6.score,
        layer7Score: result.layers.layer7.score,
        layer8Score: result.layers.layer8.score,
        finalScore: result.finalScore,
        verdict: result.verdict,
      });
    } catch (dbErr) {
      console.error("box-verify DB:", dbErr);
    }

    res.status(200).json(result);
  } catch (e) {
    console.error("box-verify:", e);
    res.status(200).json(neutralBoxAuthResult());
  }
});

export default router;
