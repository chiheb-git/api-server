import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  Easing,
  ScrollView,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Cyber color palette ───────────────────────────────────────────────────────
const C = {
  bg: "#040d1a",
  panel: "#070f22",
  card: "#0a1628",
  neon: "#00ffe7",
  neonDim: "rgba(0,255,231,0.18)",
  neonGlow: "rgba(0,255,231,0.08)",
  blue: "#00aaff",
  amber: "#f5a623",
  amberDim: "rgba(245,166,35,0.18)",
  muted: "#4a7fa0",
  text: "#c8eeff",
  grid: "rgba(0,255,231,0.04)",
};

// ─── Animated pulsing dot ─────────────────────────────────────────────────────
function PulseDot({ color, delay = 0 }: { color: string; delay?: number }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 0.2, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={[styles.statusDot, { backgroundColor: color, opacity: anim, shadowColor: color }]} />
  );
}

// ─── Floating orb with spinning rings ────────────────────────────────────────
function CyberOrb() {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    ).start();
    Animated.loop(Animated.timing(ring1, { toValue: 1, duration: 8000, useNativeDriver: true, easing: Easing.linear })).start();
    Animated.loop(Animated.timing(ring2, { toValue: 1, duration: 14000, useNativeDriver: true, easing: Easing.linear })).start();
    Animated.loop(Animated.timing(ring3, { toValue: 1, duration: 20000, useNativeDriver: true, easing: Easing.linear })).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const spin1 = ring1.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const spin2 = ring2.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] });
  const spin3 = ring3.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View style={[styles.orbContainer, { transform: [{ translateY: floatAnim }] }]}>
      <RadarRings />
      <Animated.View style={[styles.orb, { transform: [{ scale: pulseAnim }] }]}>
        <Animated.View style={[styles.orbRing, styles.orbRing1, { transform: [{ rotate: spin1 }] }]} />
        <Animated.View style={[styles.orbRing, styles.orbRing2, { transform: [{ rotate: spin2 }] }]} />
        <Animated.View style={[styles.orbRing, styles.orbRing3, { transform: [{ rotate: spin3 }] }]} />
        <View style={styles.orbGlare} />
        <Feather name="shield" size={30} color={C.neon} style={styles.orbIcon} />
      </Animated.View>
    </Animated.View>
  );
}

// ─── Radar expanding rings ────────────────────────────────────────────────────
function RadarRings() {
  const rings = [0, 1000, 2000].map((delay) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 3000, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, []);
    return anim;
  });

  return (
    <View style={styles.radarContainer} pointerEvents="none">
      {rings.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.radarRing,
            {
              opacity: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.5, 0] }),
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ label, color, delay }: { label: string; color: string; delay?: number }) {
  return (
    <View style={styles.statusPill}>
      <PulseDot color={color} delay={delay} />
      <Text style={styles.statusLabel}>{label}</Text>
    </View>
  );
}

// ─── Action card ──────────────────────────────────────────────────────────────
function ActionCard({
  icon,
  title,
  sub,
  accentColor,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  sub: string;
  accentColor: string;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  const isNeon = accentColor === C.neon;

  return (
    <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1} style={styles.actionCardWrapper}>
      <Animated.View style={[styles.actionCard, { borderColor: isNeon ? C.neonDim : C.amberDim, transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.cardTopLine, { backgroundColor: accentColor }]} />
        <View style={[styles.cardIconBox, {
          borderColor: isNeon ? C.neonDim : C.amberDim,
          backgroundColor: isNeon ? "rgba(0,255,231,0.06)" : "rgba(245,166,35,0.06)"
        }]}>
          <Feather name={icon} size={26} color={accentColor} />
        </View>
        <Text style={[styles.cardTitle, { color: accentColor }]}>{title}</Text>
        <Text style={styles.cardSub}>{sub}</Text>
        <View style={styles.cardCTA}>
          <Text style={[styles.cardCTAText, { color: accentColor }]}>INIT</Text>
          <Feather name="arrow-right" size={12} color={accentColor} />
        </View>
        <View style={[styles.cardCorner, { borderColor: isNeon ? "rgba(0,255,231,0.4)" : "rgba(245,166,35,0.4)" }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Corner bracket decoration ────────────────────────────────────────────────
function CornerBracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const style = [
    styles.cornerBracket,
    position === "tl" && { top: 0, left: 0 },
    position === "tr" && { top: 0, right: 0, transform: [{ scaleX: -1 }] },
    position === "bl" && { bottom: 0, left: 0, transform: [{ scaleY: -1 }] },
    position === "br" && { bottom: 0, right: 0, transform: [{ scale: -1 }] },
  ];
  return <View style={style} />;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace("/auth");
  };

  const handleAddPhone = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/add-phone");
  };

  const handleSearchPhone = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/search-phone");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <CornerBracket position="tl" />
      <CornerBracket position="tr" />
      <CornerBracket position="bl" />
      <CornerBracket position="br" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>▶ OPERATOR ID</Text>
            <Text style={styles.userName}>{(user?.name ?? "USER").toUpperCase()}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Feather name="log-out" size={16} color={C.muted} />
          </TouchableOpacity>
        </View>

        {/* ── Status bar ── */}
        <View style={styles.statusBar}>
          <StatusPill label="IMEI ENGINE" color={C.neon} delay={0} />
          <StatusPill label="AI CORE" color={C.blue} delay={400} />
          <StatusPill label="THREAT DB" color={C.amber} delay={800} />
        </View>

        {/* ── Hero orb zone ── */}
        <View style={styles.heroZone}>
          <CyberOrb />
          <Text style={styles.heroTitle}>PhoneVerify</Text>
          <Text style={styles.heroSub}>Multi-Layer AI Security System</Text>
          <View style={styles.chips}>
            {[
              { label: "IMEI Analysis", color: C.neon },
              { label: "Trust Score", color: C.blue },
              { label: "Forgery Detection", color: C.amber },
            ].map(({ label, color }) => (
              <View key={label} style={[styles.chip, { borderColor: `${color}44` }]}>
                <Text style={[styles.chipText, { color }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Action cards — FULL WIDTH like PC ── */}
        <View style={styles.actionsRow}>
          <ActionCard
            icon="smartphone"
            title="ADD PHONE"
            sub={`Register & verify a new device`}
            accentColor={C.neon}
            onPress={handleAddPhone}
          />
          <ActionCard
            icon="search"
            title="SEARCH"
            sub={`Check if an IMEI\nis reported`}
            accentColor={C.amber}
            onPress={handleSearchPhone}
          />
        </View>

        {/* ── Info strip ── */}
        <View style={styles.infoStrip}>
          <Feather name="info" size={13} color={C.neon} />
          <Text style={styles.infoText}>
            Use ADD PHONE to register a device. Use SEARCH to verify IMEI status against the threat database.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: Platform.OS === "web" ? 40 : 8,
  },

  // Corner brackets
  cornerBracket: {
    position: "absolute",
    width: 18,
    height: 18,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: C.neon,
    zIndex: 10,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 12,
  },
  greeting: {
    fontSize: 9,
    color: C.muted,
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: C.neon,
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 2,
    textShadowColor: "rgba(0,255,231,0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  logoutBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.neonDim,
    backgroundColor: "rgba(0,255,231,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Status bar
  statusBar: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statusPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: C.neonDim,
    borderRadius: 3,
    backgroundColor: "rgba(0,255,231,0.03)",
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 2,
  },
  statusLabel: {
    fontSize: 7,
    color: C.muted,
    letterSpacing: 1.5,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },

  // Orb
  orbContainer: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  radarContainer: {
    position: "absolute",
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  radarRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: "rgba(0,255,231,0.25)",
  },
  orb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: "rgba(0,255,231,0.35)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: C.neon,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  orbRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
  },
  orbRing1: { width: 90, height: 90, borderColor: "rgba(0,255,231,0.25)" },
  orbRing2: { width: 106, height: 106, borderColor: "rgba(0,170,255,0.18)", borderStyle: "dashed" },
  orbRing3: { width: 118, height: 118, borderColor: "rgba(0,255,231,0.08)" },
  orbGlare: {
    position: "absolute",
    width: 30,
    height: 18,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.07)",
    top: 16,
    left: 18,
    transform: [{ rotate: "-30deg" }],
  },
  orbIcon: {
    textShadowColor: "rgba(0,255,231,0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  // Hero zone
  heroZone: {
    alignItems: "center",
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: C.neon,
    letterSpacing: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 14,
    textShadowColor: "rgba(0,255,231,0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  heroSub: {
    fontSize: 9,
    color: C.muted,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  chips: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 8,
    letterSpacing: 1.2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },

  // ── Action cards — KEY FIX ──────────────────────────────────────────────────
  actionsRow: {
    flexDirection: "row",           // côte à côte comme le PC
    gap: 12,
    marginBottom: 14,
    // Hauteur fixe pour que les 2 cartes soient grandes et visibles
    height: 200,
  },
  actionCardWrapper: {
    flex: 1,                        // chaque carte prend 50% de la largeur
  },
  actionCard: {
    flex: 1,
    borderRadius: 4,
    borderWidth: 1,
    padding: 18,
    backgroundColor: C.card,
    overflow: "hidden",
    position: "relative",
  },
  cardTopLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.7,
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 9.5,
    color: C.muted,
    lineHeight: 15,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: 12,
    flex: 1,
  },
  cardCTA: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardCTAText: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  cardCorner: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 12,
    height: 12,
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },

  // Info strip
  infoStrip: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: C.neonDim,
    backgroundColor: "rgba(0,255,231,0.03)",
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: 9,
    color: C.muted,
    letterSpacing: 0.5,
    lineHeight: 14,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});
