import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, saveBusiness } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';
import * as SecureStore from 'expo-secure-store';
import PinLockScreen from '../PinLockScreen';

const CURRENCIES = ['PKR', 'USD', 'GBP', 'EUR', 'AED', 'SAR', 'INR'];

export default function SettingsScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [pinEnabled, setPinEnabled] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);

  useEffect(() => {
    loadBusiness(businessId).then(b => {
      setBiz(b);
      setName(b?.meta?.name || '');
      setCurrency(b?.meta?.currency || 'PKR');
    });
  }, [businessId]);

  useEffect(() => {
    SecureStore.getItemAsync('smartbiz_pin_enabled').then(val => {
      setPinEnabled(val === 'true');
    });
  }, []);

  const handleTogglePin = async () => {
    if (pinEnabled) {
      Alert.alert(
        'Disable PIN Lock',
        'Are you sure you want to remove the PIN?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove PIN',
            style: 'destructive',
            onPress: async () => {
              await SecureStore.deleteItemAsync('smartbiz_pin');
              await SecureStore.deleteItemAsync('smartbiz_pin_enabled');
              setPinEnabled(false);
            },
          },
        ]
      );
    } else {
      setShowPinSetup(true);
    }
  };

  const handlePinSetupComplete = () => {
    setShowPinSetup(false);
    setPinEnabled(true);
    Alert.alert('PIN enabled', 'SmartBiz is now protected with a PIN.');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = {
        ...biz,
        meta: { ...biz.meta, name, currency },
      };
      await saveBusiness(updated);
      Alert.alert('Saved', 'Business details updated.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={styles.saveText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── BUSINESS DETAILS ── */}
        <Text style={styles.sectionLabel}>Business details</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Business name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your business name"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.label}>Currency</Text>
          <View style={styles.currencyRow}>
            {CURRENCIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.currencyBtn,
                  currency === c && styles.currencyActive,
                ]}
                onPress={() => setCurrency(c)}
              >
                <Text style={[
                  styles.currencyText,
                  currency === c && styles.currencyTextActive,
                ]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── DATA ── */}
        <Text style={styles.sectionLabel}>Data</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('BackupRestore', { businessId })}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="cloud-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.menuLabel}>Backup & Restore</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* ── SECURITY ── */}
        <Text style={styles.sectionLabel}>Security</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.menuRow} onPress={handleTogglePin}>
            <View style={[styles.iconWrap, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons
                name={pinEnabled ? 'lock-closed' : 'lock-open-outline'}
                size={20}
                color="#8B5CF6"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>PIN Lock</Text>
              <Text style={styles.menuSub}>
                {pinEnabled
                  ? 'App is protected · Tap to disable'
                  : 'Add a 4-digit PIN to secure the app'}
              </Text>
            </View>
            <View style={[
              styles.badge,
              { backgroundColor: pinEnabled ? '#8B5CF6' : '#E5E7EB' },
            ]}>
              <Text style={[
                styles.badgeText,
                { color: pinEnabled ? '#fff' : colors.textSecondary },
              ]}>
                {pinEnabled ? 'ON' : 'OFF'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── ABOUT ── */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <View style={[styles.iconWrap, { backgroundColor: '#E8F4FD' }]}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>SmartBiz</Text>
              <Text style={styles.menuSub}>Your pocket accountant · v1.0</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* PIN Setup Modal */}
      {showPinSetup && (
        <Modal visible animationType="slide">
          <PinLockScreen
            mode="setup"
            onSetupComplete={handlePinSetupComplete}
          />
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  saveText: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  form: { padding: 16, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  currencyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  currencyActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  currencyText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  currencyTextActive: { color: colors.primary },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  menuSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});