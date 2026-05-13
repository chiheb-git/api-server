export interface FusionAnalysisComplete {
  score_imei_ai: number;
  score_box_ai: number;
  score_global: number;
  verdict: "Authentique" | "Suspect" | "Invalide";
  niveau_confiance: "Élevé" | "Moyen" | "Faible";
  coherence: "oui" | "non";
  forces: string[];
  faiblesses: string[];
  recommandations: string[];
  risque_global: "Faible" | "Moyen" | "Élevé";
  decision: "STOCKER" | "REJETER";
  raison: string;
}

export interface FusionResult {
  fusionScore: number;
  verdict: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
  imeiAIScore: number;
  boxAIScore: number;
  agreement: "AGREE" | "CONFLICT" | "PARTIAL";
  details_imei?: unknown;
  details_box?: unknown;
  decision?: "STOCKER" | "REJETER";
  raison?: string;
  /** Analyse normalisée pour l’app (COMPARE-AI) */
  fusionAnalysis: FusionAnalysisComplete;
}

type BoxLike = {
  finalScore: number;
  layers?: {
    layer1?: { score?: number };
    layer8?: { score?: number };
  };
};

type ImeiLayer2 = { score: number };

function buildForces(imeiScore: number, boxResult: BoxLike | null | undefined): string[] {
  const forces: string[] = [];
  if (imeiScore > 80) forces.push("Excellente cohérence entre l’IMEI saisi et l’analyse d’image");
  if (imeiScore > 60) forces.push("Format IMEI valide et lecture fiable");
  if (boxResult && boxResult.finalScore > 70) forces.push("Signaux visuels cohérents avec une boîte d’origine");
  if (boxResult && boxResult.finalScore > 50) forces.push("Analyse de la boîte sans anomalie majeure");
  if (forces.length === 0) forces.push("Analyse automatisée terminée");
  return forces;
}

function buildFaiblesses(imeiScore: number, boxResult: BoxLike | null | undefined): string[] {
  const f: string[] = [];
  if (imeiScore < 50) f.push("Score IMEI-AI en dessous du seuil de confort");
  if (imeiScore < 40) f.push("Risque d’écart entre l’IMEI et la photo de l’étiquette");
  if (boxResult && boxResult.finalScore < 50) f.push("Authenticité de la boîte non établie avec certitude");
  if (boxResult?.layers?.layer8 && (boxResult.layers.layer8.score ?? 100) < 50) {
    f.push("Indices compatibles avec une photo d’écran ou un support imprimé");
  }
  if (boxResult?.layers?.layer1 && (boxResult.layers.layer1.score ?? 100) < 45) {
    f.push("Les deux photos de boîte présentent peu de cohérence angulaire");
  }
  if (f.length === 0) f.push("Aucune faiblesse majeure mise en évidence");
  return f;
}

function buildRecommandations(scoreGlobal: number): string[] {
  if (scoreGlobal >= 70) {
    return ["Conserver les clichés pour votre dossier", "Vous pouvez poursuivre l’enregistrement si les autres contrôles métier sont OK"];
  }
  if (scoreGlobal >= 50) {
    return ["Effectuer une vérification humaine complémentaire si possible", "Refaire les photos en meilleure lumière si le score IMEI ou boîte est limite"];
  }
  return ["Ne pas enregistrer l’IMEI sans contrôle manuel", "Reprendre des photos nettes de l’étiquette IMEI et de la boîte sous deux angles distincts"];
}

function buildRaison(
  imeiScore: number,
  boxScore: number,
  scoreGlobal: number,
  verdict: FusionAnalysisComplete["verdict"],
  imei: string,
): string {
  const imeiLabel = imei ? ` pour l’IMEI ${imei}` : "";
  if (verdict === "Authentique") {
    return `Les scores IMEI-AI (${imeiScore}%) et BOX-AI (${boxScore}%) donnent une moyenne pondérée de ${scoreGlobal}%${imeiLabel} (≥70 %). Les deux analyses convergent vers un profil crédible d’appareil et d’emballage.`;
  }
  if (verdict === "Suspect") {
    return `Le score global est de ${scoreGlobal}%${imeiLabel}, ce qui reste au-dessus du seuil minimal mais avec des réserves : au moins une des deux analyses (IMEI ${imeiScore}%, boîte ${boxScore}%) mérite une relecture humaine.`;
  }
  return `Le score global (${scoreGlobal}%)${imeiLabel} est insuffisant : la combinaison IMEI-AI (${imeiScore}%) et BOX-AI (${boxScore}%) ne permet pas de valider automatiquement l’authenticité. L’enregistrement en base est déconseillé sans contrôle supplémentaire.`;
}

export function buildFusionAnalysis(
  imeiScore: number,
  boxScore: number,
  layer2: ImeiLayer2,
  boxResult: BoxLike | null | undefined,
  imei: string,
): FusionAnalysisComplete {
  const score_global = Math.round(imeiScore * 0.5 + boxScore * 0.5);
  const gap = Math.abs(imeiScore - boxScore);
  const coherence: "oui" | "non" = gap < 30 ? "oui" : "non";

  const verdict: FusionAnalysisComplete["verdict"] =
    score_global >= 70 ? "Authentique" : score_global >= 50 ? "Suspect" : "Invalide";

  const niveau_confiance: FusionAnalysisComplete["niveau_confiance"] =
    score_global >= 70 ? "Élevé" : score_global >= 50 ? "Moyen" : "Faible";

  const risque_global: FusionAnalysisComplete["risque_global"] =
    score_global >= 70 ? "Faible" : score_global >= 50 ? "Moyen" : "Élevé";

  const decision: FusionAnalysisComplete["decision"] = score_global >= 50 ? "STOCKER" : "REJETER";

  return {
    score_imei_ai: imeiScore,
    score_box_ai: boxScore,
    score_global,
    verdict,
    niveau_confiance,
    coherence,
    forces: buildForces(layer2.score, boxResult),
    faiblesses: buildFaiblesses(layer2.score, boxResult),
    recommandations: buildRecommandations(score_global),
    risque_global,
    decision,
    raison: buildRaison(imeiScore, boxScore, score_global, verdict, imei),
  };
}

export function fusionAI(
  imeiScore: number,
  boxScore: number,
  details_imei?: unknown,
  details_box?: unknown,
  imei?: string,
): FusionResult {
  let layer2Score = imeiScore;
  if (details_imei && typeof details_imei === "object" && details_imei !== null) {
    const d = details_imei as { layer2?: { score?: number } };
    if (typeof d.layer2?.score === "number") layer2Score = d.layer2.score;
  }
  const boxLike =
    details_box && typeof details_box === "object"
      ? (details_box as BoxLike)
      : ({ finalScore: boxScore, layers: {} } satisfies BoxLike);

  const fusionAnalysis = buildFusionAnalysis(
    Math.round(imeiScore),
    Math.round(boxScore),
    { score: Math.round(layer2Score) },
    boxLike,
    imei ?? "",
  );

  const bothAgree = (imeiScore > 70 && boxScore > 70) || (imeiScore < 40 && boxScore < 40);
  const conflicting = Math.abs(imeiScore - boxScore) > 40;
  const agreement: FusionResult["agreement"] = bothAgree ? "AGREE" : conflicting ? "CONFLICT" : "PARTIAL";

  const confidence: FusionResult["confidence"] =
    fusionAnalysis.niveau_confiance === "Élevé" ? "HIGH" : fusionAnalysis.niveau_confiance === "Moyen" ? "MEDIUM" : "LOW";

  const verdictLabel =
    fusionAnalysis.verdict === "Authentique"
      ? "VERIFIED SECURE ✅"
      : fusionAnalysis.verdict === "Invalide"
        ? "FRAUD DETECTED ❌"
        : conflicting
          ? "NEEDS REVIEW ⚠️"
          : "SUSPICIOUS ⚠️";

  return {
    fusionScore: fusionAnalysis.score_global,
    verdict: verdictLabel,
    confidence,
    explanation: fusionAnalysis.raison,
    imeiAIScore: Math.round(imeiScore),
    boxAIScore: Math.round(boxScore),
    agreement,
    details_imei,
    details_box,
    decision: fusionAnalysis.decision,
    raison: fusionAnalysis.raison,
    fusionAnalysis,
  };
}
