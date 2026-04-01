import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, SafeAreaView,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createEmptyBusiness, saveBusiness } from '../data/BusinessStore';
import { colors } from '../theme/colors';

const CURRENCIES = ['PKR', 'USD', 'GBP', 'EUR', 'AED', 'SAR', 'INR'];

export default function CreateBusinessScreen({ navigation }) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your business name.');
      return;
    }

    try {
      setLoading(true);
      const biz = createEmptyBusiness(name.trim(), currency);
      await saveBusiness(biz);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main', params: { businessId: biz.id } }],
      });
    } catch (e) {
      setLoading(false);
      Alert.alert('Error', 'Could not create business. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.title}>Create your business</Text>
        <Text style={styles.subtitle}>
          You can update these details anytime in Settings
        </Text>

        <Text style={styles.label}>Business name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Ahmed Trading Co."
          placeholderTextColor={colors.textTertiary}
          autoFocus
          returnKeyType="done"
        />

        <Text style={styles.label}>Currency</Text>
        <View style={styles.currencyRow}>
          {CURRENCIES.map(c => (
            <TouchableOpacity
              key={c}
              style={[
                styles.currencyBtn,
                currency === c && styles.currencyBtnActive,
              ]}
              onPress={() => setCurrency(c)}
            >
              <Text
                style={[
                  styles.currencyText,
                  currency === c && styles.currencyTextActive,
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.infoText}>
            All your business data is stored as a single file on this phone.
            Go to More → Backup to save a copy to WhatsApp or Google Drive.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.createBtn, loading && { opacity: 0.7 }]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createText}>Create Business</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  backBtn: {
    marginBottom: 28,
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 36,
    lineHeight: 22,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 28,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 36,
  },
  currencyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  currencyBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  currencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  currencyTextActive: {
    color: colors.primary,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 16,
    marginBottom: 36,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary,
    lineHeight: 21,
  },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  createText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});