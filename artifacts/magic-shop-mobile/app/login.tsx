import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!username || !password) {
      Alert.alert("Greška", "Unesite korisničko ime i šifru");
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Pokušajte ponovo";
      Alert.alert("Greška pri prijavljivanju", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={["#1B2748", "#0E172B", "#040712"]}
      style={styles.flex}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <View style={styles.brandBox}>
          <Logo size={120} />
          <Text style={[styles.brand, { color: colors.copperLight }]}>
            Magic Cosmetic Shop
          </Text>
          <Text style={styles.subtitle}>CRM za upravljanje prodajom</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Korisničko ime</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Unesite korisničko ime"
            placeholderTextColor="rgba(255,255,255,0.4)"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            editable={!submitting}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Šifra</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Unesite šifru"
            placeholderTextColor="rgba(255,255,255,0.4)"
            secureTextEntry
            autoComplete="current-password"
            editable={!submitting}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.copper }]}
            onPress={onSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Prijavi se</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.copy}>
          © {new Date().getFullYear()} Magic Cosmetic Shop
        </Text>
      </KeyboardAwareScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "web" ? 120 : 80,
    paddingBottom: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  brandBox: { alignItems: "center", gap: 12 },
  brand: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(237, 227, 214, 0.75)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
  },
  label: {
    color: "#EDE3D6",
    fontSize: 13,
    marginBottom: 6,
    fontFamily: "Inter_500Medium",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  button: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  copy: {
    color: "rgba(237, 227, 214, 0.5)",
    fontSize: 12,
    marginTop: 12,
  },
});
