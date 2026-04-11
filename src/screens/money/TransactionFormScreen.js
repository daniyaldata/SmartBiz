import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  loadBusiness,
  saveReceiptTransaction,
  savePaymentTransaction,
  saveTransferTransaction,
  generateId,
  getInvoiceStatus,
} from '../../data/BusinessStore';
import ModalSheet from '../../components/ModalSheet';
import DateField from '../../components/DateField';
import PartyField from '../../components/PartyField';
import { colors } from '../../theme/colors';

const TAB_TYPES = [
  { id: 'receipt', label: 'Receipt', color: '#10B981', icon: 'arrow-down-circle-outline' },
  { id: 'payment', label: 'Payment', color: '#EF4444', icon: 'arrow-up-circle-outline' },
  { id: 'transfer', label: 'Transfer', color: '#8B5CF6', icon: 'swap-horizontal-outline' },
];

const PICKER_TITLES = {
  salesInvoice: 'Select Invoice',
  incomeAccount: 'Select Income Account',
  depositAccount: 'Select Deposit Account',
  purchaseInvoice: 'Select Bill',
  expenseAccount: 'Select Expense Account',
  payFromAccount: 'Select Payment Account',
  fromAccount: 'From Account (Credit)',
  toAccount: 'To Account (Debit)',
};

export default function TransactionFormScreen({ route, navigation }) {
  const {
  businessId, transactionId, defaultType,
  prefillCustomerId, prefillSupplierId,
  prefillInvoiceId, prefillAmount,
} = route?.params || {};
  const [biz, setBiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [txnType, setTxnType] = useState(defaultType || 'receipt');
  const [picker, setPicker] = useState(null);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // Receipt fields
  const [receiptParty, setReceiptParty] = useState(null);
  const [linkedSalesInvoice, setLinkedSalesInvoice] = useState(null);
  const [incomeAccount, setIncomeAccount] = useState(null);
  const [depositAccount, setDepositAccount] = useState(null);

  // Payment fields
  const [paymentParty, setPaymentParty] = useState(null);
  const [linkedPurchaseInvoice, setLinkedPurchaseInvoice] = useState(null);
  const [expenseAccount, setExpenseAccount] = useState(null);
  const [payFromAccount, setPayFromAccount] = useState(null);

  // Transfer fields
  const [fromAccount, setFromAccount] = useState(null);
  const [toAccount, setToAccount] = useState(null);

  const editing = !!transactionId;

  useEffect(() => {
    loadBusiness(businessId).then(b => {
      setBiz(b);
     if (b?.bankAccounts?.length > 0) {
  setDepositAccount(b.bankAccounts[0]);
  setPayFromAccount(b.bankAccounts[0]);
  setFromAccount(b.bankAccounts[0]);
  if (b.bankAccounts.length > 1) setToAccount(b.bankAccounts[1]);
}

// Prefill from invoice view — Record New Receipt
if (prefillCustomerId) {
  const cust = b.customers?.find(c => c.id === prefillCustomerId);
  if (cust) {
    setReceiptParty({ ...cust, _type: 'customer' });
  }
}
if (prefillInvoiceId && defaultType === 'receipt') {
  const inv = b.salesInvoices?.find(i => i.id === prefillInvoiceId);
  if (inv) setLinkedSalesInvoice(inv);
}
if (prefillAmount && defaultType === 'receipt') {
  setAmount(prefillAmount);
}

// Prefill from invoice view — Record New Payment
if (prefillSupplierId) {
  const sup = b.suppliers?.find(s => s.id === prefillSupplierId);
  if (sup) {
    setPaymentParty({ ...sup, _type: 'supplier' });
  }
}
if (prefillInvoiceId && defaultType === 'payment') {
  const inv = b.purchaseInvoices?.find(i => i.id === prefillInvoiceId);
  if (inv) setLinkedPurchaseInvoice(inv);
}
if (prefillAmount && defaultType === 'payment') {
  setAmount(prefillAmount);
}
      if (transactionId) {
        const txn = (b?.transactions || []).find(t => t.id === transactionId);
        if (txn) {
          setTxnType(txn.transactionType);
          setAmount(txn.amount?.toString() || '');
          setDate(txn.date || '');
          setReference(txn.reference || '');
          setNotes(txn.notes || '');

          if (txn.transactionType === 'receipt') {
            if (txn.partyId) {
              const cust = b.customers?.find(c => c.id === txn.partyId);
              const sup = b.suppliers?.find(s => s.id === txn.partyId);
              setReceiptParty(
                cust ? { ...cust, _type: 'customer' }
                : sup ? { ...sup, _type: 'supplier' }
                : { id: '__freetext__', displayName: txn.partyName, _type: 'freetext' }
              );
            } else if (txn.partyName) {
              setReceiptParty({
                id: '__freetext__',
                displayName: txn.partyName,
                _type: 'freetext',
              });
            }
            setLinkedSalesInvoice(
              b.salesInvoices?.find(i => i.id === txn.linkedInvoiceId) || null
            );
            setIncomeAccount(
              b.incomeAccounts?.find(a => a.id === txn.incomeAccountId) || null
            );
            setDepositAccount(
              b.bankAccounts?.find(a => a.id === txn.accountId) || null
            );
          }

          if (txn.transactionType === 'payment') {
            if (txn.partyId) {
              const sup = b.suppliers?.find(s => s.id === txn.partyId);
              const cust = b.customers?.find(c => c.id === txn.partyId);
              setPaymentParty(
                sup ? { ...sup, _type: 'supplier' }
                : cust ? { ...cust, _type: 'customer' }
                : { id: '__freetext__', displayName: txn.partyName, _type: 'freetext' }
              );
            } else if (txn.partyName) {
              setPaymentParty({
                id: '__freetext__',
                displayName: txn.partyName,
                _type: 'freetext',
              });
            }
            setLinkedPurchaseInvoice(
              b.purchaseInvoices?.find(i => i.id === txn.linkedInvoiceId) || null
            );
            setExpenseAccount(
              b.expenseAccounts?.find(a => a.id === txn.expenseAccountId) || null
            );
            setPayFromAccount(
              b.bankAccounts?.find(a => a.id === txn.accountId) || null
            );
          }

          if (txn.transactionType === 'transfer') {
            setFromAccount(
              b.bankAccounts?.find(a => a.id === txn.fromAccountId) || null
            );
            setToAccount(
              b.bankAccounts?.find(a => a.id === txn.toAccountId) || null
            );
          }
        }
      }
    });
  }, [businessId, transactionId]);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      Alert.alert('Amount required', 'Please enter a valid amount.');
      return;
    }
    if (txnType === 'receipt' && !depositAccount) {
      Alert.alert('Account required', 'Please select a deposit account.');
      return;
    }
    if (txnType === 'payment' && !payFromAccount) {
      Alert.alert('Account required', 'Please select a payment account.');
      return;
    }
    if (txnType === 'transfer') {
      if (!fromAccount || !toAccount) {
        Alert.alert('Accounts required', 'Please select both accounts.');
        return;
      }
      if (fromAccount.id === toAccount.id) {
        Alert.alert('Invalid', 'From and To accounts must be different.');
        return;
      }
    }

    setLoading(true);
    try {
      const id = transactionId || generateId();

      if (txnType === 'receipt') {
        const isLinked =
          receiptParty?._type === 'customer' ||
          receiptParty?._type === 'supplier';
        await saveReceiptTransaction(biz, {
          id,
          transactionType: 'receipt',
          partyType: receiptParty?._type || null,
          partyId: isLinked ? receiptParty?.id : null,
          partyName: receiptParty?.displayName || null,
          accountId: depositAccount?.id,
          accountName: depositAccount?.name,
          incomeAccountId: incomeAccount?.id || null,
          incomeAccountName: incomeAccount?.name || null,
          linkedInvoiceId: linkedSalesInvoice?.id || null,
          amount: amt,
          date,
          reference: reference.trim(),
          notes: notes.trim(),
          createdAt: new Date().toISOString(),
        });
      }

      if (txnType === 'payment') {
        const isLinked =
          paymentParty?._type === 'supplier' ||
          paymentParty?._type === 'customer';
        await savePaymentTransaction(biz, {
          id,
          transactionType: 'payment',
          partyType: paymentParty?._type || null,
          partyId: isLinked ? paymentParty?.id : null,
          partyName: paymentParty?.displayName || null,
          accountId: payFromAccount?.id,
          accountName: payFromAccount?.name,
          expenseAccountId: expenseAccount?.id || null,
          expenseAccountName: expenseAccount?.name || null,
          linkedInvoiceId: linkedPurchaseInvoice?.id || null,
          amount: amt,
          date,
          reference: reference.trim(),
          notes: notes.trim(),
          createdAt: new Date().toISOString(),
        });
      }

      if (txnType === 'transfer') {
        await saveTransferTransaction(biz, {
          id,
          transactionType: 'transfer',
          fromAccountId: fromAccount?.id,
          fromAccountName: fromAccount?.name,
          toAccountId: toAccount?.id,
          toAccountName: toAccount?.name,
          amount: amt,
          date,
          reference: reference.trim(),
          notes: notes.trim(),
          createdAt: new Date().toISOString(),
        });
      }

      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!biz) return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );

  const activeTab = TAB_TYPES.find(t => t.id === txnType);

  // Logic flags
  const isReceiptCustomer = receiptParty?._type === 'customer';
  const isReceiptSupplier = receiptParty?._type === 'supplier';
  const isReceiptLinked = isReceiptCustomer || isReceiptSupplier;
  const isReceiptFreeOrEmpty =
    !receiptParty || receiptParty._type === 'freetext';

  const isPaymentSupplier = paymentParty?._type === 'supplier';
  const isPaymentCustomer = paymentParty?._type === 'customer';
  const isPaymentLinked = isPaymentSupplier || isPaymentCustomer;
  const isPaymentFreeOrEmpty =
    !paymentParty || paymentParty._type === 'freetext';

  const unpaidSales = (biz.salesInvoices || [])
    .filter(i =>
      i.customerId === receiptParty?.id && getInvoiceStatus(i) !== 'paid'
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const unpaidPurchases = (biz.purchaseInvoices || [])
    .filter(i =>
      i.supplierId === paymentParty?.id && getInvoiceStatus(i) !== 'paid'
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const getPickerData = () => {
    switch (picker) {
      case 'salesInvoice':
        return [
          { id: null, _label: '— Auto-allocate (FIFO) —' },
          ...unpaidSales,
        ];
      case 'incomeAccount':
        return biz.incomeAccounts || [];
      case 'depositAccount':
        return biz.bankAccounts || [];
      case 'purchaseInvoice':
        return [
          { id: null, _label: '— Auto-allocate (FIFO) —' },
          ...unpaidPurchases,
        ];
      case 'expenseAccount':
        return biz.expenseAccounts || [];
      case 'payFromAccount':
        return biz.bankAccounts || [];
      case 'fromAccount':
        return biz.bankAccounts || [];
      case 'toAccount':
        return biz.bankAccounts || [];
      default:
        return [];
    }
  };

  const handlePickerSelect = (item) => {
    switch (picker) {
      case 'salesInvoice':
        setLinkedSalesInvoice(item.id ? item : null);
        if (item.id)
          setAmount((item.total - (item.amountPaid || 0)).toString());
        break;
      case 'incomeAccount':
        setIncomeAccount(item);
        break;
      case 'depositAccount':
        setDepositAccount(item);
        break;
      case 'purchaseInvoice':
        setLinkedPurchaseInvoice(item.id ? item : null);
        if (item.id)
          setAmount((item.total - (item.amountPaid || 0)).toString());
        break;
      case 'expenseAccount':
        setExpenseAccount(item);
        break;
      case 'payFromAccount':
        setPayFromAccount(item);
        break;
      case 'fromAccount':
        setFromAccount(item);
        break;
      case 'toAccount':
        setToAccount(item);
        break;
    }
    setPicker(null);
  };

  const PickerRow = ({ label, value, placeholder, onPress, color }) => (
    <TouchableOpacity style={styles.pickerRow} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pickerRowLabel}>{label}</Text>
        <Text style={[
          styles.pickerRowValue,
          !value && styles.pickerRowPlaceholder,
          value && color && { color },
        ]}>
          {value || placeholder}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  const renderPickerItem = ({ item }) => {
    if (item._label) {
      return (
        <TouchableOpacity
          style={styles.modalItem}
          onPress={() => handlePickerSelect(item)}
        >
          <Text style={[
            styles.modalItemName,
            { color: colors.textSecondary, fontStyle: 'italic' },
          ]}>
            {item._label}
          </Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={styles.modalItem}
        onPress={() => handlePickerSelect(item)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.modalItemName}>
            {item.displayName || item.name ||
              (item.number ? `INV-${item.number}` : '')}
          </Text>
          {item.total !== undefined && (
            <Text style={styles.modalItemSub}>
              Total: {biz.meta?.currency} {item.total?.toLocaleString()} ·
              Balance: {biz.meta?.currency}{' '}
              {(item.total - (item.amountPaid || 0)).toLocaleString()}
            </Text>
          )}
          {item.balance !== undefined && item.total === undefined && (
            <Text style={styles.modalItemSub}>
              Balance: {biz.meta?.currency} {(item.balance || 0).toLocaleString()}
            </Text>
          )}
          {item.group && (
            <Text style={styles.modalItemSub}>
              {item.code} · {item.group}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editing ? 'Edit Transaction' : 'New Transaction'}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={styles.saveBtn}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Type tabs */}
      <View style={styles.tabRow}>
        {TAB_TYPES.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              txnType === tab.id && {
                backgroundColor: tab.color + '18',
                borderColor: tab.color,
              },
            ]}
            onPress={() => !editing && setTxnType(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={txnType === tab.id ? tab.color : colors.textTertiary}
            />
            <Text style={[
              styles.tabText,
              txnType === tab.id && { color: tab.color, fontWeight: '700' },
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >

        {/* ── RECEIPT ── */}
        {txnType === 'receipt' && (
          <>
            <PartyField
              label="Received from"
              value={receiptParty}
              onSelect={(item) => {
                setReceiptParty(item);
                setLinkedSalesInvoice(null);
                setIncomeAccount(null);
              }}
              onClear={() => {
                setReceiptParty(null);
                setLinkedSalesInvoice(null);
              }}
              customers={biz.customers || []}
              suppliers={biz.suppliers || []}
              placeholder="Search customer, supplier or type name..."
            />

            {/* Invoice picker — only for linked customer */}
            {isReceiptCustomer && (
              <PickerRow
                label="Against invoice (optional)"
                value={linkedSalesInvoice
                  ? `INV-${linkedSalesInvoice.number} · ${biz.meta?.currency} ${linkedSalesInvoice.total?.toLocaleString()}`
                  : null}
                placeholder="Auto-allocate (FIFO) or pick invoice"
                onPress={() => setPicker('salesInvoice')}
              />
            )}

            {/* Income account — for freetext party or no party */}
            {isReceiptFreeOrEmpty && (
              <PickerRow
                label="Income account (optional)"
                value={incomeAccount?.name}
                placeholder="Select income account"
                onPress={() => setPicker('incomeAccount')}
                color="#10B981"
              />
            )}

            <PickerRow
              label="Deposit into *"
              value={depositAccount?.name}
              placeholder="Select account"
              onPress={() => setPicker('depositAccount')}
              color={colors.primary}
            />
          </>
        )}

        {/* ── PAYMENT ── */}
        {txnType === 'payment' && (
          <>
            <PartyField
              label="Pay to"
              value={paymentParty}
              onSelect={(item) => {
                setPaymentParty(item);
                setLinkedPurchaseInvoice(null);
                setExpenseAccount(null);
              }}
              onClear={() => {
                setPaymentParty(null);
                setLinkedPurchaseInvoice(null);
              }}
              customers={biz.customers || []}
              suppliers={biz.suppliers || []}
              placeholder="Search supplier, customer or type name..."
            />

            {/* Invoice picker — only for linked supplier */}
            {isPaymentSupplier && (
              <PickerRow
                label="Against invoice (optional)"
                value={linkedPurchaseInvoice
                  ? `BILL-${linkedPurchaseInvoice.number} · ${biz.meta?.currency} ${linkedPurchaseInvoice.total?.toLocaleString()}`
                  : null}
                placeholder="Auto-allocate (FIFO) or pick bill"
                onPress={() => setPicker('purchaseInvoice')}
              />
            )}

            {/* Expense account — for freetext party or no party */}
            {isPaymentFreeOrEmpty && (
              <PickerRow
                label="Expense account (optional)"
                value={expenseAccount?.name}
                placeholder="Select expense account"
                onPress={() => setPicker('expenseAccount')}
                color="#EF4444"
              />
            )}

            <PickerRow
              label="Pay from account *"
              value={payFromAccount?.name}
              placeholder="Select account"
              onPress={() => setPicker('payFromAccount')}
              color={colors.primary}
            />
          </>
        )}

        {/* ── TRANSFER ── */}
        {txnType === 'transfer' && (
          <View style={styles.transferRow}>
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                style={[styles.transferAccount, styles.transferFrom]}
                onPress={() => setPicker('fromAccount')}
              >
                <Text style={styles.transferLabel}>From (Credit)</Text>
                <Text style={styles.transferName} numberOfLines={1}>
                  {fromAccount?.name || 'Select account'}
                </Text>
              </TouchableOpacity>
            </View>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={colors.textTertiary}
            />
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                style={[styles.transferAccount, styles.transferTo]}
                onPress={() => setPicker('toAccount')}
              >
                <Text style={styles.transferLabel}>To (Debit)</Text>
                <Text style={styles.transferName} numberOfLines={1}>
                  {toAccount?.name || 'Select account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── SHARED FIELDS ── */}
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Amount *</Text>
            <TextInput
              style={[
                styles.input,
                styles.amountInput,
                { borderColor: activeTab?.color || colors.border },
              ]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <DateField
              label="Date"
              value={date}
              onChange={setDate}
              dateFormat={biz?.settings?.dateFormat}
            />
          </View>
        </View>

        <Text style={styles.label}>Reference</Text>
        <TextInput
          style={styles.input}
          value={reference}
          onChangeText={setReference}
          placeholder="Cheque no., bank ref, etc."
          placeholderTextColor={colors.textTertiary}
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          placeholderTextColor={colors.textTertiary}
          multiline
        />

        {/* Summary */}
        {amount && parseFloat(amount) > 0 && (
          <View style={[
            styles.summaryBox,
            { backgroundColor: activeTab?.color + '12' },
          ]}>
            <Text style={[styles.summaryTitle, { color: activeTab?.color }]}>
              {txnType === 'receipt' ? 'Receiving'
                : txnType === 'payment' ? 'Paying out'
                : 'Transferring'}
            </Text>
            <Text style={[styles.summaryAmount, { color: activeTab?.color }]}>
              {biz.meta?.currency} {parseFloat(amount || 0).toLocaleString()}
            </Text>
            {txnType === 'receipt' && (
              <Text style={styles.summarySub}>
                {receiptParty
                  ? `From ${receiptParty.displayName} → ${depositAccount?.name || 'account'}`
                  : `→ ${depositAccount?.name || 'account'}`}
              </Text>
            )}
            {txnType === 'payment' && (
              <Text style={styles.summarySub}>
                {paymentParty
                  ? `To ${paymentParty.displayName} from ${payFromAccount?.name || 'account'}`
                  : `${expenseAccount?.name || 'Expense'} from ${payFromAccount?.name || 'account'}`}
              </Text>
            )}
            {txnType === 'transfer' && (
              <Text style={styles.summarySub}>
                {fromAccount?.name || '?'} → {toAccount?.name || '?'}
              </Text>
            )}
          </View>
        )}

      </ScrollView>

      {/* Universal picker via ModalSheet */}
      <ModalSheet
        visible={!!picker}
        onClose={() => setPicker(null)}
        title={PICKER_TITLES[picker] || 'Select'}
      >
        <FlatList
          data={getPickerData()}
          keyExtractor={(item, idx) =>
            item.id != null ? String(item.id) : String(idx)
          }
          renderItem={renderPickerItem}
          ListEmptyComponent={
            <Text style={styles.modalEmpty}>No options available.</Text>
          }
        />
      </ModalSheet>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  saveBtn: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  tabRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10,
    gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 5, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  tabText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  form: { padding: 16, paddingBottom: 48 },
  label: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 5, marginTop: 12,
  },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 11,
    paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 15, color: colors.textPrimary,
  },
  amountInput: { fontSize: 18, fontWeight: '600', borderWidth: 2 },
  row2: { flexDirection: 'row', gap: 10 },
  pickerRow: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 11,
    paddingHorizontal: 13, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center',
    marginTop: 8, backgroundColor: colors.background,
  },
  pickerRowLabel: {
    fontSize: 10, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3,
  },
  pickerRowValue: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  pickerRowPlaceholder: { color: colors.textTertiary, fontWeight: '400' },
  transferRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4,
  },
  transferAccount: { borderRadius: 11, padding: 12, borderWidth: 1.5 },
  transferFrom: { borderColor: '#FECACA', backgroundColor: '#FFF5F5' },
  transferTo: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  transferLabel: {
    fontSize: 10, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
  },
  transferName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  summaryBox: {
    borderRadius: 14, padding: 16, alignItems: 'center',
    marginTop: 16, gap: 4,
  },
  summaryTitle: {
    fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  summaryAmount: { fontSize: 24, fontWeight: '700' },
  summarySub: {
    fontSize: 13, color: colors.textSecondary, textAlign: 'center',
  },
  modalItem: {
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalItemName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  modalItemSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  modalEmpty: {
    textAlign: 'center', color: colors.textTertiary,
    padding: 40, fontSize: 14,
  },
});