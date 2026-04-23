import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Vibration, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function PinLockScreen({ onUnlock, onSetupComplete, mode = 'unlock' }) {
  // mode: 'unlock' | 'setup' | 'confirm'
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [currentMode, setCurrentMode] = useState(mode);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    checkBiometric();
    if (mode === 'unlock') {
      tryBiometric();
    }
  }, []);

  const checkBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(hasHardware && isEnrolled);
  };

  const tryBiometric = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock SmartBiz',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        onUnlock?.();
      }
    } catch (e) {
      // Biometric failed silently, fall back to PIN
    }
  };

  const triggerError = (message) => {
    setError(message);
    setShake(true);
    Vibration.vibrate(400);
    setTimeout(() => {
      setShake(false);
      setPin('');
    }, 500);
    setTimeout(() => setError(''), 2000);
  };

  const handleKey = async (key) => {
    if (key === '') return;

    if (key === '⌫') {
      setPin(prev => prev.slice(0, -1));
      setError('');
      return;
    }

    const newPin = pin + key;
    setPin(newPin);

    if (newPin.length < 4) return;

    // PIN is now 4 digits — evaluate
    if (currentMode === 'unlock') {
      const stored = await SecureStore.getItemAsync('smartbiz_pin');
      if (newPin === stored) {
        setPin('');
        onUnlock?.();
      } else {
        triggerError('Incorrect PIN. Try again.');
      }
    }

    if (currentMode === 'setup') {
      setFirstPin(newPin);
      setPin('');
      setCurrentMode('confirm');
      setError('');
    }

    if (currentMode === 'confirm') {
      if (newPin === firstPin) {
        await SecureStore.setItemAsync('smartbiz_pin', newPin);
        await SecureStore.setItemAsync('smartbiz_pin_enabled', 'true');
        setPin('');
        onSetupComplete?.();
      } else {
        setFirstPin('');
        setCurrentMode('setup');
        triggerError('PINs did not match. Start again.');
      }
    }
  };

  const getTitle = () => {
    if (currentMode === 'setup') return 'Set a 4-digit PIN';
    if (currentMode === 'confirm') return 'Confirm your PIN';
    return 'Enter PIN';
  };

  const getSubtitle = () => {
    if (currentMode === 'setup') return 'Choose a PIN to secure SmartBiz';
    if (currentMode === 'confirm') return 'Enter the same PIN again';
    return 'SmartBiz is locked';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>

        {/* Icon */}
        <View style={styles.iconWrap}>
          <Ionicons
            name={currentMode === 'unlock' ? 'lock-closed' : 'shield-checkmark'}
            size={44}
            color={colors.primary}
          />
        </View>

        {/* Title */}
        <Text style={styles.title}>{getTitle()}</Text>
        <Text style={styles.subtitle}>{getSubtitle()}</Text>

        {/* PIN dots */}
        <View style={[styles.dotsRow, shake && styles.dotsShake]}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.dot,
                i < pin.length && styles.dotFilled,
                error && styles.dotError,
              ]}
            />
          ))}
        </View>

        {/* Error message */}
        <Text style={styles.errorText}>{error}</Text>

        {/* Keypad */}
        <View style={styles.keypad}>
          {KEYS.map((key, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.key,
                key === '' && styles.keyEmpty,
              ]}
              onPress={() => handleKey(key)}
              disabled={key === ''}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.keyText,
                key === '⌫' && styles.keyBackspace,
              ]}>
                {key}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Biometric button (unlock mode only) */}
        {currentMode === 'unlock' && biometricAvailable && (
          <TouchableOpacity style={styles.biometricBtn} onPress={tryBiometric}>
            <Ionicons name="finger-print-outline" size={28} color={colors.primary} />
            <Text style={styles.biometricText}>Use Face ID / Touch ID</Text>
          </TouchableOpacity>
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 0,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: colors.primaryLight || '#E8F4FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 36,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  dotsShake: {
    // Shake effect via left/right margin pulse — handled by state
    opacity: 0.5,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: colors.primary,
  },
  dotError: {
    borderColor: '#EF4444',
    backgroundColor: '#EF4444',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    height: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  keypad: {
    width: 280,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  key: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyEmpty: {
    backgroundColor: 'transparent',
  },
  keyText: {
    fontSize: 26,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  keyBackspace: {
    fontSize: 22,
    color: colors.textSecondary,
  },
  biometricBtn: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  biometricText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
  },
});