import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, getInvoiceStatus } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

const STATUS_STYLE = {
  paid:    { bg: '#DCFCE7', text: '#16A34A', label: 'Paid' },
  partial: { bg: '#FEF3C7', text: '#D97706', label: 'Partial' },
  due:     { bg: '#FEE2E2', text: '#DC2626', label: 'Due' },
};

export default function SalesInvoicesScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const invoices = (biz?.salesInvoices || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const cur = biz?.meta?.currency || 'PKR';

  const totalOutstanding = invoices
    .filter(i => getInvoiceStatus(i) !== 'paid')
    .reduce((s, i) => s + (i.total - (i.amountPaid || 0)), 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Sales Invoices</Text>
        <View style={{ width: 22 }} />
      </View>

      {totalOutstanding > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            Outstanding receivable:
          </Text>
          <Text style={styles.summaryValue}>
            {cur} {totalOutstanding.toLocaleString()}
          </Text>
        </View>
      )}

      <FlatList
        data={invoices}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons
              name="document-text-outline"
              size={52}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyTitle}>No invoices yet</Text>
            <Text style={styles.emptySub}>
              Tap + to create your first sales invoice
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const status = getInvoiceStatus(item);
          const st     = STATUS_STYLE[status];
          const balance = item.total - (item.amountPaid || 0);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('SalesInvoiceView', {
                  businessId, invoiceId: item.id,
                })
              }
            >
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardNum}>
                    INV-{item.number || item.id.slice(-4)}
                  </Text>
                  <Text style={styles.cardCustomer}>
                    {item.customerName || '—'}
                  </Text>
                  <Text style={styles.cardDate}>
                    {new Date(item.date).toLocaleDateString()}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.cardTotal}>
                    {cur} {(item.total || 0).toLocaleString()}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.badgeText, { color: st.text }]}>
                      {st.label}
                    </Text>
                  </View>
                  {status === 'partial' && (
                    <Text style={styles.balanceText}>
                      Due: {cur} {balance.toLocaleString()}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          navigation.navigate('SalesInvoiceForm', { businessId })
        }
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
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
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  summaryBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FEF3C7', borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  summaryText:  { fontSize: 13, color: '#92400E' },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  list: { padding: 12, gap: 8, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardNum:     { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardCustomer:{ fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  cardDate:    { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  cardTotal:   { fontSize: 16, fontWeight: '700', color: colors.primary },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText:   { fontSize: 11, fontWeight: '700' },
  balanceText: { fontSize: 11, color: '#D97706' },
  emptyBox: {
    alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 40,
  },
  emptyTitle:  { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  emptySub:    { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 28, right: 20,
    backgroundColor: colors.primary, width: 58, height: 58, borderRadius: 29,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
});