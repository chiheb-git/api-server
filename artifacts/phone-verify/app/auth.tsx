import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { StyledInput } from "@/components/StyledInput";
import { PrimaryButton } from "@/components/PrimaryButton";

const BASE_URL = process.env["EXPO_PUBLIC_DOMAIN"] ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}` : "";

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    setError("");
    if (!email || !password || (!isLogin && !name)) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const body = isLogin
        ? { email, password }
        : { name, email, password };

      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { token?: string; user?: { id: number; name: string; email: string }; message?: string };

      if (!res.ok) {
        setError(data.message ?? "Something went wrong");
        return;
      }

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
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 40 : 60), paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo area */}
        <View style={styles.logoArea}>
          <View style={[styles.logoIcon, { backgroundColor: colors.primary }]}>
            <Feather name="shield" size={36} color="#fff" />
          </View>
          <Text style={[styles.appName, { color: colors.foreground }]}>PhoneVerify</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            AI-powered phone security verification
          </Text>
        </View>

        {/* Tab switcher */}
        <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
          <TouchableOpacity
            style={[styles.tab, isLogin && { backgroundColor: colors.primary }]}
            onPress={() => { setIsLogin(true); setError(""); }}
          >
            <Text style={[styles.tabText, { color: isLogin ? "#fff" : colors.mutedForeground }]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, !isLogin && { backgroundColor: colors.primary }]}
            onPress={() => { setIsLogin(false); setError(""); }}
          >
            <Text style={[styles.tabText, { color: !isLogin ? "#fff" : colors.mutedForeground }]}>Register</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {!isLogin && (
            <StyledInput
              ref={nameRef}
              label="Full Name"
              placeholder="John Doe"
              value={name}
              onChangeText={setName}
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              autoCapitalize="words"
            />
          )}
          <StyledInput
            ref={emailRef}
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <View style={styles.passwordWrapper}>
            <StyledInput
              ref={passwordRef}
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
              <Feather name="alert-circle" size={14} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          <PrimaryButton
            title={isLogin ? "Sign In" : "Create Account"}
            onPress={handleSubmit}
            loading={loading}
            style={{ marginTop: 8 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#00BFA5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  tabRow: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  passwordWrapper: {
    position: "relative",
  },
  eyeButton: {
    position: "absolute",
    right: 16,
    top: 38,
    zIndex: 1,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
    fontFamily: "Inter_400Regular",
  },
});
