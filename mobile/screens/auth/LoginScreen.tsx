// mobile/screens/auth/LoginScreen.tsx
/**
 * Login Screen
 * User authentication
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';

export default function LoginScreen({ navigation }: any) {
  const { colors, spacing } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    // Implementation will connect to AuthService
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    title: {
      color: colors.text,
      fontSize: 32,
      fontWeight: '700',
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
    input: {
      backgroundColor: colors.card,
      color: colors.text,
      borderRadius: spacing.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: spacing.md,
      padding: spacing.md,
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    buttonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    signUpLink: {
      marginTop: spacing.lg,
      alignItems: 'center',
    },
    signUpText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    signUpButton: {
      color: colors.primary,
      fontWeight: '600',
    },
    errorText: {
      color: colors.danger,
      marginBottom: spacing.md,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Concierge</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textSecondary}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.textSecondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.signUpLink}
        onPress={() => navigation.navigate('Register')}
        disabled={loading}
      >
        <Text style={styles.signUpText}>
          Don't have an account?{' '}
          <Text style={styles.signUpButton}>Sign Up</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
