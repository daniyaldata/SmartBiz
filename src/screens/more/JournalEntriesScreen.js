import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  loadBusiness, generateId,
  saveJournalEntry, deleteJournalEntry,
  getInvoiceStatus,
} from '../../data/BusinessStore';
import ModalSheet from '../../components/ModalSheet';
import DateField from '../../components/DateField';
import { colors } from '../../theme/colors';

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: 'bank', label: 'Bank & Cash', initial: 'B',
    badgeColor: '#185FA5', badgeBg: '#E6F1FB',
    sub: (biz) => {
      const total = (biz.bankAccounts || [])
        .reduce((s, a) => s + (a.balance || 0), 0);
      return `${(biz.bankAccounts || []).length} accounts · ${biz.meta?.currency} ${total.toLocaleString()}`;
    },
  },
  {
    id: 'income', label: 'Income Accounts', initial: 'I',
    badgeColor: '#0F6E56', badgeBg: '#E1F5EE',
    sub: (biz) => `${(biz.incomeAccounts || []).length} accounts`,
  },
  {
    id: 'expense', label: 'Expense Accounts', initial: 'E',
    badgeColor: '#993C1D', badgeBg: '#FAECE7',
    sub: (biz) => `${(biz.expenseAccounts || []).length} accounts`,
  },
  {
    id: 'customer', label: 'Accounts Receivable', initial: 'A/R',
    badgeColor: '#854F0B', badgeBg: '#FAEEDA',
    sub: (biz) => `${(biz.customers || []).length} customers`,
  },
  {
    id: 'supplier', label: 'Accounts Payable', initial: 'A/P',
    badgeColor: '#534AB7', badgeBg: '#EEEDFE',
    sub: (biz) => `${(biz.suppliers || []).length} suppliers`,
  },
  {
    id: 'inventory', label: 'Inventory', initial: 'INV',
    badgeColor: '#5F5E5A', badgeBg: '#F1EFE8',
    sub: (biz) => `${(biz.items || []).length} items`,
  },
];

const buildAllAccounts = (biz) => {
  const list = [];
  (biz.bankAccounts || []).forEach(a => list.push({
    id: a.id, name: a.name, category: 'bank',
    badgeColor: '#185FA5', badgeBg: '#E6F1FB', badgeLabel: 'Bank',
    sub: `${biz.meta?.currency} ${(a.balance || 0).toLocaleString()}`,
  }));
  (biz.incomeAccounts || []).forEach(a => list.push({
    id: a.id, name: a.name, category: 'income',
    badgeColor: '#0F6E56', badgeBg: '#E1F5EE', badgeLabel: 'Income',
    sub: `${a.code} · ${a.group}`,
  }));
  (biz.expenseAccounts || []).forEach(a => list.push({
    id: a.id, name: a.name, category: 'expense',
    badgeColor: '#993C1D', badgeBg: '#FAECE7', badgeLabel: 'Expense',
    sub: `${a.code} · ${a.group}`,
  }));
  (biz.customers || []).forEach(a => list.push({
    id: a.id, name: a.displayName, category: 'customer',
    badgeColor: '#854F0B', badgeBg: '#FAEEDA', badgeLabel: 'Customer',
  }));
  (biz.suppliers || []).forEach(a => list.push({
    id: a.id, name: a.displayName, category: 'supplier',
    badgeColor: '#534AB7', badgeBg: '#EEEDFE', badgeLabel: 'Supplier',
  }));
  (biz.items || []).forEach(a => list.push({
    id: a.id, name: a.name, category: 'inventory',
    badgeColor: '#5F5E5A', badgeBg: '#F1EFE8', badgeLabel: 'Inventory',
    sub: `Stock: ${a.stock || 0}`,
  }));
  return list;
};

const emptyLine = () => ({
  lineId: generateId(),
  accountId: null,
  accountName: null,
  accountCategory: null,
  accountBadgeColor: null,
  accountBadgeBg: null,
  accountBadgeLabel: null,
  linkedCustomerId: null,
  linkedSupplierId: null,
  linkedInvoiceId: null,
  linkedInvoiceNumber: null,
  debit: '',
  credit: '',
});

const STAGE_CATEGORY  = 'category';
const STAGE_ACCOUNTS  = 'accounts';
const STAGE_CUSTOMERS = 'customers';
const STAGE_SUPPLIERS = 'suppliers';
const STAGE_INVOICES  = 'invoices';

export default function JournalEntriesScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz]       = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [description, setDescription] = useState('');
  const [date, setDate]             = useState(new Date().toISOString().split('T')[0]);
  const [lines, setLines]           = useState([emptyLine(), emptyLine()]);

  // Picker state — completely separate from form
  const [showPicker, setShowPicker]         = useState(false);
  const [pickerLineId, setPickerLineId]     = useState(null);
  const [pickerStage, setPickerStage]       = useState(STAGE_CATEGORY);
  const [pickerCategory, setPickerCategory] = useState(null);
  const [pickerCustomer, setPickerCustomer] = useState(null);
  const [pickerSupplier, setPickerSupplier] = useState(null);
  const [searchQuery, setSearchQuery]       = useState('');

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const entries = (biz?.journalEntries || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const cur = biz?.meta?.currency || 'PKR';

  // ── Form ────────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setLines([emptyLine(), emptyLine()]);
    setShowForm(true);
  };

  const openEdit = (entry) => {
    setEditingId(entry.id);
    setDescription(entry.description || '');
    setDate(entry.date || '');
    setLines(
      entry.lines?.length >= 2
        ? entry.lines.map(l => ({ ...l, lineId: l.lineId || generateId() }))
        : [emptyLine(), emptyLine()]
    );
    setShowForm(true);
  };

  const openClone = (entry) => {
    setEditingId(null);
    setDescription(entry.description ? `Copy of ${entry.description}` : '');
    setDate(new Date().toISOString().split('T')[0]);
    setLines(entry.lines?.map(l => ({ ...l, lineId: generateId() })) || [emptyLine(), emptyLine()]);
    setShowForm(true);
  };

  const updateLine = (id, field, value) =>
    setLines(prev => prev.map(l => l.lineId === id ? { ...l, [field]: value } : l));

  const removeLine = (id) => {
    if (lines.length <= 2) {
      Alert.alert('Minimum 2 lines', 'A journal entry needs at least 2 lines.');
      return;
    }
    setLines(prev => prev.filter(l => l.lineId !== id));
  };

  const addLine = () => setLines(prev => [...prev, emptyLine()]);

  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('Required', 'Please enter a description.');
      return;
    }
    const incomplete = lines.some(l =>
      !l.accountId || (parseFloat(l.debit) <= 0 && parseFloat(l.credit) <= 0)
    );
    if (incomplete) {
      Alert.alert('Incomplete lines', 'Each line needs an account and a debit or credit amount.');
      return;
    }
    if (!isBalanced) {
      Alert.alert(
        'Unbalanced entry',
        `Debits (${cur} ${totalDebit.toLocaleString()}) ≠ Credits (${cur} ${totalCredit.toLocaleString()})`
      );
      return;
    }
    setSaving(true);
    try {
      const entry = {
        id: editingId || generateId(),
        description: description.trim(),
        date,
        lines: lines.map(l => ({
          lineId: l.lineId,
          accountId: l.accountId,
          accountName: l.accountName,
          accountCategory: l.accountCategory,
          accountBadgeColor: l.accountBadgeColor,
          accountBadgeBg: l.accountBadgeBg,
          accountBadgeLabel: l.accountBadgeLabel,
          linkedCustomerId: l.linkedCustomerId || null,
          linkedSupplierId: l.linkedSupplierId || null,
          linkedInvoiceId: l.linkedInvoiceId || null,
          linkedInvoiceNumber: l.linkedInvoiceNumber || null,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        })),
        totalAmount: totalDebit,
        createdAt: new Date().toISOString(),
      };
      const updated = await saveJournalEntry(biz, entry);
      setBiz(updated);
      setShowForm(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (entryId) => {
    Alert.alert('Delete Entry', 'This will reverse all balance effects.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const updated = await deleteJournalEntry(biz, entryId);
          setBiz(updated);
        },
      },
    ]);
  };

  // ── Picker — sequential modal pattern ────────────────────────────────────────
  // Close form → open picker → on select → close picker → reopen form

  const openAccountPicker = (lineId) => {
    setPickerLineId(lineId);
    setPickerStage(STAGE_CATEGORY);
    setPickerCategory(null);
    setPickerCustomer(null);
    setPickerSupplier(null);
    setSearchQuery('');
    // Close form first, then open picker after animation completes
    setShowForm(false);
    setTimeout(() => setShowPicker(true), 400);
  };

  const closePicker = (reopenForm = true) => {
    setShowPicker(false);
    if (reopenForm) {
      setTimeout(() => setShowForm(true), 400);
    }
  };

  const selectCategory = (cat) => {
    setPickerCategory(cat);
    setSearchQuery('');
    if (cat.id === 'customer') setPickerStage(STAGE_CUSTOMERS);
    else if (cat.id === 'supplier') setPickerStage(STAGE_SUPPLIERS);
    else setPickerStage(STAGE_ACCOUNTS);
  };

  const selectCustomer = (customer) => {
    setPickerCustomer(customer);
    setPickerStage(STAGE_INVOICES);
    setSearchQuery('');
  };

  const selectSupplier = (supplier) => {
    setPickerSupplier(supplier);
    setPickerStage(STAGE_INVOICES);
    setSearchQuery('');
  };

  const applyAccountToLine = (account, invoiceId = null, invoiceNumber = null) => {
    setLines(prev => prev.map(l => {
      if (l.lineId !== pickerLineId) return l;
      return {
        ...l,
        accountId: account.id,
        accountName: account.name,
        accountCategory: account.category,
        accountBadgeColor: account.badgeColor,
        accountBadgeBg: account.badgeBg,
        accountBadgeLabel: account.badgeLabel,
        linkedCustomerId: account.category === 'customer' ? account.id : null,
        linkedSupplierId: account.category === 'supplier' ? account.id : null,
        linkedInvoiceId: invoiceId || null,
        linkedInvoiceNumber: invoiceNumber || null,
      };
    }));
    closePicker(true);
  };

  const selectFifo = () => {
    if (pickerCustomer) {
      applyAccountToLine({
        id: pickerCustomer.id, name: pickerCustomer.displayName,
        category: 'customer', badgeColor: '#854F0B',
        badgeBg: '#FAEEDA', badgeLabel: 'Customer',
      });
    } else if (pickerSupplier) {
      applyAccountToLine({
        id: pickerSupplier.id, name: pickerSupplier.displayName,
        category: 'supplier', badgeColor: '#534AB7',
        badgeBg: '#EEEDFE', badgeLabel: 'Supplier',
      });
    }
  };

  const goBack = () => {
    setSearchQuery('');
    if (pickerStage === STAGE_ACCOUNTS) setPickerStage(STAGE_CATEGORY);
    else if (pickerStage === STAGE_CUSTOMERS || pickerStage === STAGE_SUPPLIERS)
      setPickerStage(STAGE_CATEGORY);
    else if (pickerStage === STAGE_INVOICES)
      setPickerStage(pickerCustomer ? STAGE_CUSTOMERS : STAGE_SUPPLIERS);
  };

  // ── Picker data helpers ───────────────────────────────────────────────────────

  if (!biz) return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );

  const allAccounts    = buildAllAccounts(biz);
  const isSearching    = searchQuery.trim().length > 0 && pickerStage === STAGE_CATEGORY;
  const searchResults  = isSearching
    ? allAccounts.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.badgeLabel.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const getCategoryAccounts = () => {
    if (!pickerCategory) return [];
    const q = searchQuery.toLowerCase();
    let list = [];
    switch (pickerCategory.id) {
      case 'bank':
        list = (biz.bankAccounts || []).map(a => ({
          id: a.id, name: a.name, category: 'bank',
          badgeColor: '#185FA5', badgeBg: '#E6F1FB', badgeLabel: 'Bank',
          sub: `${biz.meta?.currency} ${(a.balance || 0).toLocaleString()}`,
        })); break;
      case 'income':
        list = (biz.incomeAccounts || []).map(a => ({
          id: a.id, name: a.name, category: 'income',
          badgeColor: '#0F6E56', badgeBg: '#E1F5EE', badgeLabel: 'Income',
          sub: `${a.code} · ${a.group}`,
        })); break;
      case 'expense':
        list = (biz.expenseAccounts || []).map(a => ({
          id: a.id, name: a.name, category: 'expense',
          badgeColor: '#993C1D', badgeBg: '#FAECE7', badgeLabel: 'Expense',
          sub: `${a.code} · ${a.group}`,
        })); break;
      case 'inventory':
        list = (biz.items || []).map(a => ({
          id: a.id, name: a.name, category: 'inventory',
          badgeColor: '#5F5E5A', badgeBg: '#F1EFE8', badgeLabel: 'Inventory',
          sub: `Stock: ${a.stock || 0} · Cost: ${biz.meta?.currency} ${(a.costPrice || 0).toLocaleString()}`,
        })); break;
    }
    return q ? list.filter(a => a.name.toLowerCase().includes(q)) : list;
  };

  const unpaidSalesInvoices = pickerCustomer
    ? (biz.salesInvoices || [])
        .filter(i => i.customerId === pickerCustomer.id && getInvoiceStatus(i) !== 'paid')
        .sort((a, b) => new Date(a.date) - new Date(b.date))
    : [];

  const unpaidPurchaseInvoices = pickerSupplier
    ? (biz.purchaseInvoices || [])
        .filter(i => i.supplierId === pickerSupplier.id && getInvoiceStatus(i) !== 'paid')
        .sort((a, b) => new Date(a.date) - new Date(b.date))
    : [];

  const getPickerTitle = () => {
    if (pickerStage === STAGE_CATEGORY)  return 'Select Account';
    if (pickerStage === STAGE_ACCOUNTS)  return pickerCategory?.label || 'Accounts';
    if (pickerStage === STAGE_CUSTOMERS) return 'Accounts Receivable';
    if (pickerStage === STAGE_SUPPLIERS) return 'Accounts Payable';
    if (pickerStage === STAGE_INVOICES)
      return pickerCustomer?.displayName || pickerSupplier?.displayName || 'Invoices';
    return 'Select Account';
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Journal Entries</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={26} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        keyExtractor={e => e.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="book-outline" size={52} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No journal entries yet</Text>
            <Text style={styles.emptySub}>Tap + to create a manual accounting entry</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardIcon}>
                <Text style={styles.cardIconText}>JE</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.description}
                </Text>
                <Text style={styles.cardSub}>
                  {new Date(item.date).toLocaleDateString()} ·{' '}
                  {item.lines?.length} lines ·{' '}
                  {cur} {(item.totalAmount || 0).toLocaleString()}
                </Text>
              </View>
            </View>
            <View style={styles.linesPreview}>
              {(item.lines || []).map((line, idx) => (
                <View key={idx} style={styles.previewLine}>
                  <View style={[styles.drcr, line.debit > 0 ? styles.drBadge : styles.crBadge]}>
                    <Text style={[styles.drcrText, line.debit > 0 ? styles.drText : styles.crText]}>
                      {line.debit > 0 ? 'DR' : 'CR'}
                    </Text>
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: line.accountBadgeBg || '#F1EFE8' }]}>
                    <Text style={[styles.typeBadgeText, { color: line.accountBadgeColor || '#5F5E5A' }]}>
                      {line.accountBadgeLabel || '—'}
                    </Text>
                  </View>
                  <Text style={styles.previewAcc} numberOfLines={1}>
                    {line.accountName}
                    {line.linkedInvoiceNumber ? ` · INV-${line.linkedInvoiceNumber}` : ''}
                  </Text>
                  <Text style={styles.previewAmt}>
                    {cur} {(line.debit > 0 ? line.debit : line.credit).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
                <Ionicons name="create-outline" size={15} color={colors.primary} />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openClone(item)}>
                <Ionicons name="copy-outline" size={15} color={colors.primary} />
                <Text style={styles.actionText}>Clone</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: '#FECACA' }]}
                onPress={() => handleDelete(item.id)}
              >
                <Ionicons name="trash-outline" size={15} color="#EF4444" />
                <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={openCreate}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* ── JOURNAL ENTRY FORM ─────────────────────────────────────────────── */}
      <ModalSheet
        visible={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Edit Entry' : 'New Journal Entry'}
        rightAction={handleSave}
        rightActionLabel="Post"
        rightActionLoading={saving}
        rightActionColor={isBalanced ? '#8B5CF6' : colors.textTertiary}
      >
        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Discount given to customer"
            placeholderTextColor={colors.textTertiary}
          />

          <DateField
            label="Date"
            value={date}
            onChange={setDate}
            dateFormat={biz?.settings?.dateFormat}
          />

          <Text style={styles.label}>Journal lines</Text>

          {lines.map((line, idx) => (
            <View key={line.lineId} style={styles.lineCard}>
              <View style={styles.lineHeader}>
                <Text style={styles.lineNum}>Line {idx + 1}</Text>
                <TouchableOpacity
                  onPress={() => removeLine(line.lineId)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle-outline" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              {/* Account button — opens picker sequentially */}
              <TouchableOpacity
                style={styles.accountBtn}
                onPress={() => openAccountPicker(line.lineId)}
              >
                {line.accountId ? (
                  <View style={styles.accountSelected}>
                    <View style={[styles.accountBadge, { backgroundColor: line.accountBadgeBg }]}>
                      <Text style={[styles.accountBadgeText, { color: line.accountBadgeColor }]}>
                        {line.accountBadgeLabel}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accountName} numberOfLines={1}>
                        {line.accountName}
                      </Text>
                      {line.linkedInvoiceNumber ? (
                        <Text style={styles.accountSub}>
                          Invoice INV-{line.linkedInvoiceNumber}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.accountPlaceholder}>
                    Tap to select account...
                  </Text>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>

              {/* Debit / Credit */}
              <View style={styles.drcrRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.drLabel}>Debit</Text>
                  <TextInput
                    style={[styles.amtInput, parseFloat(line.debit) > 0 && styles.amtInputDr]}
                    value={line.debit}
                    onChangeText={v => {
                      updateLine(line.lineId, 'debit', v);
                      if (v) updateLine(line.lineId, 'credit', '');
                    }}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
                <Text style={styles.orText}>or</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.crLabel}>Credit</Text>
                  <TextInput
                    style={[styles.amtInput, parseFloat(line.credit) > 0 && styles.amtInputCr]}
                    value={line.credit}
                    onChangeText={v => {
                      updateLine(line.lineId, 'credit', v);
                      if (v) updateLine(line.lineId, 'debit', '');
                    }}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addLineBtn} onPress={addLine}>
            <Ionicons name="add-circle-outline" size={20} color="#8B5CF6" />
            <Text style={styles.addLineBtnText}>Add another line</Text>
          </TouchableOpacity>

          {/* Balance box */}
          <View style={[styles.balanceBox, isBalanced ? styles.balanceOk : styles.balanceWarn]}>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLbl}>Total debits</Text>
              <Text style={styles.balanceDr}>{cur} {totalDebit.toLocaleString()}</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLbl}>Total credits</Text>
              <Text style={styles.balanceCr}>{cur} {totalCredit.toLocaleString()}</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLbl}>Status</Text>
              <Text style={[
                styles.balanceStatus,
                isBalanced ? styles.balanceStatusOk : styles.balanceStatusWarn,
              ]}>
                {isBalanced
                  ? '✓ Balanced — ready to post'
                  : `Difference: ${cur} ${Math.abs(totalDebit - totalCredit).toLocaleString()}`}
              </Text>
            </View>
          </View>
        </ScrollView>
      </ModalSheet>

      {/* ── ACCOUNT PICKER ─────────────────────────────────────────────────── */}
      <ModalSheet
        visible={showPicker}
        onClose={() => closePicker(true)}
        title={getPickerTitle()}
      >
        {/* Search — shown on category and list stages */}
        {(pickerStage === STAGE_CATEGORY ||
          pickerStage === STAGE_ACCOUNTS ||
          pickerStage === STAGE_CUSTOMERS ||
          pickerStage === STAGE_SUPPLIERS) && (
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={
                pickerStage === STAGE_CATEGORY
                  ? 'Search all accounts...'
                  : 'Search...'
              }
              placeholderTextColor={colors.textTertiary}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Back button */}
        {pickerStage !== STAGE_CATEGORY && (
          <TouchableOpacity style={styles.backBtn} onPress={goBack}>
            <Ionicons name="arrow-back" size={18} color={colors.primary} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}

        {/* ── Category list or global search ── */}
        {pickerStage === STAGE_CATEGORY && (
          <FlatList
            data={isSearching ? searchResults : CATEGORIES}
            keyExtractor={(item, idx) => item.id || String(idx)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.emptyPicker}>No accounts found.</Text>
            }
            renderItem={({ item }) => {
              if (isSearching) {
                return (
                  <TouchableOpacity
                    style={styles.accItem}
                    onPress={() => {
                      if (item.category === 'customer') {
                        const cust = biz.customers?.find(c => c.id === item.id);
                        if (cust) { setPickerCategory(CATEGORIES.find(c => c.id === 'customer')); selectCustomer(cust); }
                      } else if (item.category === 'supplier') {
                        const sup = biz.suppliers?.find(s => s.id === item.id);
                        if (sup) { setPickerCategory(CATEGORIES.find(c => c.id === 'supplier')); selectSupplier(sup); }
                      } else {
                        applyAccountToLine(item);
                      }
                    }}
                  >
                    <View style={[styles.accBadge, { backgroundColor: item.badgeBg }]}>
                      <Text style={[styles.accBadgeText, { color: item.badgeColor }]}>
                        {item.badgeLabel}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accName}>{item.name}</Text>
                      {item.sub ? <Text style={styles.accSub}>{item.sub}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity style={styles.catItem} onPress={() => selectCategory(item)}>
                  <View style={[styles.catIcon, { backgroundColor: item.badgeBg }]}>
                    <Text style={[styles.catInitial, { color: item.badgeColor }]}>
                      {item.initial}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catName}>{item.label}</Text>
                    <Text style={styles.catSub}>{item.sub(biz)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* ── Account list within category ── */}
        {pickerStage === STAGE_ACCOUNTS && (
          <FlatList
            data={getCategoryAccounts()}
            keyExtractor={a => a.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyPicker}>No accounts found.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.accItem} onPress={() => applyAccountToLine(item)}>
                <View style={[styles.accBadge, { backgroundColor: item.badgeBg }]}>
                  <Text style={[styles.accBadgeText, { color: item.badgeColor }]}>
                    {item.badgeLabel}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accName}>{item.name}</Text>
                  {item.sub ? <Text style={styles.accSub}>{item.sub}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          />
        )}

        {/* ── Customer list ── */}
        {pickerStage === STAGE_CUSTOMERS && (
          <FlatList
            data={(biz.customers || []).filter(c =>
              !searchQuery ||
              c.displayName.toLowerCase().includes(searchQuery.toLowerCase())
            )}
            keyExtractor={c => c.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyPicker}>No customers found.</Text>}
            renderItem={({ item }) => {
              const unpaid = (biz.salesInvoices || []).filter(
                i => i.customerId === item.id && getInvoiceStatus(i) !== 'paid'
              );
              const balance = unpaid.reduce((s, i) => s + (i.total - (i.amountPaid || 0)), 0);
              return (
                <TouchableOpacity style={styles.partyItem} onPress={() => selectCustomer(item)}>
                  <View style={[styles.partyAvatar, { backgroundColor: '#FAEEDA' }]}>
                    <Text style={[styles.partyAvatarText, { color: '#854F0B' }]}>
                      {(item.displayName || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partyName}>{item.displayName}</Text>
                    <Text style={styles.partySub}>
                      {unpaid.length} unpaid invoice{unpaid.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {balance > 0 && (
                    <Text style={[styles.partyBalance, { color: '#DC2626' }]}>
                      {cur} {balance.toLocaleString()}
                    </Text>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* ── Supplier list ── */}
        {pickerStage === STAGE_SUPPLIERS && (
          <FlatList
            data={(biz.suppliers || []).filter(s =>
              !searchQuery ||
              s.displayName.toLowerCase().includes(searchQuery.toLowerCase())
            )}
            keyExtractor={s => s.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyPicker}>No suppliers found.</Text>}
            renderItem={({ item }) => {
              const unpaid = (biz.purchaseInvoices || []).filter(
                i => i.supplierId === item.id && getInvoiceStatus(i) !== 'paid'
              );
              const balance = unpaid.reduce((s, i) => s + (i.total - (i.amountPaid || 0)), 0);
              return (
                <TouchableOpacity style={styles.partyItem} onPress={() => selectSupplier(item)}>
                  <View style={[styles.partyAvatar, { backgroundColor: '#EEEDFE' }]}>
                    <Text style={[styles.partyAvatarText, { color: '#534AB7' }]}>
                      {(item.displayName || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partyName}>{item.displayName}</Text>
                    <Text style={styles.partySub}>
                      {unpaid.length} unpaid bill{unpaid.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {balance > 0 && (
                    <Text style={[styles.partyBalance, { color: '#534AB7' }]}>
                      {cur} {balance.toLocaleString()}
                    </Text>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* ── Invoice picker ── */}
        {pickerStage === STAGE_INVOICES && (
          <FlatList
            data={[
              { _fifo: true },
              ...(pickerCustomer ? unpaidSalesInvoices : unpaidPurchaseInvoices),
            ]}
            keyExtractor={(item, idx) => item._fifo ? 'fifo' : item.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyPicker}>No unpaid invoices.</Text>}
            renderItem={({ item }) => {
              if (item._fifo) {
                return (
                  <TouchableOpacity style={styles.fifoItem} onPress={selectFifo}>
                    <View style={styles.fifoBadge}>
                      <Text style={styles.fifoBadgeText}>AUTO</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fifoTitle}>FIFO — apply to all invoices</Text>
                      <Text style={styles.fifoSub}>Oldest unpaid invoice gets credit first</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#185FA5" />
                  </TouchableOpacity>
                );
              }
              const balance = item.total - (item.amountPaid || 0);
              const status  = getInvoiceStatus(item);
              const prefix  = pickerCustomer ? 'INV' : 'BILL';
              const party   = pickerCustomer || pickerSupplier;
              return (
                <TouchableOpacity
                  style={styles.invoiceItem}
                  onPress={() => applyAccountToLine(
                    {
                      id: party.id,
                      name: party.displayName,
                      category: pickerCustomer ? 'customer' : 'supplier',
                      badgeColor: pickerCustomer ? '#854F0B' : '#534AB7',
                      badgeBg: pickerCustomer ? '#FAEEDA' : '#EEEDFE',
                      badgeLabel: pickerCustomer ? 'Customer' : 'Supplier',
                    },
                    item.id,
                    item.number
                  )}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.invoiceTop}>
                      <Text style={styles.invoiceNum}>{prefix}-{item.number}</Text>
                      <View style={[
                        styles.statusBadge,
                        status === 'partial' ? styles.statusPartial : styles.statusDue,
                      ]}>
                        <Text style={[
                          styles.statusText,
                          status === 'partial' ? styles.statusTextPartial : styles.statusTextDue,
                        ]}>
                          {status === 'partial' ? 'Partial' : 'Due'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.invoiceSub}>
                      {new Date(item.date).toLocaleDateString()} ·
                      Total: {cur} {item.total?.toLocaleString()}
                    </Text>
                    <Text style={styles.invoiceBalance}>
                      Balance: {cur} {balance.toLocaleString()}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </ModalSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  list: { padding: 12, gap: 10, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  cardIcon:    { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F5F3FF', justifyContent: 'center', alignItems: 'center' },
  cardIconText:{ fontSize: 13, fontWeight: '700', color: '#534AB7' },
  cardTitle:   { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  cardSub:     { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  linesPreview:{ backgroundColor: colors.background, borderRadius: 10, padding: 10, gap: 6, marginBottom: 10 },
  previewLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  drcr:        { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, flexShrink: 0 },
  drBadge:     { backgroundColor: '#FEE2E2' },
  crBadge:     { backgroundColor: '#DCFCE7' },
  drcrText:    { fontSize: 10, fontWeight: '700' },
  drText:      { color: '#DC2626' },
  crText:      { color: '#16A34A' },
  typeBadge:   { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, flexShrink: 0 },
  typeBadgeText:{ fontSize: 10, fontWeight: '700' },
  previewAcc:  { flex: 1, fontSize: 12, color: colors.textSecondary },
  previewAmt:  { fontSize: 12, fontWeight: '600', color: colors.textPrimary, flexShrink: 0 },
  cardActions: { flexDirection: 'row', gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  actionBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  actionText:  { fontSize: 12, fontWeight: '600', color: colors.primary },
  emptyBox:    { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 40 },
  emptyTitle:  { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  emptySub:    { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 28, right: 20,
    backgroundColor: '#8B5CF6', width: 58, height: 58, borderRadius: 29,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#8B5CF6', shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },

  // Form
  formContent: { padding: 16, paddingBottom: 48 },
  label: {
    fontSize: 12, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16,
  },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 11,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: colors.textPrimary,
  },
  lineCard:    { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: colors.background },
  lineHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  lineNum:     { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  accountBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 9, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10 },
  accountSelected: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  accountBadge:    { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  accountBadgeText:{ fontSize: 10, fontWeight: '700' },
  accountName:     { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  accountSub:      { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  accountPlaceholder: { flex: 1, fontSize: 14, color: colors.textTertiary },
  drcrRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  drLabel:     { fontSize: 10, fontWeight: '700', color: '#DC2626', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  crLabel:     { fontSize: 10, fontWeight: '700', color: '#16A34A', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  amtInput:    { borderWidth: 1.5, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 15, fontWeight: '600', color: colors.textPrimary, backgroundColor: '#fff' },
  amtInputDr:  { borderColor: '#FECACA', backgroundColor: '#FFF5F5', color: '#DC2626' },
  amtInputCr:  { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4', color: '#16A34A' },
  orText:      { fontSize: 11, color: colors.textTertiary, paddingBottom: 2 },
  addLineBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  addLineBtnText: { fontSize: 15, color: '#8B5CF6', fontWeight: '600' },
  balanceBox:  { borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1 },
  balanceOk:   { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  balanceWarn: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  balanceRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  balanceLbl:  { fontSize: 13, color: colors.textSecondary },
  balanceDr:   { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  balanceCr:   { fontSize: 13, fontWeight: '600', color: '#16A34A' },
  balanceDivider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  balanceStatus:  { fontSize: 13, fontWeight: '700' },
  balanceStatusOk:   { color: '#16A34A' },
  balanceStatusWarn: { color: '#EA580C' },

  // Picker
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
  searchInput: { flex: 1, fontSize: 15, color: colors.textPrimary, paddingVertical: 0 },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtnText: { fontSize: 15, color: colors.primary, fontWeight: '500' },
  catItem:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  catIcon:     { width: 42, height: 42, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  catInitial:  { fontSize: 12, fontWeight: '700' },
  catName:     { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  catSub:      { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  accItem:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  accBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  accBadgeText:{ fontSize: 11, fontWeight: '700' },
  accName:     { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  accSub:      { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  partyItem:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  partyAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  partyAvatarText: { fontSize: 14, fontWeight: '700' },
  partyName:   { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  partySub:    { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  partyBalance:{ fontSize: 13, fontWeight: '700' },
  fifoItem:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: '#EFF6FF' },
  fifoBadge:   { backgroundColor: '#BFDBFE', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  fifoBadgeText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },
  fifoTitle:   { fontSize: 14, fontWeight: '600', color: '#1D4ED8' },
  fifoSub:     { fontSize: 12, color: '#3B82F6', marginTop: 2 },
  invoiceItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  invoiceTop:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  invoiceNum:  { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  statusDue:   { backgroundColor: '#FEE2E2' },
  statusPartial:{ backgroundColor: '#FEF3C7' },
  statusText:  { fontSize: 10, fontWeight: '700' },
  statusTextDue:    { color: '#DC2626' },
  statusTextPartial:{ color: '#D97706' },
  invoiceSub:  { fontSize: 12, color: colors.textSecondary },
  invoiceBalance: { fontSize: 13, fontWeight: '600', color: '#DC2626', marginTop: 2 },
  emptyPicker: { textAlign: 'center', color: colors.textTertiary, padding: 40, fontSize: 14 },
});