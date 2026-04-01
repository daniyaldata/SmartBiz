import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import OnboardingScreen from './src/screens/OnboardingScreen';
import BusinessListScreen from './src/screens/BusinessListScreen';
import CreateBusinessScreen from './src/screens/CreateBusinessScreen';
import AppNavigator from './src/navigation/AppNavigator';
import { getBusinessIndex } from './src/data/BusinessStore';

const Stack = createStackNavigator();

function SplashContent() {
  return (
    <View style={{
      flex: 1,
      backgroundColor: '#0077C5',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <View style={{
        width: 84,
        height: 84,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 18,
      }}>
        <Text style={{ fontSize: 34, fontWeight: '700', color: '#fff' }}>
          SB
        </Text>
      </View>
      <Text style={{
        fontSize: 32,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
        letterSpacing: 0.5,
      }}>
        SmartBiz
      </Text>
      <Text style={{
        fontSize: 14,
        color: 'rgba(255,255,255,0.75)',
        marginBottom: 48,
      }}>
        Your pocket accountant
      </Text>
      <ActivityIndicator color="rgba(255,255,255,0.5)" size="small" />
    </View>
  );
}

export default function App() {
  const [appState, setAppState] = useState('loading');
  const [initialRoute, setInitialRoute] = useState('Onboarding');

  useEffect(() => {
    const timer = setTimeout(async () => {
      const businesses = await getBusinessIndex();
      if (businesses.length > 0) {
        setInitialRoute('BusinessList');
      } else {
        setInitialRoute('Onboarding');
      }
      setAppState('ready');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (appState === 'loading') {
    return (
      <SafeAreaProvider>
        <SplashContent />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={initialRoute}
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="BusinessList" component={BusinessListScreen} />
          <Stack.Screen name="CreateBusiness" component={CreateBusinessScreen} />
          <Stack.Screen name="Main" component={AppNavigator} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}