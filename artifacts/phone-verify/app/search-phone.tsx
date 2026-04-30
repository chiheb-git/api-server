import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { StyledInput } from "@/components/StyledInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TrustGauge } from "@/components/TrustGauge";

interface StoredPhone {
  id: number;
  imei: string;
  brand?: string;
  model?: string;
  trustScore: number;
  layer1Score: number;
  layer2Score: number;
  layer3Result: string;
  finalVerdict: string;
  verificationCount: number;
  createdAt: string;
}

interface SearchResult {
  found: boolean;
  imei: string;
  isSecure: boolean;
  message: string;
  searchCount: number;
  phone?: StoredPhone;
}

const BASE_URL = process.env["EXPO_PUBLIC_DOMAIN"] ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}` : "";

export default function SearchPhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [imei, setImei] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    setError("");
    setResult(null);

    if (!imei || !/^\d{15}$/.test(imei)) {
      setError("IMEI must be exactly 15 digits");
      return;
    }

    setLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await fetch(`${BASE_URL}/api/phones/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imei }),
      });

      const data = await res.json() as SearchResult;
      setResult(data);

      if (!data.isSecure) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setImei("");
    setError("");
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 40 : 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.muted }]}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Search Phone</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}>
        {!result ? (
          <>
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="search" size={20} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                Enter an IMEI to check if this device has been reported in our security database.
              </Text>
            </View>

            <StyledInput
              label="IMEI Code"
              placeholder="15-digit IMEI (e.g. 358392049957572)"
              value={imei}
              onChangeText={(t) => setImei(t.replace(/\D/g, "").slice(0, 15))}
              keyboardType="numeric"
              maxLength={15}
            />

            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{imei.length}/15 digits</Text>

            {error ? (
              <View style={[styles.errorBanner, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
                <Feather name="alert-circle" size={14} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            <PrimaryButton
              title="Verify IMEI"
              onPress={handleSearch}
              loading={loading}
              style={{ marginTop: 16 }}
            />

            {loading && (
              <View style={styles.loadingInfo}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  Searching database...
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Security verdict */}
            <View style={[
              styles.verdictCard,
              {
                backgroundColor: result.isSecure ? "#f0fdf4" : "#fef2f2",
                borderColor: result.isSecure ? "#bbf7d0" : "#fecaca",
              }
            ]}>
              <View style={[
                styles.verdictIcon,
                { backgroundColor: result.isSecure ? colors.primary : colors.highRisk }
              ]}>
                <Feather name={result.isSecure ? "shield" : "alert-triangle"} size={32} color="#fff" />
              </View>
              <Text style={[styles.verdictHeading, { color: result.isSecure ? colors.primary : colors.highRisk }]}>
                {result.isSecure ? "PHONE IS SECURE" : "PHONE IS NOT SECURE"}
              </Text>
              <Text style={[styles.verdictMessage, { color: colors.mutedForeground }]}>{result.message}</Text>
              <View style={[styles.verdictMeta, { borderTopColor: result.isSecure ? "#bbf7d0" : "#fecaca" }]}>
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  IMEI: {result.imei}
                </Text>
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  Searched {result.searchCount} {result.searchCount === 1 ? "time" : "times"}
                </Text>
              </View>
            </View>

            {/* Detailed info if found */}
            {result.found && result.phone && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Stored Analysis</Text>

                <View style={[styles.gaugeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.gaugeLabel, { color: colors.foreground }]}>Trust Score at Registration</Text>
                  <TrustGauge score={Math.round(result.phone.trustScore)} size={140} />
                </View>

                <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.detailCardTitle, { color: colors.foreground }]}>Device Details</Text>

                  {[
                    { label: "IMEI", value: result.phone.imei },
                    { label: "Brand", value: result.phone.brand ?? "Unknown" },
                    { label: "Model", value: result.phone.model ?? "Unknown" },
                    { label: "Trust Score", value: `${result.phone.trustScore}/100` },
                    { label: "Layer 1 Match", value: `${result.phone.layer1Score}%` },
                    { label: "Layer 2 Score", value: `${result.phone.layer2Score}/100` },
                    { label: "Layer 3 Result", value: result.phone.layer3Result },
                    { label: "Final Verdict", value: result.phone.finalVerdict },
                    { label: "Times Verified", value: String(result.phone.verificationCount) },
                    { label: "Registered On", value: formatDate(result.phone.createdAt) },
                  ].map((row, i) => (
                    <View key={i} style={[styles.detailRow, { borderTopColor: colors.border, borderTopWidth: i === 0 ? 0 : 1 }]}>
                      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                      <Text style={[styles.detailValue, { color: colors.foreground }]}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <PrimaryButton title="Search Another IMEI" onPress={handleReset} style={{ marginTop: 8 }} />
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
  infoCard: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  charCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    marginTop: -10,
    marginBottom: 10,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
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
  verdictCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  verdictIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  verdictHeading: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 6,
  },
  verdictMessage: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  verdictMeta: {
    borderTopWidth: 1,
    paddingTop: 14,
    alignSelf: "stretch",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  gaugeCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    marginBottom: 14,
  },
  gaugeLabel: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 14,
  },
  detailCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  detailCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    padding: 14,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
    maxWidth: "55%",
    textAlign: "right",
  },
});
