import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  loadBusiness, saveBusiness, generateId,
} from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

export default function ReceiptFormScreen({ route, navigation }) {
  const { businessId, receiptId } = route?.params || {};
  const [biz, setBiz] = useState(null);
  const [loading, setLoading] = useState(false);

  const [customer, setCustomer] = useState(null);
  const [account, setAccount] = useState(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const editing = !!receiptId;

  useEffect(() => {
    loadBusiness(businessId).then(b => {
      setBiz(b);
      if (receiptId) {
        const r = b?.receipts?.find(x => x.id === receiptId);
        if (r) {
          const cust = b.customers?.find(c => c.id === r.customerId);
          const acc = b.bankAccounts?.find(a => a.id === r.accountId);
          setCustomer(cust || null);
          setAccount(acc || null);
          setAmount(r.amount?.toString() || '');
          setDate(r.date || '');
          setReference(r.reference || '');
          setNotes(r.notes || '');
        }
      } else {
        // Default to first bank account
        if (b?.bankAccounts?.length > 0) {
          setAccount(b.bankAccounts[0]);
        }
      }
    });
  }, [businessId, receiptId]);

  const handleSave = async () => {
    if (!customer) {
      Alert.alert('Select customer', 'Please choose a customer.');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Enter amount', 'Please enter a valid amount.');
      return;
    }
    if (!account) {
      Alert.alert('Select account', 'Please choose a bank or cash account.');
      return;
    }

    setLoading(true);
    try {
      const receipt = {
        id: receiptId || generateId(),
        customerId: customer.id,
        customerName: customer.displayName,
        accountId: account.id,
        accountName: account.name,
        amount: parseFloat(amount),
        date,
        reference: reference.trim(),
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      };

      const updated = { ...biz };

      // Save receipt
      if (editing) {
        updated.receipts = biz.receipts.map(r =>
          r.id === receiptId ? receipt : r
        );
      } else {
        updated.receipts = [...(biz.receipts || []), receipt];
      }

      // Update bank account balance
      const oldAmount = editing
        ? biz.receipts?.find(r => r.id === receiptId)?.amount || 0
        : 0;
      const diff = parseFloat(amount) - oldAmount;

      updated.bankAccounts = biz.bankAccounts.map(a =>
        a.id === account.id
          ? { ...a, balance: (a.balance || 0) + diff }
          : a
      );

      await saveBusiness(updated);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save receipt.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Receipt', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const existing = biz.receipts?.find(r => r.id === receiptId);
          const updated = {
            ...biz,
            receipts: biz.receipts.filter(r => r.id !== receiptId),
            bankAccounts: biz.bankAccounts.map(a =>
              a.id === existing?.accountId
                ? { ...a, balance: (a.balance || 0) - (existing?.amount || 0) }
                : a
            ),
          };
          await saveBusiness(updated);
          navigation.goBack();
        },
      },
    ]);
  };

  if (!biz) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editing ? 'Edit Receipt' : 'New Receipt'}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={styles.saveBtn}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
      >
        {/* Customer */}
        <Text style={styles.label}>Received from *</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowCustomerPicker(true)}
        >
          <Text style={customer ? styles.pickerValue : styles.pickerPlaceholder}>
            {customer ? customer.displayName : 'Select customer...'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Amount */}
        <Text style={styles.label}>Amount *</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
        />

        {/* Account */}
        <Text style={styles.label}>Deposit into *</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowAccountPicker(true)}
        >
          <Text style={account ? styles.pickerValue : styles.pickerPlaceholder}>
            {account ? account.name : 'Select account...'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Date */}
        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
        />

        {/* Reference */}
        <Text style={styles.label}>Reference / Cheque no.</Text>
        <TextInput
          style={styles.input}
          value={reference}
          onChangeText={setReference}
          placeholder="Optional"
          placeholderTextColor={colors.textTertiary}
        />

        {/* Notes */}
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          placeholderTextColor={colors.textTertiary}
          multiline
        />

        {/* Summary box */}
        {customer && amount && account && (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Receipt summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>From</Text>
              <Text style={styles.summaryValue}>{customer.displayName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Into</Text>
              <Text style={styles.summaryValue}>{account.name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={[styles.summaryValue, { color: '#10B981', fontSize: 18 }]}>
                {biz.meta?.currency} {parseFloat(amount || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {editing && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.deleteBtnText}>Delete Receipt</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Customer picker */}
      <Modal visible={showCustomerPicker} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Customer</Text>
            <TouchableOpacity onPress={() => setShowCustomerPicker(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={biz.customers || []}
            keyExtractor={c => c.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setCustomer(item);
                  setShowCustomerPicker(false);
                }}
              >
                <Text style={styles.modalItemName}>{item.displayName}</Text>
                {item.phone
                  ? <Text style={styles.modalItemSub}>{item.phone}</Text>
                  : null}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.modalEmpty}>
                No customers. Add one from Sales → Customers.
              </Text>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Account picker */}
      <Modal visible={showAccountPicker} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Account</Text>
            <TouchableOpacity onPress={() => setShowAccountPicker(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={biz.bankAccounts || []}
            keyExtractor={a => a.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setAccount(item);
                  setShowAccountPicker(false);
                }}
              >
                <Text style={styles.modalItemName}>{item.name}</Text>
                <Text style={styles.modalItemSub}>
                  {item.type === 'cash' ? 'Cash account' : 'Bank account'} ·
                  Balance: {biz.meta?.currency}{' '}
                  {(item.balance || 0).toLocaleString()}
                </Text>
              </TouchableOpacity>
            )}
          />
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
  form: { padding: 16, paddingBottom: 48 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 7,
    marginTop: 16,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  picker: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  pickerValue: { fontSize: 15, color: colors.textPrimary },
  pickerPlaceholder: { fontSize: 15, color: colors.textTertiary },
  summaryBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    gap: 8,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 13, color: '#065F46' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#065F46' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 32,
  },
  deleteBtnText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
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
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
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