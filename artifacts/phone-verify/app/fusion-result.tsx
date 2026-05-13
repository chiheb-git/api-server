import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle, Polygon, Path, Defs, LinearGradient, Stop, Filter, FeGaussianBlur, FeMerge, FeMergeNode } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TrustGauge } from "@/components/TrustGauge";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const CYBER = {
  bg:        "#050A0F",
  surface:   "#0B1520",
  card:      "#0D1B2A",
  border:    "#1A3550",
  accent:    "#00D4FF",
  accentDim: "#0097B8",
  green:     "#00FF88",
  greenDim:  "#00C466",
  amber:     "#FFB800",
  red:       "#FF3B5C",
  text:      "#E8F4FF",
  muted:     "#5A8FAA",
};

// ─── Types (inchangés) ─────────────────────────────────────────────────────────
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

interface PendingFusionPayload {
  fusionAnalysis?: FusionAnalysisComplete;
  imei?: string;
  imeiAnalysis?: unknown;
  boxAnalysis?: unknown;
  stored?: boolean;
  message?: string;
}

// ─── Score color (cyber palette) ───────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 75) return CYBER.green;
  if (score >= 50) return CYBER.amber;
  return CYBER.red;
}

// ─── Logo 3D animé ─────────────────────────────────────────────────────────────
function CyberLogo() {
  const hexRot   = useRef(new Animated.Value(0)).current;
  const orb1     = useRef(new Animated.Value(0)).current;
  const orb2     = useRef(new Animated.Value(0)).current;
  const orb3     = useRef(new Animated.Value(0)).current;
  const glow     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.timing(hexRot, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(orb1,   { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(orb2,   { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(orb3,   { toValue: 1, duration: 3700, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const hexRotate = hexRot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  const orbPosition = (anim: Animated.Value, radius: number, phase: number) => {
    const angle = anim.interpolate({ inputRange: [0, 1], outputRange: [phase, phase + 2 * Math.PI] });
    return {
      x: Animated.multiply(radius, new Animated.Value(Math.cos(phase))),
      y: Animated.multiply(radius, new Animated.Value(Math.sin(phase))),
    };
  };

  const makeOrbStyle = (anim: Animated.Value, r: number, phase: number) => {
    const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: [`${phase}deg`, `${phase + 360}deg`] });
    return {
      position: "absolute" as const,
      top: 45 - 4,
      left: 45 - 4,
      width: 8,
      height: 8,
      borderRadius: 4,
      transform: [
        { rotate },
        { translateX: r },
        { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: [`${-phase}deg`, `${-phase - 360}deg`] }) },
      ],
    };
  };

  return (
    <View style={{ width: 90, height: 90, alignItems: "center", justifyContent: "center" }}>
      {/* Glow halo */}
      <Animated.View style={{
        position: "absolute", width: 110, height: 110, borderRadius: 55,
        backgroundColor: CYBER.accent, opacity: glowOpacity,
        transform: [{ scale: glowOpacity.interpolate({ inputRange: [0.3, 1], outputRange: [1, 1.15] }) }],
        top: -10, left: -10,
      }}>
        <View style={{ flex: 1, borderRadius: 55, backgroundColor: "transparent",
          shadowColor: CYBER.accent, shadowRadius: 20, shadowOpacity: 1 }} />
      </Animated.View>

      {/* Hex tournant */}
      <Animated.View style={{ position: "absolute", transform: [{ rotate: hexRotate }] }}>
        <Svg width="90" height="90" viewBox="0 0 90 90">
          <Polygon points="45,4 82,24 82,66 45,86 8,66 8,24"
            fill="none" stroke={CYBER.accent} strokeWidth="1.5" strokeDasharray="6 3" opacity="0.8" />
        </Svg>
      </Animated.View>

      {/* Inner hex + shield */}
      <Svg width="70" height="70" viewBox="0 0 90 90">
        <Defs>
          <LinearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#0D2D45" />
            <Stop offset="100%" stopColor="#051525" />
          </LinearGradient>
        </Defs>
        <Polygon points="45,10 78,27.5 78,62.5 45,80 12,62.5 12,27.5" fill="url(#hg)" stroke={CYBER.accent} strokeWidth="1.2" />
        <Path d="M45 24 L57 30 L57 43 Q57 52 45 57 Q33 52 33 43 L33 30 Z"
          fill="none" stroke={CYBER.accent} strokeWidth="1.8" strokeLinejoin="round" />
        <Path d="M40 41 L44 45 L52 35"
          fill="none" stroke={CYBER.green} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>

      {/* Orbiting dots */}
      {[
        { anim: orb1, r: 34, phase: 0,   color: CYBER.accent },
        { anim: orb2, r: 28, phase: 120, color: CYBER.green  },
        { anim: orb3, r: 22, phase: 240, color: CYBER.amber  },
      ].map((o, i) => (
        <Animated.View key={i} style={[makeOrbStyle(o.anim, o.r, o.phase), {
          backgroundColor: o.color,
          shadowColor: o.color, shadowRadius: 4, shadowOpacity: 1,
        }]} />
      ))}
    </View>
  );
}

// ─── Badge tag ─────────────────────────────────────────────────────────────────
function CyberBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: color + "22" }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Section title ──────────────────────────────────────────────────────────────
function SectionTitle({ icon, title, color = CYBER.accent }: { icon: string; title: string; color?: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={[styles.sectionTitleText, { color }]}>{title}</Text>
      <View style={[styles.sectionLine, { backgroundColor: color + "44" }]} />
    </View>
  );
}

// ─── Cyber card wrapper ─────────────────────────────────────────────────────────
function CyberCard({ children, accentColor = CYBER.border, glow = false, style }: {
  children: React.ReactNode; accentColor?: string; glow?: boolean; style?: object;
}) {
  return (
    <View style={[
      styles.cyberCard,
      { borderColor: accentColor },
      glow && { shadowColor: accentColor, shadowRadius: 12, shadowOpacity: 0.4, elevation: 8 },
      style,
    ]}>
      {/* Corner accents */}
      <View style={[styles.cornerTL, { borderColor: accentColor }]} />
      <View style={[styles.cornerBR, { borderColor: accentColor }]} />
      {children}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function FusionResultScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ imei?: string; imeiScore?: string; boxScore?: string; fusionPayload?: string }>();

  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [analysis, setAnalysis]     = useState<FusionAnalysisComplete | null>(null);
  const [imeiLabel, setImeiLabel]   = useState("");
  const [extra, setExtra]           = useState<{ imeiAnalysis?: unknown; boxAnalysis?: unknown; stored?: boolean; message?: string }>({});

  // ── Fade-in global ──
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }
  }, [loading]);

  // ── Blink dot ──
  const blinkAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ─── Logic inchangée ────────────────────────────────────────────────────────
  const computeFromScores = useCallback(
    (imeiScore: number, boxScore: number) => {
      const score_global = Math.round(imeiScore * 0.5 + boxScore * 0.5);
      const verdict: FusionAnalysisComplete["verdict"] =
        score_global >= 70 ? "Authentique" : score_global >= 50 ? "Suspect" : "Invalide";
      const niveau_confiance: FusionAnalysisComplete["niveau_confiance"] =
        score_global >= 70 ? "Élevé" : score_global >= 50 ? "Moyen" : "Faible";
      const coherence: "oui" | "non" = Math.abs(imeiScore - boxScore) <= 25 ? "oui" : "non";
      const risque_global: FusionAnalysisComplete["risque_global"] =
        score_global >= 70 ? "Faible" : score_global >= 50 ? "Moyen" : "Élevé";
      const decision: FusionAnalysisComplete["decision"] = score_global >= 50 ? "STOCKER" : "REJETER";
      const raison =
        score_global >= 50
          ? `Score global ${score_global}% — résultat calculé localement à partir des scores IMEI (${imeiScore}%) et boîte (${boxScore}%).`
          : `Score global ${score_global}% — sous le seuil de 50%.`;

      const result: FusionAnalysisComplete = {
        score_imei_ai: imeiScore,
        score_box_ai: boxScore,
        score_global,
        verdict,
        niveau_confiance,
        coherence,
        forces: score_global >= 55 ? ["Scores disponibles pour synthèse"] : ["Analyse locale limitée"],
        faiblesses: score_global < 50 ? ["Score global insuffisant"] : [],
        recommandations:
          score_global >= 50
            ? ["Vérifier le détail sur l'écran précédent si besoin"]
            : ["Refaire une capture complète depuis Ajouter un téléphone"],
        risque_global,
        decision,
        raison,
      };
      setAnalysis(result);
      setLoading(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem("pending_fusion_result");
        if (raw && !cancelled) {
          const data = JSON.parse(raw) as PendingFusionPayload;
          await AsyncStorage.removeItem("pending_fusion_result");
          if (data.fusionAnalysis && typeof data.fusionAnalysis.score_global === "number") {
            setAnalysis(data.fusionAnalysis);
            setImeiLabel(data.imei ?? params.imei ?? "");
            setExtra({
              imeiAnalysis: data.imeiAnalysis,
              boxAnalysis: data.boxAnalysis,
              stored: data.stored,
              message: data.message,
            });
            setLoading(false);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return;
          }
          const layer2s = (data.imeiAnalysis as { layer2?: { score?: number } } | undefined)?.layer2?.score;
          const boxFinal = (data.boxAnalysis as { finalScore?: number } | undefined)?.finalScore;
          if (typeof layer2s === "number" && typeof boxFinal === "number") {
            computeFromScores(Math.round(layer2s), Math.round(boxFinal));
            setImeiLabel(data.imei ?? params.imei ?? "");
            setExtra({
              imeiAnalysis: data.imeiAnalysis,
              boxAnalysis: data.boxAnalysis,
              stored: data.stored,
              message: data.message,
            });
            return;
          }
        }
      } catch {
        /* fall through */
      }

      if (cancelled) return;

      if (params.fusionPayload) {
        try {
          const parsed = JSON.parse(params.fusionPayload) as FusionAnalysisComplete;
          if (typeof parsed.score_global === "number") {
            setAnalysis(parsed);
            setImeiLabel(params.imei ?? "");
            setLoading(false);
            return;
          }
        } catch {
          setError("Données fusion invalides.");
          setLoading(false);
          return;
        }
      }

      const imeiValue = Number(params.imeiScore || 0);
      const boxValue  = Number(params.boxScore  || 0);
      if (
        Number.isFinite(imeiValue) && imeiValue >= 0 && imeiValue <= 100 &&
        Number.isFinite(boxValue)  && boxValue  >= 0 && boxValue  <= 100
      ) {
        computeFromScores(imeiValue, boxValue);
        setImeiLabel(params.imei ?? "");
        return;
      }

      setError("Aucun résultat d'analyse disponible. Revenez depuis « Ajouter un téléphone ».");
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [params.fusionPayload, params.imeiScore, params.boxScore, params.imei, computeFromScores]);

  const reset = () => {
    setAnalysis(null);
    setError("");
    setExtra({});
    setImeiLabel("");
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Grid background */}
      <View style={styles.gridBg} pointerEvents="none" />
      <View style={styles.glowBg}   pointerEvents="none" />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 40 : 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={CYBER.accent} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <CyberLogo />
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <Text style={styles.headerTitle}>COMPARE-AI</Text>
            <Text style={styles.headerSub}>SYSTÈME D'ANALYSE MOBILE</Text>
          </View>
        </View>

        {/* Live dot */}
        <Animated.View style={[styles.liveDot, { opacity: blinkAnim }]} />
      </View>

      {/* Separator */}
      <View style={styles.headerSep} />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}>

        {/* ── Loading ── */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={CYBER.accent} size="large" />
            <Text style={styles.loadingText}>Chargement du rapport…</Text>
          </View>

        /* ── Error ── */
        ) : error ? (
          <CyberCard accentColor={CYBER.red} style={{ marginTop: 10 }}>
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={14} color={CYBER.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </CyberCard>

        /* ── Analysis ── */
        ) : analysis ? (
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* Decision banner */}
            <CyberCard
              accentColor={analysis.score_global >= 50 ? CYBER.green : CYBER.red}
              glow
              style={styles.decisionCard}
            >
              <View style={styles.decisionRow}>
                <View style={[styles.decisionIcon, {
                  borderColor: analysis.score_global >= 50 ? CYBER.green : CYBER.red,
                  backgroundColor: (analysis.score_global >= 50 ? CYBER.green : CYBER.red) + "18",
                }]}>
                  <Feather
                    name={analysis.score_global >= 50 ? "check-circle" : "x-circle"}
                    size={24}
                    color={analysis.score_global >= 50 ? CYBER.green : CYBER.red}
                  />
                </View>
                <View style={styles.decisionContent}>
                  <Text style={[styles.decisionTitle, {
                    color: analysis.score_global >= 50 ? CYBER.green : CYBER.red,
                  }]}>
                    {analysis.decision === "STOCKER" ? "DÉCISION : STOCKER" : "DÉCISION : REJETER"}
                  </Text>
                  <Text style={styles.decisionSubtext}>{analysis.raison}</Text>
                </View>
              </View>
              <View style={[styles.decisionBar, {
                backgroundColor: analysis.score_global >= 50 ? CYBER.green : CYBER.red,
              }]} />
            </CyberCard>

            {/* IMEI label */}
            {imeiLabel ? (
              <View style={styles.imeiRow}>
                <Text style={styles.imeiKey}>IMEI :</Text>
                <Text style={styles.imeiValue}>{imeiLabel}</Text>
              </View>
            ) : null}

            {/* Dual score cards */}
            <View style={styles.scoresContainer}>
              {[
                { label: "IMEI-AI", score: analysis.score_imei_ai },
                { label: "BOX-AI",  score: analysis.score_box_ai  },
              ].map((s, i) => (
                <CyberCard key={i} accentColor={scoreColor(s.score)} style={styles.scoreCard}>
                  <Text style={styles.scoreTitle}>{s.label}</Text>
                  <TrustGauge score={s.score} size={120} />
                  <Text style={[styles.scoreValue, { color: scoreColor(s.score) }]}>
                    {s.score}%
                  </Text>
                </CyberCard>
              ))}
            </View>

            {/* Global fusion score */}
            <CyberCard accentColor={scoreColor(analysis.score_global)} glow style={styles.fusionCard}>
              <SectionTitle icon="⬡" title="SCORE GLOBAL FUSIONNÉ (50/50)" color={scoreColor(analysis.score_global)} />
              <TrustGauge score={analysis.score_global} size={170} />
              <Text style={[styles.verdict, { color: scoreColor(analysis.score_global) }]}>
                {analysis.verdict.toUpperCase()}
              </Text>
              <View style={styles.badgeRow}>
                <CyberBadge label={`CONFIANCE : ${analysis.niveau_confiance.toUpperCase()}`} color={CYBER.accent} />
                <CyberBadge label={`RISQUE : ${analysis.risque_global.toUpperCase()}`}       color={scoreColor(analysis.score_global)} />
                <CyberBadge label={`COHÉRENCE : ${analysis.coherence === "oui" ? "OUI ✓" : "NON ✗"}`}
                  color={analysis.coherence === "oui" ? CYBER.green : CYBER.red} />
              </View>
            </CyberCard>

            {/* Forces */}
            <CyberCard accentColor={CYBER.border} style={styles.blockCard}>
              <SectionTitle icon="▲" title="FORCES DÉTECTÉES" color={CYBER.green} />
              {analysis.forces.map((t, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: CYBER.green, shadowColor: CYBER.green }]} />
                  <Text style={styles.bulletText}>{t}</Text>
                </View>
              ))}
            </CyberCard>

            {/* Faiblesses */}
            <CyberCard accentColor={CYBER.border} style={styles.blockCard}>
              <SectionTitle icon="▼" title="FAIBLESSES IDENTIFIÉES" color={CYBER.amber} />
              {analysis.faiblesses.length
                ? analysis.faiblesses.map((t, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <View style={[styles.bulletDot, { backgroundColor: CYBER.amber, shadowColor: CYBER.amber }]} />
                      <Text style={styles.bulletText}>{t}</Text>
                    </View>
                  ))
                : <Text style={styles.emptyText}>— Aucune faiblesse détectée —</Text>
              }
            </CyberCard>

            {/* Recommandations */}
            <CyberCard accentColor={CYBER.border} style={styles.blockCard}>
              <SectionTitle icon="◈" title="RECOMMANDATIONS" color={CYBER.accent} />
              {analysis.recommandations.map((t, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: CYBER.accent, shadowColor: CYBER.accent }]} />
                  <Text style={styles.bulletText}>{t}</Text>
                </View>
              ))}
            </CyberCard>

            {/* Message extra */}
            {extra.message ? (
              <Text style={styles.note}>{extra.message}</Text>
            ) : null}

            {/* IMEI detail */}
            {extra.imeiAnalysis != null ? (
              <CyberCard accentColor={CYBER.border} style={styles.blockCard}>
                <SectionTitle icon="▸" title="DÉTAIL IMEI (APERÇU)" color={CYBER.accent} />
                <Text style={styles.detailsText}>
                  {JSON.stringify(extra.imeiAnalysis, null, 2).slice(0, 4000)}
                </Text>
              </CyberCard>
            ) : null}

            {/* Box detail */}
            {extra.boxAnalysis != null ? (
              <CyberCard accentColor={CYBER.border} style={styles.blockCard}>
                <SectionTitle icon="▸" title="DÉTAIL BOÎTE (APERÇU)" color={CYBER.accent} />
                <Text style={styles.detailsText}>
                  {JSON.stringify(extra.boxAnalysis, null, 2).slice(0, 4000)}
                </Text>
              </CyberCard>
            ) : null}

          </Animated.View>
        ) : null}

        {/* ── Buttons (inchangés) ── */}
        <PrimaryButton title="Nouvelle analyse" onPress={reset} style={{ marginTop: 20 }} />
        <PrimaryButton title="Accueil" onPress={() => router.replace("/home")} variant="secondary" style={{ marginTop: 8 }} />

        {/* Footer */}
        <Text style={styles.footer}>COMPARE-AI v2.4 · SYSTÈME CERTIFIÉ ISO 27001</Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CYBER.bg,
  },

  // Background layers
  gridBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
    // Grid via SVG background would require a library; we emulate with subtle border tints
    backgroundColor: "transparent",
  },
  glowBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: CYBER.surface,
    borderWidth: 1,
    borderColor: CYBER.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: CYBER.accent,
    letterSpacing: 6,
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    fontSize: 8,
    color: CYBER.muted,
    letterSpacing: 3,
    marginTop: 2,
    fontFamily: "Inter_500Medium",
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: CYBER.green,
    shadowColor: CYBER.green,
    shadowRadius: 8,
    shadowOpacity: 1,
  },
  headerSep: {
    height: 1,
    marginHorizontal: 20,
    backgroundColor: CYBER.border,
    marginBottom: 20,
  },

  // Scroll
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 13,
    color: CYBER.muted,
    letterSpacing: 2,
    fontFamily: "Inter_500Medium",
  },

  // Error
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
    color: CYBER.red,
    fontFamily: "Inter_400Regular",
  },

  // IMEI row
  imeiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  imeiKey: {
    fontSize: 10,
    color: CYBER.muted,
    letterSpacing: 2,
    fontFamily: "Inter_500Medium",
  },
  imeiValue: {
    fontSize: 12,
    color: CYBER.accent,
    letterSpacing: 2,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },

  // Decision
  decisionCard: {
    marginBottom: 20,
  },
  decisionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  decisionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  decisionContent: { flex: 1 },
  decisionTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 4,
    fontFamily: "Inter_700Bold",
  },
  decisionSubtext: {
    fontSize: 11,
    color: CYBER.muted,
    lineHeight: 16,
    fontFamily: "Inter_500Medium",
  },
  decisionBar: {
    height: 2,
    borderRadius: 2,
    marginTop: 14,
    opacity: 0.7,
  },

  // Scores
  scoresContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  scoreCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
  },
  scoreTitle: {
    fontSize: 10,
    color: CYBER.muted,
    letterSpacing: 3,
    marginBottom: 12,
    fontFamily: "Inter_600SemiBold",
  },
  scoreValue: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },

  // Fusion
  fusionCard: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  verdict: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 3,
    fontFamily: "Inter_700Bold",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 14,
  },

  // Block cards
  blockCard: {
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  bulletText: {
    fontSize: 12,
    color: CYBER.text,
    lineHeight: 20,
    flex: 1,
    fontFamily: "Inter_400Regular",
    opacity: 0.85,
  },
  emptyText: {
    fontSize: 12,
    color: CYBER.muted,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },

  // Note
  note: {
    fontSize: 11,
    color: CYBER.muted,
    marginBottom: 12,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.5,
  },

  // Details
  detailsText: {
    fontSize: 10,
    color: CYBER.muted,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
  },

  // Cyber card base
  cyberCard: {
    backgroundColor: CYBER.card,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  cornerTL: {
    position: "absolute",
    top: 0, left: 0,
    width: 18, height: 18,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 16,
  },
  cornerBR: {
    position: "absolute",
    bottom: 0, right: 0,
    width: 18, height: 18,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 16,
  },

  // Badge
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    fontFamily: "Inter_600SemiBold",
  },

  // Section title
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionIcon: {
    fontSize: 13,
    color: CYBER.accent,
  },
  sectionTitleText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3,
    fontFamily: "Inter_700Bold",
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },

  // Footer
  footer: {
    textAlign: "center",
    marginTop: 28,
    fontSize: 8,
    color: CYBER.muted,
    letterSpacing: 2,
    opacity: 0.5,
    fontFamily: "Inter_400Regular",
  },
});
