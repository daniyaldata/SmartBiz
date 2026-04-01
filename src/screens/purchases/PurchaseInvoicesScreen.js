import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, getInvoiceStatus } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

const STATUS = {
  paid:    { bg: '#DCFCE7', text: '#16A34A', label: 'Paid' },
  partial: { bg: '#FEF3C7', text: '#D97706', label: 'Partial' },
  due:     { bg: '#FEE2E2', text: '#DC2626', label: 'Due' },
};

export default function PurchaseInvoicesScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const invoices = (biz?.purchaseInvoices || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const cur = biz?.meta?.currency || 'PKR';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Purchase Invoices</Text>
        <View style={{ width: 22 }} />
      </View>

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
            <Text style={styles.emptyTitle}>No purchase invoices yet</Text>
            <Text style={styles.emptySub}>Tap + to record a purchase</Text>
          </View>
        }
        renderItem={({ item }) => {
          const status = getInvoiceStatus(item);
          const st = STATUS[status];
          const balance = item.total - (item.amountPaid || 0);
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                navigation.navigate('PurchaseInvoiceForm', {
                  businessId,
                  invoiceId: item.id,
                })
              }
            >
              <View style={styles.rowLeft}>
                <Text style={styles.invNum}>
                  BILL-{item.number || item.id.slice(-4)}
                </Text>
                <Text style={styles.supplierName}>{item.supplierName}</Text>
                <Text style={styles.dateText}>
                  {new Date(item.date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.amount}>
                  {cur} {(item.total || 0).toLocaleString()}
                </Text>
                {balance > 0 && (
                  <Text style={styles.balance}>
                    Due: {cur} {balance.toLocaleString()}
                  </Text>
                )}
                <View style={[styles.badge, { backgroundColor: st.bg }]}>
                  <Text style={[styles.badgeText, { color: st.text }]}>
                    {st.label}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          navigation.navigate('PurchaseInvoiceForm', { businessId })
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  list: { padding: 12, gap: 8, paddingBottom: 100 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  rowLeft: { flex: 1, gap: 3 },
  invNum: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  supplierName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  dateText: { fontSize: 12, color: colors.textSecondary },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  balance: { fontSize: 12, color: colors.textSecondary },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    backgroundColor: '#EF4444',
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});