import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness } from '../../data/BusinessStore';
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

  // Build all ledger entries for this customer
  const rawTxns = [

    // Sales invoices — debit the customer (they owe us)
    ...(biz.salesInvoices || [])
      .filter(i => i.customerId === customerId)
      .map(i => ({
        id: i.id,
        date: i.date,
        description: `Invoice INV-${i.number || i.id.slice(-4)}`,
        type: 'invoice',
        debit: i.total || 0,
        credit: 0,
      })),

    // Receipts — credit the customer (they paid us)
    ...(biz.transactions || [])
      .filter(t =>
        t.transactionType === 'receipt' &&
        t.partyId === customerId &&
        t.partyType === 'customer'
      )
      .map(t => ({
        id: t.id,
        date: t.date,
        description: `Receipt${t.reference ? ' — Ref: ' + t.reference : ''}`,
        type: 'receipt',
        debit: 0,
        credit: t.amount || 0,
        ref: t.reference || null,
      })),

    // Journal entries affecting this customer
    ...(biz.journalEntries || []).flatMap(je =>
      (je.lines || [])
        .filter(line =>
          line.accountCategory === 'customer' &&
          (line.accountId === customerId ||
            line.linkedCustomerId === customerId)
        )
        .map(line => ({
          id: `${je.id}_${line.lineId}`,
          date: je.date,
          description: `Journal — ${je.description}`,
          type: 'journal',
          // Debit on customer = more they owe
          // Credit on customer = reduces what they owe
          debit: line.debit || 0,
          credit: line.credit || 0,
        }))
    ),

  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Calculate running balance (positive = customer owes us)
  let running = 0;
  const txns = rawTxns.map(t => {
    running += t.debit - t.credit;
    return { ...t, runningBalance: running };
  });

  const totalDebit  = rawTxns.reduce((s, t) => s + t.debit,  0);
  const totalCredit = rawTxns.reduce((s, t) => s + t.credit, 0);
  const balance     = totalDebit - totalCredit;

  const getTypeIcon = (type) => {
    if (type === 'invoice') return 'document-text-outline';
    if (type === 'receipt') return 'arrow-down-circle-outline';
    if (type === 'journal') return 'book-outline';
    return 'ellipse-outline';
  };

  const getTypeColor = (type) => {
    if (type === 'invoice') return '#EF4444';
    if (type === 'receipt') return '#10B981';
    if (type === 'journal') return '#8B5CF6';
    return colors.textSecondary;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {customer?.displayName || 'Customer'}
        </Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('CustomerForm', { businessId, customerId })
          }
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Outstanding Receivable</Text>
        <Text style={[
          styles.balanceAmount,
          { color: balance > 0 ? '#EF4444' : '#10B981' },
        ]}>
          {cur} {Math.abs(balance).toLocaleString()}
        </Text>
        <Text style={styles.balanceSub}>
          {balance > 0
            ? 'Amount customer owes'
            : balance < 0
            ? 'Credit balance (overpaid)'
            : 'Account settled'}
        </Text>
      </View>

      {/* Contact info */}
      {(customer?.phone || customer?.email) ? (
        <View style={styles.contactCard}>
          {customer.phone ? (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.contactText}>{customer.phone}</Text>
            </View>
          ) : null}
          {customer.email ? (
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.contactText}>{customer.email}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.col, { flex: 3 }]}>Description</Text>
        <Text style={[styles.col, { textAlign: 'right' }]}>Debit</Text>
        <Text style={[styles.col, { textAlign: 'right' }]}>Credit</Text>
        <Text style={[styles.col, { textAlign: 'right' }]}>Balance</Text>
      </View>

      <FlatList
        data={txns}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons
              name="person-outline"
              size={44}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySub}>
              Create a sales invoice or record a receipt for this customer
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[
            styles.txnRow,
            item.type === 'receipt' && styles.txnRowReceipt,
            item.type === 'journal' && styles.txnRowJournal,
          ]}>
            <View style={{ flex: 3 }}>
              <View style={styles.txnTitleRow}>
                <Ionicons
                  name={getTypeIcon(item.type)}
                  size={13}
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
            <Text style={[styles.txnDebit, { textAlign: 'right' }]}>
              {item.debit > 0
                ? `${cur} ${item.debit.toLocaleString()}`
                : '—'}
            </Text>
            <Text style={[styles.txnCredit, { textAlign: 'right' }]}>
              {item.credit > 0
                ? `${cur} ${item.credit.toLocaleString()}`
                : '—'}
            </Text>
            <Text style={[
              styles.txnBalance,
              { color: item.runningBalance > 0 ? '#EF4444' : '#10B981' },
            ]}>
              {cur} {Math.abs(item.runningBalance).toLocaleString()}
            </Text>
          </View>
        )}
        ListFooterComponent={
          txns.length > 0 ? (
            <View style={styles.totalRow}>
              <Text style={[styles.totalCell, { flex: 3 }]}>Total</Text>
              <Text style={[styles.totalDebit, { textAlign: 'right' }]}>
                {cur} {totalDebit.toLocaleString()}
              </Text>
              <Text style={[styles.totalCredit, { textAlign: 'right' }]}>
                {cur} {totalCredit.toLocaleString()}
              </Text>
              <Text style={[
                styles.totalBalance,
                { color: balance > 0 ? '#EF4444' : '#10B981' },
              ]}>
                {cur} {Math.abs(balance).toLocaleString()}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, flex: 1, textAlign: 'center' },
  balanceCard: {
    backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 20,
    alignItems: 'center', shadowColor: '#000',
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, gap: 4,
  },
  balanceLabel:  { fontSize: 13, color: colors.textSecondary },
  balanceAmount: { fontSize: 28, fontWeight: '700' },
  balanceSub:    { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  contactCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 12, padding: 12, gap: 8,
  },
  contactRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactText: { fontSize: 13, color: colors.textSecondary },
  tableHeader: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  col: {
    flex: 1, fontSize: 10, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  txnRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: '#fff', alignItems: 'center',
  },
  txnRowReceipt: { backgroundColor: '#F0FDF4' },
  txnRowJournal: { backgroundColor: '#FAF5FF' },
  txnTitleRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  txnDesc:  { fontSize: 13, fontWeight: '500', color: colors.textPrimary, flex: 1 },
  txnDate:  { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  txnRef:   { fontSize: 11, color: colors.textTertiary },
  txnDebit:  { flex: 1, fontSize: 12, fontWeight: '600', color: '#EF4444' },
  txnCredit: { flex: 1, fontSize: 12, fontWeight: '600', color: '#10B981' },
  txnBalance:{ flex: 1, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  totalRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 2, borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  totalCell:   { flex: 3, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  totalDebit:  { flex: 1, fontSize: 12, fontWeight: '700', color: '#EF4444' },
  totalCredit: { flex: 1, fontSize: 12, fontWeight: '700', color: '#10B981' },
  totalBalance:{ flex: 1, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  emptyBox:  { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 40 },
  emptyTitle:{ fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  emptySub:  { fontSize: 13, color: colors.textTertiary, textAlign: 'center', lineHeight: 20 },
});