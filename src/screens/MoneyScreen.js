import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const blocks = [
  {
    label: 'Bank & Cash Accounts',
    icon: 'business-outline',
    color: '#3B82F6',
    bg: '#EFF6FF',
    route: 'Accounts',
    sub: 'View balances & transactions',
  },
  {
    label: 'Receipts',
    icon: 'arrow-down-circle-outline',
    color: '#10B981',
    bg: '#ECFDF5',
    route: 'Receipts',
    sub: 'Money received from customers',
  },
  {
    label: 'Payments',
    icon: 'arrow-up-circle-outline',
    color: '#EF4444',
    bg: '#FEF2F2',
    route: 'Payments',
    sub: 'Money paid to suppliers',
  },
  {
    label: 'Transfers',
    icon: 'swap-horizontal-outline',
    color: '#8B5CF6',
    bg: '#F5F3FF',
    route: 'Accounts',
    sub: 'Between your accounts',
  },
];

export default function MoneyScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Money</Text>
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
  blockSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
});