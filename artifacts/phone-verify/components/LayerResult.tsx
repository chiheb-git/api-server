import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface LayerResultProps {
  layerNumber: number;
  title: string;
  passed: boolean;
  details: Array<{ label: string; value: string | number | boolean }>;
}

export function LayerResult({ layerNumber, title, passed, details }: LayerResultProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: passed ? colors.primary : colors.highRisk }]}>
          <Text style={styles.badgeText}>Layer {layerNumber}</Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Feather
          name={passed ? "check-circle" : "x-circle"}
          size={20}
          color={passed ? colors.primary : colors.highRisk}
        />
      </View>
      {details.map((d, i) => (
        <View key={i} style={[styles.detail, { borderTopColor: colors.border }]}>
          <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{d.label}</Text>
          <Text style={[styles.detailValue, { color: typeof d.value === "boolean" ? (d.value ? colors.highRisk : colors.primary) : colors.foreground }]}>
            {typeof d.value === "boolean" ? (d.value ? "Yes" : "No") : String(d.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  detail: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
});
