import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, getSupplierBalance } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

export default function SupplierLedgerScreen({ route, navigation }) {
  const { businessId, supplierId } = route?.params || {};
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  if (!biz) return <View style={styles.container} />;

  const supplier = biz.suppliers?.find(s => s.id === supplierId);
  const cur = biz.meta?.currency || 'PKR';
  const balance = getSupplierBalance(biz, supplierId);

  const txns = [
    ...(biz.purchaseInvoices || [])
      .filter(i => i.supplierId === supplierId)
      .map(i => ({
        id: i.id,
        type: 'Invoice',
        date: i.date,
        description: `Bill #${i.number || i.id.slice(-4)}`,
        debit: i.total,
        credit: 0,
        color: '#EF4444',
      })),
    ...(biz.payments || [])
      .filter(p => p.supplierId === supplierId)
      .map(p => ({
        id: p.id,
        type: 'Payment',
        date: p.date,
        description: `Payment${p.reference ? ' · ' + p.reference : ''}`,
        debit: 0,
        credit: p.amount,
        color: '#10B981',
      })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {supplier?.displayName || 'Supplier'}
        </Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('SupplierForm', { businessId, supplierId })
          }
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Outstanding Payable</Text>
        <Text style={[
          styles.balanceAmount,
          { color: balance > 0 ? '#EF4444' : colors.success },
        ]}>
          {cur} {Math.abs(balance).toLocaleString()}
        </Text>
        <Text style={styles.balanceStatus}>
          {balance > 0
            ? 'Amount you owe'
            : balance < 0
            ? 'Overpaid'
            : 'All cleared'}
        </Text>
      </View>

      {supplier?.phone || supplier?.email ? (
        <View style={styles.contactCard}>
          {supplier.phone ? (
            <View style={styles.contactRow}>
              <Ionicons
                name="call-outline"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.contactText}>{supplier.phone}</Text>
            </View>
          ) : null}
          {supplier.email ? (
            <View style={styles.contactRow}>
              <Ionicons
                name="mail-outline"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.contactText}>{supplier.email}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.tableHeader}>
        <Text style={[styles.col, { flex: 2 }]}>Description</Text>
        <Text style={[styles.col, { textAlign: 'right' }]}>Debit</Text>
        <Text style={[styles.col, { textAlign: 'right' }]}>Credit</Text>
      </View>

      <FlatList
        data={txns}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No transactions yet</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.txnRow}>
            <View style={{ flex: 2 }}>
              <Text style={styles.txnDesc}>{item.description}</Text>
              <Text style={styles.txnDate}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
            </View>
            <Text style={[
              styles.txnAmount,
              { color: '#EF4444', textAlign: 'right' },
            ]}>
              {item.debit > 0
                ? `${cur} ${item.debit.toLocaleString()}`
                : '—'}
            </Text>
            <Text style={[
              styles.txnAmount,
              { color: '#10B981', textAlign: 'right' },
            ]}>
              {item.credit > 0
                ? `${cur} ${item.credit.toLocaleString()}`
                : '—'}
            </Text>
          </View>
        )}
      />
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
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  balanceCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 4,
  },
  balanceLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  balanceAmount: { fontSize: 28, fontWeight: '700' },
  balanceStatus: { fontSize: 13, color: colors.textSecondary },
  contactCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: { fontSize: 14, color: colors.textSecondary },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  col: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  txnRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  txnDesc: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  txnDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  txnAmount: { flex: 1, fontSize: 13, fontWeight: '600' },
  emptyText: {
    textAlign: 'center',
    color: colors.textTertiary,
    padding: 40,
    fontSize: 14,
  },
});