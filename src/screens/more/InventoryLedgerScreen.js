import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

export default function InventoryLedgerScreen({ route, navigation }) {
  const { businessId, itemId } = route?.params || {};
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  if (!biz) return <View style={styles.container} />;

  const item = biz.items?.find(i => i.id === itemId);
  if (!item) return <View style={styles.container} />;

  const cur = biz.meta?.currency || 'PKR';

  // Build all movements for this item
  const rawTxns = [];

  // Opening stock (if any)
  if ((item.openingStock || 0) > 0) {
    rawTxns.push({
      id: 'opening',
      date: biz.meta?.createdAt || new Date().toISOString(),
      type: 'opening',
      description: 'Opening Stock',
      party: '—',
      ref: null,
      qtyIn: item.openingStock,
      qtyOut: 0,
      unitCost: item.costPrice || 0,
      totalValue: (item.openingStock || 0) * (item.costPrice || 0),
    });
  }

  // Purchase invoices — items IN
  (biz.purchaseInvoices || []).forEach(inv => {
    (inv.lines || []).forEach(line => {
      if (
        line.description?.toLowerCase() === item.name?.toLowerCase() ||
        line.itemId === itemId
      ) {
        const qty  = parseFloat(line.qty) || 0;
        const rate = parseFloat(line.rate) || 0;
        rawTxns.push({
          id: `pi_${inv.id}_${line.id || Math.random()}`,
          date: inv.date,
          type: 'purchase',
          description: `Purchase — BILL-${inv.number || inv.id.slice(-4)}`,
          party: inv.supplierName || 'Supplier',
          ref: `BILL-${inv.number || inv.id.slice(-4)}`,
          qtyIn: qty,
          qtyOut: 0,
          unitCost: rate,
          totalValue: qty * rate,
        });
      }
    });
  });

  // Sales invoices — items OUT
  (biz.salesInvoices || []).forEach(inv => {
    (inv.lines || []).forEach(line => {
      if (
        line.description?.toLowerCase() === item.name?.toLowerCase() ||
        line.itemId === itemId
      ) {
        const qty  = parseFloat(line.qty) || 0;
        const rate = parseFloat(line.rate) || 0;
        rawTxns.push({
          id: `si_${inv.id}_${line.id || Math.random()}`,
          date: inv.date,
          type: 'sale',
          description: `Sale — INV-${inv.number || inv.id.slice(-4)}`,
          party: inv.customerName || 'Customer',
          ref: `INV-${inv.number || inv.id.slice(-4)}`,
          qtyIn: 0,
          qtyOut: qty,
          unitCost: item.costPrice || 0,
          totalValue: qty * (item.costPrice || 0),
        });
      }
    });
  });

  // Inventory write-offs — items OUT
  (biz.inventoryWriteOffs || [])
    .filter(w => w.itemId === itemId)
    .forEach(w => {
      rawTxns.push({
        id: `wo_${w.id}`,
        date: w.date,
        type: 'writeoff',
        description: 'Write-off',
        party: w.reason || 'Write-off',
        ref: null,
        qtyIn: 0,
        qtyOut: w.qty,
        unitCost: w.costPrice || 0,
        totalValue: w.amount || 0,
      });
    });

  // Sort by date
  rawTxns.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Calculate running balance and average cost
  let runningQty    = 0;
  let runningValue  = 0;

  const txns = rawTxns.map(t => {
    runningQty   += t.qtyIn - t.qtyOut;
    runningValue += t.qtyIn > 0
      ? t.totalValue
      : -(t.qtyOut * (runningValue / Math.max(runningQty + t.qtyOut, 1)));

    const avgCost = runningQty > 0 ? runningValue / runningQty : 0;

    return {
      ...t,
      runningQty:   Math.max(0, runningQty),
      runningValue: Math.max(0, runningValue),
      avgCost,
    };
  });

  const currentStock  = item.stock || 0;
  const currentAvgCost = txns.length > 0
    ? txns[txns.length - 1].avgCost
    : (item.costPrice || 0);
  const stockValue = currentStock * currentAvgCost;

  const getTypeIcon = (type) => {
    if (type === 'purchase') return 'arrow-down-circle-outline';
    if (type === 'sale')     return 'arrow-up-circle-outline';
    if (type === 'writeoff') return 'alert-circle-outline';
    if (type === 'opening')  return 'flag-outline';
    return 'ellipse-outline';
  };

  const getTypeColor = (type) => {
    if (type === 'purchase' || type === 'opening') return '#10B981';
    if (type === 'sale')     return '#3B82F6';
    if (type === 'writeoff') return '#EF4444';
    return colors.textSecondary;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('ItemForm', { businessId, itemId })
          }
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Current Stock</Text>
          <Text style={[
            styles.summaryValue,
            { color: currentStock > 0 ? '#10B981' : '#EF4444' },
          ]}>
            {currentStock} units
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Avg Cost</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>
            {cur} {Math.round(currentAvgCost).toLocaleString()}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Stock Value</Text>
          <Text style={[styles.summaryValue, { color: '#D97706' }]}>
            {cur} {Math.round(stockValue).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Item info */}
      <View style={styles.infoRow}>
        <View style={styles.infoPill}>
          <Text style={styles.infoPillText}>
            Sale price: {cur} {(item.salePrice || 0).toLocaleString()}
          </Text>
        </View>
        <View style={[styles.infoPill, { backgroundColor: '#FEF3C7' }]}>
          <Text style={[styles.infoPillText, { color: '#92400E' }]}>
            Cost price: {cur} {(item.costPrice || 0).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.col, { flex: 3 }]}>Movement</Text>
        <Text style={[styles.col, { textAlign: 'center' }]}>In</Text>
        <Text style={[styles.col, { textAlign: 'center' }]}>Out</Text>
        <Text style={[styles.col, { textAlign: 'right' }]}>Stock</Text>
      </View>

      <FlatList
        data={txns}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons
              name="cube-outline"
              size={44}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyTitle}>No movements yet</Text>
            <Text style={styles.emptySub}>
              Stock will appear here when you create purchase or sales invoices
            </Text>
          </View>
        }
        renderItem={({ item: txn }) => (
          <View style={[
            styles.txnRow,
            txn.type === 'opening' && styles.txnRowOpening,
            txn.type === 'sale' && styles.txnRowSale,
            txn.type === 'writeoff' && styles.txnRowWriteoff,
          ]}>
            <View style={{ flex: 3 }}>
              <View style={styles.txnTitleRow}>
                <Ionicons
                  name={getTypeIcon(txn.type)}
                  size={13}
                  color={getTypeColor(txn.type)}
                />
                <Text style={styles.txnDesc} numberOfLines={1}>
                  {txn.description}
                </Text>
              </View>
              <Text style={styles.txnParty} numberOfLines={1}>
                {txn.party}
              </Text>
              <Text style={styles.txnDate}>
                {new Date(txn.date).toLocaleDateString()}
              </Text>
            </View>
            <Text style={[styles.txnQty, { color: '#10B981', textAlign: 'center' }]}>
              {txn.qtyIn > 0 ? `+${txn.qtyIn}` : '—'}
            </Text>
            <Text style={[styles.txnQty, { color: '#EF4444', textAlign: 'center' }]}>
              {txn.qtyOut > 0 ? `-${txn.qtyOut}` : '—'}
            </Text>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.txnStock}>{txn.runningQty}</Text>
              <Text style={styles.txnAvgCost}>
                @ {cur} {Math.round(txn.avgCost).toLocaleString()}
              </Text>
            </View>
          </View>
        )}
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
  title: {
    fontSize: 17, fontWeight: '700', color: colors.textPrimary,
    flex: 1, textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row', gap: 8, padding: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  summaryCard: {
    flex: 1, backgroundColor: colors.background,
    borderRadius: 10, padding: 10, alignItems: 'center', gap: 4,
  },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  infoRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 12,
    paddingVertical: 8, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoPill: {
    backgroundColor: '#ECFDF5', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  infoPillText: { fontSize: 12, fontWeight: '600', color: '#065F46' },
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
  txnRowOpening:  { backgroundColor: '#F0FDF4' },
  txnRowSale:     { backgroundColor: '#EFF6FF' },
  txnRowWriteoff: { backgroundColor: '#FFF5F5' },
  txnTitleRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  txnDesc:  { fontSize: 13, fontWeight: '500', color: colors.textPrimary, flex: 1 },
  txnParty: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  txnDate:  { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  txnQty:   { flex: 1, fontSize: 13, fontWeight: '700' },
  txnStock: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  txnAvgCost: { fontSize: 10, color: colors.textTertiary, marginTop: 1 },
  emptyBox:  { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 40 },
  emptyTitle:{ fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  emptySub:  {
    fontSize: 13, color: colors.textTertiary,
    textAlign: 'center', lineHeight: 20,
  },
});