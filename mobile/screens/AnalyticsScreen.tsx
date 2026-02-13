// mobile/screens/AnalyticsScreen.tsx
/**
 * Analytics Screen
 * Performance metrics and forecasts
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

export default function AnalyticsScreen() {
  const { colors } = useAppTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    text: {
      color: colors.text,
      fontSize: 18,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Analytics Screen (Coming Soon)</Text>
    </View>
  );
}
