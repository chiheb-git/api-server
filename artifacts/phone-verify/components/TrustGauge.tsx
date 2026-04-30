import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

interface TrustGaugeProps {
  score: number;
  size?: number;
}

export function TrustGauge({ score, size = 160 }: TrustGaugeProps) {
  const colors = useColors();
  const animatedScore = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedScore, {
      toValue: score,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const radius = (size - 24) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score / 100);

  let gaugeColor: string;
  let riskLabel: string;
  if (score <= 40) {
    gaugeColor = colors.highRisk;
    riskLabel = "High Risk";
  } else if (score <= 70) {
    gaugeColor = colors.warning;
    riskLabel = "Medium Risk";
  } else {
    gaugeColor = colors.primary;
    riskLabel = "Verified Secure";
  }

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gaugeColor} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={gaugeColor} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.muted}
          strokeWidth={10}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={gaugeColor}
          strokeWidth={10}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[styles.center, { width: size, height: size }]} pointerEvents="none">
        <Text style={[styles.score, { color: gaugeColor }]}>{score}</Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Trust Score</Text>
        <Text style={[styles.risk, { color: gaugeColor }]}>{riskLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  score: {
    fontSize: 36,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  risk: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
});
