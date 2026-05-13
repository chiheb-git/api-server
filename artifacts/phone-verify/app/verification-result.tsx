import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Layer {
  score: number;
  status: string;
  detail: string;
}

interface AnalysisResult {
  stored: boolean;
  message?: string;
  fusionScore?: number;
  verdict?: string;
  confidence?: string;
  explanation?: string;
  imeiAIScore?: number;
  boxAIScore?: number;
  agreement?: string;
  imeiAnalysis?: {
    layer1?: { matchPercentage?: number; ocrConfidence?: number; extractedImei?: string; message?: string; verified?: boolean };
    layer2?: { score?: number; message?: string };
    layer3?: { message?: string; forgeryDetected?: boolean };
  };
  boxAnalysis?: {
    finalScore: number;
    verdict: string;
    verdictMessage: string;
    layers: {
      layer1: Layer; layer2: Layer; layer3: Layer; layer4: Layer;
      layer5: Layer; layer6: Layer; layer7: Layer; layer8: Layer;
    };
  };
  fusionAnalysis?: {
    fusionScore: number;
    verdict: string;
    confidence: string;
    explanation: string;
    imeiAIScore: number;
    boxAIScore: number;
    agreement: string;
  };
}

const BOX_LAYER_NAMES: Record<string, string> = {
  layer1: "3D Object Detection",
  layer2: "Natural Lighting",
  layer3: "Material Texture",
  layer4: "IMEI Sticker Detection",
  layer5: "Print Quality",
  layer6: "Natural Defects",
  layer7: "Scene Coherence",
  layer8: "Fraud Detection",
};

const BOX_LAYER_ICONS: Record<string, string> = {
  layer1: "box",
  layer2: "sun",
  layer3: "layers",
  layer4: "tag",
  layer5: "zoom-in",
  layer6: "alert-circle",
  layer7: "image",
  layer8: "shield-off",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "PASS") return <Feather name="check-circle" size={16} color="#16a34a" />;
  if (status === "FAIL") return <Feather name="x-circle" size={16} color="#dc2626" />;
  return <Feather name="alert-triangle" size={16} color="#d97706" />;
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: score, duration: 800, useNativeDriver: false }).start();
  }, [score, anim]);
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { width, backgroundColor: color }]} />
    </View>
  );
}

function CollapsibleSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setOpen(!open)}>
        <Feather name={icon as any} size={18} color="#00BFA5" />
        <Text style={styles.sectionTitle}>{title}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color="#6b7280" />
      </TouchableOpacity>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

export default function VerificationResultScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ result: string }>();
  const gaugeAnim = useRef(new Animated.Value(0)).current;

  const result: AnalysisResult | null = params.result
    ? (JSON.parse(params.result) as AnalysisResult)
    : null;

  const fusion = result?.fusionAnalysis ?? (result && "fusionScore" in result
    ? {
        fusionScore: result.fusionScore ?? 0,
        verdict: result.verdict ?? "",
        confidence: result.confidence ?? "",
        explanation: result.explanation ?? "",
        imeiAIScore: result.imeiAIScore ?? 0,
        boxAIScore: result.boxAIScore ?? 0,
        agreement: result.agreement ?? "",
      }
    : null);

  const fusionScore = fusion?.fusionScore ?? 0;
  const stored = result?.stored ?? false;

  useEffect(() => {
    Animated.timing(gaugeAnim, {
      toValue: fusionScore,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [fusionScore, gaugeAnim]);

  const gaugeColor = fusionScore >= 70 ? "#00BFA5" : fusionScore >= 50 ? "#f59e0b" : "#ef4444";

  const gaugeWidth = gaugeAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  if (!result || !fusion) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.foreground }}>No result data found.</Text>
        <TouchableOpacity onPress={() => router.replace("/home")} style={styles.homeBtn}>
          <Text style={styles.homeBtnText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 40 : 16), backgroundColor: stored ? "#00BFA5" : "#ef4444" }]}>
        <Feather name={stored ? "check-circle" : "x-circle"} size={24} color="#fff" />
        <Text style={styles.headerTitle}>
          {stored ? "✅ Device Added Successfully" : "❌ Device Not Added"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}>

        {/* Fusion Score Gauge */}
        <View style={styles.gaugeCard}>
          <Text style={styles.gaugeLabel}>Fusion AI Score</Text>
          <Text style={[styles.gaugeNumber, { color: gaugeColor }]}>{fusionScore}%</Text>
          <View style={styles.gaugeTrack}>
            <Animated.View style={[styles.gaugeFill, { width: gaugeWidth, backgroundColor: gaugeColor }]} />
          </View>
          <Text style={[styles.gaugeThreshold, { color: fusionScore >= 50 ? "#16a34a" : "#dc2626" }]}>
            {fusionScore >= 50 ? "✅ Above 50% threshold — Added to database" : "❌ Below 50% threshold — Not added to database"}
          </Text>

          {/* Badges */}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: gaugeColor + "22", borderColor: gaugeColor }]}>
              <Text style={[styles.badgeText, { color: gaugeColor }]}>{fusion.verdict}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "#6b728022", borderColor: "#6b7280" }]}>
              <Text style={[styles.badgeText, { color: "#6b7280" }]}>{fusion.confidence}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "#6b728022", borderColor: "#6b7280" }]}>
              <Text style={[styles.badgeText, { color: "#6b7280" }]}>{fusion.agreement}</Text>
            </View>
          </View>
          <Text style={styles.explanationText}>"{fusion.explanation}"</Text>
        </View>

        {/* AI Scores Comparison */}
        <View style={styles.scoresCard}>
          <Text style={styles.scoresTitle}>AI Scores Comparison</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>🔍 IMEI AI (Gallery)</Text>
            <ScoreBar score={fusion.imeiAIScore} color="#00BFA5" />
            <Text style={[styles.scorePct, { color: "#00BFA5" }]}>{fusion.imeiAIScore}%</Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>📦 Box AI (Camera)</Text>
            <ScoreBar score={fusion.boxAIScore} color="#2563eb" />
            <Text style={[styles.scorePct, { color: "#2563eb" }]}>{fusion.boxAIScore}%</Text>
          </View>
        </View>

        {/* AI 1 — IMEI Analysis */}
        {result.imeiAnalysis && (
          <CollapsibleSection title="AI 1 — IMEI Scanner Results" icon="smartphone">
            <View style={styles.layerRow}>
              <StatusIcon status={result.imeiAnalysis.layer1?.verified ? "PASS" : "FAIL"} />
              <View style={{ flex: 1 }}>
                <Text style={styles.layerName}>Layer 1 — OCR Extraction</Text>
                <Text style={styles.layerDetail}>
                  Extracted: {result.imeiAnalysis.layer1?.extractedImei ?? "N/A"}
                </Text>
                <Text style={styles.layerDetail}>
                  Match: {result.imeiAnalysis.layer1?.matchPercentage ?? 0}% | OCR Confidence: {result.imeiAnalysis.layer1?.ocrConfidence ?? 0}%
                </Text>
              </View>
              <Text style={[styles.layerScore, { color: (result.imeiAnalysis.layer1?.matchPercentage ?? 0) >= 50 ? "#16a34a" : "#dc2626" }]}>
                {result.imeiAnalysis.layer1?.matchPercentage ?? 0}%
              </Text>
            </View>

            <View style={styles.layerRow}>
              <StatusIcon status={(result.imeiAnalysis.layer2?.score ?? 0) >= 50 ? "PASS" : "FAIL"} />
              <View style={{ flex: 1 }}>
                <Text style={styles.layerName}>Layer 2 — Trust Score</Text>
                <Text style={styles.layerDetail}>{result.imeiAnalysis.layer2?.message ?? ""}</Text>
              </View>
              <Text style={[styles.layerScore, { color: (result.imeiAnalysis.layer2?.score ?? 0) >= 50 ? "#16a34a" : "#dc2626" }]}>
                {result.imeiAnalysis.layer2?.score ?? 0}%
              </Text>
            </View>

            <View style={styles.layerRow}>
              <StatusIcon status={result.imeiAnalysis.layer3?.forgeryDetected ? "FAIL" : "PASS"} />
              <View style={{ flex: 1 }}>
                <Text style={styles.layerName}>Layer 3 — Forgery Detection</Text>
                <Text style={styles.layerDetail}>{result.imeiAnalysis.layer3?.message ?? ""}</Text>
              </View>
              <Text style={[styles.layerScore, { color: result.imeiAnalysis.layer3?.forgeryDetected ? "#dc2626" : "#16a34a" }]}>
                {result.imeiAnalysis.layer3?.forgeryDetected ? "FORGED" : "CLEAN"}
              </Text>
            </View>
          </CollapsibleSection>
        )}

        {/* AI 2 — Box Analysis */}
        {result.boxAnalysis && (
          <CollapsibleSection title="AI 2 — Box Verifier Results" icon="box">
            <View style={styles.boxSummary}>
              <Text style={styles.boxScore}>{result.boxAnalysis.finalScore}%</Text>
              <Text style={[styles.boxVerdict, { color: result.boxAnalysis.finalScore >= 75 ? "#16a34a" : result.boxAnalysis.finalScore >= 50 ? "#d97706" : "#dc2626" }]}>
                {result.boxAnalysis.verdict}
              </Text>
            </View>

            {Object.entries(result.boxAnalysis.layers).map(([key, layer]) => (
              <View key={key} style={styles.layerRow}>
                <StatusIcon status={layer.status} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.layerName}>
                    {BOX_LAYER_NAMES[key] ?? key}
                  </Text>
                  <Text style={styles.layerDetail}>{layer.detail}</Text>
                </View>
                <Text style={[styles.layerScore, {
                  color: layer.status === "PASS" ? "#16a34a" : layer.status === "FAIL" ? "#dc2626" : "#d97706"
                }]}>
                  {layer.score}%
                </Text>
              </View>
            ))}
          </CollapsibleSection>
        )}

        {/* Final Decision */}
        <View style={[styles.finalCard, { backgroundColor: stored ? "#f0fdf4" : "#fef2f2", borderColor: stored ? "#16a34a" : "#dc2626" }]}>
          <Feather name={stored ? "check-circle" : "x-circle"} size={32} color={stored ? "#16a34a" : "#dc2626"} />
          <Text style={[styles.finalTitle, { color: stored ? "#16a34a" : "#dc2626" }]}>
            {stored ? "✅ ADDED TO DATABASE" : "❌ NOT ADDED TO DATABASE"}
          </Text>
          <Text style={styles.finalMessage}>
            {stored
              ? "Device is registered in our security database. It will appear as NOT SECURE when searched."
              : `Score ${fusionScore}% is below the 50% threshold. Device was not registered.`}
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          {!stored && (
            <TouchableOpacity style={[styles.btn, { backgroundColor: "#ef4444" }]} onPress={() => router.back()}>
              <Feather name="refresh-cw" size={18} color="#fff" />
              <Text style={styles.btnText}>Try Again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#00BFA5" }]} onPress={() => router.replace("/home")}>
            <Feather name="home" size={18} color="#fff" />
            <Text style={styles.btnText}>Go Home</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  scroll: { padding: 16 },
  gaugeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  gaugeLabel: { fontSize: 13, color: "#6b7280", fontFamily: "Inter_400Regular", marginBottom: 4 },
  gaugeNumber: { fontSize: 48, fontWeight: "700", fontFamily: "Inter_700Bold" },
  gaugeTrack: { width: "100%", height: 12, borderRadius: 99, backgroundColor: "#e5e7eb", overflow: "hidden", marginVertical: 12 },
  gaugeFill: { height: 12, borderRadius: 99 },
  gaugeThreshold: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 10 },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  explanationText: { fontSize: 13, color: "#374151", fontFamily: "Inter_400Regular", textAlign: "center", fontStyle: "italic" },
  scoresCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#e5e7eb" },
  scoresTitle: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 14 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  scoreLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#374151", width: 110 },
  barTrack: { flex: 1, height: 8, borderRadius: 99, backgroundColor: "#e5e7eb", overflow: "hidden" },
  barFill: { height: 8, borderRadius: 99 },
  scorePct: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", width: 36, textAlign: "right" },
  section: { backgroundColor: "#fff", borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#111827" },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16 },
  layerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  layerName: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 2 },
  layerDetail: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6b7280", lineHeight: 16 },
  layerScore: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold", minWidth: 50, textAlign: "right" },
  boxSummary: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", marginBottom: 4 },
  boxScore: { fontSize: 32, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#111827" },
  boxVerdict: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  finalCard: { borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 2, alignItems: "center", gap: 8 },
  finalTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", textAlign: "center" },
  finalMessage: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151", textAlign: "center", lineHeight: 18 },
  buttons: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  homeBtn: { marginTop: 16, backgroundColor: "#00BFA5", padding: 12, borderRadius: 10 },
  homeBtnText: { color: "#fff", fontWeight: "700", fontFamily: "Inter_700Bold" },
});
