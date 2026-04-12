import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'pnl',     label: 'P&L Report' },
  { id: 'balance', label: 'Balance Sheet' },
  { id: 'cashflow',label: 'Cash Flow' },
];

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year',  label: 'Year' },
];

const EXPENSE_COLORS = [
  '#EF4444','#F97316','#EAB308',
  '#8B5CF6','#3B82F6','#10B981','#6B7280',
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

const getDateRange = (period) => {
  const now   = new Date();
  const start = new Date();
  const end   = new Date();
  end.setHours(23, 59, 59, 999);
  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week': {
      const day = now.getDay();
      start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() + 1, 0);
      break;
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      break;
  }
  return { start, end };
};

const inRange = (dateStr, start, end) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d <= end;
};

// ─── COGS Calculator (weighted average cost) ─────────────────────────────────
// COGS = sum of (qty sold × weighted avg cost at time of sale) for each item
// We use the inventory ledger data already tracked per item

const calcCOGS = (biz, start, end) => {
  if (!biz) return { totalCOGS: 0, itemBreakdown: [] };

  const itemBreakdown = [];
  let totalCOGS = 0;

  (biz.items || []).forEach(item => {
    // Build all purchase movements up to end date to get avg cost
    // then calculate COGS for units sold in the period

    // All purchases for this item (all time, to compute running avg cost)
    const allPurchases = [];
    (biz.purchaseInvoices || []).forEach(inv => {
      (inv.lines || []).forEach(line => {
        if (
          line.description?.toLowerCase() === item.name?.toLowerCase() ||
          line.itemId === item.id
        ) {
          allPurchases.push({
            date: inv.date,
            qty:  parseFloat(line.qty) || 0,
            rate: parseFloat(line.rate) || 0,
          });
        }
      });
    });

    // Opening stock
    let totalQty   = item.openingStock || 0;
    let totalValue = (item.openingStock || 0) * (item.costPrice || 0);

    // Process all purchases in date order to compute weighted avg cost
    allPurchases
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(p => {
        totalQty   += p.qty;
        totalValue += p.qty * p.rate;
      });

    const avgCost = totalQty > 0 ? totalValue / totalQty : (item.costPrice || 0);

    // Sales of this item in the period
    let qtySoldInPeriod = 0;
    (biz.salesInvoices || [])
      .filter(inv => inRange(inv.date, start, end))
      .forEach(inv => {
        (inv.lines || []).forEach(line => {
          if (
            line.description?.toLowerCase() === item.name?.toLowerCase() ||
            line.itemId === item.id
          ) {
            qtySoldInPeriod += parseFloat(line.qty) || 0;
          }
        });
      });

    const itemCOGS = qtySoldInPeriod * avgCost;

    if (qtySoldInPeriod > 0) {
      itemBreakdown.push({
        name: item.name,
        qtySold: qtySoldInPeriod,
        avgCost,
        cogs: itemCOGS,
      });
      totalCOGS += itemCOGS;
    }
  });

  // Also add write-offs in period as COGS
  const writeOffCOGS = (biz.inventoryWriteOffs || [])
    .filter(w => inRange(w.date, start, end))
    .reduce((s, w) => s + (w.amount || 0), 0);

  if (writeOffCOGS > 0) {
    itemBreakdown.push({
      name: 'Write-offs',
      qtySold: 0,
      avgCost: 0,
      cogs: writeOffCOGS,
    });
    totalCOGS += writeOffCOGS;
  }

  return { totalCOGS, itemBreakdown };
};

// ─── Main stats calculator ────────────────────────────────────────────────────

const calcStats = (biz, period) => {
  if (!biz) return null;
  const { start, end } = getDateRange(period);
  const cur = biz.meta?.currency || 'PKR';

  // ── P&L ──────────────────────────────────────────────────────────────────

  // Revenue from sales invoices in period
  const salesInvoices = (biz.salesInvoices || [])
    .filter(i => inRange(i.date, start, end));
  const totalSales   = salesInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const invoiceCount = salesInvoices.length;

  // COGS using weighted average cost (correct method)
  const { totalCOGS, itemBreakdown: cogsBreakdown } = calcCOGS(biz, start, end);

  const grossProfit  = totalSales - totalCOGS;
  const grossMargin  = totalSales > 0
    ? ((grossProfit / totalSales) * 100).toFixed(1) : '0.0';

  // Other income (receipts not linked to customers)
  const otherIncome = (biz.transactions || [])
    .filter(t =>
      t.transactionType === 'receipt' &&
      inRange(t.date, start, end) &&
      !t.partyId &&
      t.incomeAccountId
    )
    .reduce((s, t) => s + (t.amount || 0), 0);

  // Operating expenses by category
  const expenseMap = {};
  (biz.transactions || [])
    .filter(t =>
      t.transactionType === 'payment' &&
      inRange(t.date, start, end) &&
      t.expenseAccountId
    )
    .forEach(t => {
      const key = t.expenseAccountName || 'Other';
      expenseMap[key] = (expenseMap[key] || 0) + (t.amount || 0);
    });

  (biz.journalEntries || [])
    .filter(je => inRange(je.date, start, end))
    .flatMap(je => je.lines || [])
    .filter(l => l.accountCategory === 'expense' && l.debit > 0)
    .forEach(l => {
      const key = l.accountName || 'Other';
      expenseMap[key] = (expenseMap[key] || 0) + (l.debit || 0);
    });

  const totalExpenses = Object.values(expenseMap).reduce((s, v) => s + v, 0);
  const expenseBreakdown = Object.entries(expenseMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Net profit
  const netProfit = grossProfit + otherIncome - totalExpenses;
  const netMargin = totalSales > 0
    ? ((netProfit / totalSales) * 100).toFixed(1) : '0.0';

  // ── Balance Sheet ─────────────────────────────────────────────────────────
  // Assets
  const cashOnHand = (biz.bankAccounts || [])
    .filter(a => a.type === 'cash')
    .reduce((s, a) => s + (a.balance || 0), 0);
  const bankBalance = (biz.bankAccounts || [])
    .filter(a => a.type !== 'cash')
    .reduce((s, a) => s + (a.balance || 0), 0);
  const totalLiquid = cashOnHand + bankBalance;

  const totalReceivables = (biz.salesInvoices || [])
    .reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.amountPaid || 0)), 0);

  // Inventory at current value (using items stock × avg cost)
  const inventoryValue = (biz.items || []).reduce((s, item) => {
    const stock = item.stock || 0;
    const cost  = item.costPrice || 0;
    return s + stock * cost;
  }, 0);

  const totalAssets = totalLiquid + totalReceivables + inventoryValue;

  // Liabilities
  const totalPayables = (biz.purchaseInvoices || [])
    .reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.amountPaid || 0)), 0);

  // Capital = Assets - Liabilities (Owner's equity)
  const capital = totalAssets - totalPayables;

  // ── Cash Flow ─────────────────────────────────────────────────────────────
  const cashIn = (biz.transactions || [])
    .filter(t => t.transactionType === 'receipt' && inRange(t.date, start, end))
    .reduce((s, t) => s + (t.amount || 0), 0);

  const cashOut = (biz.transactions || [])
    .filter(t => t.transactionType === 'payment' && inRange(t.date, start, end))
    .reduce((s, t) => s + (t.amount || 0), 0);

  const netCashFlow = cashIn - cashOut;

  // Cash in breakdown by source
  const receiptsBySource = {};
  (biz.transactions || [])
    .filter(t => t.transactionType === 'receipt' && inRange(t.date, start, end))
    .forEach(t => {
      const key = t.partyName || t.incomeAccountName || 'Other';
      receiptsBySource[key] = (receiptsBySource[key] || 0) + (t.amount || 0);
    });

  return {
    cur,
    // P&L
    totalSales, invoiceCount,
    totalCOGS, cogsBreakdown,
    grossProfit, grossMargin,
    otherIncome,
    totalExpenses, expenseBreakdown,
    netProfit, netMargin,
    // Balance sheet
    cashOnHand, bankBalance, totalLiquid,
    totalReceivables, inventoryValue,
    totalAssets, totalPayables, capital,
    // Cash flow
    cashIn, cashOut, netCashFlow,
    receiptsBySource,
  };
};

// ─── Formatting ───────────────────────────────────────────────────────────────

const fmt = (n) =>
  !n && n !== 0 ? '0' : Math.round(n).toLocaleString();

// ─── Reusable components ─────────────────────────────────────────────────────

const SectionLabel = ({ title }) => (
  <Text style={styles.sectionLabel}>{title}</Text>
);

const Card = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

const CardTitle = ({ title }) => (
  <Text style={styles.cardTitle}>{title}</Text>
);

const PnlRow = ({
  label, value, valueColor, indent = false,
  bold = false, highlight, borderTop = false,
}) => (
  <View style={[
    styles.pnlRow,
    borderTop && styles.pnlRowBorderTop,
    highlight === 'green' && styles.pnlRowGreen,
    highlight === 'red'   && styles.pnlRowRed,
    highlight === 'gray'  && styles.pnlRowGray,
  ]}>
    <Text style={[
      styles.pnlLabel,
      indent && styles.pnlLabelIndent,
      bold   && styles.pnlLabelBold,
    ]}>
      {label}
    </Text>
    <Text style={[
      styles.pnlValue,
      bold && styles.pnlValueBold,
      { color: valueColor || colors.textPrimary },
    ]}>
      {value}
    </Text>
  </View>
);

const BsRow = ({
  label, value, valueColor,
  sub, borderBottom = true, bold = false,
}) => (
  <View style={[
    styles.bsRow,
    !borderBottom && { borderBottomWidth: 0 },
  ]}>
    <View style={{ flex: 1 }}>
      <Text style={[styles.bsLabel, bold && { fontWeight: '700' }]}>
        {label}
      </Text>
      {sub ? <Text style={styles.bsSub}>{sub}</Text> : null}
    </View>
    <Text style={[
      styles.bsValue,
      bold && styles.bsValueBold,
      { color: valueColor || colors.textPrimary },
    ]}>
      {value}
    </Text>
  </View>
);

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function StatisticsScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz]       = useState(null);
  const [period, setPeriod] = useState('month');
  const [tab, setTab]       = useState('pnl');

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const stats = calcStats(biz, period);
  const cur   = stats?.cur || 'PKR';

  const getPeriodLabel = () => {
    const now = new Date();
    switch (period) {
      case 'today': return now.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
      case 'week':  return 'This week';
      case 'month': return now.toLocaleDateString('en-GB', {
        month: 'long', year: 'numeric',
      });
      case 'year':  return `Year ${now.getFullYear()}`;
    }
  };

  const maxExpense = stats?.expenseBreakdown?.[0]?.amount || 1;
  const maxCashIn  = Math.max(
    ...(stats ? Object.values(stats.receiptsBySource) : [1])
  ) || 1;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistics</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Report tabs */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[
              styles.tabBtnText,
              tab === t.id && styles.tabBtnTextActive,
            ]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Period bar — only shown for P&L and Cash Flow */}
      {tab !== 'balance' && (
        <View style={styles.periodBar}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.periodBtn, period === p.id && styles.periodBtnActive]}
              onPress={() => setPeriod(p.id)}
            >
              <Text style={[
                styles.periodBtnText,
                period === p.id && styles.periodBtnTextActive,
              ]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!stats ? (
        <View style={styles.emptyBox}>
          <Ionicons name="bar-chart-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptySub}>
            Start recording transactions to see your statistics
          </Text>
        </View>
      ) : (

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >

          {/* ── P&L REPORT ── */}
          {tab === 'pnl' && (
            <>
              {/* Hero */}
              <View style={styles.heroCard}>
                <Text style={styles.heroLabel}>Net Profit</Text>
                <Text style={[
                  styles.heroAmount,
                  { color: stats.netProfit >= 0 ? '#fff' : '#FCA5A5' },
                ]}>
                  {stats.netProfit < 0 ? '- ' : ''}{cur} {fmt(Math.abs(stats.netProfit))}
                </Text>
                <Text style={styles.heroPeriod}>
                  {getPeriodLabel()} · Weighted avg cost
                </Text>
                <View style={styles.heroRow}>
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>Revenue</Text>
                    <Text style={styles.heroStatVal}>{fmt(stats.totalSales)}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>COGS</Text>
                    <Text style={styles.heroStatVal}>{fmt(stats.totalCOGS)}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>Expenses</Text>
                    <Text style={styles.heroStatVal}>{fmt(stats.totalExpenses)}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>Margin</Text>
                    <Text style={styles.heroStatVal}>{stats.netMargin}%</Text>
                  </View>
                </View>
              </View>

              {/* Revenue section */}
              <SectionLabel title="Income" />
              <Card>
                <PnlRow
                  label={`Sales revenue (${stats.invoiceCount} invoices)`}
                  value={`${cur} ${fmt(stats.totalSales)}`}
                  valueColor="#10B981"
                />
                {stats.otherIncome > 0 && (
                  <PnlRow
                    label="Other income"
                    value={`${cur} ${fmt(stats.otherIncome)}`}
                    valueColor="#10B981"
                  />
                )}
                <PnlRow
                  label="Total Revenue"
                  value={`${cur} ${fmt(stats.totalSales + stats.otherIncome)}`}
                  valueColor="#10B981"
                  bold highlight="gray"
                />
              </Card>

              {/* COGS section */}
              <SectionLabel title="Cost of Goods Sold" />
              <Card>
                <Text style={styles.cogsNote}>
                  Calculated using weighted average cost per item
                </Text>
                {stats.cogsBreakdown.map(item => (
                  <PnlRow
                    key={item.name}
                    label={item.qtySold > 0
                      ? `${item.name} (${item.qtySold} units × ${cur} ${fmt(item.avgCost)})`
                      : item.name}
                    value={`${cur} ${fmt(item.cogs)}`}
                    valueColor="#D97706"
                    indent
                  />
                ))}
                {stats.cogsBreakdown.length === 0 && (
                  <PnlRow
                    label="No inventory items sold this period"
                    value={`${cur} 0`}
                    valueColor={colors.textTertiary}
                    indent
                  />
                )}
                <PnlRow
                  label="Total COGS"
                  value={`${cur} ${fmt(stats.totalCOGS)}`}
                  valueColor="#EF4444"
                  bold highlight="gray"
                />
                <PnlRow
                  label="Gross Profit"
                  value={`${cur} ${fmt(stats.grossProfit)}`}
                  valueColor={stats.grossProfit >= 0 ? '#16A34A' : '#EF4444'}
                  bold
                  highlight={stats.grossProfit >= 0 ? 'green' : 'red'}
                />
              </Card>

              {/* Expenses section */}
              <SectionLabel title="Operating Expenses" />
              <Card>
                {stats.expenseBreakdown.length === 0 ? (
                  <PnlRow
                    label="No expenses recorded this period"
                    value={`${cur} 0`}
                    valueColor={colors.textTertiary}
                    indent
                  />
                ) : (
                  stats.expenseBreakdown.map(item => (
                    <PnlRow
                      key={item.name}
                      label={item.name}
                      value={`${cur} ${fmt(item.amount)}`}
                      valueColor="#EF4444"
                      indent
                    />
                  ))
                )}
                <PnlRow
                  label="Total Expenses"
                  value={`${cur} ${fmt(stats.totalExpenses)}`}
                  valueColor="#EF4444"
                  bold highlight="gray"
                />
                <PnlRow
                  label="Net Profit"
                  value={`${stats.netProfit < 0 ? '- ' : ''}${cur} ${fmt(Math.abs(stats.netProfit))}`}
                  valueColor={stats.netProfit >= 0 ? '#16A34A' : '#EF4444'}
                  bold
                  highlight={stats.netProfit >= 0 ? 'green' : 'red'}
                />
              </Card>

              {/* Expense bar chart */}
              {stats.expenseBreakdown.length > 0 && (
                <>
                  <SectionLabel title="Expense Breakdown" />
                  <Card>
                    <CardTitle title="Where your money went" />
                    {stats.expenseBreakdown.map((item, idx) => {
                      const barWidth = maxExpense > 0
                        ? (item.amount / maxExpense) * 100 : 0;
                      const pct = stats.totalExpenses > 0
                        ? ((item.amount / stats.totalExpenses) * 100).toFixed(0) : 0;
                      return (
                        <View key={item.name} style={styles.barRow}>
                          <View style={styles.barLabelWrap}>
                            <Text style={styles.barName} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={styles.barPct}>{pct}%</Text>
                          </View>
                          <View style={styles.barTrack}>
                            <View style={[
                              styles.barFill,
                              {
                                width: `${barWidth}%`,
                                backgroundColor: EXPENSE_COLORS[idx % EXPENSE_COLORS.length],
                              },
                            ]} />
                          </View>
                          <Text style={styles.barAmt}>
                            {cur} {fmt(item.amount)}
                          </Text>
                        </View>
                      );
                    })}
                  </Card>
                </>
              )}
            </>
          )}

          {/* ── BALANCE SHEET ── */}
          {tab === 'balance' && (
            <>
              <Text style={styles.bsNote}>
                Showing current position as of today
              </Text>

              <SectionLabel title="Assets — What you own" />
              <Card>
                <BsRow
                  label="Cash on Hand"
                  sub="Physical cash in business"
                  value={`${cur} ${fmt(stats.cashOnHand)}`}
                  valueColor="#10B981"
                />
                <BsRow
                  label="Bank Accounts"
                  sub="Money in bank"
                  value={`${cur} ${fmt(stats.bankBalance)}`}
                  valueColor="#3B82F6"
                />
                <BsRow
                  label="Accounts Receivable"
                  sub="Customers owe you"
                  value={`${cur} ${fmt(stats.totalReceivables)}`}
                  valueColor={stats.totalReceivables > 0 ? '#D97706' : '#10B981'}
                />
                <BsRow
                  label="Inventory"
                  sub="Stock at cost price"
                  value={`${cur} ${fmt(stats.inventoryValue)}`}
                  valueColor="#8B5CF6"
                />
                <BsRow
                  label="Total Assets"
                  value={`${cur} ${fmt(stats.totalAssets)}`}
                  valueColor="#10B981"
                  bold
                  borderBottom={false}
                />
              </Card>

              <SectionLabel title="Liabilities — What you owe" />
              <Card>
                <BsRow
                  label="Accounts Payable"
                  sub="You owe suppliers"
                  value={`${cur} ${fmt(stats.totalPayables)}`}
                  valueColor={stats.totalPayables > 0 ? '#EF4444' : '#10B981'}
                />
                <BsRow
                  label="Total Liabilities"
                  value={`${cur} ${fmt(stats.totalPayables)}`}
                  valueColor="#EF4444"
                  bold
                  borderBottom={false}
                />
              </Card>

              <SectionLabel title="Capital — Owner's Equity" />
              <Card style={{ marginBottom: 8 }}>
                <BsRow
                  label="Net Capital"
                  sub="Assets minus Liabilities"
                  value={`${cur} ${fmt(stats.capital)}`}
                  valueColor={stats.capital >= 0 ? '#10B981' : '#EF4444'}
                  bold
                  borderBottom={false}
                />
              </Card>

              {/* Quick balance check */}
              <View style={[
                styles.checkCard,
                {
                  backgroundColor:
                    Math.abs(stats.totalAssets - (stats.totalPayables + stats.capital)) < 1
                      ? '#F0FDF4' : '#FEF2F2',
                },
              ]}>
                <Ionicons
                  name={
                    Math.abs(stats.totalAssets - (stats.totalPayables + stats.capital)) < 1
                      ? 'checkmark-circle' : 'alert-circle'
                  }
                  size={18}
                  color={
                    Math.abs(stats.totalAssets - (stats.totalPayables + stats.capital)) < 1
                      ? '#16A34A' : '#EF4444'
                  }
                />
                <Text style={[
                  styles.checkText,
                  {
                    color:
                      Math.abs(stats.totalAssets - (stats.totalPayables + stats.capital)) < 1
                        ? '#16A34A' : '#EF4444',
                  },
                ]}>
                  {Math.abs(stats.totalAssets - (stats.totalPayables + stats.capital)) < 1
                    ? 'Assets = Liabilities + Capital ✓'
                    : 'Balance sheet not fully reconciled'}
                </Text>
              </View>

              {/* Inventory detail */}
              {(biz?.items || []).length > 0 && (
                <>
                  <SectionLabel title="Inventory breakdown" />
                  <Card>
                    <CardTitle title="Stock at cost price" />
                    {(biz.items || [])
                      .filter(item => (item.stock || 0) > 0)
                      .map((item, idx, arr) => (
                        <BsRow
                          key={item.id}
                          label={item.name}
                          sub={`${item.stock} units × ${cur} ${fmt(item.costPrice)}`}
                          value={`${cur} ${fmt((item.stock || 0) * (item.costPrice || 0))}`}
                          valueColor="#8B5CF6"
                          borderBottom={idx < arr.length - 1}
                        />
                      ))}
                    {(biz.items || []).filter(i => (i.stock || 0) > 0).length === 0 && (
                      <View style={styles.emptyInline}>
                        <Text style={styles.emptyInlineText}>
                          No stock currently available
                        </Text>
                      </View>
                    )}
                  </Card>
                </>
              )}
            </>
          )}

          {/* ── CASH FLOW ── */}
          {tab === 'cashflow' && (
            <>
              {/* Hero */}
              <View style={[
                styles.heroCard,
                {
                  backgroundColor:
                    stats.netCashFlow >= 0 ? '#10B981' : '#EF4444',
                },
              ]}>
                <Text style={styles.heroLabel}>Net Cash Flow</Text>
                <Text style={styles.heroAmount}>
                  {stats.netCashFlow < 0 ? '- ' : ''}{cur} {fmt(Math.abs(stats.netCashFlow))}
                </Text>
                <Text style={styles.heroPeriod}>{getPeriodLabel()}</Text>
                <View style={styles.heroRow}>
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>Cash In</Text>
                    <Text style={styles.heroStatVal}>{fmt(stats.cashIn)}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>Cash Out</Text>
                    <Text style={styles.heroStatVal}>{fmt(stats.cashOut)}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>Balance</Text>
                    <Text style={styles.heroStatVal}>
                      {fmt(stats.cashOnHand + stats.bankBalance)}
                    </Text>
                  </View>
                </View>
              </View>

              <SectionLabel title="Cash In" />
              <Card>
                {Object.entries(stats.receiptsBySource).length === 0 ? (
                  <PnlRow
                    label="No receipts this period"
                    value={`${cur} 0`}
                    valueColor={colors.textTertiary}
                    indent
                  />
                ) : (
                  Object.entries(stats.receiptsBySource).map(([name, amount]) => {
                    const barWidth = maxCashIn > 0
                      ? (amount / maxCashIn) * 100 : 0;
                    return (
                      <View key={name} style={styles.barRow}>
                        <View style={styles.barLabelWrap}>
                          <Text style={styles.barName} numberOfLines={1}>
                            {name}
                          </Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View style={[
                            styles.barFill,
                            { width: `${barWidth}%`, backgroundColor: '#10B981' },
                          ]} />
                        </View>
                        <Text style={styles.barAmt}>
                          {cur} {fmt(amount)}
                        </Text>
                      </View>
                    );
                  })
                )}
                <PnlRow
                  label="Total Cash In"
                  value={`${cur} ${fmt(stats.cashIn)}`}
                  valueColor="#10B981"
                  bold highlight="gray"
                />
              </Card>

              <SectionLabel title="Cash Out" />
              <Card>
                {stats.expenseBreakdown.length === 0 ? (
                  <PnlRow
                    label="No payments this period"
                    value={`${cur} 0`}
                    valueColor={colors.textTertiary}
                    indent
                  />
                ) : (
                  stats.expenseBreakdown.map((item, idx) => {
                    const barWidth = maxExpense > 0
                      ? (item.amount / maxExpense) * 100 : 0;
                    return (
                      <View key={item.name} style={styles.barRow}>
                        <View style={styles.barLabelWrap}>
                          <Text style={styles.barName} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View style={[
                            styles.barFill,
                            {
                              width: `${barWidth}%`,
                              backgroundColor: EXPENSE_COLORS[idx % EXPENSE_COLORS.length],
                            },
                          ]} />
                        </View>
                        <Text style={styles.barAmt}>
                          {cur} {fmt(item.amount)}
                        </Text>
                      </View>
                    );
                  })
                )}
                <PnlRow
                  label="Total Cash Out"
                  value={`${cur} ${fmt(stats.cashOut)}`}
                  valueColor="#EF4444"
                  bold highlight="gray"
                />
              </Card>

              <SectionLabel title="Account Balances" />
              <Card style={{ marginBottom: 32 }}>
                {(biz?.bankAccounts || []).map((acc, idx, arr) => (
                  <BsRow
                    key={acc.id}
                    label={acc.name}
                    sub={acc.type === 'cash' ? 'Cash' : 'Bank'}
                    value={`${cur} ${fmt(acc.balance || 0)}`}
                    valueColor={(acc.balance || 0) >= 0 ? '#10B981' : '#EF4444'}
                    borderBottom={idx < arr.length - 1}
                  />
                ))}
                {(biz?.bankAccounts || []).length === 0 && (
                  <View style={styles.emptyInline}>
                    <Text style={styles.emptyInlineText}>No accounts set up</Text>
                  </View>
                )}
              </Card>
            </>
          )}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  // Tabs
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    paddingHorizontal: 12, paddingVertical: 10, gap: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#F3F4F6',
  },
  tabBtnActive:     { backgroundColor: colors.primary },
  tabBtnText:       { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  tabBtnTextActive: { color: '#fff' },

  // Period
  periodBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    paddingHorizontal: 12, paddingVertical: 8, gap: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  periodBtn: {
    flex: 1, paddingVertical: 6, borderRadius: 20,
    alignItems: 'center', backgroundColor: '#F3F4F6',
  },
  periodBtnActive:     { backgroundColor: colors.primary },
  periodBtnText:       { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  periodBtnTextActive: { color: '#fff' },

  // Content
  content: { padding: 14, paddingBottom: 48 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 6, marginTop: 14, marginLeft: 2,
  },

  // Hero card
  heroCard: {
    backgroundColor: colors.primary, borderRadius: 18,
    padding: 18, marginBottom: 8,
  },
  heroLabel:  { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 3 },
  heroAmount: { fontSize: 28, fontWeight: '700', color: '#fff' },
  heroPeriod: {
    fontSize: 11, color: 'rgba(255,255,255,0.6)',
    marginTop: 2, marginBottom: 12,
  },
  heroRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 10, padding: 10,
  },
  heroStat:        { flex: 1, alignItems: 'center' },
  heroStatDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroStatLabel:   { fontSize: 9, color: 'rgba(255,255,255,0.65)', marginBottom: 2 },
  heroStatVal:     { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 13, fontWeight: '700', color: colors.textPrimary,
    padding: 12, paddingBottom: 8,
  },

  cogsNote: {
    fontSize: 11, color: colors.textTertiary, fontStyle: 'italic',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
  },

  // P&L rows
  pnlRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  pnlRowBorderTop: { borderTopWidth: 0 },
  pnlRowGreen:     { backgroundColor: '#F0FDF4' },
  pnlRowRed:       { backgroundColor: '#FEF2F2' },
  pnlRowGray:      { backgroundColor: '#F9FAFB' },
  pnlLabel: {
    fontSize: 13, color: colors.textSecondary, flex: 1, paddingRight: 8,
  },
  pnlLabelIndent: {
    paddingLeft: 12, fontSize: 12, color: colors.textTertiary,
  },
  pnlLabelBold: { fontWeight: '700', color: colors.textPrimary, fontSize: 13 },
  pnlValue:     { fontSize: 13, fontWeight: '600' },
  pnlValueBold: { fontSize: 14, fontWeight: '700' },

  // Balance sheet rows
  bsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  bsLabel:     { fontSize: 14, color: colors.textPrimary },
  bsSub:       { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  bsValue:     { fontSize: 14, fontWeight: '600' },
  bsValueBold: { fontSize: 15, fontWeight: '700' },

  // Balance check
  checkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  checkText: { fontSize: 13, fontWeight: '600', flex: 1 },

  // Notes
  bsNote: {
    fontSize: 12, color: colors.textTertiary, fontStyle: 'italic',
    textAlign: 'center', paddingVertical: 8,
  },

  // Bar chart
  barRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingHorizontal: 14, marginBottom: 10,
  },
  barLabelWrap: { width: 85, flexShrink: 0 },
  barName:      { fontSize: 12, color: colors.textPrimary, fontWeight: '500' },
  barPct:       { fontSize: 10, color: colors.textTertiary },
  barTrack: {
    flex: 1, height: 7, backgroundColor: '#F3F4F6',
    borderRadius: 4, overflow: 'hidden',
  },
  barFill:  { height: '100%', borderRadius: 4 },
  barAmt:   { fontSize: 11, color: colors.textSecondary, width: 68, textAlign: 'right' },

  // Empty
  emptyBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingHorizontal: 40,
  },
  emptyTitle:    { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  emptySub:      { fontSize: 13, color: colors.textTertiary, textAlign: 'center', lineHeight: 20 },
  emptyInline:   { padding: 16 },
  emptyInlineText: { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
});