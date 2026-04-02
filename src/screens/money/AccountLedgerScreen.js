import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

export default function AccountLedgerScreen({ route, navigation }) {
  const { businessId, accountId } = route?.params || {};
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  if (!biz) return <View style={styles.container} />;

  const account = biz.bankAccounts?.find(a => a.id === accountId);
  if (!account) return <View style={styles.container} />;

  const cur = biz.meta?.currency || 'PKR';

  // Build all transactions for this account
  const txns = [
    // Opening balance entry
    ...(account.openingBalance > 0 ? [{
      id: 'ob',
      date: biz.meta?.createdAt || new Date().toISOString(),
      description: 'Opening Balance',
      type: 'opening',
      in: account.openingBalance,
      out: 0,
    }] : []),

    // Receipts (money in)
    ...(biz.receipts || [])
      .filter(r => r.accountId === accountId)
      .map(r => ({
        id: r.id,
        date: r.date,
        description: `Receipt — ${r.customerName || ''}`,
        type: 'receipt',
        in: r.amount || 0,
        out: 0,
        ref: r.reference,
      })),

    // Payments (money out)
    ...(biz.payments || [])
      .filter(p => p.accountId === accountId)
      .map(p => ({
        id: p.id,
        date: p.date,
        description: `Payment — ${p.supplierName || ''}`,
        type: 'payment',
        in: 0,
        out: p.amount || 0,
        ref: p.reference,
      })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Calculate running balance
  let running = 0;
  const txnsWithBalance = txns.map(t => {
    running += t.in - t.out;
    return { ...t, runningBalance: running };
  });

  const getTypeColor = (type) => {
    if (type === 'receipt' || type === 'opening') return '#10B981';
    return '#EF4444';
  };

  const getTypeIcon = (type) => {
    if (type === 'opening') return 'flag-outline';
    if (type === 'receipt') return 'arrow-down-outline';
    return 'arrow-up-outline';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{account.name}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Accounts', { businessId })}
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={[
          styles.balanceAmount,
          { color: (account.balance || 0) >= 0 ? '#10B981' : '#EF4444' },
        ]}>
          {cur} {(account.balance || 0).toLocaleString()}
        </Text>
        {account.openingBalance > 0 && (
          <Text style={styles.balanceSub}>
            Opening balance: {cur} {account.openingBalance.toLocaleString()}
          </Text>
        )}
      </View>

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.col, { flex: 3 }]}>Description</Text>
        <Text style={[styles.col, { textAlign: 'right' }]}>In</Text>
        <Text style={[styles.col, { textAlign: 'right' }]}>Out</Text>
        <Text style={[styles.col, { textAlign: 'right' }]}>Balance</Text>
      </View>

      <FlatList
        data={txnsWithBalance}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons
              name="document-text-outline"
              size={44}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySub}>
              Record a receipt or payment to see entries here
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[
            styles.txnRow,
            item.type === 'opening' && styles.txnRowOpening,
          ]}>
            <View style={{ flex: 3 }}>
              <View style={styles.txnTitleRow}>
                <Ionicons
                  name={getTypeIcon(item.type)}
                  size={14}
                  color={getTypeColor(item.type)}
                />
                <Text style={styles.txnDesc} numberOfLines={1}>
                  {item.description}
                </Text>
              </View>
              <Text style={styles.txnDate}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
              {item.ref ? (
                <Text style={styles.txnRef}>Ref: {item.ref}</Text>
              ) : null}
            </View>
            <Text style={[
              styles.txnAmount,
              { color: '#10B981', textAlign: 'right' },
            ]}>
              {item.in > 0 ? `${cur} ${item.in.toLocaleString()}` : '—'}
            </Text>
            <Text style={[
              styles.txnAmount,
              { color: '#EF4444', textAlign: 'right' },
            ]}>
              {item.out > 0 ? `${cur} ${item.out.toLocaleString()}` : '—'}
            </Text>
            <Text style={[
              styles.txnBalance,
              { color: item.runningBalance >= 0 ? colors.textPrimary : '#EF4444' },
            ]}>
              {cur} {item.runningBalance.toLocaleString()}
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
  balanceLabel: { fontSize: 13, color: colors.textSecondary },
  balanceAmount: { fontSize: 28, fontWeight: '700' },
  balanceSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
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
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  txnRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  txnRowOpening: {
    backgroundColor: '#F0FDF4',
  },
  txnTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  txnDesc: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
  txnDate: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  txnRef: { fontSize: 11, color: colors.textTertiary },
  txnAmount: { flex: 1, fontSize: 12, fontWeight: '600' },
  txnBalance: { flex: 1, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  emptySub: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});