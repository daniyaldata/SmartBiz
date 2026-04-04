import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  Modal, FlatList,
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
import { colors } from '../../theme/colors';

const TAB_TYPES = [
  { id: 'receipt', label: 'Receipt', color: '#10B981', icon: 'arrow-down-circle-outline' },
  { id: 'payment', label: 'Payment', color: '#EF4444', icon: 'arrow-up-circle-outline' },
  { id: 'transfer', label: 'Transfer', color: '#8B5CF6', icon: 'swap-horizontal-outline' },
];

export default function TransactionFormScreen({ route, navigation }) {
  const { businessId, transactionId, defaultType } = route?.params || {};
  const [biz, setBiz] = useState(null);
  const [loading, setLoading] = useState(false);

  const [txnType, setTxnType] = useState(defaultType || 'receipt');

  // Shared fields
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // Receipt fields
  const [customer, setCustomer] = useState(null);
  const [linkedSalesInvoice, setLinkedSalesInvoice] = useState(null);
  const [incomeAccount, setIncomeAccount] = useState(null);
  const [depositAccount, setDepositAccount] = useState(null);

  // Payment fields
  const [supplier, setSupplier] = useState(null);
  const [linkedPurchaseInvoice, setLinkedPurchaseInvoice] = useState(null);
  const [expenseAccount, setExpenseAccount] = useState(null);
  const [payFromAccount, setPayFromAccount] = useState(null);

  // Transfer fields
  const [fromAccount, setFromAccount] = useState(null);
  const [toAccount, setToAccount] = useState(null);

  // Picker modals
  const [picker, setPicker] = useState(null);

  const editing = !!transactionId;

  useEffect(() => {
    loadBusiness(businessId).then(b => {
      setBiz(b);
      // Set defaults
      if (b?.bankAccounts?.length > 0) {
        setDepositAccount(b.bankAccounts[0]);
        setPayFromAccount(b.bankAccounts[0]);
        setFromAccount(b.bankAccounts[0]);
        if (b.bankAccounts.length > 1) setToAccount(b.bankAccounts[1]);
      }
      // Load existing if editing
      if (transactionId) {
        const txn = (b?.transactions || []).find(t => t.id === transactionId);
        if (txn) {
          setTxnType(txn.transactionType);
          setAmount(txn.amount?.toString() || '');
          setDate(txn.date || '');
          setReference(txn.reference || '');
          setNotes(txn.notes || '');
          if (txn.transactionType === 'receipt') {
            const cust = b.customers?.find(c => c.id === txn.partyId);
            setCustomer(cust || null);
            const inv = b.salesInvoices?.find(i => i.id === txn.linkedInvoiceId);
            setLinkedSalesInvoice(inv || null);
            const inc = b.incomeAccounts?.find(a => a.id === txn.incomeAccountId);
            setIncomeAccount(inc || null);
            const acc = b.bankAccounts?.find(a => a.id === txn.accountId);
            setDepositAccount(acc || null);
          }
          if (txn.transactionType === 'payment') {
            const sup = b.suppliers?.find(s => s.id === txn.partyId);
            setSupplier(sup || null);
            const inv = b.purchaseInvoices?.find(i => i.id === txn.linkedInvoiceId);
            setLinkedPurchaseInvoice(inv || null);
            const exp = b.expenseAccounts?.find(a => a.id === txn.expenseAccountId);
            setExpenseAccount(exp || null);
            const acc = b.bankAccounts?.find(a => a.id === txn.accountId);
            setPayFromAccount(acc || null);
          }
          if (txn.transactionType === 'transfer') {
            const from = b.bankAccounts?.find(a => a.id === txn.fromAccountId);
            const to = b.bankAccounts?.find(a => a.id === txn.toAccountId);
            setFromAccount(from || null);
            setToAccount(to || null);
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
        const txn = {
          id,
          transactionType: 'receipt',
          partyType: customer ? 'customer' : null,
          partyId: customer?.id || null,
          partyName: customer?.displayName || null,
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
        };
        await saveReceiptTransaction(biz, txn);
      }

      if (txnType === 'payment') {
        const txn = {
          id,
          transactionType: 'payment',
          partyType: supplier ? 'supplier' : null,
          partyId: supplier?.id || null,
          partyName: supplier?.displayName || null,
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
        };
        await savePaymentTransaction(biz, txn);
      }

      if (txnType === 'transfer') {
        const txn = {
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
        };
        await saveTransferTransaction(biz, txn);
      }

      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save transaction: ' + e.message);
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

  const unpaidSalesInvoices = (biz.salesInvoices || [])
    .filter(i => i.customerId === customer?.id && getInvoiceStatus(i) !== 'paid')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const unpaidPurchaseInvoices = (biz.purchaseInvoices || [])
    .filter(i => i.supplierId === supplier?.id && getInvoiceStatus(i) !== 'paid')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const PickerField = ({ label, value, placeholder, onPress, color }) => (
    <TouchableOpacity style={styles.picker} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pickerLabel}>{label}</Text>
        <Text style={[
          styles.pickerValue,
          !value && styles.pickerPlaceholder,
          value && color && { color },
        ]}>
          {value || placeholder}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
    </TouchableOpacity>
  );

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
      >

        {/* ── RECEIPT FIELDS ── */}
        {txnType === 'receipt' && (
          <>
            <PickerField
              label="Received from (optional)"
              value={customer?.displayName}
              placeholder="Select customer or leave blank"
              onPress={() => setPicker('customer')}
            />

            {customer && (
              <PickerField
                label="Against invoice (optional)"
                value={linkedSalesInvoice
                  ? `INV-${linkedSalesInvoice.number} · ${biz.meta?.currency} ${linkedSalesInvoice.total?.toLocaleString()}`
                  : null}
                placeholder="Auto-allocate (FIFO) or pick invoice"
                onPress={() => setPicker('salesInvoice')}
              />
            )}

            {!customer && (
              <PickerField
                label="Income account"
                value={incomeAccount?.name}
                placeholder="Select income account"
                onPress={() => setPicker('incomeAccount')}
                color="#10B981"
              />
            )}

            <PickerField
              label="Deposit into *"
              value={depositAccount?.name}
              placeholder="Select account"
              onPress={() => setPicker('depositAccount')}
              color={colors.primary}
            />
          </>
        )}

        {/* ── PAYMENT FIELDS ── */}
        {txnType === 'payment' && (
          <>
            <PickerField
              label="Pay to (optional)"
              value={supplier?.displayName}
              placeholder="Select supplier or leave blank"
              onPress={() => setPicker('supplier')}
            />

            {supplier && (
              <PickerField
                label="Against invoice (optional)"
                value={linkedPurchaseInvoice
                  ? `BILL-${linkedPurchaseInvoice.number} · ${biz.meta?.currency} ${linkedPurchaseInvoice.total?.toLocaleString()}`
                  : null}
                placeholder="Auto-allocate (FIFO) or pick invoice"
                onPress={() => setPicker('purchaseInvoice')}
              />
            )}

            {!supplier && (
              <PickerField
                label="Expense account"
                value={expenseAccount?.name}
                placeholder="Select expense account"
                onPress={() => setPicker('expenseAccount')}
                color="#EF4444"
              />
            )}

            <PickerField
              label="Pay from account *"
              value={payFromAccount?.name}
              placeholder="Select account"
              onPress={() => setPicker('payFromAccount')}
              color={colors.primary}
            />
          </>
        )}

        {/* ── TRANSFER FIELDS ── */}
        {txnType === 'transfer' && (
          <>
            <View style={styles.transferRow}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  style={[styles.transferAccount, styles.transferFrom]}
                  onPress={() => setPicker('fromAccount')}
                >
                  <Text style={styles.transferAccountLabel}>From (Credit)</Text>
                  <Text style={styles.transferAccountName} numberOfLines={1}>
                    {fromAccount?.name || 'Select account'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.textTertiary} />
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  style={[styles.transferAccount, styles.transferTo]}
                  onPress={() => setPicker('toAccount')}
                >
                  <Text style={styles.transferAccountLabel}>To (Debit)</Text>
                  <Text style={styles.transferAccountName} numberOfLines={1}>
                    {toAccount?.name || 'Select account'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* ── SHARED FIELDS ── */}
        <View style={styles.amountRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Amount *</Text>
            <TextInput
              style={[styles.input, styles.amountInput,
                { borderColor: activeTab?.color || colors.border }
              ]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
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
          <View style={[styles.summaryBox, { backgroundColor: activeTab?.color + '12' }]}>
            <Text style={[styles.summaryTitle, { color: activeTab?.color }]}>
              {txnType === 'receipt' ? 'Receiving'
                : txnType === 'payment' ? 'Paying'
                : 'Transferring'}
            </Text>
            <Text style={[styles.summaryAmount, { color: activeTab?.color }]}>
              {biz.meta?.currency} {parseFloat(amount || 0).toLocaleString()}
            </Text>
            {txnType === 'receipt' && (
              <Text style={styles.summarySub}>
                {customer
                  ? `From ${customer.displayName} → ${depositAccount?.name || 'account'}`
                  : `Income → ${depositAccount?.name || 'account'}`}
              </Text>
            )}
            {txnType === 'payment' && (
              <Text style={styles.summarySub}>
                {supplier
                  ? `To ${supplier.displayName} from ${payFromAccount?.name || 'account'}`
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

      {/* ── PICKERS ── */}
      <Modal visible={!!picker} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {picker === 'customer' && 'Select Customer'}
              {picker === 'salesInvoice' && 'Select Invoice'}
              {picker === 'incomeAccount' && 'Select Income Account'}
              {picker === 'depositAccount' && 'Select Account'}
              {picker === 'supplier' && 'Select Supplier'}
              {picker === 'purchaseInvoice' && 'Select Bill'}
              {picker === 'expenseAccount' && 'Select Expense Account'}
              {picker === 'payFromAccount' && 'Select Account'}
              {picker === 'fromAccount' && 'From Account (Credit)'}
              {picker === 'toAccount' && 'To Account (Debit)'}
            </Text>
            <TouchableOpacity onPress={() => setPicker(null)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Customer picker */}
          {picker === 'customer' && (
            <FlatList
              data={[{ id: null, displayName: '— No customer (income account) —' }, ...(biz.customers || [])]}
              keyExtractor={(i, idx) => i.id || 'none-' + idx}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    if (!item.id) {
                      setCustomer(null);
                      setLinkedSalesInvoice(null);
                    } else {
                      setCustomer(item);
                      setLinkedSalesInvoice(null);
                    }
                    setPicker(null);
                  }}
                >
                  <Text style={[
                    styles.modalItemName,
                    !item.id && { color: colors.textSecondary, fontStyle: 'italic' },
                  ]}>
                    {item.displayName}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>No customers found.</Text>
              }
            />
          )}

          {/* Sales invoice picker */}
          {picker === 'salesInvoice' && (
            <FlatList
              data={[
                { id: null, _label: '— Auto-allocate (FIFO) —' },
                ...unpaidSalesInvoices,
              ]}
              keyExtractor={(i, idx) => i.id || 'auto-' + idx}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setLinkedSalesInvoice(item.id ? item : null);
                    if (item.id) setAmount(
                      (item.total - (item.amountPaid || 0)).toString()
                    );
                    setPicker(null);
                  }}
                >
                  {item._label ? (
                    <Text style={[styles.modalItemName, { color: colors.textSecondary, fontStyle: 'italic' }]}>
                      {item._label}
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.modalItemName}>
                        INV-{item.number} · {biz.meta?.currency} {item.total?.toLocaleString()}
                      </Text>
                      <Text style={styles.modalItemSub}>
                        Balance: {biz.meta?.currency}{' '}
                        {(item.total - (item.amountPaid || 0)).toLocaleString()} ·{' '}
                        {new Date(item.date).toLocaleDateString()}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>No unpaid invoices for this customer.</Text>
              }
            />
          )}

          {/* Income account picker */}
          {picker === 'incomeAccount' && (
            <FlatList
              data={biz.incomeAccounts || []}
              keyExtractor={a => a.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setIncomeAccount(item); setPicker(null); }}
                >
                  <Text style={styles.modalItemName}>{item.name}</Text>
                  <Text style={styles.modalItemSub}>{item.code} · {item.group}</Text>
                </TouchableOpacity>
              )}
            />
          )}

          {/* Bank account pickers */}
          {(picker === 'depositAccount' || picker === 'payFromAccount' ||
            picker === 'fromAccount' || picker === 'toAccount') && (
            <FlatList
              data={biz.bankAccounts || []}
              keyExtractor={a => a.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    if (picker === 'depositAccount') setDepositAccount(item);
                    if (picker === 'payFromAccount') setPayFromAccount(item);
                    if (picker === 'fromAccount') setFromAccount(item);
                    if (picker === 'toAccount') setToAccount(item);
                    setPicker(null);
                  }}
                >
                  <Text style={styles.modalItemName}>{item.name}</Text>
                  <Text style={styles.modalItemSub}>
                    Balance: {biz.meta?.currency} {(item.balance || 0).toLocaleString()}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}

          {/* Supplier picker */}
          {picker === 'supplier' && (
            <FlatList
              data={[{ id: null, displayName: '— No supplier (expense account) —' }, ...(biz.suppliers || [])]}
              keyExtractor={(i, idx) => i.id || 'none-' + idx}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    if (!item.id) {
                      setSupplier(null);
                      setLinkedPurchaseInvoice(null);
                    } else {
                      setSupplier(item);
                      setLinkedPurchaseInvoice(null);
                    }
                    setPicker(null);
                  }}
                >
                  <Text style={[
                    styles.modalItemName,
                    !item.id && { color: colors.textSecondary, fontStyle: 'italic' },
                  ]}>
                    {item.displayName}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}

          {/* Purchase invoice picker */}
          {picker === 'purchaseInvoice' && (
            <FlatList
              data={[
                { id: null, _label: '— Auto-allocate (FIFO) —' },
                ...unpaidPurchaseInvoices,
              ]}
              keyExtractor={(i, idx) => i.id || 'auto-' + idx}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setLinkedPurchaseInvoice(item.id ? item : null);
                    if (item.id) setAmount(
                      (item.total - (item.amountPaid || 0)).toString()
                    );
                    setPicker(null);
                  }}
                >
                  {item._label ? (
                    <Text style={[styles.modalItemName, { color: colors.textSecondary, fontStyle: 'italic' }]}>
                      {item._label}
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.modalItemName}>
                        BILL-{item.number} · {biz.meta?.currency} {item.total?.toLocaleString()}
                      </Text>
                      <Text style={styles.modalItemSub}>
                        Balance: {biz.meta?.currency}{' '}
                        {(item.total - (item.amountPaid || 0)).toLocaleString()} ·{' '}
                        {new Date(item.date).toLocaleDateString()}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>No unpaid bills for this supplier.</Text>
              }
            />
          )}

          {/* Expense account picker */}
          {picker === 'expenseAccount' && (
            <FlatList
              data={biz.expenseAccounts || []}
              keyExtractor={a => a.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setExpenseAccount(item); setPicker(null); }}
                >
                  <Text style={styles.modalItemName}>{item.name}</Text>
                  <Text style={styles.modalItemSub}>{item.code} · {item.group}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  saveBtn: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  tabText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  form: { padding: 16, paddingBottom: 48, gap: 4 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
    marginTop: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.textPrimary,
  },
  amountRow: { flexDirection: 'row', gap: 10 },
  amountInput: { fontSize: 18, fontWeight: '600', borderWidth: 2 },
  picker: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: colors.background,
  },
  pickerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  pickerValue: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  pickerPlaceholder: { color: colors.textTertiary, fontWeight: '400' },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  transferAccount: {
    borderRadius: 11,
    padding: 12,
    borderWidth: 1.5,
  },
  transferFrom: {
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  transferTo: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  transferAccountLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  transferAccountName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  summaryBox: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    gap: 4,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryAmount: { fontSize: 24, fontWeight: '700' },
  summarySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  modalItemSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  modalEmpty: {
    textAlign: 'center',
    color: colors.textTertiary,
    padding: 40,
    fontSize: 14,
  },
});