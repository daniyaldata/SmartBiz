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
  if (!item) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>Item not found.</Text>
      </View>
    </SafeAreaView>
  );

  const cur = biz.meta?.currency || 'PKR';

  // ── Build all movements ──────────────────────────────────────────────────

  const rawTxns = [];

  // 1. Opening stock — treated as first purchase entry
  if ((item.openingStock || 0) > 0) {
    const openingRate  = item.openingStockRate || item.costPrice || 0;
    const openingValue = (item.openingStock || 0) * openingRate;
    rawTxns.push({
      id:        'opening',
      date:      item.createdAt || biz.meta?.createdAt || new Date().toISOString(),
      type:      'opening',
      description: 'Opening Stock',
      party:     'Opening balance',
      ref:       null,
      qtyIn:     item.openingStock,
      qtyOut:    0,
      unitCost:  openingRate,
      lineValue: openingValue,
      _isOpening: true,
    });
  }

  // 2. Purchase invoices — stock IN
  (biz.purchaseInvoices || []).forEach(inv => {
    (inv.lines || []).forEach((line, lineIdx) => {
      const nameMatch = line.description?.toLowerCase().trim() ===
        item.name?.toLowerCase().trim();
      const idMatch   = line.itemId === itemId;
      if (!nameMatch && !idMatch) return;

      const qty  = parseFloat(line.qty)  || 0;
      const rate = parseFloat(line.rate) || 0;
      if (qty <= 0) return;

      rawTxns.push({
        id:          `pi_${inv.id}_${lineIdx}`,
        date:        inv.date,
        type:        'purchase',
        description: `Purchase — BILL-${inv.number || inv.id.slice(-4)}`,
        party:       inv.supplierName || 'Supplier',
        ref:         `BILL-${inv.number || inv.id.slice(-4)}`,
        qtyIn:       qty,
        qtyOut:      0,
        unitCost:    rate,
        lineValue:   qty * rate,
      });
    });
  });

  // 3. Sales invoices — stock OUT
  (biz.salesInvoices || []).forEach(inv => {
    (inv.lines || []).forEach((line, lineIdx) => {
      const nameMatch = line.description?.toLowerCase().trim() ===
        item.name?.toLowerCase().trim();
      const idMatch   = line.itemId === itemId;
      if (!nameMatch && !idMatch) return;

      const qty  = parseFloat(line.qty)  || 0;
      const rate = parseFloat(line.rate) || 0;
      if (qty <= 0) return;

      rawTxns.push({
        id:          `si_${inv.id}_${lineIdx}`,
        date:        inv.date,
        type:        'sale',
        description: `Sale — INV-${inv.number || inv.id.slice(-4)}`,
        party:       inv.customerName || 'Customer',
        ref:         `INV-${inv.number || inv.id.slice(-4)}`,
        qtyIn:       0,
        qtyOut:      qty,
        saleRate:    rate,
        lineValue:   0, // calculated below using avg cost at time of sale
      });
    });
  });

  // 4. Inventory write-offs — stock OUT
  (biz.inventoryWriteOffs || [])
    .filter(w => w.itemId === itemId)
    .forEach(w => {
      rawTxns.push({
        id:          `wo_${w.id}`,
        date:        w.date,
        type:        'writeoff',
        description: 'Write-off',
        party:       w.reason || 'Write-off',
        ref:         null,
        qtyIn:       0,
        qtyOut:      w.qty || 0,
        unitCost:    w.costPrice || 0,
        lineValue:   w.amount || 0,
      });
    });

  // 5. Journal entries affecting this inventory item
  (biz.journalEntries || []).forEach(je => {
    (je.lines || []).forEach((line, lineIdx) => {
      if (line.accountCategory !== 'inventory') return;
      if (line.accountId !== itemId) return;

      const qty    = parseFloat(line.qty) || 0;
      const debit  = line.debit  || 0;
      const credit = line.credit || 0;

      if (qty > 0) {
        // Stock movement
        rawTxns.push({
          id:          `je_${je.id}_${lineIdx}`,
          date:        je.date,
          type:        debit > 0 ? 'journal_in' : 'journal_out',
          description: `Journal — ${je.description}`,
          party:       'Journal entry',
          ref:         null,
          qtyIn:       debit  > 0 ? qty : 0,
          qtyOut:      credit > 0 ? qty : 0,
          unitCost:    debit  > 0 ? (debit / qty)  : 0,
          lineValue:   debit  > 0 ? debit : credit,
          _isCostAdj:  false,
        });
      } else if (debit > 0 || credit > 0) {
        // Cost adjustment only — no stock change
        rawTxns.push({
          id:          `je_${je.id}_${lineIdx}`,
          date:        je.date,
          type:        'cost_adj',
          description: `Journal — ${je.description}`,
          party:       'Cost adjustment',
          ref:         null,
          qtyIn:       0,
          qtyOut:      0,
          unitCost:    0,
          lineValue:   debit > 0 ? debit : -credit,
          _isCostAdj:  true,
        });
      }
    });
  });

  // ── Sort chronologically (opening always first) ──────────────────────────

  rawTxns.sort((a, b) => {
    if (a._isOpening) return -1;
    if (b._isOpening) return 1;
    return new Date(a.date) - new Date(b.date);
  });

  // ── Calculate running qty and weighted average cost ──────────────────────
  // This is the correct perpetual weighted average method:
  // After every stock-in: new avg cost = (old value + new value) / new qty
  // After every stock-out: avg cost stays the same, value decreases
  // After cost adjustment: new avg cost = new value / current qty

  let runningQty   = 0;
  let runningValue = 0; // total inventory value at avg cost

  const txns = rawTxns.map(t => {
    if (t.type === 'opening' || t.type === 'purchase' || t.type === 'journal_in') {
      // Stock IN — update qty and value, recalculate avg cost
      runningQty   += t.qtyIn;
      runningValue += t.lineValue;
    } else if (t.type === 'sale' || t.type === 'writeoff' || t.type === 'journal_out') {
      // Stock OUT — use current avg cost for COGS
      const currentAvg = runningQty > 0 ? runningValue / runningQty : 0;
      const costOfSale = t.qtyOut * currentAvg;
      runningQty   -= t.qtyOut;
      runningValue -= costOfSale;
      if (runningValue < 0) runningValue = 0;
      // Store the avg cost used for this sale
      t = { ...t, unitCost: currentAvg, lineValue: costOfSale };
    } else if (t.type === 'cost_adj') {
      // Cost adjustment — no qty change, update value only
      runningValue += t.lineValue;
      if (runningValue < 0) runningValue = 0;
    }

    const avgCost = runningQty > 0
      ? runningValue / runningQty
      : 0;

    return {
      ...t,
      runningQty,
      runningValue: Math.max(0, runningValue),
      avgCost,
    };
  });

  // ── Summary values ────────────────────────────────────────────────────────
  // Use item.stock as authoritative (updated by all transaction paths)
  // Use last calculated avg cost from ledger for valuation
  const currentStock   = item.stock ?? 0;
  const isNegative     = currentStock < 0;
  const isToOrder      = currentStock <= 0;
  const lastEntry      = txns[txns.length - 1];
  const currentAvgCost = lastEntry?.avgCost || 0;
  const stockValue     = currentStock * currentAvgCost;

  // User-set default rates (never auto-changed)
  const salePrice     = item.salePrice     || 0;
  const purchasePrice = item.purchasePrice || item.costPrice || 0;

  // ── Type helpers ─────────────────────────────────────────────────────────

  const getTypeIcon = (type) => {
    switch (type) {
      case 'opening':     return 'flag-outline';
      case 'purchase':    return 'arrow-down-circle-outline';
      case 'sale':        return 'arrow-up-circle-outline';
      case 'writeoff':    return 'alert-circle-outline';
      case 'journal_in':  return 'git-merge-outline';
      case 'journal_out': return 'git-merge-outline';
      case 'cost_adj':    return 'calculator-outline';
      default:            return 'ellipse-outline';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'opening':
      case 'purchase':
      case 'journal_in':  return '#10B981';
      case 'sale':        return '#3B82F6';
      case 'writeoff':
      case 'journal_out': return '#EF4444';
      case 'cost_adj':    return '#8B5CF6';
      default:            return colors.textSecondary;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'opening':     return 'Opening';
      case 'purchase':    return 'Purchase';
      case 'sale':        return 'Sale';
      case 'writeoff':    return 'Write-off';
      case 'journal_in':  return 'Adj In';
      case 'journal_out': return 'Adj Out';
      case 'cost_adj':    return 'Cost Adj';
      default:            return '';
    }
  };

  const getTypeBg = (type) => {
    switch (type) {
      case 'opening':
      case 'purchase':
      case 'journal_in':  return '#ECFDF5';
      case 'sale':        return '#EFF6FF';
      case 'writeoff':
      case 'journal_out': return '#FEF2F2';
      case 'cost_adj':    return '#FAF5FF';
      default:            return colors.background;
    }
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
            {currentStock} {item.unit || 'units'}
          </Text>
          {isToOrder && (
            <View style={[
              styles.badge,
              { backgroundColor: isNegative ? '#FEE2E2' : '#FEF3C7' },
            ]}>
              <Text style={[
                styles.badgeText,
                { color: isNegative ? '#DC2626' : '#D97706' },
              ]}>
                {isNegative ? 'To Order' : 'Out of Stock'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Avg Cost</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>
            {cur} {currentAvgCost > 0
              ? Math.round(currentAvgCost).toLocaleString()
              : '—'}
          </Text>
          <Text style={styles.summarySubLabel}>
            Calculated from purchases
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Stock Value</Text>
          <Text style={[styles.summaryValue, { color: '#D97706' }]}>
            {cur} {Math.round(Math.abs(stockValue)).toLocaleString()}
          </Text>
          <Text style={styles.summarySubLabel}>
            At avg cost
          </Text>
        </View>
      </View>

      {/* Default price pills */}
      <View style={styles.pillRow}>
        <View style={styles.pill}>
          <Ionicons name="pricetag-outline" size={12} color="#065F46" />
          <Text style={styles.pillText}>
            Sale: {cur} {salePrice.toLocaleString()}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="cart-outline" size={12} color="#92400E" />
          <Text style={[styles.pillText, { color: '#92400E' }]}>
            Purchase: {cur} {purchasePrice.toLocaleString()}
          </Text>
        </View>
        {item.unit ? (
          <View style={[styles.pill, { backgroundColor: '#F5F3FF' }]}>
            <Text style={[styles.pillText, { color: '#5B21B6' }]}>
              Unit: {item.unit}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.col, { flex: 3 }]}>Movement</Text>
        <Text style={[styles.col, { textAlign: 'center', flex: 1 }]}>In</Text>
        <Text style={[styles.col, { textAlign: 'center', flex: 1 }]}>Out</Text>
        <Text style={[styles.col, { textAlign: 'right', flex: 2 }]}>
          Stock / Avg Cost
        </Text>
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
              Create purchase or sales invoices containing this item to
              see stock movements here
            </Text>
          </View>
        }
        renderItem={({ item: txn }) => (
          <View style={[
            styles.txnRow,
            { backgroundColor: getTypeBg(txn.type) },
          ]}>
            <View style={{ flex: 3 }}>
              <View style={styles.txnTitleRow}>
                <View style={[
                  styles.typeIcon,
                  { backgroundColor: getTypeBg(txn.type) },
                ]}>
                  <Ionicons
                    name={getTypeIcon(txn.type)}
                    size={13}
                    color={getTypeColor(txn.type)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnDesc} numberOfLines={1}>
                    {txn.description}
                  </Text>
                  <Text style={styles.txnParty} numberOfLines={1}>
                    {txn.party}
                  </Text>
                  <Text style={styles.txnDate}>
                    {new Date(txn.date).toLocaleDateString()}
                    {txn.type === 'cost_adj' ? ' · Cost adjustment' : ''}
                  </Text>
                </View>
              </View>
            </View>

            {/* In column */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              {txn.qtyIn > 0 ? (
                <>
                  <Text style={styles.qtyIn}>+{txn.qtyIn}</Text>
                  {txn.unitCost > 0 && (
                    <Text style={styles.unitCostText}>
                      @ {Math.round(txn.unitCost).toLocaleString()}
                    </Text>
                  )}
                </>
              ) : txn.type === 'cost_adj' && txn.lineValue > 0 ? (
                <Text style={styles.costAdjText}>
                  +{cur}{Math.round(txn.lineValue).toLocaleString()}
                </Text>
              ) : (
                <Text style={styles.dash}>—</Text>
              )}
            </View>

            {/* Out column */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              {txn.qtyOut > 0 ? (
                <>
                  <Text style={styles.qtyOut}>-{txn.qtyOut}</Text>
                  {txn.unitCost > 0 && (
                    <Text style={styles.unitCostText}>
                      @ {Math.round(txn.unitCost).toLocaleString()}
                    </Text>
                  )}
                </>
              ) : txn.type === 'cost_adj' && txn.lineValue < 0 ? (
                <Text style={[styles.costAdjText, { color: '#EF4444' }]}>
                  -{cur}{Math.round(Math.abs(txn.lineValue)).toLocaleString()}
                </Text>
              ) : (
                <Text style={styles.dash}>—</Text>
              )}
            </View>

            {/* Running balance */}
            <View style={{ flex: 2, alignItems: 'flex-end' }}>
              <Text style={[
                styles.runningQty,
                { color: txn.runningQty < 0 ? '#EF4444' : colors.textPrimary },
              ]}>
                {txn.runningQty} {item.unit || ''}
                {txn.runningQty < 0 ? ' ⚠' : ''}
              </Text>
              {txn.avgCost > 0 && (
                <Text style={styles.runningAvgCost}>
                  avg {cur} {Math.round(txn.avgCost).toLocaleString()}
                </Text>
              )}
              {txn.type === 'cost_adj' && (
                <Text style={styles.runningAvgCost}>
                  new avg {cur} {Math.round(txn.avgCost).toLocaleString()}
                </Text>
              )}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.background },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: {
    fontSize: 17, fontWeight: '700', color: colors.textPrimary,
    flex: 1, textAlign: 'center',
  },

  // Summary
  summaryRow: {
    flexDirection: 'row', gap: 6, padding: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  summaryCard: {
    flex: 1, backgroundColor: colors.background,
    borderRadius: 10, padding: 10, alignItems: 'center', gap: 2,
  },
  summaryLabel:    { fontSize: 10, fontWeight: '600', color: colors.textSecondary },
  summaryValue:    { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  summarySubLabel: { fontSize: 9, color: colors.textTertiary, textAlign: 'center' },
  badge: {
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2,
  },
  badgeText: { fontSize: 9, fontWeight: '700' },

  // Pills
  pillRow: {
    flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ECFDF5', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: '#065F46' },

  // Table header
  tableHeader: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  col: {
    fontSize: 9, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },

  // Ledger rows
  txnRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    alignItems: 'center',
  },
  txnTitleRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  typeIcon: {
    width: 24, height: 24, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1,
  },
  txnDesc:  { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  txnParty: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  txnDate:  { fontSize: 10, color: colors.textTertiary, marginTop: 1 },

  // Qty columns
  qtyIn:  { fontSize: 13, fontWeight: '700', color: '#10B981' },
  qtyOut: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  dash:   { fontSize: 13, color: colors.textTertiary },
  unitCostText: { fontSize: 9, color: colors.textTertiary, marginTop: 1 },
  costAdjText:  { fontSize: 11, fontWeight: '600', color: '#8B5CF6' },

  // Running balance
  runningQty:     { fontSize: 13, fontWeight: '700' },
  runningAvgCost: { fontSize: 9, color: colors.textTertiary, marginTop: 1 },

  // Empty
  emptyBox:  { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 40 },
  emptyTitle:{ fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  emptySub:  { fontSize: 13, color: colors.textTertiary, textAlign: 'center', lineHeight: 20 },
});