import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  loadBusiness, getCashBalance, getBankBalance,
  getTotalReceivables, getTotalPayables,
} from '../data/BusinessStore';
import { colors } from '../theme/colors';

const fmt = (n, cur = 'PKR') =>
  `${cur} ${Number(n || 0).toLocaleString('en-US')}`;

export default function DashboardScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      const b = await loadBusiness(businessId);
      setBiz(b);
    } catch (e) {
      console.log('Dashboard load error:', e);
    }
  }, [businessId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!biz) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading your business...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cur = biz.meta?.currency || 'PKR';

  const summaryCards = [
    {
      label: 'Cash',
      value: getCashBalance(biz),
      icon: 'cash-outline',
      color: '#10B981',
      bg: '#ECFDF5',
    },
    {
      label: 'Bank',
      value: getBankBalance(biz),
      icon: 'business-outline',
      color: '#3B82F6',
      bg: '#EFF6FF',
    },
    {
      label: 'Receivables',
      value: getTotalReceivables(biz),
      icon: 'arrow-down-circle-outline',
      color: '#8B5CF6',
      bg: '#F5F3FF',
    },
    {
      label: 'Payables',
      value: getTotalPayables(biz),
      icon: 'arrow-up-circle-outline',
      color: '#EF4444',
      bg: '#FEF2F2',
    },
  ];

  const allTxns = [
    ...(biz.salesInvoices || []).map(i => ({
      ...i,
      _type: 'Sales Invoice',
      _color: '#10B981',
      _amount: i.total,
      _name: i.customerName,
    })),
    ...(biz.receipts || []).map(r => ({
      ...r,
      _type: 'Receipt',
      _color: '#3B82F6',
      _amount: r.amount,
      _name: r.customerName,
    })),
    ...(biz.payments || []).map(p => ({
      ...p,
      _type: 'Payment',
      _color: '#EF4444',
      _amount: p.amount,
      _name: p.supplierName,
    })),
    ...(biz.purchaseInvoices || []).map(i => ({
      ...i,
      _type: 'Purchase Invoice',
      _color: '#F59E0B',
      _amount: i.total,
      _name: i.supplierName,
    })),
  ]
    .filter(t => t.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.bizName}>{biz.meta?.name || 'My Business'}</Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings', { businessId })}
        >
          <Ionicons
            name="settings-outline"
            size={22}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.sectionLabel}>Overview</Text>
        <View style={styles.cardGrid}>
          {summaryCards.map(card => (
            <View
              key={card.label}
              style={[styles.summaryCard, { backgroundColor: card.bg }]}
            >
              <View
                style={[
                  styles.cardIconWrap,
                  { backgroundColor: card.color + '20' },
                ]}
              >
                <Ionicons name={card.icon} size={22} color={card.color} />
              </View>
              <Text style={styles.cardLabel}>{card.label}</Text>
              <Text style={[styles.cardValue, { color: card.color }]}>
                {fmt(card.value, cur)}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Recent activity</Text>

        {allTxns.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name="receipt-outline"
              size={44}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyHint}>
              Go to Sales or Purchases to create your first transaction
            </Text>
          </View>
        ) : (
          allTxns.map((txn, i) => (
            <View key={i} style={styles.txnRow}>
              <View
                style={[
                  styles.txnIcon,
                  { backgroundColor: txn._color + '18' },
                ]}
              >
                <Ionicons
                  name={
                    txn._type === 'Receipt'
                      ? 'arrow-down'
                      : txn._type === 'Payment'
                      ? 'arrow-up'
                      : 'document-text-outline'
                  }
                  size={18}
                  color={txn._color}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txnTitle}>{txn._type}</Text>
                <Text style={styles.txnSub}>
                  {txn._name || '—'} ·{' '}
                  {txn.date
                    ? new Date(txn.date).toLocaleDateString()
                    : ''}
                </Text>
              </View>
              <Text style={[styles.txnAmount, { color: txn._color }]}>
                {txn._type === 'Payment' ? '−' : '+'}
                {fmt(txn._amount, cur)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bizName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 12,
    marginTop: 6,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  summaryCard: {
    width: '47.5%',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  cardValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  txnRow: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  txnSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
});