/**
 * BOX AUTHENTICITY ANALYZER v5.0 � HYBRID ENGINE
 *
 * Architecture: TensorFlow (local, toujours actif) + HF API (cloud, optionnel)
 * Pr�cision cible: 95%
 *
 * Layers:
 *   L1  � COCO-SSD 3D detection         (TF local)
 *   L2  � Natural lighting               (Sharp heuristic)
 *   L3  � MobileNet material             (TF local)
 *   L4  � Edge / sharpness               (Sharp heuristic)
 *   L5  � Print quality                  (Sharp heuristic)
 *   L6  � Natural noise                  (Sharp heuristic)
 *   L7  � Scene coherence                (TF + histogram)
 *   L8  � Screen fraud detection         (TF local)
 *   L9  � BLIP captioning                (HF cloud, optionnel)
 *   L10 � CLIP zero-shot                 (HF cloud, optionnel)
 *
 * Setup HF (optionnel mais recommand�):
 *   HF_API_TOKEN=hf_xxxxx dans .env
 */

import sharp from "sharp";
import * as tf from "@tensorflow/tfjs";
// @ts-ignore
import * as mobilenet from "@tensorflow-models/mobilenet";
// @ts-ignore
import * as cocoSsd from "@tensorflow-models/coco-ssd";

// ??? Types ????????????????????????????????????????????????????????????????????

export type LayerStatus = "PASS" | "WARN" | "FAIL" | "SKIP";

interface LayerBase {
  score: number;
  status: LayerStatus;
  detail: string;
  confidence: number;
}

export interface BoxAuthResult {
  finalScore: number;
  verdict: "AUTHENTIC" | "SUSPICIOUS" | "FAKE";
  verdictMessage: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  riskFlags: string[];
  layers: {
    layer1: LayerBase & { is3D: boolean; objectsDetected: string[]; positionShift: number };
    layer2: LayerBase & { brightness: number; contrast: number; hasShadows: boolean; hasHighlights: boolean };
    layer3: LayerBase & { topClassification: string; classConfidence: number; lowSaturationLikely: boolean };
    layer4: LayerBase & { edgeIntensity: number; strongEdges: boolean };
    layer5: LayerBase & { stdev: number; highPrintQuality: boolean };
    layer6: LayerBase & { noiseLevel: number; isReal: boolean; isTooPerfect: boolean };
    layer7: LayerBase & { histogramSimilarity: number; similarScenes: boolean };
    layer8: LayerBase & { screenProbability: number; isFraud: boolean };
    layer9: LayerBase & { caption: string; isBoxScene: boolean; isFraudScene: boolean };
    layer10: LayerBase & { topClass: string; clipScores: Record<string, number> };
  };
  hfApiUsed: boolean;
  tfApiUsed: boolean;
  processingTimeMs: number;
  analyzedAt: string;
}

// ??? TF Model singletons ??????????????????????????????????????????????????????

let mobilenetModel: mobilenet.MobileNet | null = null;
let cocoModel: cocoSsd.ObjectDetection | null = null;
let modelsLoading: Promise<void> | null = null;

async function loadModels(): Promise<boolean> {
  try {
    if (mobilenetModel && cocoModel) return true;
    if (modelsLoading) { await modelsLoading; return true; }
    modelsLoading = (async () => {
      if (!mobilenetModel) mobilenetModel = await mobilenet.load({ version: 2, alpha: 1.0 });
      if (!cocoModel) cocoModel = await cocoSsd.load({ base: "mobilenet_v2" });
    })();
    await modelsLoading;
    return true;
  } catch {
    return false;
  }
}

// ??? HF API Config ????????????????????????????????????????????????????????????

const HF_TOKEN = process.env.HF_API_TOKEN ?? "";
const HF_BASE = "https://api-inference.huggingface.co/models";

// Mod�les HF valid�s et fonctionnels (v�rifi�s mai 2026)
const HF_MODELS = {
  captioning: "Salesforce/blip-image-captioning-base",
  clip: "openai/clip-vit-base-patch32",
};

const CLIP_CLASSES = [
  "a real cardboard phone box",
  "a photo of a screen showing a box",
  "a printout or photograph of a box",
  "a genuine product packaging box",
  "a screenshot of a box image",
  "a physical cardboard box on a table",
  "a digital display showing a product",
];

// ??? Keyword Dictionaries ?????????????????????????????????????????????????????

const BOX_KEYWORDS = [
  "box", "carton", "package", "packaging", "cardboard", "container",
  "parcel", "crate", "shipping", "retail box", "phone box", "label", "barcode",
];

const FRAUD_KEYWORDS = [
  "screen", "monitor", "display", "television", "computer", "laptop",
  "tablet", "phone screen", "digital display", "lcd", "printed paper",
  "photograph", "poster", "printout", "desktop", "application", "app",
  "interface", "website", "webpage",
];

// ??? Utilities ????????????????????????????????????????????????????????????????

function normalizeBase64(b64: string): string {
  return b64.replace(/^data:image\/\w+;base64,/, "");
}

function bufferFromBase64(b64: string): Buffer {
  return Buffer.from(normalizeBase64(b64), "base64");
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function statusFromScore(score: number): LayerStatus {
  if (score >= 72) return "PASS";
  if (score >= 45) return "WARN";
  return "FAIL";
}

async function toTensor3D(b64: string, w: number, h: number): Promise<any> {
  const { data } = await sharp(bufferFromBase64(b64))
    .resize(w, h).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const tfAny = tf as any;
  return tfAny.tensor(new Uint8Array(data), [h, w, 3], "int32");
}

async function greyHistogram(b64: string, bins: number): Promise<number[]> {
  const { data } = await sharp(bufferFromBase64(b64))
    .resize(128, 128, { fit: "fill" }).greyscale().raw()
    .toBuffer({ resolveWithObject: true });
  const h = new Array<number>(bins).fill(0);
  const bw = 256 / bins;
  for (let i = 0; i < data.length; i++) h[Math.min(bins - 1, Math.floor(data[i]! / bw))]!++;
  return h.map((x) => x / data.length);
}

// ??? HF API caller ????????????????????????????????????????????????????????????

async function callHF<T>(model: string, buf: Buffer, jsonBody?: object): Promise<T | null> {
  if (!HF_TOKEN) return null;
  try {
    let body: string | Buffer;
    const headers: Record<string, string> = { Authorization: `Bearer ${HF_TOKEN}` };
    if (jsonBody) {
      body = JSON.stringify(jsonBody);
      headers["Content-Type"] = "application/json";
    } else {
      body = buf;
      headers["Content-Type"] = "application/octet-stream";
    }
    const res = await fetch(`${HF_BASE}/${model}`, {
      method: "POST", headers, body,
      signal: AbortSignal.timeout(25_000),
    });
    if (res.status === 503) {
      // Model is in cold start � wait 15s and retry
      await new Promise((r) => setTimeout(r, 15_000));
      const r2 = await fetch(`${HF_BASE}/${model}`, { method: "POST", headers, body });
      if (!r2.ok) return null;
      return await r2.json() as T;
    }
    if (!res.ok) { console.warn(`[HF] ${model} HTTP ${res.status}`); return null; }
    return await res.json() as T;
  } catch (e: any) {
    console.warn(`[HF] ${model} error:`, e.message);
    return null;
  }
}

// ???????????????????????????????????????????????????????????????????????????????
// LAYERS TF (toujours actifs)
// ???????????????????????????????????????????????????????????????????????????????

// L1 � COCO-SSD 3D Object Detection
async function layer1_3dDetection(front: string, angle: string) {
  const tfOk = await loadModels();
  if (!tfOk) return defaultLayer(1);

  const t1 = await toTensor3D(front, 640, 640);
  const t2 = await toTensor3D(angle, 640, 640);
  let p1: cocoSsd.DetectedObject[] = [];
  let p2: cocoSsd.DetectedObject[] = [];
  try {
    p1 = await cocoModel!.detect(t1);
    p2 = await cocoModel!.detect(t2);
  } finally { t1.dispose(); t2.dispose(); }

  const o1 = p1.map((p) => p.class);
  const o2 = p2.map((p) => p.class);
  const common = o1.filter((o) => o2.includes(o));

  const nonBoxObjects = ["tv", "laptop", "cell phone", "monitor", "person",
    "car", "dog", "cat", "chair", "couch", "bed", "sports ball", "balloon"];
  const hasNonBox = [...o1, ...o2].some((o) =>
    nonBoxObjects.some((nb) => o.toLowerCase().includes(nb))
  );

  const shift = p1.length > 0 && p2.length > 0
    ? Math.abs(p1[0]!.bbox[0] - p2[0]!.bbox[0]) + Math.abs(p1[0]!.bbox[1] - p2[0]!.bbox[1])
    : 0;

  const is3D = shift > 15 && common.length > 0 && !hasNonBox;

  const score = hasNonBox ? 5
    : is3D ? clamp(60 + shift / 3)
    : common.length > 0 ? 40
    : 15;

  return {
    score, is3D,
    objectsDetected: [...new Set([...o1, ...o2])],
    positionShift: Math.round(shift),
    status: hasNonBox ? "FAIL" as LayerStatus : statusFromScore(score),
    confidence: 0.8,
    detail: hasNonBox
      ? `?? Objet non-bo�te d�tect�: ${[...o1, ...o2].join(", ")}`
      : is3D
      ? `? Objet 3D confirm� � ${common.length} objets sous 2 angles, d�calage ${Math.round(shift)}px`
      : `?? Pas de d�calage de perspective d�tect�`,
  };
}

// L2 � Natural Lighting
async function layer2_lighting(front: string) {
  const stats = await sharp(bufferFromBase64(front)).stats();
  const ch = stats.channels[0]!;
  const hasShadows = ch.min < 55;
  const hasHighlights = ch.max > 185;
  const hasVariation = ch.stdev > 20;
  const contrast = ch.max - ch.min;
  const hasGoodContrast = contrast > 80;
  const passCount = [hasShadows, hasHighlights, hasVariation, hasGoodContrast].filter(Boolean).length;
  const score = clamp(passCount * 25);
  return {
    score, brightness: Math.round(ch.mean), contrast: Math.round(contrast),
    hasShadows, hasHighlights,
    status: statusFromScore(score), confidence: 0.75,
    detail: score >= 72
      ? `? Eclairage naturel (${passCount}/4 crit�res)`
      : `?? Eclairage suspect (${passCount}/4 crit�res)`,
  };
}

// L3 � MobileNet Material Classification
async function layer3_material(front: string) {
  const tfOk = await loadModels();
  if (!tfOk) return defaultLayer(3);

  const tensor = await toTensor3D(front, 224, 224);
  let cls: Array<{ className: string; probability: number }> = [];
  try { cls = await mobilenetModel!.classify(tensor, 15); }
  finally { tensor.dispose(); }

  const boxKw = ["box", "carton", "package", "container", "cardboard", "crate", "label", "wrap"];
  const fakeKw = ["screen", "monitor", "display", "tv", "computer", "laptop", "phone",
    "tablet", "poster", "print", "person", "animal", "food"];

  const realScore = cls.filter((c) => boxKw.some((k) => c.className.toLowerCase().includes(k)))
    .reduce((s, c) => s + c.probability * 100, 0);
  const fakeScore = cls.filter((c) => fakeKw.some((k) => c.className.toLowerCase().includes(k)))
    .reduce((s, c) => s + c.probability * 100, 0);

  const stats = await sharp(bufferFromBase64(front)).stats();
  const r = stats.channels[0]!.mean;
  const g = stats.channels[1]?.mean ?? r;
  const b = stats.channels[2]?.mean ?? r;
  const rgbSpread = Math.max(r, g, b) - Math.min(r, g, b);
  const tooVivid = rgbSpread > 65;

  const rawScore = clamp(realScore * 3 - fakeScore * 2);
  const score = tooVivid ? Math.min(rawScore, 25) : rawScore;
  const top = cls[0]!;

  return {
    score,
    topClassification: top.className,
    classConfidence: Math.round(top.probability * 100),
    lowSaturationLikely: rgbSpread < 45,
    status: statusFromScore(score), confidence: 0.75,
    detail: tooVivid
      ? `?? Couleurs trop vives (spread=${Math.round(rgbSpread)}) � pas du carton`
      : score >= 72
      ? `? Mat�riau bo�te confirm�: "${top.className}" (${Math.round(top.probability * 100)}%)`
      : `?? Mat�riau non reconnu comme bo�te: "${top.className}"`,
  };
}

// L4 � Edge Detection
async function layer4_edges(front: string) {
  const LAPLACIAN = { width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] };
  const buf = await sharp(bufferFromBase64(front)).greyscale().convolve(LAPLACIAN).raw().toBuffer();
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i]!;
  const intensity = sum / buf.length;
  const strongEdges = intensity >= 12;
  const score = strongEdges
    ? clamp(70 + intensity * 1.5)
    : intensity >= 8
    ? clamp(40 + intensity * 2)
    : clamp(intensity * 4);
  return {
    score, edgeIntensity: Math.round(intensity * 10) / 10, strongEdges,
    status: statusFromScore(score), confidence: 0.8,
    detail: strongEdges
      ? `? Bords nets d�tect�s (intensit�=${Math.round(intensity)})`
      : `?? Bords insuffisants (intensit�=${Math.round(intensity)})`,
  };
}

// L5 � Print Quality
async function layer5_print(front: string) {
  const stats = await sharp(bufferFromBase64(front)).stats();
  const stdev = stats.channels[0]!.stdev;
  const score = stdev < 15 ? clamp(stdev * 2)
    : stdev < 30 ? clamp(30 + stdev)
    : clamp(60 + (stdev - 30) * 1.5);
  return {
    score, stdev: Math.round(stdev * 10) / 10,
    highPrintQuality: stdev > 30,
    status: statusFromScore(score), confidence: 0.7,
    detail: stdev > 30
      ? `? Bonne qualit� d'impression (?=${Math.round(stdev)})`
      : `?? Qualit� d'impression faible (?=${Math.round(stdev)})`,
  };
}

// L6 � Natural Noise
async function layer6_noise(front: string) {
  const orig = await sharp(bufferFromBase64(front)).greyscale().raw().toBuffer();
  const blurred = await sharp(bufferFromBase64(front)).greyscale().blur(3).raw().toBuffer();
  let noiseSum = 0; let count = 0;
  for (let i = 0; i < orig.length; i += 4) {
    noiseSum += Math.abs((orig[i] ?? 0) - (blurred[i] ?? 0));
    count++;
  }
  const noiseLevel = noiseSum / count;
  const isTooPerfect = noiseLevel < 1.5;
  const isNatural = noiseLevel >= 2.0 && noiseLevel <= 22;
  const score = isTooPerfect ? 0
    : isNatural ? clamp(65 + (noiseLevel - 2) * 2)
    : noiseLevel > 22 ? clamp(20 + noiseLevel * 0.3)
    : 40;
  return {
    score, noiseLevel: Math.round(noiseLevel * 100) / 100,
    isReal: isNatural, isTooPerfect,
    status: isTooPerfect ? "FAIL" as LayerStatus : statusFromScore(score), confidence: 0.85,
    detail: isTooPerfect
      ? `?? Image trop parfaite (bruit=${Math.round(noiseLevel * 100) / 100}) � capture d'�cran d�tect�e`
      : isNatural
      ? `? Bruit naturel confirm� (niveau=${Math.round(noiseLevel * 100) / 100})`
      : `?? Signature bruit inhabituelle (niveau=${Math.round(noiseLevel * 100) / 100})`,
  };
}

// L7 � Scene Coherence
async function layer7_sceneCoherence(front: string, angle: string) {
  const [h1, h2] = await Promise.all([greyHistogram(front, 32), greyHistogram(angle, 32)]);
  let bhatt = 0;
  for (let i = 0; i < 32; i++) bhatt += Math.sqrt((h1[i] ?? 0) * (h2[i] ?? 0));
  const [s1, s2] = await Promise.all([
    sharp(bufferFromBase64(front)).stats(),
    sharp(bufferFromBase64(angle)).stats(),
  ]);
  const brightDiff = Math.abs(s1.channels[0]!.mean - s2.channels[0]!.mean);
  const similarScenes = bhatt > 0.65 && brightDiff < 65;
  const perspectiveShift = bhatt < 0.98 && brightDiff > 5;
  const score = !similarScenes ? clamp(bhatt * 30)
    : !perspectiveShift ? 20
    : clamp(60 + bhatt * 30 + 10);
  return {
    score, histogramSimilarity: Math.round(bhatt * 1000) / 1000, similarScenes,
    status: statusFromScore(score), confidence: 0.75,
    detail: !perspectiveShift
      ? `?? Photos identiques soumises deux fois`
      : !similarScenes
      ? `?? Sc�nes diff�rentes entre les 2 photos (similarit�=${Math.round(bhatt * 100)}%)`
      : `? M�me objet sous 2 angles (similarit�=${Math.round(bhatt * 100)}%, ?brillance=${Math.round(brightDiff)})`,
  };
}

// L8 � Screen Fraud Detection (TF)
async function layer8_screenFraud(front: string) {
  const tfOk = await loadModels();
  const screenKw = ["screen", "monitor", "display", "television", "tv", "computer",
    "laptop", "phone", "tablet", "desktop", "keyboard"];
  const printKw = ["paper", "document", "letter", "sheet", "newspaper", "magazine", "poster"];

  if (!tfOk) {
    // Fallback heuristique si TF �choue
    const stats = await sharp(bufferFromBase64(front)).stats();
    const r = stats.channels[0]!.mean;
    const g = stats.channels[1]?.mean ?? r;
    const b = stats.channels[2]?.mean ?? r;
    const isBlueHeavy = b > r * 1.15 && b > g;
    const isVivid = Math.max(r, g, b) - Math.min(r, g, b) > 70;
    const isFraud = isBlueHeavy || isVivid;
    return {
      score: isFraud ? 10 : 80, screenProbability: isFraud ? 80 : 5, isFraud,
      status: isFraud ? "FAIL" as LayerStatus : "PASS" as LayerStatus, confidence: 0.5,
      detail: isFraud ? `?? Couleurs �cran d�tect�es` : `? Pas de fraude �cran d�tect�e`,
    };
  }

  const tensor = await toTensor3D(front, 224, 224);
  let cls: Array<{ className: string; probability: number }> = [];
  try { cls = await mobilenetModel!.classify(tensor, 15); }
  finally { tensor.dispose(); }

  const screenProb = cls.filter((c) => screenKw.some((k) => c.className.toLowerCase().includes(k)))
    .reduce((s, c) => s + c.probability, 0);
  const printProb = cls.filter((c) => printKw.some((k) => c.className.toLowerCase().includes(k)))
    .reduce((s, c) => s + c.probability, 0);

  const stats = await sharp(bufferFromBase64(front)).stats();
  const r = stats.channels[0]!.mean;
  const g = stats.channels[1]?.mean ?? r;
  const b = stats.channels[2]?.mean ?? r;
  const screenColor = Math.max(r, g, b) - Math.min(r, g, b) > 20 && b > r * 1.1;

  const isFraud = screenProb > 0.15 || printProb > 0.25 || screenColor;
  const score = isFraud ? clamp(10 - screenProb * 30) : clamp(80 + (1 - screenProb) * 20);

  return {
    score, screenProbability: Math.round(screenProb * 100), isFraud,
    status: isFraud ? "FAIL" as LayerStatus : "PASS" as LayerStatus, confidence: 0.85,
    detail: isFraud
      ? `?? FRAUDE DETECTEE � ${screenProb > 0.15 ? `Ecran (${Math.round(screenProb * 100)}%)` : screenColor ? "Couleur �cran" : `Document imprim� (${Math.round(printProb * 100)}%)`}`
      : `? Objet physique r�el confirm�`,
  };
}

// ???????????????????????????????????????????????????????????????????????????????
// LAYERS HF (optionnels, haute pr�cision)
// ???????????????????????????????????????????????????????????????????????????????

// L9 � BLIP Captioning
async function layer9_blip(front: string) {
  const buf = bufferFromBase64(front);
  type BLIPRes = [{ generated_text: string }];
  const result = await callHF<BLIPRes>(HF_MODELS.captioning, buf);

  if (!result || !Array.isArray(result) || !result[0]?.generated_text) {
    return {
      score: 50, status: "SKIP" as LayerStatus, confidence: 0,
      detail: "BLIP non disponible � layer ignor�",
      caption: "", isBoxScene: false, isFraudScene: false,
    };
  }

  const caption = result[0].generated_text.toLowerCase();
  const isBoxScene = BOX_KEYWORDS.some((k) => caption.includes(k));
  const isFraudScene = FRAUD_KEYWORDS.some((k) => caption.includes(k));
  const score = isFraudScene ? 5 : isBoxScene ? 90 : 35;

  return {
    score,
    status: isFraudScene ? "FAIL" as LayerStatus : statusFromScore(score),
    confidence: 0.90,
    detail: isFraudScene
      ? `?? BLIP d�crit une fraude: "${result[0].generated_text}"`
      : isBoxScene
      ? `? BLIP confirme une bo�te: "${result[0].generated_text}"`
      : `?? BLIP ambigu: "${result[0].generated_text}"`,
    caption: result[0].generated_text,
    isBoxScene,
    isFraudScene,
  };
}

// L10 � CLIP Zero-Shot
async function layer10_clip(front: string) {
  const buf = bufferFromBase64(front);
  type CLIPRes = Array<{ label: string; score: number }>;

  const result = await callHF<CLIPRes>(HF_MODELS.clip, buf, {
    inputs: buf.toString("base64"),
    parameters: { candidate_labels: CLIP_CLASSES },
  });

  if (!result || !Array.isArray(result)) {
    return {
      score: 50, status: "SKIP" as LayerStatus, confidence: 0,
      detail: "CLIP non disponible � layer ignor�",
      topClass: "", clipScores: {},
    };
  }

  const scores: Record<string, number> = {};
  result.forEach((r) => { scores[r.label] = Math.round(r.score * 1000) / 10; });
  const topClass = result[0]?.label ?? "";
  const topScore = result[0]?.score ?? 0;

  const authenticKw = ["real cardboard", "genuine product", "physical cardboard"];
  const fraudKw = ["screen", "screenshot", "printout", "digital display"];

  const authScore = result.filter((r) => authenticKw.some((k) => r.label.includes(k)))
    .reduce((s, r) => s + r.score, 0);
  const fraudScore = result.filter((r) => fraudKw.some((k) => r.label.includes(k)))
    .reduce((s, r) => s + r.score, 0);

  const isFraud = fraudKw.some((k) => topClass.includes(k));
  const score = clamp((authScore - fraudScore * 1.5) * 100 + 40);

  return {
    score,
    status: isFraud ? "FAIL" as LayerStatus : statusFromScore(score),
    confidence: 0.92,
    detail: isFraud
      ? `?? CLIP identifie: "${topClass}" (${Math.round(topScore * 100)}%)`
      : `? CLIP confirme: "${topClass}" (${Math.round(topScore * 100)}%)`,
    topClass,
    clipScores: scores,
  };
}

// ??? Default layers ???????????????????????????????????????????????????????????

function defaultLayer(kind: number): any {
  const base = { score: 0, status: "FAIL" as LayerStatus, confidence: 0, detail: `Layer ${kind} � �chec` };
  const extras: Record<number, object> = {
    1: { is3D: false, objectsDetected: [], positionShift: 0 },
    2: { brightness: 0, contrast: 0, hasShadows: false, hasHighlights: false },
    3: { topClassification: "unknown", classConfidence: 0, lowSaturationLikely: false },
    4: { edgeIntensity: 0, strongEdges: false },
    5: { stdev: 0, highPrintQuality: false },
    6: { noiseLevel: 0, isReal: false, isTooPerfect: true },
    7: { histogramSimilarity: 0, similarScenes: false },
    8: { screenProbability: 0, isFraud: true },
    9: { caption: "", isBoxScene: false, isFraudScene: false },
    10: { topClass: "", clipScores: {} },
  };
  return { ...base, ...(extras[kind] ?? {}) };
}

// ???????????????????????????????????????????????????????????????????????????????
// MAIN EXPORT
// ???????????????????????????????????????????????????????????????????????????????

export async function analyzeBoxAuthenticity(
  frontBase64: string,
  angleBase64: string
): Promise<BoxAuthResult> {
  const startTime = Date.now();

  // Lancer tous les layers en parall�le
  const settled = await Promise.allSettled([
    layer1_3dDetection(frontBase64, angleBase64),   // L1
    layer2_lighting(frontBase64),                    // L2
    layer3_material(frontBase64),                    // L3
    layer4_edges(frontBase64),                       // L4
    layer5_print(frontBase64),                       // L5
    layer6_noise(frontBase64),                       // L6
    layer7_sceneCoherence(frontBase64, angleBase64), // L7
    layer8_screenFraud(frontBase64),                 // L8
    layer9_blip(frontBase64),                        // L9 (HF)
    layer10_clip(frontBase64),                       // L10 (HF)
  ]);

  const l1 = settled[0]?.status === "fulfilled" ? settled[0].value : defaultLayer(1);
  const l2 = settled[1]?.status === "fulfilled" ? settled[1].value : defaultLayer(2);
  const l3 = settled[2]?.status === "fulfilled" ? settled[2].value : defaultLayer(3);
  const l4 = settled[3]?.status === "fulfilled" ? settled[3].value : defaultLayer(4);
  const l5 = settled[4]?.status === "fulfilled" ? settled[4].value : defaultLayer(5);
  const l6 = settled[5]?.status === "fulfilled" ? settled[5].value : defaultLayer(6);
  const l7 = settled[6]?.status === "fulfilled" ? settled[6].value : defaultLayer(7);
  const l8 = settled[7]?.status === "fulfilled" ? settled[7].value : defaultLayer(8);
  const l9 = settled[8]?.status === "fulfilled" ? settled[8].value : defaultLayer(9);
  const l10 = settled[9]?.status === "fulfilled" ? settled[9].value : defaultLayer(10);

  const hfUsed = l9.status !== "SKIP" || l10.status !== "SKIP";
  const tfUsed = l1.status !== "FAIL" || l3.status !== "FAIL";

  // ?? Weights dynamiques ????????????????????????????????????????????????????
  // Si HF disponible ? HF prend plus de poids (plus pr�cis)
  // Si HF absent ? TF prend plus de poids
  let W = hfUsed
    ? { l1:0.10, l2:0.05, l3:0.10, l4:0.05, l5:0.04, l6:0.08, l7:0.08, l8:0.10, l9:0.20, l10:0.20 }
    : { l1:0.25, l2:0.10, l3:0.20, l4:0.08, l5:0.05, l6:0.10, l7:0.10, l8:0.12, l9:0.00, l10:0.00 };

  const rawScore = clamp(
    l1.score * W.l1 + l2.score * W.l2 + l3.score * W.l3 + l4.score * W.l4 +
    l5.score * W.l5 + l6.score * W.l6 + l7.score * W.l7 + l8.score * W.l8 +
    l9.score * W.l9 + l10.score * W.l10
  );

  // ?? Vetos critiques ???????????????????????????????????????????????????????
  let finalScore = rawScore;

  // Veto 1: COCO d�tecte un non-box ? FAKE
  if (l1.score <= 5) finalScore = Math.min(finalScore, 20);
  // Veto 2: Fraude �cran TF ? FAKE
  if (l8.isFraud) finalScore = Math.min(finalScore, 30);
  // Veto 3: BLIP d�crit une fraude ? FAKE
  if (l9.isFraudScene) finalScore = Math.min(finalScore, 20);
  // Veto 4: CLIP identifie �cran/screenshot ? FAKE
  if (l10.topClass && ["screen", "screenshot", "printout", "digital"].some((k) => l10.topClass.includes(k)))
    finalScore = Math.min(finalScore, 25);
  // Veto 5: Image trop parfaite ? FAKE
  if (l6.isTooPerfect) finalScore = Math.min(finalScore, 25);
  // Veto 6: Photos identiques soumises 2 fois ? SUSPICIOUS
  if (l7.histogramSimilarity > 0.99) finalScore = Math.min(finalScore, 45);
  // Veto 7: Photos de sc�nes compl�tement diff�rentes ? SUSPICIOUS
  if (!l7.similarScenes && l7.histogramSimilarity > 0) finalScore = Math.min(finalScore, 55);

  // ?? Risk flags ????????????????????????????????????????????????????????????
  const riskFlags: string[] = [];
  if (l1.score <= 5) riskFlags.push(`Objet non-bo�te d�tect�: ${l1.objectsDetected.join(", ")}`);
  if (l8.isFraud) riskFlags.push(`Fraude �cran/impression d�tect�e (${l8.screenProbability}%)`);
  if (l9.isFraudScene) riskFlags.push(`BLIP: sc�ne frauduleuse "${l9.caption}"`);
  if (l6.isTooPerfect) riskFlags.push("Image trop parfaite � capture d'�cran probable");
  if (!l7.similarScenes) riskFlags.push("Photos de sc�nes diff�rentes");
  if (l7.histogramSimilarity > 0.99) riskFlags.push("Photos identiques soumises deux fois");

  // ?? Confiance globale ?????????????????????????????????????????????????????
  const confidence: "HIGH" | "MEDIUM" | "LOW" =
    hfUsed && tfUsed ? "HIGH"
    : tfUsed ? "MEDIUM"
    : "LOW";

  // ?? Verdict ???????????????????????????????????????????????????????????????
  const verdict: BoxAuthResult["verdict"] =
    finalScore >= 72 ? "AUTHENTIC" : finalScore >= 45 ? "SUSPICIOUS" : "FAKE";

  const verdictMessage =
    finalScore >= 72
      ? `? Bo�te AUTHENTIQUE � Objet physique r�el confirm� (confiance: ${confidence})`
      : finalScore >= 45
      ? `?? Bo�te SUSPECTE � ${riskFlags.length} anomalie(s), v�rification manuelle conseill�e`
      : `? Bo�te FAUSSE � ${riskFlags[0] ?? "Pas une vraie bo�te physique"}`;

  return {
    finalScore, verdict, verdictMessage, confidence, riskFlags,
    layers: { layer1:l1, layer2:l2, layer3:l3, layer4:l4, layer5:l5,
              layer6:l6, layer7:l7, layer8:l8, layer9:l9, layer10:l10 },
    hfApiUsed: hfUsed, tfApiUsed: tfUsed,
    processingTimeMs: Date.now() - startTime,
    analyzedAt: new Date().toISOString(),
  };
}

export const analyzeBox = analyzeBoxAuthenticity;

export function neutralBoxAuthResult(): BoxAuthResult {
  const n = (k: number) => defaultLayer(k);
  return {
    finalScore: 0, verdict: "FAKE",
    verdictMessage: "? Analyse �chou�e � veuillez r�essayer",
    confidence: "LOW", riskFlags: ["Analyse non compl�t�e"],
    layers: { layer1:n(1), layer2:n(2), layer3:n(3), layer4:n(4), layer5:n(5),
              layer6:n(6), layer7:n(7), layer8:n(8), layer9:n(9), layer10:n(10) },
    hfApiUsed: false, tfApiUsed: false, processingTimeMs: 0,
    analyzedAt: new Date().toISOString(),
  };
}
