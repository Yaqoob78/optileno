// mobile/screens/SplashScreen.tsx
/**
 * Splash Screen
 * Displayed while app is loading
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

export default function SplashScreen() {
  const { colors } = useAppTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logo: {
      color: colors.primary,
      fontSize: 32,
      fontWeight: '700',
      marginBottom: 20,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Concierge</Text>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
