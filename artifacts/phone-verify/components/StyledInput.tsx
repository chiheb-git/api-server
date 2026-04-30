import React, { forwardRef } from "react";
import { View, Text, TextInput, TextInputProps, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface StyledInputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const StyledInput = forwardRef<TextInput, StyledInputProps>(function StyledInput(
  { label, error, style, ...props },
  ref
) {
  const colors = useColors();

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text> : null}
      <TextInput
        ref={ref}
        style={[
          styles.input,
          {
            backgroundColor: colors.input,
            color: colors.foreground,
            borderColor: error ? colors.error : colors.border,
          },
          style,
        ]}
        placeholderTextColor={colors.mutedForeground}
        {...props}
      />
      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  error: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
});
