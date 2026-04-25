import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness } from '../../data/BusinessStore';
import {
  initFromBusiness,
  querySalesRevenue,
  queryCashIn,
  queryCashOut,
  queryJournalCashMovements,
  queryExpenses,
  queryJournalExpenses,
  queryWriteOffLosses,
  queryReceivables,
  queryPayables,
  queryItemPurchaseHistory,
  queryItemSalesInPeriod,
  queryItems,
} from '../../data/SmartBizDatabase';
import { colors } from '../../theme/colors';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'pnl',      label: 'P&L Report' },
  { id: 'balance',  label: 'Balance Sheet' },
  { id: 'cashflow', label: 'Cash Flow' },
];

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year',  label: 'Year' },
];

const EXPENSE_COLORS = [
  '#EF4444', '#F97316', '#EAB308',
  '#8B5CF6', '#3B82F6', '#10B981', '#6B7280',
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
    default:
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() + 1, 0);
  }
  return { start, end };
};

// ─── Main stats calculator (async — uses SQLite) ──────────────────────────────

const calcStats = async (biz, period) => {
  if (!biz) return null;
  const { start, end } = getDateRange(period);
  const startDate = start.toISOString().split('T')[0];
  const endDate   = end.toISOString().split('T')[0];
  const bid = biz.id;
  const cur = biz.meta?.currency || 'PKR';

  // Populate SQLite tables from AsyncStorage JSON
  await initFromBusiness(biz);

  // ── Revenue ──────────────────────────────────────────────────────────────
  const revenueData  = await querySalesRevenue(bid, startDate, endDate);
  const totalSales   = revenueData?.total_sales   || 0;
  const invoiceCount = revenueData?.invoice_count || 0;

  // ── COGS via SQL purchase history ────────────────────────────────────────
  const sqlItems      = await queryItems(bid);
  let totalCOGS       = 0;
  const cogsBreakdown = [];

  for (const item of sqlItems) {
    const purchases = await queryItemPurchaseHistory(bid, item.name);

    let runningQty   = item.opening_stock || 0;
    let runningValue = runningQty * (item.opening_stock_rate || 0);

    // Build timeline: purchases + journal cost adjustments
    const timeline = [
      ...purchases.map(p => ({
        date: p.date, type: 'purchase',
        qty: p.qty, value: p.qty * p.rate, order: 1,
      })),
      ...(biz.journalEntries || []).flatMap(je =>
        (je.lines || [])
          .filter(l => {
            if (l.accountCategory !== 'inventory') return false;
            const ti = (biz.items || []).find(i => i.id === l.accountId);
            return ti && ti.name === item.name &&
              (parseFloat(l.qty) || 0) === 0 && (l.debit || 0) > 0;
          })
          .map(l => ({
            date: je.date, type: 'cost_adj',
            qty: 0, value: l.debit || 0, order: 3,
          }))
      ),
    ].sort((a, b) => {
      const d = new Date(a.date) - new Date(b.date);
      return d !== 0 ? d : (a.order - b.order);
    });

    // Replay to build avgCostByDate map
    let runQty = runningQty;
    let runVal = runningValue;
    const avgCostByDate = {};

    for (const event of timeline) {
      avgCostByDate[event.date] = runQty > 0 ? runVal / runQty : 0;
      if (event.type === 'purchase') {
        runQty += event.qty;
        runVal += event.value;
      } else if (event.type === 'cost_adj') {
        runVal += event.value;
        if (runVal < 0) runVal = 0;
      }
    }
    const finalAvgCost = runQty > 0 ? runVal / runQty : 0;

    // Get sales in period from SQL
    const sales = await queryItemSalesInPeriod(bid, item.name, startDate, endDate);
    if (sales.length === 0) continue;

    let itemCOGS     = 0;
    let totalQtySold = 0;

    for (const sale of sales) {
      const saleDates = Object.keys(avgCostByDate).sort();
      let avgCostAtSale = finalAvgCost;
      for (const d of saleDates) {
        if (d <= sale.date) avgCostAtSale = avgCostByDate[d];
      }
      itemCOGS     += sale.qty * avgCostAtSale;
      totalQtySold += sale.qty;
    }

    if (itemCOGS > 0) {
      cogsBreakdown.push({
        name:    item.name,
        qtySold: totalQtySold,
        avgCost: totalQtySold > 0 ? itemCOGS / totalQtySold : 0,
        cogs:    itemCOGS,
      });
      totalCOGS += itemCOGS;
    }
  }

  const grossProfit = totalSales - totalCOGS;
  const grossMargin = totalSales > 0
    ? ((grossProfit / totalSales) * 100).toFixed(1) : '0.0';

  // ── Operating expenses ───────────────────────────────────────────────────
  const expenseRows    = await queryExpenses(bid, startDate, endDate);
  const journalExpRows = await queryJournalExpenses(bid, startDate, endDate);
  const writeOffData   = await queryWriteOffLosses(bid, startDate, endDate);

  const expenseMap = {};

  for (const row of expenseRows) {
    expenseMap[row.category] = (expenseMap[row.category] || 0) + row.total;
  }
  for (const row of journalExpRows) {
    const acc = (biz.expenseAccounts || []).find(a => a.id === row.category);
    const key = acc?.name || row.category || 'Other';
    expenseMap[key] = (expenseMap[key] || 0) + row.total;
  }
  if (writeOffData.total > 0) {
    expenseMap['Inventory Write-off Loss'] =
      (expenseMap['Inventory Write-off Loss'] || 0) + writeOffData.total;
  }

  const totalExpenses    = Object.values(expenseMap).reduce((s, v) => s + v, 0);
  const expenseBreakdown = Object.entries(expenseMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // ── Other income ─────────────────────────────────────────────────────────
  const otherIncome = (biz.transactions || [])
    .filter(t =>
      t.transactionType === 'receipt' &&
      new Date(t.date) >= start && new Date(t.date) <= end &&
      !t.partyId && t.incomeAccountId
    )
    .reduce((s, t) => s + (t.amount || 0), 0);

  // ── Net profit ───────────────────────────────────────────────────────────
  const netProfit = grossProfit + otherIncome - totalExpenses;
  const netMargin = totalSales > 0
    ? ((netProfit / totalSales) * 100).toFixed(1) : '0.0';

  // ── Balance Sheet ────────────────────────────────────────────────────────
  const cashOnHand  = (biz.bankAccounts || [])
    .filter(a => a.type === 'cash')
    .reduce((s, a) => s + (a.balance || 0), 0);
  const bankBalance = (biz.bankAccounts || [])
    .filter(a => a.type !== 'cash')
    .reduce((s, a) => s + (a.balance || 0), 0);
  const totalLiquid = cashOnHand + bankBalance;

  const totalReceivables = await queryReceivables(bid);
  const totalPayables    = await queryPayables(bid);

  // Inventory valuation
  let inventoryValue       = 0;
  const inventoryBreakdown = [];

  for (const item of sqlItems) {
    const purchases = await queryItemPurchaseHistory(bid, item.name);
    let runQty = item.opening_stock || 0;
    let runVal = runQty * (item.opening_stock_rate || 0);

    for (const p of purchases) {
      runQty += p.qty;
      runVal += p.qty * p.rate;
    }
    for (const je of biz.journalEntries || []) {
      for (const line of je.lines || []) {
        if (line.accountCategory !== 'inventory') continue;
        const ti = (biz.items || []).find(i => i.id === line.accountId);
        if (!ti || ti.name !== item.name) continue;
        if ((parseFloat(line.qty) || 0) === 0 && (line.debit || 0) > 0) {
          runVal += line.debit;
        }
      }
    }

    const currentAvgCost = runQty > 0 ? runVal / runQty : 0;
    const currentStock   = item.stock;
    const value          = Math.max(0, currentStock * currentAvgCost);

    if (currentStock !== 0 || value !== 0) {
      inventoryBreakdown.push({
        name:    item.name,
        stock:   currentStock,
        avgCost: currentAvgCost,
        value,
        unit: (biz.items || []).find(i => i.name === item.name)?.unit || 'units',
      });
      inventoryValue += value;
    }
  }

  const totalAssets = totalLiquid + totalReceivables + inventoryValue;

  const openingStockEquity = (biz.items || []).reduce((s, it) => {
    const rate = it.openingStockRate || it.purchasePrice || it.costPrice || 0;
    return s + (it.openingStock || 0) * rate;
  }, 0);
  const customerOpeningEquity = (biz.customers || [])
    .reduce((s, c) => s + (c.openingBalance || 0), 0);
  const supplierOpeningEquity = (biz.suppliers || [])
    .reduce((s, s2) => s + (s2.openingBalance || 0), 0);
  const totalOpeningEquity =
    openingStockEquity + customerOpeningEquity - supplierOpeningEquity;
  const capital = totalAssets - totalPayables;

  // ── Cash Flow ────────────────────────────────────────────────────────────
  const cashInData  = await queryCashIn(bid, startDate, endDate);
  const cashOutData = await queryCashOut(bid, startDate, endDate);
  const jCash       = await queryJournalCashMovements(bid, startDate, endDate);

  const totalCashIn  = cashInData.total  + jCash.journalCashIn;
  const totalCashOut = cashOutData.total + jCash.journalCashOut;
  const netCashFlow  = totalCashIn - totalCashOut;

  const receiptsBySource = {};
  for (const row of cashInData.rows) {
    receiptsBySource[row.source] =
      (receiptsBySource[row.source] || 0) + row.total;
  }
  if (jCash.journalCashIn > 0) {
    receiptsBySource['Journal entries'] =
      (receiptsBySource['Journal entries'] || 0) + jCash.journalCashIn;
  }

  const cashOutByCategory = {};
  for (const row of cashOutData.rows) {
    cashOutByCategory[row.category] =
      (cashOutByCategory[row.category] || 0) + row.total;
  }
  if (jCash.journalCashOut > 0) {
    cashOutByCategory['Journal entries'] =
      (cashOutByCategory['Journal entries'] || 0) + jCash.journalCashOut;
  }
  const cashOutBreakdown = Object.entries(cashOutByCategory)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    cur,
    totalSales, invoiceCount,
    totalCOGS, cogsBreakdown,
    grossProfit, grossMargin,
    otherIncome,
    totalExpenses, expenseBreakdown,
    netProfit, netMargin,
    cashOnHand, bankBalance, totalLiquid,
    totalReceivables,
    inventoryValue, inventoryBreakdown,
    totalAssets,
    totalPayables,
    totalOpeningEquity,
    capital,
    cashIn: cashInData.total, cashOut: cashOutData.total,
    journalCashIn: jCash.journalCashIn, journalCashOut: jCash.journalCashOut,
    totalCashIn, totalCashOut, netCashFlow,
    receiptsBySource,
    cashOutBreakdown,
    totalCashBalance: totalLiquid,
  };
};

// ─── Formatting ───────────────────────────────────────────────────────────────

const fmt = (n) =>
  !n && n !== 0 ? '0' : Math.round(n).toLocaleString();

// ─── Reusable row components ──────────────────────────────────────────────────

const SectionLabel = ({ title }) => (
  <Text style={styles.sectionLabel}>{title}</Text>
);

const PnlRow = ({ label, value, valueColor, indent = false, bold = false, highlight }) => (
  <View style={[
    styles.pnlRow,
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

const BsRow = ({ label, value, valueColor, sub, borderBottom = true, bold = false }) => (
  <View style={[styles.bsRow, !borderBottom && { borderBottomWidth: 0 }]}>
    <View style={{ flex: 1 }}>
      <Text style={[styles.bsLabel, bold && { fontWeight: '700' }]}>{label}</Text>
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function StatisticsScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;

  const [biz, setBiz]       = useState(null);
  const [period, setPeriod] = useState('month');
  const [tab, setTab]       = useState('pnl');
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(false);

  // ── cur and getPeriodLabel are derived from component state ──────────────
  // They MUST live here in the component body, not inside calcStats,
  // because they are used by the JSX render.
  const cur = biz?.meta?.currency || 'PKR';

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
      case 'year':  return 'Year ' + now.getFullYear();
      default:      return '';
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(b => setBiz(b));
    }, [businessId])
  );

  useEffect(() => {
    if (!biz) return;
    setLoading(true);
    setStats(null);
    calcStats(biz, period)
      .then(result => {
        setStats(result);
        setLoading(false);
      })
      .catch(e => {
        console.error('Stats error:', e);
        setLoading(false);
      });
  }, [biz, period]);

  const maxExpense = stats?.expenseBreakdown?.[0]?.amount || 1;
  const maxCashOut = stats?.cashOutBreakdown?.[0]?.amount  || 1;
  const maxCashIn  = Math.max(
    ...Object.values(stats?.receiptsBySource || {}).concat([1])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistics</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[styles.tabBtnText, tab === t.id && styles.tabBtnTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Period bar */}
      {tab !== 'balance' ? (
        <View style={styles.periodBar}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.periodBtn, period === p.id && styles.periodBtnActive]}
              onPress={() => setPeriod(p.id)}
            >
              <Text style={[styles.periodBtnText, period === p.id && styles.periodBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* Loading state */}
      {loading ? (
        <View style={styles.emptyBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptySub}>Loading via SQLite...</Text>
        </View>

      /* Empty state */
      ) : !stats ? (
        <View style={styles.emptyBox}>
          <Ionicons name="bar-chart-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptySub}>
            Start recording transactions to see your statistics
          </Text>
        </View>

      /* Main content */
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* ── P&L REPORT ────────────────────────────────────────────────── */}
          {tab === 'pnl' ? (
            <>
              <View style={styles.heroCard}>
                <Text style={styles.heroLabel}>Net Profit</Text>
                <Text style={[styles.heroAmount, { color: stats.netProfit >= 0 ? '#fff' : '#FCA5A5' }]}>
                  {stats.netProfit < 0 ? '- ' : ''}{cur}{' '}{fmt(Math.abs(stats.netProfit))}
                </Text>
                <Text style={styles.heroPeriod}>
                  {getPeriodLabel()}{' · Weighted avg cost'}
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
                    <Text style={styles.heroStatVal}>{stats.netMargin}{'%'}</Text>
                  </View>
                </View>
              </View>

              <SectionLabel title="Income" />
              <View style={styles.card}>
                <PnlRow
                  label={'Sales revenue (' + String(stats.invoiceCount) + (stats.invoiceCount !== 1 ? ' invoices)' : ' invoice)')}
                  value={cur + ' ' + fmt(stats.totalSales)}
                  valueColor="#10B981"
                />
                {stats.otherIncome > 0 ? (
                  <PnlRow
                    label="Other income"
                    value={cur + ' ' + fmt(stats.otherIncome)}
                    valueColor="#10B981"
                  />
                ) : null}
                <PnlRow
                  label="Total Revenue"
                  value={cur + ' ' + fmt(stats.totalSales + stats.otherIncome)}
                  valueColor="#10B981"
                  bold highlight="gray"
                />
              </View>

              <SectionLabel title="Cost of Goods Sold" />
              <View style={styles.card}>
                <Text style={styles.cogsNote}>
                  Each item valued at its weighted average cost at time of sale
                </Text>
                {stats.cogsBreakdown.length === 0 ? (
                  <PnlRow
                    label="No inventory items sold this period"
                    value={cur + ' 0'}
                    valueColor={colors.textTertiary}
                    indent
                  />
                ) : (
                  stats.cogsBreakdown.map(item => (
                    <PnlRow
                      key={item.name}
                      label={item.name + ' (' + String(item.qtySold) + ' units × ' + cur + ' ' + fmt(item.avgCost) + ')'}
                      value={cur + ' ' + fmt(item.cogs)}
                      valueColor="#D97706"
                      indent
                    />
                  ))
                )}
                <PnlRow
                  label="Total COGS"
                  value={cur + ' ' + fmt(stats.totalCOGS)}
                  valueColor="#EF4444"
                  bold highlight="gray"
                />
                <PnlRow
                  label="Gross Profit"
                  value={cur + ' ' + fmt(stats.grossProfit)}
                  valueColor={stats.grossProfit >= 0 ? '#16A34A' : '#EF4444'}
                  bold
                  highlight={stats.grossProfit >= 0 ? 'green' : 'red'}
                />
              </View>

              <SectionLabel title="Operating Expenses" />
              <View style={styles.card}>
                {stats.expenseBreakdown.length === 0 ? (
                  <PnlRow
                    label="No expenses this period"
                    value={cur + ' 0'}
                    valueColor={colors.textTertiary}
                    indent
                  />
                ) : (
                  stats.expenseBreakdown.map(item => (
                    <PnlRow
                      key={item.name}
                      label={item.name}
                      value={cur + ' ' + fmt(item.amount)}
                      valueColor="#EF4444"
                      indent
                    />
                  ))
                )}
                <PnlRow
                  label="Total Expenses"
                  value={cur + ' ' + fmt(stats.totalExpenses)}
                  valueColor="#EF4444"
                  bold highlight="gray"
                />
                <PnlRow
                  label="Net Profit"
                  value={(stats.netProfit < 0 ? '- ' : '') + cur + ' ' + fmt(Math.abs(stats.netProfit))}
                  valueColor={stats.netProfit >= 0 ? '#16A34A' : '#EF4444'}
                  bold
                  highlight={stats.netProfit >= 0 ? 'green' : 'red'}
                />
              </View>

              {stats.expenseBreakdown.length > 0 ? (
                <>
                  <SectionLabel title="Expense Breakdown" />
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Where your money went</Text>
                    {stats.expenseBreakdown.map((item, idx) => {
                      const barWidth = maxExpense > 0 ? (item.amount / maxExpense) * 100 : 0;
                      const pct = stats.totalExpenses > 0
                        ? ((item.amount / stats.totalExpenses) * 100).toFixed(0) : '0';
                      return (
                        <View key={item.name} style={styles.barRow}>
                          <View style={styles.barLabelWrap}>
                            <Text style={styles.barName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.barPct}>{pct + '%'}</Text>
                          </View>
                          <View style={styles.barTrack}>
                            <View style={[styles.barFill, {
                              width: barWidth + '%',
                              backgroundColor: EXPENSE_COLORS[idx % EXPENSE_COLORS.length],
                            }]} />
                          </View>
                          <Text style={styles.barAmt}>{cur + ' ' + fmt(item.amount)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </>
          ) : null}

          {/* ── BALANCE SHEET ─────────────────────────────────────────────── */}
          {tab === 'balance' ? (
            <>
              <Text style={styles.bsNote}>Current business position as of today</Text>

              <SectionLabel title="Assets — What you own" />
              <View style={styles.card}>
                <BsRow
                  label="Cash on Hand" sub="Physical cash"
                  value={cur + ' ' + fmt(stats.cashOnHand)} valueColor="#10B981"
                />
                <BsRow
                  label="Bank Accounts" sub="Money in bank"
                  value={cur + ' ' + fmt(stats.bankBalance)} valueColor="#3B82F6"
                />
                <BsRow
                  label="Accounts Receivable"
                  sub="Customers owe you (incl. opening balances)"
                  value={cur + ' ' + fmt(stats.totalReceivables)}
                  valueColor={stats.totalReceivables > 0 ? '#D97706' : '#10B981'}
                />
                <BsRow
                  label="Inventory" sub="Closing stock at weighted avg cost"
                  value={cur + ' ' + fmt(stats.inventoryValue)} valueColor="#8B5CF6"
                />
                <BsRow
                  label="Total Assets"
                  value={cur + ' ' + fmt(stats.totalAssets)}
                  valueColor="#10B981" bold borderBottom={false}
                />
              </View>

              <SectionLabel title="Liabilities — What you owe" />
              <View style={styles.card}>
                <BsRow
                  label="Accounts Payable"
                  sub="You owe suppliers (incl. opening balances)"
                  value={cur + ' ' + fmt(stats.totalPayables)}
                  valueColor={stats.totalPayables > 0 ? '#EF4444' : '#10B981'}
                />
                <BsRow
                  label="Total Liabilities"
                  value={cur + ' ' + fmt(stats.totalPayables)}
                  valueColor="#EF4444" bold borderBottom={false}
                />
              </View>

              <SectionLabel title="Capital — Owner's Equity" />
              <View style={styles.card}>
                {stats.totalOpeningEquity > 0 ? (
                  <BsRow
                    label="Opening Equity"
                    sub="Opening stock + opening receivables − opening payables"
                    value={cur + ' ' + fmt(stats.totalOpeningEquity)}
                    valueColor="#6B7280"
                  />
                ) : null}
                <BsRow
                  label="Net Capital" sub="Total Assets minus Total Liabilities"
                  value={cur + ' ' + fmt(stats.capital)}
                  valueColor={stats.capital >= 0 ? '#10B981' : '#EF4444'}
                  bold borderBottom={false}
                />
              </View>

              {/* Balance check */}
              <View style={[
                styles.checkCard,
                { backgroundColor: Math.abs(stats.totalAssets - (stats.totalPayables + stats.capital)) < 1 ? '#F0FDF4' : '#FEF2F2' },
              ]}>
                <Ionicons
                  name={Math.abs(stats.totalAssets - (stats.totalPayables + stats.capital)) < 1 ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={Math.abs(stats.totalAssets - (stats.totalPayables + stats.capital)) < 1 ? '#16A34A' : '#EF4444'}
                />
                <Text style={[
                  styles.checkText,
                  { color: Math.abs(stats.totalAssets - (stats.totalPayables + stats.capital)) < 1 ? '#16A34A' : '#EF4444' },
                ]}>
                  {Math.abs(stats.totalAssets - (stats.totalPayables + stats.capital)) < 1
                    ? 'Assets = Liabilities + Capital ✓'
                    : 'Balance sheet difference: ' + fmt(Math.abs(stats.totalAssets - stats.totalPayables - stats.capital))}
                </Text>
              </View>

              {/* Inventory breakdown */}
              {stats.inventoryBreakdown.length > 0 ? (
                <>
                  <SectionLabel title="Inventory Breakdown" />
                  <View style={[styles.card, { marginBottom: 8 }]}>
                    <Text style={styles.cardTitle}>Closing stock at weighted avg cost</Text>
                    {stats.inventoryBreakdown.map((item, idx, arr) => (
                      <BsRow
                        key={item.name}
                        label={item.name}
                        sub={String(item.stock) + ' ' + item.unit + ' × ' + cur + ' ' + fmt(item.avgCost)}
                        value={cur + ' ' + fmt(item.value)}
                        valueColor="#8B5CF6"
                        borderBottom={idx < arr.length - 1}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : null}

          {/* ── CASH FLOW ─────────────────────────────────────────────────── */}
          {tab === 'cashflow' ? (
            <>
              <View style={[styles.heroCard, { backgroundColor: stats.netCashFlow >= 0 ? '#10B981' : '#EF4444' }]}>
                <Text style={styles.heroLabel}>Net Cash Flow</Text>
                <Text style={styles.heroAmount}>
                  {stats.netCashFlow < 0 ? '- ' : ''}{cur}{' '}{fmt(Math.abs(stats.netCashFlow))}
                </Text>
                <Text style={styles.heroPeriod}>{getPeriodLabel()}</Text>
                <View style={styles.heroRow}>
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>Cash In</Text>
                    <Text style={styles.heroStatVal}>{fmt(stats.totalCashIn)}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>Cash Out</Text>
                    <Text style={styles.heroStatVal}>{fmt(stats.totalCashOut)}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatLabel}>Balance</Text>
                    <Text style={styles.heroStatVal}>{fmt(stats.totalCashBalance)}</Text>
                  </View>
                </View>
              </View>

              <SectionLabel title="Cash In" />
              <View style={styles.card}>
                {Object.keys(stats.receiptsBySource).length === 0 ? (
                  <PnlRow label="No receipts this period" value={cur + ' 0'} valueColor={colors.textTertiary} indent />
                ) : (
                  Object.entries(stats.receiptsBySource).map(([name, amount]) => {
                    const barWidth = maxCashIn > 0 ? (amount / maxCashIn) * 100 : 0;
                    return (
                      <View key={name} style={styles.barRow}>
                        <View style={styles.barLabelWrap}>
                          <Text style={styles.barName} numberOfLines={1}>{name}</Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { width: barWidth + '%', backgroundColor: '#10B981' }]} />
                        </View>
                        <Text style={styles.barAmt}>{cur + ' ' + fmt(amount)}</Text>
                      </View>
                    );
                  })
                )}
                <PnlRow
                  label="Total Cash In"
                  value={cur + ' ' + fmt(stats.totalCashIn)}
                  valueColor="#10B981" bold highlight="gray"
                />
              </View>

              <SectionLabel title="Cash Out" />
              <View style={styles.card}>
                {(stats.cashOutBreakdown || []).length === 0 ? (
                  <PnlRow label="No cash payments this period" value={cur + ' 0'} valueColor={colors.textTertiary} indent />
                ) : (
                  (stats.cashOutBreakdown || []).map((item, idx) => {
                    const barWidth = maxCashOut > 0 ? (item.amount / maxCashOut) * 100 : 0;
                    return (
                      <View key={item.name} style={styles.barRow}>
                        <View style={styles.barLabelWrap}>
                          <Text style={styles.barName} numberOfLines={1}>{item.name}</Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, {
                            width: barWidth + '%',
                            backgroundColor: EXPENSE_COLORS[idx % EXPENSE_COLORS.length],
                          }]} />
                        </View>
                        <Text style={styles.barAmt}>{cur + ' ' + fmt(item.amount)}</Text>
                      </View>
                    );
                  })
                )}
                <PnlRow
                  label="Total Cash Out"
                  value={cur + ' ' + fmt(stats.totalCashOut)}
                  valueColor="#EF4444" bold highlight="gray"
                />
              </View>

              <SectionLabel title="Account Balances" />
              <View style={[styles.card, { marginBottom: 32 }]}>
                {(biz?.bankAccounts || []).length === 0 ? (
                  <View style={{ padding: 16 }}>
                    <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center' }}>
                      No accounts set up
                    </Text>
                  </View>
                ) : (
                  (biz?.bankAccounts || []).map((acc, idx, arr) => (
                    <BsRow
                      key={acc.id}
                      label={acc.name}
                      sub={acc.type === 'cash' ? 'Cash' : 'Bank'}
                      value={cur + ' ' + fmt(acc.balance || 0)}
                      valueColor={(acc.balance || 0) >= 0 ? '#10B981' : '#EF4444'}
                      borderBottom={idx < arr.length - 1}
                    />
                  ))
                )}
              </View>
            </>
          ) : null}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
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
  content: { padding: 14, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 6, marginTop: 14, marginLeft: 2,
  },
  heroCard: {
    backgroundColor: colors.primary, borderRadius: 18,
    padding: 18, marginBottom: 8,
  },
  heroLabel:  { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 3 },
  heroAmount: { fontSize: 28, fontWeight: '700', color: '#fff' },
  heroPeriod: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, marginBottom: 12 },
  heroRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 10, padding: 10,
  },
  heroStat:        { flex: 1, alignItems: 'center' },
  heroStatDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroStatLabel:   { fontSize: 9, color: 'rgba(255,255,255,0.65)', marginBottom: 2 },
  heroStatVal:     { fontSize: 12, fontWeight: '700', color: '#fff' },
  card: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    elevation: 1, overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 13, fontWeight: '700', color: colors.textPrimary,
    padding: 12, paddingBottom: 8,
  },
  cogsNote: {
    fontSize: 11, color: colors.textTertiary, fontStyle: 'italic',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
  },
  pnlRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  pnlRowGreen: { backgroundColor: '#F0FDF4' },
  pnlRowRed:   { backgroundColor: '#FEF2F2' },
  pnlRowGray:  { backgroundColor: '#F9FAFB' },
  pnlLabel:       { fontSize: 13, color: colors.textSecondary, flex: 1, paddingRight: 8 },
  pnlLabelIndent: { paddingLeft: 12, fontSize: 12, color: colors.textTertiary },
  pnlLabelBold:   { fontWeight: '700', color: colors.textPrimary, fontSize: 13 },
  pnlValue:     { fontSize: 13, fontWeight: '600' },
  pnlValueBold: { fontSize: 14, fontWeight: '700' },
  bsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  bsLabel:     { fontSize: 14, color: colors.textPrimary },
  bsSub:       { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  bsValue:     { fontSize: 14, fontWeight: '600' },
  bsValueBold: { fontSize: 15, fontWeight: '700' },
  bsNote: {
    fontSize: 12, color: colors.textTertiary, fontStyle: 'italic',
    textAlign: 'center', paddingVertical: 8,
  },
  checkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  checkText: { fontSize: 13, fontWeight: '600', flex: 1 },
  barRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingHorizontal: 14, marginBottom: 10,
  },
  barLabelWrap: { width: 85, flexShrink: 0 },
  barName: { fontSize: 12, color: colors.textPrimary, fontWeight: '500' },
  barPct:  { fontSize: 10, color: colors.textTertiary },
  barTrack: {
    flex: 1, height: 7, backgroundColor: '#F3F4F6',
    borderRadius: 4, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
  barAmt:  { fontSize: 11, color: colors.textSecondary, width: 68, textAlign: 'right' },
  emptyBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  emptySub:   { fontSize: 13, color: colors.textTertiary, textAlign: 'center', lineHeight: 20 },
});