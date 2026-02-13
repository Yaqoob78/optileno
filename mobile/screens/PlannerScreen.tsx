// mobile/screens/PlannerScreen.tsx
/**
 * Planner Screen
 * Task planning and management
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

export default function PlannerScreen() {
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
      <Text style={styles.text}>Planner Screen (Coming Soon)</Text>
    </View>
  );
}
