import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, getCustomerBalance } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

export default function CustomerLedgerScreen({ route, navigation }) {
  const { businessId, customerId } = route?.params || {};
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  if (!biz) return <View style={styles.container} />;

  const customer = biz.customers?.find(c => c.id === customerId);
  const cur = biz.meta?.currency || 'PKR';
  const balance = getCustomerBalance(biz, customerId);

  const txns = [
    ...(biz.salesInvoices || [])
      .filter(i => i.customerId === customerId)
      .map(i => ({
        id: i.id,
        type: 'Invoice',
        date: i.date,
        description: `Invoice #${i.number || i.id.slice(-4)}`,
        debit: i.total,
        credit: 0,
        color: '#EF4444',
      })),
    ...(biz.receipts || [])
      .filter(r => r.customerId === customerId)
      .map(r => ({
        id: r.id,
        type: 'Receipt',
        date: r.date,
        description: `Receipt`,
        debit: 0,
        credit: r.amount,
        color: '#10B981',
      })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{customer?.displayName || 'Customer'}</Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('CustomerForm', { businessId, customerId })
          }
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Outstanding Balance</Text>
        <Text style={[
          styles.balanceAmount,
          { color: balance > 0 ? '#EF4444' : colors.success }
        ]}>
          {cur} {Math.abs(balance).toLocaleString()}
        </Text>
        <Text style={styles.balanceStatus}>
          {balance > 0 ? 'Amount receivable' : balance < 0 ? 'Overpaid' : 'All cleared'}
        </Text>
      </View>

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
            <Text style={[styles.txnAmount, { color: '#EF4444', textAlign: 'right' }]}>
              {item.debit > 0 ? `${cur} ${item.debit.toLocaleString()}` : '—'}
            </Text>
            <Text style={[styles.txnAmount, { color: '#10B981', textAlign: 'right' }]}>
              {item.credit > 0 ? `${cur} ${item.credit.toLocaleString()}` : '—'}
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
  },
  balanceLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
  balanceAmount: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  balanceStatus: { fontSize: 13, color: colors.textSecondary },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
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
  txnDesc: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  txnDate: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  txnAmount: { flex: 1, fontSize: 13, fontWeight: '600' },
  emptyText: {
    textAlign: 'center',
    color: colors.textTertiary,
    padding: 40,
    fontSize: 14,
  },
});