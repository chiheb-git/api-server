import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Easing,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, { Polygon, Path, Circle, Defs, LinearGradient, Stop, RadialGradient } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { StyledInput } from "@/components/StyledInput";
import { PrimaryButton } from "@/components/PrimaryButton";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       "#040C14",
  surface:  "#08131E",
  card:     "#0A1929",
  border:   "#112840",
  accent:   "#00C8F0",
  accent2:  "#0077A8",
  green:    "#00E87A",
  amber:    "#FFB300",
  red:      "#FF3B5C",
  text:     "#E2F0FF",
  muted:    "#4A7A96",
  white:    "#FFFFFF",
};

const BASE_URL = process.env["EXPO_PUBLIC_DOMAIN"] ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}` : "";

// ─── Logo 3D animé ─────────────────────────────────────────────────────────────
function CyberLogo3D() {
  const hex1Rot  = useRef(new Animated.Value(0)).current;
  const hex2Rot  = useRef(new Animated.Value(0)).current;
  const orb1     = useRef(new Animated.Value(0)).current;
  const orb2     = useRef(new Animated.Value(0)).current;
  const orb3     = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const floatY   = useRef(new Animated.Value(0)).current;
  const scaleAnim= useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance scale
    Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();

    // Outer hex clockwise
    Animated.loop(Animated.timing(hex1Rot, {
      toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true,
    })).start();

    // Inner hex counter-clockwise
    Animated.loop(Animated.timing(hex2Rot, {
      toValue: -1, duration: 6000, easing: Easing.linear, useNativeDriver: true,
    })).start();

    // Orbits
    Animated.loop(Animated.timing(orb1, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(orb2, { toValue: 1, duration: 3400, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(orb3, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: true })).start();

    // Glow pulse
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();

    // Float up/down
    Animated.loop(Animated.sequence([
      Animated.timing(floatY, { toValue: -8, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(floatY, { toValue:  8, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);

  const r1 = hex1Rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const r2 = hex2Rot.interpolate({ inputRange: [-1, 0], outputRange: ["-360deg", "0deg"] });

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });
  const glowScale   = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });

  const makeOrb = (anim: Animated.Value, radius: number, phase: number, color: string) => {
    const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: [`${phase}deg`, `${phase + 360}deg`] });
    const counter= anim.interpolate({ inputRange: [0, 1], outputRange: [`${-phase}deg`, `${-phase - 360}deg`] });
    return (
      <Animated.View style={{
        position: "absolute", top: 56, left: 56,
        width: 10, height: 10, borderRadius: 5,
        transform: [{ rotate }, { translateX: radius }, { rotate: counter }],
      }}>
        <View style={{
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: color,
          shadowColor: color, shadowRadius: 6, shadowOpacity: 1,
        }} />
      </Animated.View>
    );
  };

  return (
    <Animated.View style={{
      width: 120, height: 120, alignItems: "center", justifyContent: "center",
      transform: [{ scale: scaleAnim }, { translateY: floatY }],
    }}>
      {/* Outer glow halo */}
      <Animated.View style={{
        position: "absolute", width: 140, height: 140,
        borderRadius: 70, top: -10, left: -10,
        backgroundColor: C.accent,
        opacity: glowOpacity,
        transform: [{ scale: glowScale }],
        shadowColor: C.accent, shadowRadius: 40, shadowOpacity: 1,
      }} />

      {/* Second glow ring (green tint) */}
      <Animated.View style={{
        position: "absolute", width: 120, height: 120,
        borderRadius: 60, top: 0, left: 0,
        backgroundColor: C.green,
        opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.15] }),
      }} />

      {/* Outer hex rotating CW */}
      <Animated.View style={{ position: "absolute", transform: [{ rotate: r1 }] }}>
        <Svg width="120" height="120" viewBox="0 0 120 120">
          <Defs>
            <LinearGradient id="hexGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={C.accent} stopOpacity="0.9" />
              <Stop offset="100%" stopColor={C.green}  stopOpacity="0.5" />
            </LinearGradient>
          </Defs>
          <Polygon
            points="60,5 107,30 107,80 60,105 13,80 13,30"
            fill="none" stroke="url(#hexGrad1)" strokeWidth="1.5" strokeDasharray="8 4"
          />
        </Svg>
      </Animated.View>

      {/* Inner hex rotating CCW */}
      <Animated.View style={{ position: "absolute", transform: [{ rotate: r2 }] }}>
        <Svg width="90" height="90" viewBox="0 0 90 90" style={{ marginTop: 15, marginLeft: 15 }}>
          <Polygon
            points="45,5 80,23 80,57 45,75 10,57 10,23"
            fill="none" stroke={C.accent} strokeWidth="1" strokeDasharray="4 6" opacity="0.5"
          />
        </Svg>
      </Animated.View>

      {/* Core shield */}
      <Svg width="80" height="80" viewBox="0 0 80 80">
        <Defs>
          <RadialGradient id="shieldBg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#0D2D45" />
            <Stop offset="100%" stopColor="#051018" />
          </RadialGradient>
          <LinearGradient id="shieldStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={C.accent} />
            <Stop offset="100%" stopColor={C.green}  />
          </LinearGradient>
        </Defs>
        {/* Hexagon face */}
        <Polygon points="40,4 72,22 72,58 40,76 8,58 8,22" fill="url(#shieldBg)" stroke="url(#shieldStroke)" strokeWidth="1.5" />
        {/* Shield body */}
        <Path d="M40 18 L55 25 L55 40 Q55 52 40 58 Q25 52 25 40 L25 25 Z"
          fill="none" stroke="url(#shieldStroke)" strokeWidth="2" strokeLinejoin="round" />
        {/* Checkmark */}
        <Path d="M32 39 L38 45 L50 31"
          fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Corner dots */}
        <Circle cx="15"  cy="40" r="2" fill={C.accent} opacity="0.6" />
        <Circle cx="65"  cy="40" r="2" fill={C.accent} opacity="0.6" />
        <Circle cx="40"  cy="8"  r="2" fill={C.green}  opacity="0.6" />
        <Circle cx="40"  cy="72" r="2" fill={C.green}  opacity="0.6" />
      </Svg>

      {/* Orbiting particles */}
      {makeOrb(orb1, 46, 0,   C.accent)}
      {makeOrb(orb2, 38, 120, C.green )}
      {makeOrb(orb3, 30, 240, C.amber )}
    </Animated.View>
  );
}

// ─── Cyber input field ─────────────────────────────────────────────────────────
function CyberInput({
  label, icon, value, onChangeText, placeholder, secureTextEntry,
  keyboardType, autoCapitalize, autoCorrect, returnKeyType,
  onSubmitEditing, inputRef, rightElement,
}: {
  label: string; icon: string; value: string;
  onChangeText: (t: string) => void; placeholder?: string;
  secureTextEntry?: boolean; keyboardType?: any; autoCapitalize?: any;
  autoCorrect?: boolean; returnKeyType?: any;
  onSubmitEditing?: () => void; inputRef?: React.RefObject<TextInput | null>;
  rightElement?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(focusAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(focusAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [C.border, C.accent] });
  const labelColor  = focused ? C.accent : C.muted;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.inputLabel, { color: labelColor }]}>{label}</Text>
      <Animated.View style={[styles.inputWrapper, { borderColor }]}>
        {/* Corner accents */}
        <View style={[styles.ctl, { borderColor: focused ? C.accent : C.border }]} />
        <View style={[styles.cbr, { borderColor: focused ? C.accent : C.border }]} />

        <Feather name={icon as any} size={16} color={focused ? C.accent : C.muted} style={{ marginLeft: 14 }} />
        <TextInput
          ref={inputRef}
          style={styles.inputField}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.muted + "66"}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {rightElement}
      </Animated.View>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  // ── State (inchangé) ──
  const [isLogin, setIsLogin]         = useState(true);
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const emailRef    = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const nameRef     = useRef<TextInput>(null);

  // ── Tab slide animation ──
  const tabAnim   = useRef(new Animated.Value(0)).current;
  const formFade  = useRef(new Animated.Value(1)).current;
  const cardSlide = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(cardSlide, { toValue: 1, tension: 50, friction: 10, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(blinkAnim, { toValue: 0.2, duration: 900, useNativeDriver: true }),
      Animated.timing(blinkAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);

  const switchTab = (toLogin: boolean) => {
    Animated.timing(formFade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setIsLogin(toLogin);
      setError("");
      Animated.timing(formFade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
    Animated.spring(tabAnim, { toValue: toLogin ? 0 : 1, tension: 80, friction: 12, useNativeDriver: false }).start();
  };

  const tabIndicatorLeft = tabAnim.interpolate({ inputRange: [0, 1], outputRange: ["2%", "51%"] });

  // ── Logic (inchangée) ──
  const handleSubmit = async () => {
    setError("");
    if (!email || !password || (!isLogin && !name)) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const body = isLogin ? { email, password } : { name, email, password };

      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json() as {
        token?: string;
        user?: { id: number; name: string; email: string };
        message?: string;
      };

      if (!res.ok) { setError(data.message ?? "Something went wrong"); return; }

      if (data.token && data.user) {
        await login(data.token, data.user);
        router.replace("/home");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Grid background lines */}
      <View style={styles.gridLayer} pointerEvents="none" />
      {/* Top glow */}
      <View style={styles.topGlow} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 40 : 50), paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo area ── */}
        <View style={styles.logoArea}>
          <CyberLogo3D />

          <View style={styles.logoTextWrap}>
            {/* Live dot */}
            <Animated.View style={[styles.liveDot, { opacity: blinkAnim }]} />
            <Text style={styles.appName}>PhoneVerify </Text>
          </View>

          <Text style={styles.tagline}>AI-POWERED PHONE SECURITY VERIFICATION - Devloped By Meghraoui Chiheb </Text>

          {/* Decorative divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerDot}>◆</Text>
            <View style={styles.dividerLine} />
          </View>
        </View>

        {/* ── Card ── */}
        <Animated.View style={[styles.card, {
          transform: [
            { translateY: cardSlide.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
            { scale: cardSlide.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
          ],
          opacity: cardSlide,
        }]}>
          {/* Corner accents */}
          <View style={[styles.cornerTL, { borderColor: C.accent }]} />
          <View style={[styles.cornerTR, { borderColor: C.accent }]} />
          <View style={[styles.cornerBL, { borderColor: C.accent }]} />
          <View style={[styles.cornerBR2, { borderColor: C.accent }]} />

          {/* ── Tab switcher ── */}
          <View style={styles.tabContainer}>
            <Animated.View style={[styles.tabIndicator, { left: tabIndicatorLeft }]} />
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab(true)}>
              <Text style={[styles.tabText, { color: isLogin ? C.white : C.muted }]}>
                {isLogin ? "▶ " : ""}CONNEXION
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab(false)}>
              <Text style={[styles.tabText, { color: !isLogin ? C.white : C.muted }]}>
                {!isLogin ? "▶ " : ""}INSCRIPTION
              </Text>
            </TouchableOpacity>
          </View>

          {/* Status bar under tabs */}
          <View style={styles.statusBar}>
            <View style={[styles.statusDot, { backgroundColor: C.green }]} />
            <Text style={styles.statusText}>
              {isLogin ? "SESSION SÉCURISÉE · AES-256" : "CRÉATION COMPTE · CHIFFRÉ"}
            </Text>
          </View>

          {/* ── Form ── */}
          <Animated.View style={{ opacity: formFade }}>
            {!isLogin && (
              <CyberInput
                label="NOM COMPLET"
                icon="user"
                value={name}
                onChangeText={setName}
                placeholder="John Doe"
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                inputRef={nameRef}
              />
            )}

            <CyberInput
              label="ADRESSE EMAIL"
              icon="mail"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              inputRef={emailRef}
            />

            <CyberInput
              label="MOT DE PASSE"
              icon="lock"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              inputRef={passwordRef}
              rightElement={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingHorizontal: 14 }}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={C.muted} />
                </TouchableOpacity>
              }
            />

            {/* Error banner */}
            {error ? (
              <View style={styles.errorBanner}>
                <View style={[styles.errorIcon, { borderColor: C.red }]}>
                  <Feather name="alert-circle" size={14} color={C.red} />
                </View>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              style={[styles.submitBtn, loading && { opacity: 0.6 }]}
              activeOpacity={0.8}
            >
              <View style={styles.submitInner}>
                {loading ? (
                  <Text style={styles.submitText}>⟳  AUTHENTIFICATION…</Text>
                ) : (
                  <Text style={styles.submitText}>
                    {isLogin ? "⟶  ACCÉDER AU SYSTÈME" : "⟶  CRÉER MON COMPTE"}
                  </Text>
                )}
              </View>
              {/* Animated bottom bar */}
              <View style={styles.submitBar} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Footer */}
        <Text style={styles.footer}>
         Devloped By Chiheb Meghraoui 
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Backgrounds
  gridLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    opacity: 0.4,
  },
  topGlow: {
    position: "absolute", top: -60, left: "10%", right: "10%", height: 300,
    backgroundColor: C.accent,
    opacity: 0.04,
    borderRadius: 150,
  },

  // Scroll
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },

  // Logo
  logoArea: {
    alignItems: "center",
    marginBottom: 36,
  },
  logoTextWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 6,
  },
  liveDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.green,
    shadowColor: C.green, shadowRadius: 6, shadowOpacity: 1,
  },
  appName: {
    fontSize: 30,
    fontWeight: "800",
    color: C.text,
    letterSpacing: 3,
    fontFamily: "Inter_700Bold",
  },
  tagline: {
    fontSize: 9,
    color: C.muted,
    letterSpacing: 2.5,
    textAlign: "center",
    fontFamily: "Inter_500Medium",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
    width: "60%",
  },
  dividerLine: {
    flex: 1, height: 1, backgroundColor: C.border,
  },
  dividerDot: {
    fontSize: 8, color: C.accent, opacity: 0.6,
  },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    position: "relative",
    overflow: "hidden",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  // Corner accents
  cornerTL: { position: "absolute", top: 0, left: 0, width: 22, height: 22, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 20 },
  cornerTR: { position: "absolute", top: 0, right: 0, width: 22, height: 22, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 20 },
  cornerBL: { position: "absolute", bottom: 0, left: 0, width: 22, height: 22, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 20 },
  cornerBR2: { position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 20 },

  // Tabs
  tabContainer: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    position: "relative",
    borderWidth: 1,
    borderColor: C.border,
  },
  tabIndicator: {
    position: "absolute",
    top: 4, bottom: 4,
    width: "48%",
    backgroundColor: C.accent + "22",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.accent,
  },
  tabBtn: {
    flex: 1, height: 40, justifyContent: "center", alignItems: "center", borderRadius: 9,
  },
  tabText: {
    fontSize: 10, fontWeight: "700", letterSpacing: 2, fontFamily: "Inter_600SemiBold",
  },

  // Status bar
  statusBar: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20,
  },
  statusDot: {
    width: 6, height: 6, borderRadius: 3,
    shadowColor: C.green, shadowRadius: 4, shadowOpacity: 1,
  },
  statusText: {
    fontSize: 9, color: C.muted, letterSpacing: 2, fontFamily: "Inter_500Medium",
  },

  // Input
  inputLabel: {
    fontSize: 9, letterSpacing: 2.5, fontWeight: "700",
    fontFamily: "Inter_600SemiBold", marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderRadius: 12,
    height: 52,
    position: "relative",
    overflow: "hidden",
  },
  inputField: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 12,
    height: "100%",
  },
  // Input corner accents
  ctl: { position: "absolute", top: 0, left: 0, width: 10, height: 10, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopLeftRadius: 12 },
  cbr: { position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderBottomRightRadius: 12 },

  // Error
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.red + "12", borderWidth: 1, borderColor: C.red + "55",
    borderRadius: 10, padding: 12, marginBottom: 14,
  },
  errorIcon: {
    width: 26, height: 26, borderRadius: 6, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.red + "18",
  },
  errorText: {
    fontSize: 12, color: C.red, flex: 1, fontFamily: "Inter_400Regular",
  },

  // Submit button
  submitBtn: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: C.accent + "15",
    borderWidth: 1.5,
    borderColor: C.accent,
    shadowColor: C.accent,
    shadowRadius: 16,
    shadowOpacity: 0.3,
    elevation: 6,
  },
  submitInner: {
    height: 52, justifyContent: "center", alignItems: "center",
  },
  submitText: {
    fontSize: 12, fontWeight: "800", color: C.accent,
    letterSpacing: 3, fontFamily: "Inter_700Bold",
  },
  submitBar: {
    height: 2,
    backgroundColor: C.accent,
    opacity: 0.6,
  },

  // Footer
  footer: {
    textAlign: "center",
    marginTop: 28,
    fontSize: 8,
    color: C.muted,
    letterSpacing: 2,
    opacity: 0.45,
    fontFamily: "Inter_400Regular",
  },
});
