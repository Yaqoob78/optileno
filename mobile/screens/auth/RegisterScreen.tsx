// mobile/screens/auth/RegisterScreen.tsx
/**
 * Register Screen
 * User registration
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

export default function RegisterScreen({ navigation }: any) {
  const { colors, spacing } = useAppTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
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
    loginLink: {
      marginTop: spacing.lg,
      alignItems: 'center',
    },
    loginText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    loginButton: {
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
      <Text style={styles.title}>Create Account</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        placeholderTextColor={colors.textSecondary}
        value={fullName}
        onChangeText={setFullName}
        editable={!loading}
      />

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

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        placeholderTextColor={colors.textSecondary}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        editable={!loading}
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.loginLink}
        onPress={() => navigation.navigate('Login')}
        disabled={loading}
      >
        <Text style={styles.loginText}>
          Already have an account?{' '}
          <Text style={styles.loginButton}>Sign In</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
