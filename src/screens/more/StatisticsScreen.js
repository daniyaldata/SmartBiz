import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PERIODS = [
  { id: 'today',  label: 'Today' },
  { id: 'week',   label: 'This week' },
  { id: 'month',  label: 'This month' },
  { id: 'year',   label: 'This year' },
];

// ─── Date range helpers ───────────────────────────────────────────────────────

const getDateRange = (period) => {
  const now = new Date();
  const start = new Date();
  const end   = new Date();
  end.setHours(23, 59, 59, 999);

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      const day = now.getDay();
      start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      start.setHours(0, 0, 0, 0);
      break;
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

// ─── Stats calculator ─────────────────────────────────────────────────────────

const calcStats = (biz, period) => {
  if (!biz) return null;
  const { start, end } = getDateRange(period);
  const cur = biz.meta?.currency || 'PKR';

  // ── Revenue: sales invoices in period
  const salesInvoices = (biz.salesInvoices || [])
    .filter(i => inRange(i.date, start, end));
  const totalSales = salesInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const invoiceCount = salesInvoices.length;

  // ── COGS: payments to expense account "Cost of Goods Sold" (exp-1 code 5000)
  //    + journal entries debiting COGS
  const cogsFromPayments = (biz.transactions || [])
    .filter(t =>
      t.transactionType === 'payment' &&
      inRange(t.date, start, end) &&
      (t.expenseAccountId === 'exp-1' ||
        t.expenseAccountName?.toLowerCase().includes('cost of goods'))
    )
    .reduce((s, t) => s + (t.amount || 0), 0);

  const cogsFromJournals = (biz.journalEntries || [])
    .filter(je => inRange(je.date, start, end))
    .flatMap(je => je.lines || [])
    .filter(line =>
      line.accountCategory === 'expense' &&
      (line.accountId === 'exp-1' ||
        line.accountName?.toLowerCase().includes('cost of goods'))
    )
    .reduce((s, line) => s + (line.debit || 0), 0);

  const totalCOGS = cogsFromPayments + cogsFromJournals;
  const grossProfit = totalSales - totalCOGS;

  // ── Expenses by category: payments + journal entries
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
    .filter(line => line.accountCategory === 'expense' && line.debit > 0)
    .forEach(line => {
      const key = line.accountName || 'Other';
      expenseMap[key] = (expenseMap[key] || 0) + (line.debit || 0);
    });

  const totalExpenses = Object.values(expenseMap).reduce((s, v) => s + v, 0);
  const netProfit = grossProfit - totalExpenses;
  const netMargin = totalSales > 0
    ? ((netProfit / totalSales) * 100).toFixed(1)
    : '0.0';

  // ── Income (other income sources)
  const otherIncome = (biz.transactions || [])
    .filter(t =>
      t.transactionType === 'receipt' &&
      inRange(t.date, start, end) &&
      t.incomeAccountId &&
      !t.partyId
    )
    .reduce((s, t) => s + (t.amount || 0), 0);

  // ── Cash position (current, not period-specific)
  const totalCash = (biz.bankAccounts || [])
    .filter(a => a.type === 'cash')
    .reduce((s, a) => s + (a.balance || 0), 0);

  const totalBank = (biz.bankAccounts || [])
    .filter(a => a.type !== 'cash')
    .reduce((s, a) => s + (a.balance || 0), 0);

  // ── Receivables and payables (current)
  const totalReceivables = (biz.salesInvoices || [])
    .reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.amountPaid || 0)), 0);

  const totalPayables = (biz.purchaseInvoices || [])
    .reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.amountPaid || 0)), 0);

  // ── Expense breakdown sorted
  const expenseBreakdown = Object.entries(expenseMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // ── Receipts in period
  const totalReceipts = (biz.transactions || [])
    .filter(t =>
      t.transactionType === 'receipt' && inRange(t.date, start, end)
    )
    .reduce((s, t) => s + (t.amount || 0), 0);

  // ── Payments out in period
  const totalPaymentsOut = (biz.transactions || [])
    .filter(t =>
      t.transactionType === 'payment' && inRange(t.date, start, end)
    )
    .reduce((s, t) => s + (t.amount || 0), 0);

  return {
    cur,
    totalSales, invoiceCount,
    totalCOGS, grossProfit,
    grossMargin: totalSales > 0
      ? ((grossProfit / totalSales) * 100).toFixed(1) : '0.0',
    totalExpenses,
    otherIncome,
    netProfit, netMargin,
    totalCash, totalBank,
    totalReceivables, totalPayables,
    expenseBreakdown,
    totalReceipts, totalPaymentsOut,
    totalBalance: totalCash + totalBank,
  };
};

// ─── Formatting ───────────────────────────────────────────────────────────────

const fmt = (n) => {
  if (!n && n !== 0) return '0';
  return Math.round(n).toLocaleString();
};

// ─── Components ───────────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, iconName, iconBg, valueColor }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
      <Ionicons name={iconName} size={20} color={valueColor} />
    </View>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, { color: valueColor || colors.textPrimary }]}>
      {value}
    </Text>
    {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
  </View>
);

const SectionLabel = ({ title }) => (
  <Text style={styles.sectionLabel}>{title}</Text>
);

const Card = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

const BalanceRow = ({ label, value, valueColor, borderBottom = true }) => (
  <View style={[styles.balanceRow, !borderBottom && { borderBottomWidth: 0 }]}>
    <Text style={styles.balanceLabel}>{label}</Text>
    <Text style={[styles.balanceValue, { color: valueColor || colors.textPrimary }]}>
      {value}
    </Text>
  </View>
);

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function StatisticsScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz]       = useState(null);
  const [period, setPeriod] = useState('month');

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const stats = calcStats(biz, period);
  const cur = stats?.cur || 'PKR';

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

  const EXPENSE_COLORS = [
    '#EF4444', '#F97316', '#EAB308',
    '#8B5CF6', '#3B82F6', '#10B981', '#6B7280',
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistics</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Period selector */}
      <View style={styles.periodBar}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[
              styles.periodBtn,
              period === p.id && styles.periodBtnActive,
            ]}
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

          {/* ── Hero profit card ── */}
          <SectionLabel title="Profit summary" />
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Net Profit</Text>
            <Text style={[
              styles.heroAmount,
              { color: stats.netProfit >= 0 ? '#fff' : '#FCA5A5' },
            ]}>
              {cur} {fmt(Math.abs(stats.netProfit))}
              {stats.netProfit < 0 ? ' (Loss)' : ''}
            </Text>
            <Text style={styles.heroPeriod}>{getPeriodLabel()}</Text>
            <View style={styles.heroRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Revenue</Text>
                <Text style={styles.heroStatVal}>{fmt(stats.totalSales)}</Text>
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

          {/* ── 4 stat cards ── */}
          <View style={styles.grid2}>
            <StatCard
              label="Total Sales"
              value={`${cur} ${fmt(stats.totalSales)}`}
              sub={`${stats.invoiceCount} invoice${stats.invoiceCount !== 1 ? 's' : ''}`}
              iconName="trending-up-outline"
              iconBg="#ECFDF5"
              valueColor="#10B981"
            />
            <StatCard
              label="Cost of Goods"
              value={`${cur} ${fmt(stats.totalCOGS)}`}
              sub="COGS"
              iconName="cube-outline"
              iconBg="#FEF3C7"
              valueColor="#D97706"
            />
            <StatCard
              label="Gross Profit"
              value={`${cur} ${fmt(stats.grossProfit)}`}
              sub={`${stats.grossMargin}% margin`}
              iconName="bar-chart-outline"
              iconBg="#EFF6FF"
              valueColor={stats.grossProfit >= 0 ? colors.primary : '#EF4444'}
            />
            <StatCard
              label="Total Expenses"
              value={`${cur} ${fmt(stats.totalExpenses)}`}
              sub={`${stats.expenseBreakdown.length} categories`}
              iconName="receipt-outline"
              iconBg="#FEF2F2"
              valueColor="#EF4444"
            />
          </View>

          {/* ── Cash flow card ── */}
          <View style={styles.grid2}>
            <StatCard
              label="Money In"
              value={`${cur} ${fmt(stats.totalReceipts)}`}
              sub="Receipts"
              iconName="arrow-down-circle-outline"
              iconBg="#ECFDF5"
              valueColor="#10B981"
            />
            <StatCard
              label="Money Out"
              value={`${cur} ${fmt(stats.totalPaymentsOut)}`}
              sub="Payments"
              iconName="arrow-up-circle-outline"
              iconBg="#FEF2F2"
              valueColor="#EF4444"
            />
          </View>

          {/* ── Expense breakdown ── */}
          {stats.expenseBreakdown.length > 0 && (
            <>
              <SectionLabel title="Expense breakdown" />
              <Card>
                <Text style={styles.cardTitle}>Where your money went</Text>
                {stats.expenseBreakdown.map((item, idx) => {
                  const barWidth = maxExpense > 0
                    ? (item.amount / maxExpense) * 100
                    : 0;
                  const barColor = EXPENSE_COLORS[idx % EXPENSE_COLORS.length];
                  const pct = stats.totalExpenses > 0
                    ? ((item.amount / stats.totalExpenses) * 100).toFixed(0)
                    : 0;
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
                          { width: `${barWidth}%`, backgroundColor: barColor },
                        ]} />
                      </View>
                      <Text style={styles.barAmt}>
                        {cur} {fmt(item.amount)}
                      </Text>
                    </View>
                  );
                })}

                {/* Legend dots */}
                <View style={styles.legendRow}>
                  {stats.expenseBreakdown.slice(0, 5).map((item, idx) => (
                    <View key={item.name} style={styles.legendItem}>
                      <View style={[
                        styles.legendDot,
                        { backgroundColor: EXPENSE_COLORS[idx % EXPENSE_COLORS.length] },
                      ]} />
                      <Text style={styles.legendText} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </>
          )}

          {/* ── Money position ── */}
          <SectionLabel title="Money position" />
          <Card>
            <Text style={styles.cardTitle}>Cash & bank balances</Text>
            <BalanceRow
              label="Cash on Hand"
              value={`${cur} ${fmt(stats.totalCash)}`}
              valueColor="#10B981"
            />
            <BalanceRow
              label="Bank accounts"
              value={`${cur} ${fmt(stats.totalBank)}`}
              valueColor="#3B82F6"
            />
            <BalanceRow
              label="Total liquid"
              value={`${cur} ${fmt(stats.totalBalance)}`}
              valueColor={stats.totalBalance >= 0 ? '#10B981' : '#EF4444'}
            />
          </Card>

          {/* ── Receivables & Payables ── */}
          <SectionLabel title="Outstanding balances" />
          <Card style={{ marginBottom: 32 }}>
            <Text style={styles.cardTitle}>What's owed</Text>
            <BalanceRow
              label="Customers owe you"
              value={`${cur} ${fmt(stats.totalReceivables)}`}
              valueColor={stats.totalReceivables > 0 ? '#EF4444' : '#10B981'}
            />
            <BalanceRow
              label="You owe suppliers"
              value={`${cur} ${fmt(stats.totalPayables)}`}
              valueColor={stats.totalPayables > 0 ? '#EF4444' : '#10B981'}
            />
            <BalanceRow
              label="Net position"
              value={`${cur} ${fmt(stats.totalReceivables - stats.totalPayables)}`}
              valueColor={
                stats.totalReceivables >= stats.totalPayables
                  ? '#10B981'
                  : '#EF4444'
              }
              borderBottom={false}
            />
          </Card>

        </ScrollView>
      )}
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  // Period bar
  periodBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  periodBtnActive: { backgroundColor: colors.primary },
  periodBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  periodBtnTextActive: { color: '#fff' },

  // Content
  content: { padding: 14, paddingBottom: 48 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 2,
  },

  // Hero card
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    padding: 20,
    marginBottom: 10,
  },
  heroLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
  },
  heroPeriod: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    marginBottom: 14,
  },
  heroRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 3,
  },
  heroStatVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },

  // 2-column grid
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 2,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 3,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  statSub: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },

  // Expense bar chart
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  barLabelWrap: {
    width: 90,
    flexShrink: 0,
  },
  barName: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  barPct: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 1,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barAmt: {
    fontSize: 11,
    color: colors.textSecondary,
    width: 68,
    textAlign: 'right',
    flexShrink: 0,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
    maxWidth: 80,
  },

  // Balance rows
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  balanceLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Empty state
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});