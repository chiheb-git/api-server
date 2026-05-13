import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
  Easing,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { TrustGauge } from "@/components/TrustGauge";

// ─── Cyber palette ────────────────────────────────────────────────────────────
const C = {
  bg: "#040d1a",
  card: "#0a1628",
  panel: "#070f22",
  neon: "#00ffe7",
  neonDim: "rgba(0,255,231,0.18)",
  neonBg: "rgba(0,255,231,0.05)",
  blue: "#00aaff",
  amber: "#f5a623",
  amberDim: "rgba(245,166,35,0.2)",
  danger: "#ff3b6b",
  dangerDim: "rgba(255,59,107,0.18)",
  dangerBg: "rgba(255,59,107,0.06)",
  success: "#00ff88",
  successDim: "rgba(0,255,136,0.18)",
  successBg: "rgba(0,255,136,0.05)",
  muted: "#4a7fa0",
  text: "#c8eeff",
  mono: Platform.OS === "ios" ? "Courier" : "monospace",
};

// ─── Pulsing dot ──────────────────────────────────────────────────────────────
function PulseDot({ color, delay = 0 }: { color: string; delay?: number }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 0.15, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color, opacity: anim }} />
  );
}

// ─── Corner bracket ───────────────────────────────────────────────────────────
function CornerBracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  return (
    <View style={[
      styles.cornerBracket,
      position === "tl" && { top: 0, left: 0 },
      position === "tr" && { top: 0, right: 0, transform: [{ scaleX: -1 }] },
      position === "bl" && { bottom: 0, left: 0, transform: [{ scaleY: -1 }] },
      position === "br" && { bottom: 0, right: 0, transform: [{ scale: -1 }] },
    ]} />
  );
}

// ─── Scanning bar animation ───────────────────────────────────────────────────
function ScanBar() {
  const anim = useRef(new Animated.Value(0)).current;
  const opacAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute", left: 0, right: 0, height: 1.5,
        backgroundColor: C.neon, opacity: opacAnim,
        shadowColor: C.neon, shadowRadius: 6, shadowOpacity: 0.8,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 80] }) }],
      }}
    />
  );
}

// ─── Rotating hex logo ────────────────────────────────────────────────────────
function CyberLogo({ size = 48, color = C.neon }: { size?: number; color?: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 12000, useNativeDriver: true, easing: Easing.linear })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.12, duration: 1400, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
    ])).start();
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale: pulse }], alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        position: "absolute", width: size, height: size,
        borderRadius: 4, borderWidth: 1.5,
        borderColor: `${color}55`, transform: [{ rotate }],
      }} />
      <View style={{
        width: size * 0.7, height: size * 0.7, borderRadius: size * 0.14,
        borderWidth: 1, borderColor: `${color}33`,
        backgroundColor: `${color}08`,
        alignItems: "center", justifyContent: "center",
      }}>
        <Feather name="search" size={size * 0.35} color={color} />
      </View>
    </Animated.View>
  );
}

// ─── Cyber input ──────────────────────────────────────────────────────────────
function CyberInput({
  value, onChangeText, placeholder, maxLength, keyboardType,
}: {
  value: string; onChangeText: (t: string) => void; placeholder: string;
  maxLength?: number; keyboardType?: "numeric" | "default";
}) {
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, { toValue: focused ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [focused]);

  const borderColor = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [C.neonDim, C.neon] });

  return (
    <Animated.View style={[styles.inputWrap, { borderColor }]}>
      {focused && <ScanBar />}
      <Text style={styles.inputLabel}>▶ IMEI CODE</Text>
      <View style={styles.inputRow}>
        <Feather name="hash" size={14} color={focused ? C.neon : C.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.inputField}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          keyboardType={keyboardType ?? "default"}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          selectionColor={C.neon}
        />
        <Text style={styles.inputCount}>{value.length}/{maxLength}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Cyber button ─────────────────────────────────────────────────────────────
function CyberButton({
  title, onPress, variant = "primary", loading = false, icon,
}: {
  title: string; onPress: () => void; variant?: "primary" | "secondary" | "danger";
  loading?: boolean; icon?: React.ComponentProps<typeof Feather>["name"];
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const scanAnim = useRef(new Animated.Value(-1)).current;

  const onIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.timing(scanAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.linear })
      ).start();
    } else {
      scanAnim.setValue(-1);
    }
  }, [loading]);

  const color = variant === "secondary" ? C.muted : variant === "danger" ? C.danger : C.neon;
  const bg = variant === "secondary" ? "rgba(74,127,160,0.08)" : variant === "danger" ? C.dangerBg : C.neonBg;
  const border = variant === "secondary" ? "rgba(74,127,160,0.25)" : variant === "danger" ? C.dangerDim : C.neonDim;

  return (
    <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1} disabled={loading}>
      <Animated.View style={[styles.cyberBtn, { backgroundColor: bg, borderColor: border, transform: [{ scale }] }]}>
        {loading && (
          <Animated.View style={[styles.btnScanLine, {
            backgroundColor: color,
            transform: [{ translateX: scanAnim.interpolate({ inputRange: [-1, 1], outputRange: [-160, 160] }) }],
          }]} />
        )}
        <View style={[styles.btnTopLine, { backgroundColor: color }]} />
        {icon && !loading && <Feather name={icon} size={13} color={color} style={{ marginRight: 7 }} />}
        {loading && <Animated.View style={[styles.loadingDot, { backgroundColor: color }]} />}
        <Text style={[styles.btnText, { color }]}>
          {loading ? "SCANNING..." : title.toUpperCase()}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Detail row ───────────────────────────────────────────────────────────────
function DetailRow({ label, value, i }: { label: string; value: string; i: number }) {
  return (
    <View style={[styles.detailRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.neonDim }]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface StoredPhone {
  id: number; imei: string; brand?: string; model?: string;
  trustScore: number; layer1Score: number; layer2Score: number;
  layer3Result: string; finalVerdict: string;
  verificationCount: number; createdAt: string;
}

interface SearchResult {
  found: boolean; imei: string; isSecure: boolean;
  message: string; searchCount: number; phone?: StoredPhone;
}

const BASE_URL = process.env["EXPO_PUBLIC_DOMAIN"] ? `http://${process.env["EXPO_PUBLIC_DOMAIN"]}` : "";

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function SearchPhoneScreen() {
  const insets = useSafeAreaInsets();
  const [imei, setImei] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState("");

  // Result entry animation
  const resultAnim = useRef(new Animated.Value(0)).current;
  const resultSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (result) {
      resultAnim.setValue(0);
      resultSlide.setValue(30);
      Animated.parallel([
        Animated.timing(resultAnim, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(resultSlide, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      ]).start();
    }
  }, [result]);

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
      void Haptics.notificationAsync(
        data.isSecure ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
      );
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => { setResult(null); setImei(""); setError(""); };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        {/* Corner brackets */}
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="bl" />
        <CornerBracket position="br" />

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 40 : 16) }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={18} color={C.neon} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>IMEI SCAN</Text>
            <View style={styles.headerUnderline} />
          </View>
          <View style={styles.headerRight}>
            <PulseDot color={C.neon} />
            <Text style={styles.liveLabel}>LIVE</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!result ? (
            <>
              {/* Logo + intro */}
              <View style={styles.logoZone}>
                <CyberLogo size={64} color={C.neon} />
                <Text style={styles.logoTitle}>PHONEVERIFY</Text>
                <Text style={styles.logoSub}>Threat Intelligence Database</Text>
                <View style={styles.chips}>
                  {[
                    { label: "IMEI Lookup", color: C.neon },
                    { label: "Stolen Check", color: C.danger },
                    { label: "Trust Score", color: C.blue },
                  ].map(({ label, color }) => (
                    <View key={label} style={[styles.chip, { borderColor: `${color}40` }]}>
                      <Text style={[styles.chipText, { color }]}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Info card */}
              <View style={styles.infoCard}>
                <Feather name="shield" size={14} color={C.neon} />
                <Text style={styles.infoText}>
                  Enter a 15-digit IMEI to check if this device has been reported in the security threat database.
                </Text>
              </View>

              {/* Input */}
              <CyberInput
                value={imei}
                onChangeText={(t) => setImei(t.replace(/\D/g, "").slice(0, 15))}
                placeholder="358392049957572"
                maxLength={15}
                keyboardType="numeric"
              />

              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: `${(imei.length / 15) * 100}%` }]} />
              </View>
              <Text style={styles.progressLabel}>{imei.length}/15 DIGITS</Text>

              {/* Error */}
              {!!error && (
                <View style={styles.errorBanner}>
                  <Feather name="alert-triangle" size={13} color={C.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <CyberButton
                title="Verify IMEI"
                onPress={handleSearch}
                loading={loading}
                icon="search"
              />
            </>
          ) : (
            <Animated.View style={{ opacity: resultAnim, transform: [{ translateY: resultSlide }] }}>

              {/* ── Verdict card ── */}
              <View style={[
                styles.verdictCard,
                { borderColor: result.isSecure ? C.successDim : C.dangerDim,
                  backgroundColor: result.isSecure ? C.successBg : C.dangerBg }
              ]}>
                {/* Animated top line */}
                <View style={[styles.verdictTopLine, { backgroundColor: result.isSecure ? C.success : C.danger }]} />

                {/* Icon orb */}
                <View style={[styles.verdictOrb, { borderColor: result.isSecure ? C.successDim : C.dangerDim }]}>
                  <Feather
                    name={result.isSecure ? "shield" : "alert-triangle"}
                    size={30}
                    color={result.isSecure ? C.success : C.danger}
                  />
                  {/* Ring */}
                  <View style={[styles.verdictOrbRing, { borderColor: result.isSecure ? `${C.success}30` : `${C.danger}30` }]} />
                </View>

                {/* Status label */}
                <View style={[styles.verdictStatusRow, { borderColor: result.isSecure ? C.successDim : C.dangerDim }]}>
                  <PulseDot color={result.isSecure ? C.success : C.danger} />
                  <Text style={[styles.verdictStatusText, { color: result.isSecure ? C.success : C.danger }]}>
                    {result.isSecure ? "SECURE" : "THREAT DETECTED"}
                  </Text>
                </View>

                <Text style={[styles.verdictHeading, { color: result.isSecure ? C.success : C.danger }]}>
                  {result.isSecure ? "PHONE IS SECURE" : "PHONE IS NOT SECURE"}
                </Text>
                <Text style={styles.verdictMessage}>{result.message}</Text>

                <View style={[styles.verdictMeta, { borderTopColor: result.isSecure ? C.successDim : C.dangerDim }]}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>IMEI</Text>
                    <Text style={styles.metaValue}>{result.imei}</Text>
                  </View>
                  <View style={[styles.metaDivider, { backgroundColor: result.isSecure ? C.successDim : C.dangerDim }]} />
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>QUERIES</Text>
                    <Text style={styles.metaValue}>{result.searchCount}</Text>
                  </View>
                </View>
              </View>

              {/* ── Detailed analysis ── */}
              {result.found && result.phone && (
                <>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionLine} />
                    <Text style={styles.sectionTitle}>STORED ANALYSIS</Text>
                    <View style={styles.sectionLine} />
                  </View>

                  {/* Trust gauge card */}
                  <View style={styles.gaugeCard}>
                    <View style={styles.cardTopLine2} />
                    <Text style={styles.gaugeLabel}>▶ TRUST SCORE AT REGISTRATION</Text>
                    <TrustGauge score={Math.round(result.phone.trustScore)} size={140} />
                  </View>

                  {/* Device detail card */}
                  <View style={styles.detailCard}>
                    <View style={styles.cardTopLine2} />
                    <View style={styles.detailCardHeader}>
                      <Feather name="cpu" size={13} color={C.neon} />
                      <Text style={styles.detailCardTitle}>DEVICE DETAILS</Text>
                    </View>
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
                      <DetailRow key={i} label={row.label} value={row.value} i={i} />
                    ))}
                  </View>
                </>
              )}

              <CyberButton title="Search Another IMEI" onPress={handleReset} icon="refresh-cw" />
              <View style={{ height: 10 }} />
              <CyberButton title="Back to Home" onPress={() => router.replace("/home")} variant="secondary" icon="home" />
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  cornerBracket: {
    position: "absolute", width: 16, height: 16,
    borderTopWidth: 2, borderLeftWidth: 2, borderColor: C.neon, zIndex: 10,
  },

  // Header
  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 3,
    borderWidth: 1, borderColor: C.neonDim, backgroundColor: C.neonBg,
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { alignItems: "center" },
  headerTitle: {
    fontSize: 13, fontWeight: "700", color: C.neon,
    letterSpacing: 4, fontFamily: C.mono,
    textShadowColor: "rgba(0,255,231,0.5)",
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },
  headerUnderline: {
    height: 1, width: 60, backgroundColor: C.neon,
    opacity: 0.4, marginTop: 3,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveLabel: { fontSize: 8, color: C.neon, letterSpacing: 2, fontFamily: C.mono },

  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  // Logo zone
  logoZone: { alignItems: "center", marginBottom: 20, paddingTop: 8 },
  logoTitle: {
    fontSize: 18, fontWeight: "900", color: C.neon,
    letterSpacing: 4, fontFamily: C.mono, marginTop: 10,
    textShadowColor: "rgba(0,255,231,0.6)",
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },
  logoSub: { fontSize: 9, color: C.muted, letterSpacing: 2, fontFamily: C.mono, marginTop: 3 },
  chips: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap", justifyContent: "center" },
  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 2, borderWidth: 1 },
  chipText: { fontSize: 7.5, letterSpacing: 1.2, fontFamily: C.mono },

  // Info card
  infoCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 12, borderRadius: 3, borderWidth: 1,
    borderColor: C.neonDim, backgroundColor: C.neonBg, marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 9, color: C.muted, lineHeight: 14, letterSpacing: 0.5, fontFamily: C.mono },

  // Input
  inputWrap: {
    borderWidth: 1, borderRadius: 3, padding: 12,
    backgroundColor: C.card, marginBottom: 10, overflow: "hidden", position: "relative",
  },
  inputLabel: { fontSize: 8, color: C.muted, letterSpacing: 2, fontFamily: C.mono, marginBottom: 8 },
  inputRow: { flexDirection: "row", alignItems: "center" },
  inputField: {
    flex: 1, fontSize: 14, color: C.neon, letterSpacing: 3,
    fontFamily: C.mono, paddingVertical: 0,
  },
  inputCount: { fontSize: 8, color: C.muted, fontFamily: C.mono, letterSpacing: 1 },

  // Progress
  progressTrack: {
    height: 2, backgroundColor: "rgba(0,255,231,0.1)", borderRadius: 1, marginBottom: 5,
  },
  progressFill: {
    height: "100%", backgroundColor: C.neon, borderRadius: 1,
    shadowColor: C.neon, shadowRadius: 4, shadowOpacity: 0.8,
  },
  progressLabel: { fontSize: 8, color: C.muted, letterSpacing: 2, fontFamily: C.mono, textAlign: "right", marginBottom: 14 },

  // Error
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 10, borderRadius: 3, borderWidth: 1,
    borderColor: C.dangerDim, backgroundColor: C.dangerBg, marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 9, color: C.danger, fontFamily: C.mono, letterSpacing: 0.5 },

  // Cyber button
  cyberBtn: {
    borderWidth: 1, borderRadius: 3, paddingVertical: 13,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    overflow: "hidden", position: "relative",
  },
  btnTopLine: { position: "absolute", top: 0, left: 0, right: 0, height: 1.5, opacity: 0.6 },
  btnScanLine: {
    position: "absolute", top: 0, bottom: 0, width: 60, opacity: 0.15,
  },
  btnText: { fontSize: 10, fontWeight: "700", letterSpacing: 3, fontFamily: C.mono },
  loadingDot: { width: 5, height: 5, borderRadius: 3, marginRight: 8, opacity: 0.8 },

  // Verdict card
  verdictCard: {
    borderRadius: 4, borderWidth: 1, padding: 20,
    alignItems: "center", marginBottom: 20, overflow: "hidden", position: "relative",
  },
  verdictTopLine: { position: "absolute", top: 0, left: 0, right: 0, height: 2, opacity: 0.8 },
  verdictOrb: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 1, backgroundColor: C.card,
    alignItems: "center", justifyContent: "center", marginBottom: 14, position: "relative",
  },
  verdictOrbRing: {
    position: "absolute", width: 84, height: 84, borderRadius: 42, borderWidth: 1,
  },
  verdictStatusRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 2, borderWidth: 1, marginBottom: 10,
  },
  verdictStatusText: { fontSize: 8, letterSpacing: 2, fontFamily: C.mono },
  verdictHeading: {
    fontSize: 16, fontWeight: "700", letterSpacing: 2,
    fontFamily: C.mono, textAlign: "center", marginBottom: 6,
  },
  verdictMessage: { fontSize: 10, color: C.muted, textAlign: "center", lineHeight: 15, fontFamily: C.mono, marginBottom: 16 },
  verdictMeta: {
    flexDirection: "row", borderTopWidth: 1, paddingTop: 14, alignSelf: "stretch",
    justifyContent: "center", gap: 0,
  },
  metaItem: { flex: 1, alignItems: "center", gap: 3 },
  metaDivider: { width: 1, marginHorizontal: 12 },
  metaLabel: { fontSize: 7, color: C.muted, letterSpacing: 2, fontFamily: C.mono },
  metaValue: { fontSize: 10, color: C.text, fontFamily: C.mono, letterSpacing: 1 },

  // Section separator
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sectionLine: { flex: 1, height: 1, backgroundColor: C.neonDim },
  sectionTitle: { fontSize: 8, color: C.neon, letterSpacing: 3, fontFamily: C.mono },

  // Gauge card
  gaugeCard: {
    borderRadius: 4, borderWidth: 1, borderColor: C.neonDim,
    backgroundColor: C.card, padding: 16, alignItems: "center",
    marginBottom: 12, overflow: "hidden", position: "relative",
  },
  cardTopLine2: { position: "absolute", top: 0, left: 0, right: 0, height: 1.5, backgroundColor: C.neon, opacity: 0.4 },
  gaugeLabel: { fontSize: 8, color: C.muted, letterSpacing: 2, fontFamily: C.mono, marginBottom: 14 },

  // Detail card
  detailCard: {
    borderRadius: 4, borderWidth: 1, borderColor: C.neonDim,
    backgroundColor: C.card, marginBottom: 14, overflow: "hidden", position: "relative",
  },
  detailCardHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderBottomWidth: 1, borderBottomColor: C.neonDim,
  },
  detailCardTitle: { fontSize: 9, color: C.neon, letterSpacing: 2, fontFamily: C.mono },
  detailRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 12, paddingVertical: 9,
  },
  detailLabel: { fontSize: 9, color: C.muted, fontFamily: C.mono, letterSpacing: 0.5 },
  detailValue: { fontSize: 9, color: C.text, fontFamily: C.mono, letterSpacing: 0.5, maxWidth: "55%", textAlign: "right" },
});
