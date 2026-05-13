import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, ScrollView } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { PrimaryButton } from "@/components/PrimaryButton";
import { LayerResult } from "@/components/LayerResult";
import { TrustGauge } from "@/components/TrustGauge";

interface LayerResponse {
  score: number;
  status: "PASS" | "WARN" | "FAIL";
  detail: string;
}

interface BoxVerifyResponse {
  layers: {
    layer1: LayerResponse;
    layer2: LayerResponse;
    layer3: LayerResponse;
    layer4: LayerResponse;
    layer5: LayerResponse;
    layer6: LayerResponse;
    layer7: LayerResponse;
    layer8: LayerResponse;
  };
  finalScore: number;
  verdict: "AUTHENTIC" | "SUSPICIOUS" | "FAKE";
  verdictMessage: string;
}

const BASE_URL = process.env["EXPO_PUBLIC_DOMAIN"] ? `http://${process.env["EXPO_PUBLIC_DOMAIN"]}` : "";

export default function BoxVerifyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [frontBase64, setFrontBase64] = useState<string | null>(null);
  const [angleUri, setAngleUri] = useState<string | null>(null);
  const [angleBase64, setAngleBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BoxVerifyResponse | null>(null);
  const [error, setError] = useState("");
  const [visibleLayers, setVisibleLayers] = useState(0);

  const captureStep: 1 | 2 = frontBase64 ? 2 : 1;
  const overlayText = captureStep === 1 ? "Position box facing camera" : "Tilt the box slightly";
  const progressText = loading ? "Analyzing..." : frontBase64 && angleBase64 ? "Photo 2/2" : frontBase64 ? "Photo 1/2" : "Photo 0/2";

  const layers = useMemo(() => {
    if (!result) return [];
    const labels = [
      "3D Object Detection",
      "Natural Light and Shadow",
      "Material Texture",
      "IMEI Sticker Detection",
      "Print Quality",
      "Natural Defects",
      "Scene Coherence",
      "Screen/Print Fraud Detection",
    ];
    const layerValues = [
      result.layers.layer1,
      result.layers.layer2,
      result.layers.layer3,
      result.layers.layer4,
      result.layers.layer5,
      result.layers.layer6,
      result.layers.layer7,
      result.layers.layer8,
    ];
    return [
      ...layerValues.map((layer, index) => ({
        layer: index + 1,
        name: labels[index]!,
        score: layer.score,
        status: layer.status,
        detail: layer.detail,
      })),
    ];
  }, [result]);

  useEffect(() => {
    if (!result) return;
    setVisibleLayers(0);
    const id = setInterval(() => {
      setVisibleLayers((prev) => {
        if (prev >= 8) {
          clearInterval(id);
          return prev;
        }
        return prev + 1;
      });
    }, 260);
    return () => clearInterval(id);
  }, [result]);

  const toBase64 = async (uri: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      const response = await fetch(uri);
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Invalid file reader result")));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
    return `data:image/jpeg;base64,${b64}`;
  };

  const takePhoto = async () => {
    setError("");
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Please allow camera access.");
      return;
    }

    const photo = await ImagePicker.launchCameraAsync({ quality: 0.85, base64: false });
    if (photo.canceled || !photo.assets[0]) return;

    const uri = photo.assets[0].uri;
    const base64 = await toBase64(uri);
    if (!base64) {
      setError("Failed to process photo. Please retry.");
      return;
    }

    if (captureStep === 1) {
      setFrontUri(uri);
      setFrontBase64(base64);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      setAngleUri(uri);
      setAngleBase64(base64);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };

  const runAnalysis = async () => {
    if (!frontBase64 || !angleBase64) {
      setError("Please capture both required photos.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE_URL}/api/box-verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ frontImage: frontBase64, angleImage: angleBase64 }),
      });
      const data = await res.json() as BoxVerifyResponse | { message?: string };
      if (!res.ok) {
        setError("message" in data ? (data.message ?? "Box verification failed.") : "Box verification failed.");
      } else {
        setResult(data as BoxVerifyResponse);
      }
    } catch {
      setError("Network error while running verification.");
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setFrontUri(null);
    setFrontBase64(null);
    setAngleUri(null);
    setAngleBase64(null);
    setLoading(false);
    setResult(null);
    setError("");
    setVisibleLayers(0);
  };

  const verdictColor = result?.verdict.includes("AUTHENTIC")
    ? colors.primary
    : result?.verdict.includes("SUSPICIOUS")
      ? colors.warning
      : colors.highRisk;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 40 : 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.muted }]}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Box Verify</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}>
        {!result ? (
          <>
            <View style={[styles.overlayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.progress, { color: colors.primary }]}>{progressText}</Text>
              <Text style={[styles.overlayText, { color: colors.foreground }]}>{overlayText}</Text>
              <Text style={[styles.overlaySub, { color: colors.mutedForeground }]}>
                Camera-only capture flow is enabled for box authenticity validation.
              </Text>
            </View>

            <TouchableOpacity style={[styles.cameraCard, { borderColor: colors.border }]} onPress={takePhoto} activeOpacity={0.9}>
              <Feather name="camera" size={30} color={colors.primary} />
              <Text style={[styles.cameraTitle, { color: colors.foreground }]}>
                {captureStep === 1 ? "Take Front Photo" : "Take Angle Photo"}
              </Text>
              <Text style={[styles.cameraSub, { color: colors.mutedForeground }]}>
                {captureStep === 1 ? "Step 1 of 2" : "Step 2 of 2"}
              </Text>
            </TouchableOpacity>

            <View style={styles.previewRow}>
              <View style={[styles.previewCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>Front Photo</Text>
                {frontUri ? <Image source={{ uri: frontUri }} style={styles.previewImage} contentFit="cover" /> : <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Not captured</Text>}
              </View>
              <View style={[styles.previewCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>Angle Photo</Text>
                {angleUri ? <Image source={{ uri: angleUri }} style={styles.previewImage} contentFit="cover" /> : <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Not captured</Text>}
              </View>
            </View>

            {error ? (
              <View style={[styles.errorBanner, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
                <Feather name="alert-circle" size={14} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            <PrimaryButton title="Analyze Box" onPress={runAnalysis} disabled={!frontBase64 || !angleBase64 || loading} loading={loading} style={{ marginTop: 16 }} />
            {loading ? (
              <View style={styles.loadingInfo}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Running 8-layer camera box analysis...</Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={[styles.resultBanner, { borderColor: verdictColor, backgroundColor: colors.card }]}>
              <Text style={[styles.resultTitle, { color: verdictColor }]}>{result.verdict}</Text>
              <Text style={[styles.resultSub, { color: colors.mutedForeground }]}>{result.verdictMessage}</Text>
              <TrustGauge score={result.finalScore} size={150} />
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>8-Layer Analysis</Text>
            {layers.slice(0, visibleLayers).map((layer) => (
              <LayerResult
                key={layer.layer}
                layerNumber={layer.layer}
                title={layer.name}
                passed={layer.status === "PASS"}
                details={[
                  { label: "Score", value: `${layer.score}/100` },
                  { label: "Status", value: layer.status },
                  { label: "Details", value: layer.detail },
                ]}
              />
            ))}

            <PrimaryButton title="Verify Another Box" onPress={resetAll} style={{ marginTop: 8 }} />
            <PrimaryButton title="Back to Home" onPress={() => router.replace("/home")} variant="secondary" style={{ marginTop: 10 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  overlayCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  progress: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
  overlayText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  overlaySub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  cameraCard: {
    borderWidth: 1,
    borderRadius: 16,
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  cameraTitle: {
    marginTop: 8,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  cameraSub: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  previewRow: {
    flexDirection: "row",
    gap: 10,
  },
  previewCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    minHeight: 130,
  },
  previewLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
  },
  previewImage: {
    width: "100%",
    height: 88,
    borderRadius: 8,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 30,
    textAlign: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
    fontFamily: "Inter_400Regular",
  },
  loadingInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 14,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  resultBanner: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    marginBottom: 14,
  },
  resultTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
  },
  resultSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
});
