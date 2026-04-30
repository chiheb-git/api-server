import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  variant?: "primary" | "secondary" | "destructive";
}

export function PrimaryButton({ title, onPress, loading, disabled, style, variant = "primary" }: PrimaryButtonProps) {
  const colors = useColors();

  const bgColor =
    variant === "destructive" ? colors.destructive :
    variant === "secondary" ? colors.secondary :
    colors.primary;

  const textColor =
    variant === "secondary" ? colors.secondaryForeground : "#ffffff";

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled ?? loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        { backgroundColor: (disabled ?? loading) ? colors.muted : bgColor },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.text, { color: (disabled ?? loading) ? colors.mutedForeground : textColor }]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
