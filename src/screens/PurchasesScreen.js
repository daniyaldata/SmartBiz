import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const blocks = [
  {
    label: 'Suppliers',
    icon: 'people-outline',
    color: '#F59E0B',
    bg: '#FFFBEB',
    route: 'Suppliers',
    sub: 'Manage & view ledgers',
  },
  {
    label: 'Purchase Invoices',
    icon: 'document-text-outline',
    color: '#EF4444',
    bg: '#FEF2F2',
    route: 'PurchaseInvoices',
    sub: 'Track what you owe',
  },
 {
  label: 'Purchase Quotes',
  icon: 'clipboard-outline',
  color: '#8B5CF6',
  bg: '#F5F3FF',
  route: 'PurchaseQuotes',
  sub: 'Convert to invoice',
},
];

export default function PurchasesScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Purchases</Text>
      </View>
      <ScrollView contentContainerStyle={styles.grid}>
        {blocks.map(b => (
          <TouchableOpacity
            key={b.label}
            style={styles.block}
            onPress={() => navigation.navigate(b.route, { businessId })}
          >
            <View style={[styles.iconWrap, { backgroundColor: b.bg }]}>
              <Ionicons name={b.icon} size={28} color={b.color} />
            </View>
            <Text style={styles.blockLabel}>{b.label}</Text>
            <Text style={styles.blockSub}>{b.sub}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  grid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  block: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  blockLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  blockSub: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
});