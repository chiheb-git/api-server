import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Easing,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { StyledInput } from "@/components/StyledInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import Svg, { Path, Circle, Rect, G, Line } from "react-native-svg";

// ??? Types ???????????????????????????????????????????????????????????????????

interface StoredOkResponse {
  stored: true;
  message?: string;
  imeiAnalysis?: {
    layer1?: { message?: string };
    layer2?: { score?: number };
    layer3?: { message?: string };
  };
  boxAnalysis?: {
    finalScore: number;
    verdict: string;
    verdictMessage: string;
    layers: Record<string, { score: number; status: string; detail: string }>;
  };
  fusionAnalysis?: {
    score_imei_ai: number;
    score_box_ai: number;
    score_global: number;
    verdict: "Authentique" | "Suspect" | "Invalide";
    niveau_confiance: "Elevé" | "Moyen" | "Faible";
    coherence: "oui" | "non";
    forces: string[];
    faiblesses: string[];
    recommandations: string[];
    risque_global: "Faible" | "Moyen" | "Elevé";
    decision: "STOCKER" | "REJETER";
    raison: string;
  };
}

interface FailedFusionResponse {
  stored: false;
  message: string;
  imeiAnalysis?: StoredOkResponse["imeiAnalysis"];
  boxAnalysis?: StoredOkResponse["boxAnalysis"];
  fusionAnalysis?: StoredOkResponse["fusionAnalysis"];
}

type AnalyzeResultResponse = StoredOkResponse | FailedFusionResponse;

// ??? Fallback fusion ??????????????????????????????????????????????????????????

function fallbackFusionAnalysisFromParts(
  imeiAnalysis: StoredOkResponse["imeiAnalysis"],
  boxAnalysis: StoredOkResponse["boxAnalysis"],
  imeiLabel: string
): NonNullable<StoredOkResponse["fusionAnalysis"]> {
  const imeiAi =
    typeof imeiAnalysis?.layer2?.score === "number"
      ? Math.round(imeiAnalysis.layer2.score)
      : 0;
  const boxAi =
    boxAnalysis && typeof boxAnalysis.finalScore === "number"
      ? Math.round(boxAnalysis.finalScore)
      : 0;
  const score_global = Math.round(imeiAi * 0.5 + boxAi * 0.5);
  const verdict: NonNullable<StoredOkResponse["fusionAnalysis"]>["verdict"] =
    score_global >= 70
      ? "Authentique"
      : score_global >= 50
        ? "Suspect"
        : "Invalide";
  const niveau_confiance: NonNullable<
    StoredOkResponse["fusionAnalysis"]
  >["niveau_confiance"] =
    score_global >= 70 ? "Elevé" : score_global >= 50 ? "Moyen" : "Faible";
  const risque_global: NonNullable<
    StoredOkResponse["fusionAnalysis"]
  >["risque_global"] =
    score_global >= 70 ? "Faible" : score_global >= 50 ? "Moyen" : "Elevé";
  return {
    score_imei_ai: imeiAi,
    score_box_ai: boxAi,
    score_global,
    verdict,
    niveau_confiance,
    coherence: Math.abs(imeiAi - boxAi) <= 25 ? "oui" : "non",
    forces: ["Synthèse calculée côté app à partir des scores IMEI et boîte"],
    faiblesses:
      score_global < 50
        ? ["Score global sous le seuil de validation"]
        : imeiAi < 50 || boxAi < 50
          ? ["Au moins une des deux IA est en dessous du confort"]
          : [],
    recommandations:
      score_global >= 50
        ? ["Vérifier les détails affichés sur l'écran précédent si besoin"]
        : [
            "Reprendre la procédure depuis cette page avec de meilleures photos",
          ],
    risque_global,
    decision: score_global >= 50 ? "STOCKER" : "REJETER",
    raison: `Score global ${score_global}% (IMEI-AI ${imeiAi}%, BOX-AI ${boxAi}%)${imeiLabel ? ` pour ${imeiLabel}` : ""}`,
  };
}

const API_BASE_URL = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}`
  : "https://localhost:3000";

// ??? Cyber color palette ??????????????????????????????????????????????????????

const CYBER = {
  bg: "#040810",
  surface: "#080f1c",
  card: "#0d1829",
  border: "#1a3a5c",
  accent: "#00d4ff",
  accent2: "#0066ff",
  green: "#00ff88",
  red: "#ff2244",
  amber: "#ffaa00",
  text: "#c8e8ff",
  muted: "#4a7a99",
  glow: "rgba(0,212,255,0.15)",
};

// ??? Sub-components ???????????????????????????????????????????????????????????

/** Animated shield logo */
const ShieldLogo = () => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -4,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim, glowAnim]);

  const opacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  return (
    <Animated.View
      style={{ transform: [{ translateY: floatAnim }], opacity }}
    >
      <Svg width={36} height={36} viewBox="0 0 36 36" fill="none">
        <Path
          d="M18 2L4 8v10c0 8.84 5.99 17.12 14 19 8.01-1.88 14-10.16 14-19V8L18 2z"
          stroke={CYBER.accent}
          strokeWidth={1.5}
          strokeLinejoin="round"
          fill="rgba(0,212,255,0.06)"
        />
        <Path
          d="M13 18l3.5 3.5L23 14"
          stroke={CYBER.green}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={18} cy={18} r={5} stroke="rgba(0,212,255,0.25)" strokeWidth={0.5} fill="none" />
      </Svg>
    </Animated.View>
  );
};

/** Animated status dot */
const StatusDot = () => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);
  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: CYBER.green,
        opacity: pulse,
      }}
    />
  );
};

/** Scan line animation (purely decorative, floats across the header) */
const ScanLine = () => {
  const scan = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(scan, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [scan]);
  const translateY = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [-2, 800],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          transform: [{ translateY }],
          height: 2,
          backgroundColor: "transparent",
          borderTopWidth: 1,
          borderTopColor: "rgba(0,212,255,0.25)",
          zIndex: 999,
        },
      ]}
    />
  );
};

/** Corner decoration for photo cards */
const CornerDeco = ({ color = CYBER.accent }: { color?: string }) => (
  <>
    {/* TL */}
    <View style={[s.corner, s.cornerTL, { borderColor: color }]} />
    {/* TR */}
    <View style={[s.corner, s.cornerTR, { borderColor: color }]} />
    {/* BL */}
    <View style={[s.corner, s.cornerBL, { borderColor: color }]} />
    {/* BR */}
    <View style={[s.corner, s.cornerBR, { borderColor: color }]} />
  </>
);

/** IMEI pip progress */
const ImeiPips = ({ count }: { count: number }) => (
  <View style={{ flexDirection: "row", gap: 3 }}>
    {Array.from({ length: 15 }).map((_, i) => (
      <View
        key={i}
        style={{
          width: 14,
          height: 3,
          borderRadius: 1.5,
          backgroundColor: i < count ? CYBER.accent : "rgba(255,255,255,0.07)",
        }}
      />
    ))}
  </View>
);

/** Photo thumbnail card */
const PhotoCard = ({
  uri,
  label,
  sublabel,
  icon,
}: {
  uri: string | null;
  label: string;
  sublabel: string;
  icon: string;
}) => {
  const hasPic = !!uri;
  return (
    <View
      style={[
        s.photoCard,
        hasPic
          ? { borderColor: "rgba(0,255,136,0.4)", backgroundColor: "rgba(0,255,136,0.03)" }
          : { borderStyle: "dashed", borderColor: CYBER.border },
      ]}
    >
      <CornerDeco color={hasPic ? CYBER.green : CYBER.accent} />
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      ) : null}
      <View style={s.photoInner}>
        <Text style={{ fontSize: 24, opacity: hasPic ? 1 : 0.4 }}>{icon}</Text>
        <Text
          style={[
            s.photoLabel,
            { color: hasPic ? CYBER.green : CYBER.muted },
          ]}
        >
          {label}
        </Text>
        <Text style={[s.photoSub, { color: hasPic ? "rgba(0,255,136,0.6)" : CYBER.muted }]}>
          {hasPic ? "CAPTURED" : sublabel}
        </Text>
      </View>
      {hasPic && (
        <View style={s.photoCheck}>
          <Feather name="check" size={10} color="#000" />
        </View>
      )}
    </View>
  );
};

/** Section header with cyber line */
const SectionHeader = ({ label }: { label: string }) => (
  <View style={s.sectionHeader}>
    <Text style={s.sectionLabel}>{label}</Text>
    <View style={s.sectionLine} />
  </View>
);

/** Cyber-styled text input */
const CyberInput = ({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  maxLength,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: any;
  maxLength?: number;
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.inputLabel}>{label}</Text>
      <StyledInput
        label=""
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        maxLength={maxLength}
        // Pass focus/blur for glow — actual implementation depends on StyledInput internals
      />
    </View>
  );
};

/** Animated score bar */
const ScoreBar = ({
  label,
  score,
  anim,
}: {
  label: string;
  score: number;
  anim: Animated.Value;
}) => {
  const color =
    score >= 70 ? CYBER.green : score >= 50 ? CYBER.amber : CYBER.red;
  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={s.barLabel}>{label}</Text>
        <Text style={[s.barLabel, { color }]}>{score}%</Text>
      </View>
      <View style={s.barTrack}>
        <Animated.View
          style={[s.barFill, { width, backgroundColor: color }]}
        />
      </View>
    </View>
  );
};

// ??? Main Screen ??????????????????????????????????????????????????????????????

export default function AddPhoneScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();

  const [imei, setImei] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [boxFrontUri, setBoxFrontUri] = useState<string | null>(null);
  const [boxFrontImage, setBoxFrontImage] = useState<string | null>(null);
  const [boxAngleUri, setBoxAngleUri] = useState<string | null>(null);
  const [boxAngleImage, setBoxAngleImage] = useState<string | null>(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"imei" | "front" | "angle">("front");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResultResponse | null>(null);

  const imeiBar = useRef(new Animated.Value(0)).current;
  const boxBar = useRef(new Animated.Value(0)).current;

  // Submit button pulse animation
  const submitPulse = useRef(new Animated.Value(0)).current;

  type ScanStatus = "idle" | "scanning" | "found" | "not_found";
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [detectedImei, setDetectedImei] = useState("");
  const [scanConfidence, setScanConfidence] = useState(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(submitPulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(submitPulse, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [submitPulse]);

  const autoScanForImei = async (base64: string) => {
    setScanStatus("scanning");
    setDetectedImei("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/phones/ocr-scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      if (!res.ok) {
        setScanStatus("not_found");
        return;
      }
      const data = (await res.json()) as {
        bestCandidate: string;
        candidates: string[];
        confidence: number;
      };
      if (data.bestCandidate && data.bestCandidate.length === 15) {
        setDetectedImei(data.bestCandidate);
        setScanConfidence(Math.round(data.confidence));
        setImei((prev) => (prev.length < 15 ? data.bestCandidate : prev));
        setScanStatus("found");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setScanStatus("not_found");
      }
    } catch {
      setScanStatus("not_found");
    }
  };

  const toBase64FromUri = async (uri: string): Promise<string> => {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );
    if (!manipulated.base64) throw new Error("Image conversion failed");
    return `data:image/jpeg;base64,${manipulated.base64}`;
  };

  const convertToBase64 = async (uri: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("FileReader error"));
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        setError("Could not read image. Please try a different photo.");
        return null;
      }
    } else {
      try {
        return await toBase64FromUri(uri);
      } catch {
        setError("Could not process image. Please try again.");
        return null;
      }
    }
  };

  const convertAndSetBase64 = async (uri: string) => {
    const base64 = await convertToBase64(uri);
    if (!base64) return;
    setImageBase64(base64);
    void autoScanForImei(base64);
  };

  const applyImageForTarget = async (
    target: "imei" | "front" | "angle",
    uri: string
  ) => {
    if (target === "imei") {
      setImageUri(uri);
      setScanStatus("idle");
      await convertAndSetBase64(uri);
      return;
    }
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 300 } }],
      { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    const base64 = `data:image/jpeg;base64,${manipulated.base64}`;
    if (!base64) return;
    if (target === "front") {
      setBoxFrontUri(uri);
      setBoxFrontImage(base64);
    } else {
      setBoxAngleUri(uri);
      setBoxAngleImage(base64);
    }
  };

  const pickImageForTarget = async (target: "imei" | "front" | "angle") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Please allow access to your photo library.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.8,
      base64: false,
    });
    if (picked.canceled || !picked.assets[0]?.uri) return;
    await applyImageForTarget(target, picked.assets[0].uri);
  };

  const openCameraModal = async (target: "imei" | "front" | "angle") => {
    if (Platform.OS === "web") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError("Please allow camera access.");
        return;
      }
      const captured = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.8,
        base64: false,
      });
      if (captured.canceled || !captured.assets[0]?.uri) return;
      await applyImageForTarget(target, captured.assets[0].uri);
      return;
    }
    if (!cameraPermission?.granted) {
      const perm = await requestCameraPermission();
      if (!perm.granted) {
        setError("Please allow camera access.");
        return;
      }
    }
    setCameraTarget(target);
    setCameraVisible(true);
  };

  const capturePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) return;
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: cameraTarget === "imei" ? 800 : 300 } }],
        {
          compress: cameraTarget === "imei" ? 0.7 : 0.4,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
      const base64 = manipulated.base64;
      if (!base64) {
        setError("Failed to process captured photo.");
        return;
      }
      const data = `data:image/jpeg;base64,${base64}`;
      if (cameraTarget === "imei") {
        setImageUri(photo.uri);
        setImageBase64(data);
        setScanStatus("idle");
        void autoScanForImei(data);
      } else if (cameraTarget === "front") {
        setBoxFrontUri(photo.uri);
        setBoxFrontImage(data);
      } else {
        setBoxAngleUri(photo.uri);
        setBoxAngleImage(data);
      }
      setCameraVisible(false);
    } catch {
      setError("Failed to capture photo. Please try again.");
    }
  };

  useEffect(() => {
    if (!analyzing) return;
    setAnalysisStep(0);
    const t1 = setTimeout(() => setAnalysisStep(1), 1500);
    const t2 = setTimeout(() => setAnalysisStep(2), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [analyzing]);

  const handleAnalyze = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    setAnalysisResult(null);

    if (!/^\d{15}$/.test(imei.trim())) {
      setError("IMEI must be exactly 15 digits");
      setIsSubmitting(false);
      return;
    }
    if (!imageBase64) {
      setError("Please select or take a photo of the IMEI sticker");
      setIsSubmitting(false);
      return;
    }
    if (!boxFrontImage || !boxAngleImage) {
      setError("Please capture both box photos.");
      setIsSubmitting(false);
      return;
    }

    setLoading(true);
    setAnalyzing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const body = {
        imei: imei.trim(),
        brand: brand.trim(),
        model: model.trim(),
        imageBase64,
        boxFrontImage,
        boxAngleImage,
        userId: user?.id ?? null,
      };

      const res = await fetch(`${API_BASE_URL}/api/phones`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => null)) as
        | AnalyzeResultResponse
        | { message?: string }
        | null;

      if (res.status === 200 || res.status === 422) {
        const resultData = data as AnalyzeResultResponse | null;
        if (!resultData || typeof resultData.stored !== "boolean") {
          setError("Unexpected verification response.");
        } else {
          void Haptics.notificationAsync(
            resultData.stored
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Error
          );

          const fusionAnalysisResolved =
            resultData.fusionAnalysis ??
            fallbackFusionAnalysisFromParts(
              resultData.imeiAnalysis,
              resultData.boxAnalysis,
              imei.trim()
            );

          await AsyncStorage.setItem(
            "pending_fusion_result",
            JSON.stringify({
              fusionAnalysis: fusionAnalysisResolved,
              imei: imei.trim(),
              imeiAnalysis: resultData.imeiAnalysis,
              boxAnalysis: resultData.boxAnalysis,
              stored: resultData.stored,
              message: "message" in resultData ? resultData.message : undefined,
            })
          );

          router.push({
            pathname: "/fusion-result",
            params: { imei: imei.trim() },
          });
        }
      } else {
        const err = data as { message?: string } | null;
        setError(err?.message ?? "Verification failed.");
      }
    } catch {
      setError("Connection error. Check server is running.");
      setAnalyzing(false);
    } finally {
      setLoading(false);
      setIsSubmitting(false);
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setImei("");
    setBrand("");
    setModel("");
    setImageUri(null);
    setImageBase64(null);
    setError("");
    setScanStatus("idle");
    setDetectedImei("");
    setScanConfidence(0);
    setBoxFrontUri(null);
    setBoxFrontImage(null);
    setBoxAngleUri(null);
    setBoxAngleImage(null);
    setAnalysisResult(null);
    imeiBar.setValue(0);
    boxBar.setValue(0);
  };

  const canSubmit =
    /^\d{15}$/.test(imei.trim()) &&
    imageBase64 !== null &&
    boxFrontImage !== null &&
    boxAngleImage !== null;

  const fusionData = analysisResult?.fusionAnalysis;

  const getScoreColor = (score: number) =>
    score >= 70 ? CYBER.green : score >= 50 ? CYBER.amber : CYBER.red;

  useEffect(() => {
    if (!analysisResult || !fusionData) return;
    Animated.timing(imeiBar, {
      toValue: fusionData.score_imei_ai,
      duration: 700,
      useNativeDriver: false,
    }).start();
    Animated.timing(boxBar, {
      toValue: fusionData.score_box_ai,
      duration: 700,
      useNativeDriver: false,
    }).start();
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  }, [analysisResult, fusionData, boxBar, imeiBar]);

  const processingSteps = [
    "? Analyzing IMEI sticker...",
    "? Analyzing box photos...",
    "? Running Fusion AI...",
  ];

  const submitScale = submitPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.015],
  });

  // ??? Render ???????????????????????????????????????????????????????????????

  return (
    <View style={[s.root, { backgroundColor: CYBER.bg }]}>
      {/* Decorative scan line */}
      <ScanLine />

      {/* Grid background dots */}
      <View style={s.gridBg} pointerEvents="none" />

      {/* Success banner */}
      {successMsg ? (
        <View style={s.successBanner}>
          <Feather name="check-circle" size={14} color={CYBER.green} />
          <Text style={s.successText}>{successMsg}</Text>
        </View>
      ) : null}

      {/* ?? Camera Modal ?? */}
      {Platform.OS !== "web" && (
        <Modal visible={cameraVisible} animationType="slide" transparent={false}>
          <View style={s.modalContainer}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              facing="back"
            />
            {/* Cyber overlay corners */}
            <View style={s.cameraCornerTL} />
            <View style={s.cameraCornerTR} />
            <View style={s.cameraCornerBL} />
            <View style={s.cameraCornerBR} />

            <View style={s.cameraTopBar}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setCameraVisible(false)}
              >
                <Feather name="x" size={20} color={CYBER.accent} />
              </TouchableOpacity>
              <View style={s.cameraStatusDot} />
              <Text style={s.cameraStatusText}>SCANNING</Text>
            </View>

            <View style={s.overlayLabel}>
              <Text style={s.overlayLabelText}>
                {cameraTarget === "imei"
                  ? "ALIGN IMEI STICKER IN FRAME"
                  : cameraTarget === "front"
                    ? "ALIGN BOX FRONT FACE"
                    : "TILT BOX TO ANGLE VIEW"}
              </Text>
            </View>

            <View style={s.captureWrap}>
              <TouchableOpacity style={s.captureBtn} onPress={capturePhoto}>
                <View style={s.captureRing} />
                <View style={s.captureInner} />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ?? Header ?? */}
      <View
        style={[
          s.header,
          { paddingTop: insets.top + (Platform.OS === "web" ? 40 : 16) },
        ]}
      >
        <View style={s.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backBtn}
          >
            <Feather name="arrow-left" size={18} color={CYBER.accent} />
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <ShieldLogo />
            <View style={{ marginLeft: 10 }}>
              <Text style={s.headerTitle}>CyberVerify</Text>
              <Text style={s.headerSub}>AI PHONE AUTHENTICATOR</Text>
            </View>
          </View>

          <TouchableOpacity style={s.backBtn} onPress={handleReset}>
            <Feather name="refresh-cw" size={16} color={CYBER.muted} />
          </TouchableOpacity>
        </View>

        {/* Status strip */}
        <View style={s.statusBar}>
          <StatusDot />
          <Text style={s.statusText}>SECURE CHANNEL ACTIVE</Text>
          <View style={{ flex: 1 }} />
          <Text style={[s.statusText, { color: CYBER.accent }]}>AES-256</Text>
        </View>
      </View>

      {/* ?? Scroll Content ?? */}
      <ScrollView
        ref={(r) => { scrollRef.current = r; }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ?? Device Info ?? */}
        <SectionHeader label="Device Identification" />

        {/* IMEI field with pips */}
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>
            <Text style={{ color: CYBER.accent }}>? </Text>IMEI CODE
          </Text>
          <View
            style={[
              s.imeiDisplay,
              imei.length > 0 && { borderColor: CYBER.accent },
            ]}
          >
            <Text style={s.imeiDigits}>
              {imei || "···············"}
            </Text>
          </View>
          <View style={s.pipRow}>
            <ImeiPips count={imei.length} />
            <Text style={[s.statusText, { marginLeft: "auto" }]}>
              {imei.length}/15
            </Text>
          </View>
          {/* Hidden input to capture keyboard input */}
          <StyledInput
            label=""
            placeholder="15-digit IMEI (e.g. 358392049957572)"
            value={imei}
            onChangeText={(t) => setImei(t.replace(/\D/g, "").slice(0, 15))}
            keyboardType="numeric"
            maxLength={15}
          />
        </View>

        <View style={s.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={s.inputLabel}>BRAND</Text>
            <StyledInput
              label=""
              placeholder="e.g. Apple"
              value={brand}
              onChangeText={setBrand}
            />
          </View>
          <View style={{ width: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.inputLabel}>MODEL</Text>
            <StyledInput
              label=""
              placeholder="e.g. S24"
              value={model}
              onChangeText={setModel}
            />
          </View>
        </View>

        {/* ?? IMEI Sticker ?? */}
        <SectionHeader label="IMEI Sticker Scan" />

        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => void openCameraModal("imei")}
          >
            <Feather name="camera" size={18} color={CYBER.accent} />
            <Text style={s.actionBtnText}>CAMERA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => void pickImageForTarget("imei")}
          >
            <Feather name="image" size={18} color={CYBER.accent} />
            <Text style={s.actionBtnText}>GALLERY</Text>
          </TouchableOpacity>
        </View>

        <View style={s.photoRow}>
          <PhotoCard
            uri={imageUri}
            label="IMEI"
            sublabel="REQUIRED"
            icon="??"
          />
        </View>

        {/* Scan status badge */}
        {scanStatus === "scanning" && (
          <View style={[s.scanBadge, s.scanBadgeScanning]}>
            <ActivityIndicator color={CYBER.accent} size="small" />
            <Text style={[s.scanTitle, { color: CYBER.accent }]}>
              SCANNING IMAGE FOR IMEI...
            </Text>
          </View>
        )}
        {scanStatus === "found" && (
          <View style={[s.scanBadge, s.scanBadgeFound]}>
            <Feather name="check-circle" size={14} color={CYBER.green} />
            <View style={{ flex: 1 }}>
              <Text style={[s.scanTitle, { color: CYBER.green }]}>
                IMEI DETECTED FROM PHOTO
              </Text>
              <Text style={[s.scanSub, { color: CYBER.green, opacity: 0.7 }]}>
                {detectedImei} · OCR confidence {scanConfidence}%
              </Text>
            </View>
          </View>
        )}
        {scanStatus === "not_found" && (
          <View style={[s.scanBadge, s.scanBadgeFail]}>
            <Feather name="alert-triangle" size={14} color={CYBER.amber} />
            <Text style={[s.scanTitle, { color: CYBER.amber, flex: 1 }]}>
              IMEI NOT DETECTED — take a clearer photo or type IMEI manually
            </Text>
          </View>
        )}

        {/* ?? Error Banner ?? */}
        {error ? (
          <View style={s.errorBanner}>
            <Feather name="alert-circle" size={14} color={CYBER.red} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ?? Box Verify Shortcut ?? */}
        <TouchableOpacity
          style={s.boxVerifyBtn}
          onPress={() => router.push("/box-verify")}
          activeOpacity={0.85}
        >
          <View style={s.bvbIcon}>
            <Feather name="box" size={20} color="#60a5fa" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.bvbTitle}>VERIFY BOX AUTHENTICITY</Text>
            <Text style={s.bvbSub}>8-layer AI analysis engine</Text>
          </View>
          <Feather name="arrow-right" size={16} color="#60a5fa" />
        </TouchableOpacity>

        {/* ?? Box Photos ?? */}
        <SectionHeader label="Box Documentation" />

        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => void openCameraModal("front")}
          >
            <Feather name="camera" size={18} color={CYBER.accent} />
            <Text style={s.actionBtnText}>FRONT</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => void openCameraModal("angle")}
          >
            <Feather name="camera" size={18} color={CYBER.accent} />
            <Text style={s.actionBtnText}>ANGLE</Text>
          </TouchableOpacity>
        </View>

        <View style={s.photoGrid}>
          <PhotoCard
            uri={boxFrontUri}
            label="FRONT"
            sublabel="PENDING"
            icon="??"
          />
          <PhotoCard
            uri={boxAngleUri}
            label="ANGLE"
            sublabel="PENDING"
            icon="??"
          />
        </View>

        {/* ?? Submit ?? */}
        <Animated.View
          style={{
            transform: canSubmit ? [{ scale: submitScale }] : [],
            marginTop: 24,
          }}
        >
          <TouchableOpacity
            style={[
              s.submitBtn,
              !canSubmit && { opacity: 0.35, borderColor: CYBER.border },
            ]}
            onPress={handleAnalyze}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={CYBER.accent} />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
                  <Path
                    d="M9 1L16 5v6c0 4.4-2.9 8.5-7 9.3C3.9 19.5 1 15.4 1 11V5L9 1z"
                    stroke={CYBER.accent}
                    strokeWidth={1.5}
                    fill="none"
                  />
                  <Path
                    d="M6 9l2.5 2.5L12 7"
                    stroke={CYBER.accent}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text style={s.submitText}>CONFIRM &amp; ANALYZE</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {loading && (
          <View style={s.loadingInfo}>
            <Text style={[s.statusText, { color: CYBER.accent }]}>
              {processingSteps[Math.min(analysisStep, 2)]}
            </Text>
          </View>
        )}

        {/* ?? Analysis Result ?? */}
        {analysisResult && fusionData ? (
          <View style={s.analysisContainer}>
            {/* Decision banner */}
            <View
              style={[
                s.decisionBanner,
                {
                  backgroundColor:
                    fusionData.score_global >= 50
                      ? "rgba(0,255,136,0.07)"
                      : "rgba(255,34,68,0.07)",
                  borderColor:
                    fusionData.score_global >= 50
                      ? "rgba(0,255,136,0.4)"
                      : "rgba(255,34,68,0.4)",
                },
              ]}
            >
              <Feather
                name={fusionData.score_global >= 50 ? "check-circle" : "x-circle"}
                size={22}
                color={fusionData.score_global >= 50 ? CYBER.green : CYBER.red}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={[
                    s.decisionTitle,
                    {
                      color:
                        fusionData.score_global >= 50 ? CYBER.green : CYBER.red,
                    },
                  ]}
                >
                  {fusionData.decision === "STOCKER"
                    ? "IMEI STORED — AUTHENTIC"
                    : "IMEI REJECTED — SUSPICIOUS"}
                </Text>
                <Text style={[s.decisionSub, { color: CYBER.muted }]}>
                  {fusionData.raison}
                </Text>
              </View>
            </View>

            <SectionHeader label="AI Analysis Scores" />

            <View style={s.scoreCard}>
              <ScoreBar
                label="IMEI-AI"
                score={fusionData.score_imei_ai}
                anim={imeiBar}
              />
              <ScoreBar
                label="BOX-AI"
                score={fusionData.score_box_ai}
                anim={boxBar}
              />

              <View style={s.globalScoreRow}>
                <Text style={s.barLabel}>GLOBAL SCORE</Text>
                <Text
                  style={[
                    s.globalScoreVal,
                    { color: getScoreColor(fusionData.score_global) },
                  ]}
                >
                  {fusionData.score_global}%
                </Text>
              </View>

              <View style={s.tagRow}>
                {[
                  { label: fusionData.verdict },
                  { label: fusionData.niveau_confiance },
                  { label: `RISK: ${fusionData.risque_global}` },
                ].map((t) => (
                  <View key={t.label} style={s.tag}>
                    <Text style={s.tagText}>{t.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ??? Styles ???????????????????????????????????????????????????????????????????

const s = StyleSheet.create({
  root: { flex: 1 },
  gridBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },

  // Header
  header: {
    backgroundColor: CYBER.surface,
    borderBottomWidth: 1,
    borderBottomColor: CYBER.border,
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: CYBER.accent,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  headerSub: {
    fontSize: 9,
    color: CYBER.muted,
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CYBER.border,
    backgroundColor: CYBER.card,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,212,255,0.08)",
  },
  statusText: {
    fontSize: 10,
    color: CYBER.muted,
    letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },

  // Scroll
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: CYBER.accent,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: CYBER.border,
  },

  // Inputs
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 10,
    color: CYBER.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  imeiDisplay: {
    backgroundColor: CYBER.card,
    borderWidth: 1,
    borderColor: CYBER.border,
    borderRadius: 8,
    padding: 12,
  },
  imeiDigits: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 18,
    fontWeight: "700",
    color: CYBER.accent,
    letterSpacing: 3,
  },
  pipRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 2,
  },
  twoCol: {
    flexDirection: "row",
    gap: 10,
  },

  // Action buttons
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: CYBER.card,
    borderWidth: 1,
    borderColor: CYBER.border,
    borderRadius: 8,
    paddingVertical: 10,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: CYBER.text,
    letterSpacing: 1.5,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },

  // Photo grid
  photoGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  photoRow: {
    marginBottom: 10,
  },
  photoCard: {
    flex: 1,
    aspectRatio: 4 / 3,
    backgroundColor: CYBER.card,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  photoInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  photoLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  photoSub: {
    fontSize: 9,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
  },
  photoCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: CYBER.green,
    alignItems: "center",
    justifyContent: "center",
  },

  // Corner decorations
  corner: {
    position: "absolute",
    width: 12,
    height: 12,
    borderWidth: 2,
  },
  cornerTL: { top: 6, left: 6, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 6, right: 6, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 6, left: 6, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 6, right: 6, borderLeftWidth: 0, borderTopWidth: 0 },

  // Scan badges
  scanBadge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  scanBadgeFound: {
    backgroundColor: "rgba(0,255,136,0.05)",
    borderColor: "rgba(0,255,136,0.3)",
  },
  scanBadgeScanning: {
    backgroundColor: "rgba(0,212,255,0.05)",
    borderColor: "rgba(0,212,255,0.2)",
  },
  scanBadgeFail: {
    backgroundColor: "rgba(255,170,0,0.05)",
    borderColor: "rgba(255,170,0,0.3)",
  },
  scanTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  scanSub: {
    fontSize: 10,
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },

  // Error
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,34,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,34,68,0.3)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 11,
    color: "#ff6680",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 0.5,
  },

  // Box verify shortcut
  boxVerifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(0,102,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,102,255,0.35)",
    borderRadius: 10,
    padding: 14,
    marginVertical: 6,
  },
  bvbIcon: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(0,102,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,102,255,0.35)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bvbTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#60a5fa",
    letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  bvbSub: {
    fontSize: 10,
    color: CYBER.muted,
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },

  // Submit
  submitBtn: {
    padding: 16,
    backgroundColor: "rgba(0,212,255,0.08)",
    borderWidth: 1,
    borderColor: CYBER.accent,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontSize: 13,
    fontWeight: "700",
    color: CYBER.accent,
    letterSpacing: 3,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },

  // Loading
  loadingInfo: {
    alignItems: "center",
    marginTop: 12,
  },

  // Analysis
  analysisContainer: {
    marginTop: 20,
  },
  decisionBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
  },
  decisionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  decisionSub: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  scoreCard: {
    backgroundColor: CYBER.card,
    borderWidth: 1,
    borderColor: CYBER.border,
    borderRadius: 10,
    padding: 16,
  },
  barLabel: {
    fontSize: 10,
    color: CYBER.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  barTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },
  globalScoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CYBER.border,
  },
  globalScoreVal: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  tag: {
    backgroundColor: "rgba(0,212,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.25)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 9,
    color: CYBER.accent,
    letterSpacing: 1,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },

  // Success
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,255,136,0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,255,136,0.3)",
    padding: 10,
    paddingHorizontal: 16,
  },
  successText: {
    fontSize: 12,
    color: CYBER.green,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 0.5,
  },

  // Camera modal
  modalContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraTopBar: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },
  cancelBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.4)",
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CYBER.red,
  },
  cameraStatusText: {
    fontSize: 11,
    color: CYBER.accent,
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  overlayLabel: {
    position: "absolute",
    bottom: 130,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.3)",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  overlayLabelText: {
    fontSize: 11,
    color: CYBER.accent,
    letterSpacing: 2,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  captureWrap: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  captureBtn: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  captureRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: CYBER.accent,
  },
  captureInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: CYBER.accent,
    opacity: 0.9,
  },

  // Camera corners
  cameraCornerTL: {
    position: "absolute",
    top: 140,
    left: 40,
    width: 30,
    height: 30,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: CYBER.accent,
    zIndex: 5,
  },
  cameraCornerTR: {
    position: "absolute",
    top: 140,
    right: 40,
    width: 30,
    height: 30,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: CYBER.accent,
    zIndex: 5,
  },
  cameraCornerBL: {
    position: "absolute",
    bottom: 200,
    left: 40,
    width: 30,
    height: 30,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: CYBER.accent,
    zIndex: 5,
  },
  cameraCornerBR: {
    position: "absolute",
    bottom: 200,
    right: 40,
    width: 30,
    height: 30,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: CYBER.accent,
    zIndex: 5,
  },
});
