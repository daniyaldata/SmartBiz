import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, saveBusiness } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

const CURRENCIES = ['PKR', 'USD', 'GBP', 'EUR', 'AED', 'SAR', 'INR'];

export default function SettingsScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('PKR');

  useEffect(() => {
    loadBusiness(businessId).then(b => {
      setBiz(b);
      setName(b?.meta?.name || '');
      setCurrency(b?.meta?.currency || 'PKR');
    });
  }, [businessId]);

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

        <Text style={styles.sectionLabel}>Data</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('BackupRestore', { businessId })}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="cloud-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.rowLabel}>Backup & Restore</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.textPrimary },
});