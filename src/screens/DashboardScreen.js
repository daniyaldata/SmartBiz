import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  loadBusiness,
  getTotalReceivables,
  getTotalPayables,
  getCashBalance,
  getBankBalance,
} from '../data/BusinessStore';
import { colors } from '../theme/colors';

const fmt = (n) => Math.round(n || 0).toLocaleString();

export default function DashboardScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  if (!biz) return <View style={styles.container} />;

  const cur = biz.meta?.currency || 'PKR';
  const cashBalance = getCashBalance(biz);
  const bankBalance = getBankBalance(biz);
  const totalBalance = cashBalance + bankBalance;
  const receivables = getTotalReceivables(biz);
  const payables    = getTotalPayables(biz);

  // Build recent activity from ALL transaction types
  const activities = [

    // Sales invoices
    ...(biz.salesInvoices || []).map(i => ({
      id: 'si_' + i.id,
      date: i.createdAt || i.date,
      icon: 'document-text-outline',
      iconBg: '#EFF6FF',
      iconColor: colors.primary,
      title: `Sales Invoice INV-${i.number || i.id.slice(-4)}`,
      sub: i.customerName || 'Customer',
      amount: `+ ${cur} ${fmt(i.total)}`,
      amountColor: colors.primary,
      onPress: () => navigation.navigate('SalesInvoiceView', {
        businessId, invoiceId: i.id,
      }),
    })),

    // Purchase invoices
    ...(biz.purchaseInvoices || []).map(i => ({
      id: 'pi_' + i.id,
      date: i.createdAt || i.date,
      icon: 'document-text-outline',
      iconBg: '#FEF2F2',
      iconColor: '#EF4444',
      title: `Purchase Bill BILL-${i.number || i.id.slice(-4)}`,
      sub: i.supplierName || 'Supplier',
      amount: `- ${cur} ${fmt(i.total)}`,
      amountColor: '#EF4444',
      onPress: () => navigation.navigate('PurchaseInvoiceView', {
        businessId, invoiceId: i.id,
      }),
    })),

    // Receipts
    ...(biz.transactions || [])
      .filter(t => t.transactionType === 'receipt')
      .map(t => ({
        id: 'rc_' + t.id,
        date: t.createdAt || t.date,
        icon: 'arrow-down-circle-outline',
        iconBg: '#ECFDF5',
        iconColor: '#10B981',
        title: 'Receipt',
        sub: t.partyName || t.incomeAccountName || 'Receipt',
        amount: `+ ${cur} ${fmt(t.amount)}`,
        amountColor: '#10B981',
        onPress: () => navigation.navigate('Receipts', { businessId }),
      })),

    // Payments
    ...(biz.transactions || [])
      .filter(t => t.transactionType === 'payment')
      .map(t => ({
        id: 'py_' + t.id,
        date: t.createdAt || t.date,
        icon: 'arrow-up-circle-outline',
        iconBg: '#FEF2F2',
        iconColor: '#EF4444',
        title: 'Payment',
        sub: t.partyName || t.expenseAccountName || 'Payment',
        amount: `- ${cur} ${fmt(t.amount)}`,
        amountColor: '#EF4444',
        onPress: () => navigation.navigate('Payments', { businessId }),
      })),

    // Transfers
    ...(biz.transactions || [])
      .filter(t => t.transactionType === 'transfer')
      .map(t => ({
        id: 'tr_' + t.id,
        date: t.createdAt || t.date,
        icon: 'swap-horizontal-outline',
        iconBg: '#F5F3FF',
        iconColor: '#8B5CF6',
        title: 'Transfer',
        sub: `${t.fromAccountName || '?'} → ${t.toAccountName || '?'}`,
        amount: `${cur} ${fmt(t.amount)}`,
        amountColor: '#8B5CF6',
        onPress: () => navigation.navigate('Transfers', { businessId }),
      })),

    // Journal entries
    ...(biz.journalEntries || []).map(je => ({
      id: 'je_' + je.id,
      date: je.createdAt || je.date,
      icon: 'book-outline',
      iconBg: '#FAF5FF',
      iconColor: '#8B5CF6',
      title: 'Journal Entry',
      sub: je.description || 'Journal entry',
      amount: `${cur} ${fmt(je.totalAmount)}`,
      amountColor: '#8B5CF6',
      onPress: () => navigation.navigate('JournalEntries', { businessId }),
    })),

    // Inventory write-offs
    ...(biz.inventoryWriteOffs || []).map(w => ({
      id: 'wo_' + w.id,
      date: w.createdAt || w.date,
      icon: 'alert-circle-outline',
      iconBg: '#FEF2F2',
      iconColor: '#EF4444',
      title: 'Inventory Write-off',
      sub: `${w.itemName} × ${w.qty}`,
      amount: `- ${cur} ${fmt(w.amount)}`,
      amountColor: '#EF4444',
      onPress: () => navigation.navigate('InventoryWriteOff', { businessId }),
    })),

  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15);

  const summaryCards = [
    {
      label: 'Total Balance',
      value: `${cur} ${fmt(totalBalance)}`,
      icon: 'wallet-outline',
      color: colors.primary,
      bg: '#EFF6FF',
    },
    {
      label: 'Receivables',
      value: `${cur} ${fmt(receivables)}`,
      icon: 'arrow-down-circle-outline',
      color: '#10B981',
      bg: '#ECFDF5',
    },
    {
      label: 'Payables',
      value: `${cur} ${fmt(payables)}`,
      icon: 'arrow-up-circle-outline',
      color: '#EF4444',
      bg: '#FEF2F2',
    },
    {
      label: 'Cash on Hand',
      value: `${cur} ${fmt(cashBalance)}`,
      icon: 'cash-outline',
      color: '#10B981',
      bg: '#ECFDF5',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Hello 👋</Text>
          <Text style={styles.headerBiz}>{biz.meta?.name}</Text>
        </View>
        <TouchableOpacity
          style={styles.switchBtn}
          onPress={() => navigation.navigate('BusinessList')}
        >
          <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
          <Text style={styles.switchBtnText}>Switch</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary cards */}
        <View style={styles.grid}>
          {summaryCards.map(card => (
            <View key={card.label} style={styles.summaryCard}>
              <View style={[styles.summaryIcon, { backgroundColor: card.bg }]}>
                <Ionicons name={card.icon} size={20} color={card.color} />
              </View>
              <Text style={styles.summaryLabel}>{card.label}</Text>
              <Text style={[styles.summaryValue, { color: card.color }]}>
                {card.value}
              </Text>
            </View>
          ))}
        </View>

        {/* Recent activity */}
        <Text style={styles.sectionLabel}>Recent Activity</Text>
        <View style={styles.activityCard}>
          {activities.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Ionicons
                name="time-outline"
                size={36}
                color={colors.textTertiary}
              />
              <Text style={styles.emptyText}>No activity yet</Text>
              <Text style={styles.emptySubText}>
                Start by creating an invoice or recording a transaction
              </Text>
            </View>
          ) : (
            activities.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.activityRow,
                  idx === activities.length - 1 && { borderBottomWidth: 0 },
                ]}
                onPress={item.onPress}
              >
                <View style={[
                  styles.activityIcon,
                  { backgroundColor: item.iconBg },
                ]}>
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={item.iconColor}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.activitySub} numberOfLines={1}>
                    {item.sub}
                  </Text>
                  <Text style={styles.activityDate}>
                    {new Date(item.date).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[
                  styles.activityAmount,
                  { color: item.amountColor },
                ]}>
                  {item.amount}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerGreeting: { fontSize: 13, color: colors.textSecondary },
  headerBiz: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  switchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: colors.primary,
  },
  switchBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  content: { padding: 16, paddingBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  summaryCard: {
    width: '47.5%', backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  summaryIcon: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  summaryLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 3 },
  summaryValue: { fontSize: 15, fontWeight: '700' },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
  },
  activityCard: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  activityIcon: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  activityTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  activitySub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  activityDate: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  activityAmount: { fontSize: 13, fontWeight: '700', flexShrink: 0 },
  emptyActivity: {
    alignItems: 'center', padding: 32, gap: 8,
  },
  emptyText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  emptySubText: {
    fontSize: 12, color: colors.textTertiary,
    textAlign: 'center', lineHeight: 18,
  },
});