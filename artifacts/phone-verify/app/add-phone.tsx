import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { StyledInput } from "@/components/StyledInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TrustGauge } from "@/components/TrustGauge";
import { LayerResult } from "@/components/LayerResult";

interface AnalysisResult {
  success: boolean;
  imei: string;
  needsManualConfirmation?: boolean;
  layer1: {
    extractedImei: string;
    matchPercentage: number;
    verified: boolean;
    message: string;
    ocrConfidence?: number;
    needsManualConfirmation?: boolean;
    manuallyConfirmed?: boolean;
  };
  layer2?: {
    score: number;
    riskLevel: string;
    breakdown: {
      imeiPhotoMatch: number;
      tacCoherence: number;
      imageQuality: number;
      registrationMetadata: number;
      geographicBaseline: number;
    };
  } | null;
  layer3?: {
    forgeryDetected: boolean;
    fontInconsistency: boolean;
    colorAnomaly: boolean;
    edgeVariance: boolean;
    barcodeAlignment: boolean;
    message: string;
  } | null;
  trustScore: number;
  finalVerdict: string;
  message: string;
  savedToDatabase: boolean;
}

const BASE_URL = process.env["EXPO_PUBLIC_DOMAIN"] ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}` : "";

export default function AddPhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [imei, setImei] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [confirmedImei, setConfirmedImei] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const convertAndSetBase64 = async (uri: string) => {
    if (Platform.OS === "web") {
      // On web, the URI is a blob: or data: URL — fetch and convert to base64
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        await new Promise<void>((resolve, reject) => {
          reader.onloadend = () => {
            if (typeof reader.result === "string") {
              setImageBase64(reader.result);
              resolve();
            } else {
              reject(new Error("FileReader returned unexpected type"));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        setError("Could not read image. Please try a different photo.");
      }
    } else {
      // On native, read directly from filesystem as base64
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setImageBase64(`data:image/jpeg;base64,${b64}`);
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.8,
      base64: false,
    });

    if (!picked.canceled && picked.assets[0]) {
      setImageUri(picked.assets[0].uri);
      await convertAndSetBase64(picked.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera permission needed", "Please allow camera access.");
      return;
    }

    const photo = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: false,
    });

    if (!photo.canceled && photo.assets[0]) {
      setImageUri(photo.assets[0].uri);
      await convertAndSetBase64(photo.assets[0].uri);
    }
  };

  const submitAnalysis = async (withConfirmation?: string) => {
    setError("");
    setLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const body: Record<string, string> = { imei, imageBase64: imageBase64! };
      if (brand) body["brand"] = brand;
      if (model) body["model"] = model;
      if (withConfirmation) body["confirmedImei"] = withConfirmation;

      const res = await fetch(`${BASE_URL}/api/phones`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json() as AnalysisResult;

      // Backend says OCR is low confidence and needs manual confirmation
      if (data.needsManualConfirmation && !withConfirmation) {
        setNeedsConfirmation(true);
        setResult(data);
        return;
      }

      setNeedsConfirmation(false);
      setResult(data);

      if (data.success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setError("");
    setResult(null);
    setNeedsConfirmation(false);
    setConfirmedImei("");

    if (!imei || !/^\d{15}$/.test(imei)) {
      setError("IMEI must be exactly 15 digits");
      return;
    }
    if (!imageBase64) {
      setError("Please select or take a photo of the IMEI sticker");
      return;
    }

    await submitAnalysis();
  };

  const handleConfirm = async () => {
    setError("");
    const confirmDigits = confirmedImei.replace(/\D/g, "");
    if (confirmDigits.length !== 15) {
      setError("Confirmed IMEI must be exactly 15 digits");
      return;
    }
    await submitAnalysis(confirmDigits);
  };

  const handleReset = () => {
    setResult(null);
    setImei("");
    setBrand("");
    setModel("");
    setImageUri(null);
    setImageBase64(null);
    setError("");
    setConfirmedImei("");
    setNeedsConfirmation(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 40 : 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.muted }]}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Add Phone</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}>
        {(!result || needsConfirmation) ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Device Information</Text>

            <StyledInput
              label="IMEI Code"
              placeholder="15-digit IMEI (e.g. 358392049957572)"
              value={imei}
              onChangeText={(t) => setImei(t.replace(/\D/g, "").slice(0, 15))}
              keyboardType="numeric"
              maxLength={15}
            />

            <StyledInput
              label="Brand (optional)"
              placeholder="e.g. Apple, Samsung"
              value={brand}
              onChangeText={setBrand}
            />

            <StyledInput
              label="Model (optional)"
              placeholder="e.g. iPhone 14, Galaxy S23"
              value={model}
              onChangeText={setModel}
            />

            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 4 }]}>
              IMEI Sticker Photo
            </Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Take or upload a clear photo of the IMEI sticker on your device
            </Text>

            {imageUri ? (
              <View style={styles.imagePreviewWrapper}>
                <Image
                  source={{ uri: imageUri }}
                  style={[styles.imagePreview, { borderColor: colors.border }]}
                  contentFit="cover"
                />
                <TouchableOpacity
                  style={[styles.removeImage, { backgroundColor: colors.highRisk }]}
                  onPress={() => { setImageUri(null); setImageBase64(null); }}
                >
                  <Feather name="x" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imageButtons}>
                <TouchableOpacity
                  style={[styles.imageBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={takePhoto}
                >
                  <Feather name="camera" size={22} color={colors.primary} />
                  <Text style={[styles.imageBtnText, { color: colors.foreground }]}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.imageBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={pickImage}
                >
                  <Feather name="image" size={22} color={colors.primary} />
                  <Text style={[styles.imageBtnText, { color: colors.foreground }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Manual confirmation card — shown when OCR confidence is too low */}
            {needsConfirmation && result && (
              <View style={[styles.confirmCard, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
                <View style={styles.confirmHeader}>
                  <Feather name="eye" size={18} color="#d97706" />
                  <Text style={[styles.confirmTitle, { color: "#d97706" }]}>
                    Manual Confirmation Required
                  </Text>
                </View>
                <Text style={[styles.confirmDesc, { color: colors.mutedForeground }]}>
                  OCR confidence was too low ({Math.round(result.layer1.ocrConfidence ?? 0)}%) to read the IMEI automatically.
                  Please type the 15-digit IMEI exactly as you see it printed on the sticker photo.
                </Text>
                {result.layer1.extractedImei && result.layer1.extractedImei !== "Unable to extract" && (
                  <Text style={[styles.ocrHint, { color: colors.mutedForeground }]}>
                    OCR read: <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>{result.layer1.extractedImei}</Text>
                  </Text>
                )}
                <StyledInput
                  label="Confirm IMEI from photo"
                  placeholder="Type the 15-digit IMEI you see"
                  value={confirmedImei}
                  onChangeText={(t) => setConfirmedImei(t.replace(/\D/g, "").slice(0, 15))}
                  keyboardType="numeric"
                  maxLength={15}
                />
                <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
                  {confirmedImei.length}/15 digits
                </Text>
              </View>
            )}

            {error ? (
              <View style={[styles.errorBanner, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
                <Feather name="alert-circle" size={14} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            {needsConfirmation ? (
              <PrimaryButton
                title="Verify with Manual IMEI"
                onPress={handleConfirm}
                loading={loading}
                style={{ marginTop: 12 }}
              />
            ) : (
              <PrimaryButton
                title="Confirm & Analyze"
                onPress={handleAnalyze}
                loading={loading}
                style={{ marginTop: 20 }}
              />
            )}

            {loading && (
              <View style={styles.loadingInfo}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  {needsConfirmation ? "Verifying manual confirmation..." : "Running 3-layer AI analysis..."}
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Result View */}
            <View style={[
              styles.verdictBanner,
              { backgroundColor: result.success ? "#f0fdf4" : "#fef2f2", borderColor: result.success ? "#bbf7d0" : "#fecaca" }
            ]}>
              <Feather
                name={result.success ? "check-circle" : "x-circle"}
                size={28}
                color={result.success ? colors.primary : colors.highRisk}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.verdictTitle, { color: result.success ? colors.primary : colors.highRisk }]}>
                  {result.success ? "Phone Successfully Verified" : "Verification Failed"}
                </Text>
                <Text style={[styles.verdictMessage, { color: colors.mutedForeground }]}>{result.message}</Text>
              </View>
            </View>

            {/* Trust Score */}
            {result.layer2 && (
              <View style={[styles.gaugeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.gaugeTitle, { color: colors.foreground }]}>Trust Score</Text>
                <TrustGauge score={Math.round(result.trustScore)} size={160} />
                <Text style={[styles.gaugeRisk, { color: colors.mutedForeground }]}>{result.layer2.riskLevel}</Text>
              </View>
            )}

            {/* Layer Results */}
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 4 }]}>Analysis Layers</Text>

            {result.layer1 && (
              <LayerResult
                layerNumber={1}
                title="IMEI / Photo Correlation (OCR)"
                passed={result.layer1.verified}
                details={[
                  { label: "Extracted IMEI", value: result.layer1.extractedImei },
                  { label: "Match Accuracy", value: `${result.layer1.matchPercentage}%` },
                  { label: "OCR Confidence", value: `${Math.round(result.layer1.ocrConfidence ?? 0)}%` },
                  { label: "Status", value: result.layer1.message },
                ]}
              />
            )}

            {result.layer2 && (
              <LayerResult
                layerNumber={2}
                title="Trust Score Calculation"
                passed={result.layer2.score > 70}
                details={[
                  { label: "IMEI/Photo Match", value: `${result.layer2.breakdown.imeiPhotoMatch}/35` },
                  { label: "TAC Coherence", value: `${result.layer2.breakdown.tacCoherence}/25` },
                  { label: "Image Quality", value: `${result.layer2.breakdown.imageQuality}/20` },
                  { label: "Registration Metadata", value: `${result.layer2.breakdown.registrationMetadata}/10` },
                  { label: "Geographic Baseline", value: `${result.layer2.breakdown.geographicBaseline}/10` },
                  { label: "Total Score", value: `${result.layer2.score}/100` },
                ]}
              />
            )}

            {result.layer3 && (
              <LayerResult
                layerNumber={3}
                title="Physical Forgery Detection"
                passed={!result.layer3.forgeryDetected}
                details={[
                  { label: "Font Inconsistency", value: result.layer3.fontInconsistency },
                  { label: "Color Anomaly", value: result.layer3.colorAnomaly },
                  { label: "Edge Variance", value: result.layer3.edgeVariance },
                  { label: "Barcode Misalignment", value: result.layer3.barcodeAlignment },
                  { label: "Result", value: result.layer3.message },
                ]}
              />
            )}

            <PrimaryButton title="Analyze Another Phone" onPress={handleReset} style={{ marginTop: 8 }} />
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 14,
    marginTop: -8,
  },
  imageButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  imageBtn: {
    flex: 1,
    height: 80,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  imageBtnText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  imagePreviewWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  imagePreview: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    borderWidth: 1,
  },
  removeImage: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    marginTop: 8,
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
  confirmCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
    marginBottom: 4,
    gap: 10,
  },
  confirmHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  confirmDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  ocrHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  charCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    marginTop: -6,
  },
  verdictBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  verdictTitle: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  verdictMessage: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  gaugeCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  gaugeTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 16,
  },
  gaugeRisk: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 10,
  },
});
