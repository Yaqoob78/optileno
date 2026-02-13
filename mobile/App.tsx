/**
 * React Native Concierge App - Main Application Component
 * Provides navigation, real-time sync, and offline support
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Screens
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import DashboardScreen from './screens/DashboardScreen';
import PlannerScreen from './screens/PlannerScreen';
import ChatScreen from './screens/ChatScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import CollaborationScreen from './screens/CollaborationScreen';
import SettingsScreen from './screens/SettingsScreen';
import SplashScreen from './screens/SplashScreen';

// Services
import { RealtimeService } from './services/RealtimeService';
import { OfflineSyncManager } from './services/OfflineSyncManager';
import { AuthService } from './services/AuthService';
import { useAppTheme } from './hooks/useAppTheme';
import { useAuth } from './hooks/useAuth';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Auth Stack - Displayed when user is not logged in
 */
function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{
          animationTypeForReplace: 'pop',
        }}
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen}
      />
    </Stack.Navigator>
  );
}

/**
 * Main App Stack - Displayed when user is logged in
 */
function AppStack() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#94a3b8',
        headerStyle: {
          backgroundColor: '#0f172a',
          borderBottomColor: '#1e293b',
        },
        headerTintColor: '#f1f5f9',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <View style={{ width: size, height: size, backgroundColor: color, borderRadius: 4 }} />
          ),
        }}
      />
      
      <Tab.Screen
        name="Planner"
        component={PlannerScreen}
        options={{
          tabBarLabel: 'Plan',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <View style={{ width: size, height: size, backgroundColor: color, borderRadius: 4 }} />
          ),
        }}
      />
      
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <View style={{ width: size, height: size, backgroundColor: color, borderRadius: 4 }} />
          ),
        }}
      />
      
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <View style={{ width: size, height: size, backgroundColor: color, borderRadius: 4 }} />
          ),
        }}
      />
      
      <Tab.Screen
        name="Collaboration"
        component={CollaborationScreen}
        options={{
          tabBarLabel: 'Share',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <View style={{ width: size, height: size, backgroundColor: color, borderRadius: 4 }} />
          ),
        }}
      />
      
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <View style={{ width: size, height: size, backgroundColor: color, borderRadius: 4 }} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Root Navigator Component
 */
function RootNavigator() {
  const { state: authState, isLoading } = useAuth();
  const { colors } = useAppTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.card,
          text: colors.text,
          border: colors.border,
          notification: colors.notification,
        },
      }}
    >
      {authState.isSignedIn ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

/**
 * Main App Component
 */
export default function App() {
  const { colors } = useAppTheme();
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [syncActive, setSyncActive] = useState(false);

  useEffect(() => {
    // Initialize real-time service
    RealtimeService.connect();
    RealtimeService.on('connected', () => {
      setRealtimeConnected(true);
      OfflineSyncManager.sync(); // Sync when connection restored
    });
    RealtimeService.on('disconnected', () => {
      setRealtimeConnected(false);
    });

    // Initialize offline sync manager
    OfflineSyncManager.on('sync-start', () => setSyncActive(true));
    OfflineSyncManager.on('sync-complete', () => setSyncActive(false));
    OfflineSyncManager.startPeriodicSync(5 * 60 * 1000); // Sync every 5 minutes

    return () => {
      RealtimeService.disconnect();
      OfflineSyncManager.stopPeriodicSync();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootNavigator />
    </GestureHandlerRootView>
  );
}
