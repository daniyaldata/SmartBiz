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

export default function PaymentFormScreen({ route, navigation }) {
  const { businessId, paymentId } = route?.params || {};
  const [biz, setBiz] = useState(null);
  const [loading, setLoading] = useState(false);

  const [supplier, setSupplier] = useState(null);
  const [account, setAccount] = useState(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const editing = !!paymentId;

  useEffect(() => {
    loadBusiness(businessId).then(b => {
      setBiz(b);
      if (paymentId) {
        const p = b?.payments?.find(x => x.id === paymentId);
        if (p) {
          const sup = b.suppliers?.find(s => s.id === p.supplierId);
          const acc = b.bankAccounts?.find(a => a.id === p.accountId);
          setSupplier(sup || null);
          setAccount(acc || null);
          setAmount(p.amount?.toString() || '');
          setDate(p.date || '');
          setReference(p.reference || '');
          setNotes(p.notes || '');
        }
      } else {
        if (b?.bankAccounts?.length > 0) {
          setAccount(b.bankAccounts[0]);
        }
      }
    });
  }, [businessId, paymentId]);

  const handleSave = async () => {
    if (!supplier) {
      Alert.alert('Select supplier', 'Please choose a supplier.');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Enter amount', 'Please enter a valid amount.');
      return;
    }
    if (!account) {
      Alert.alert('Select account', 'Please choose an account.');
      return;
    }

    setLoading(true);
    try {
      const payment = {
        id: paymentId || generateId(),
        supplierId: supplier.id,
        supplierName: supplier.displayName,
        accountId: account.id,
        accountName: account.name,
        amount: parseFloat(amount),
        date,
        reference: reference.trim(),
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      };

      const updated = { ...biz };

      if (editing) {
        updated.payments = biz.payments.map(p =>
          p.id === paymentId ? payment : p
        );
      } else {
        updated.payments = [...(biz.payments || []), payment];
      }

      // Update bank account balance (payment reduces balance)
      const oldAmount = editing
        ? biz.payments?.find(p => p.id === paymentId)?.amount || 0
        : 0;
      const diff = parseFloat(amount) - oldAmount;

      updated.bankAccounts = biz.bankAccounts.map(a =>
        a.id === account.id
          ? { ...a, balance: (a.balance || 0) - diff }
          : a
      );

      await saveBusiness(updated);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save payment.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Payment', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const existing = biz.payments?.find(p => p.id === paymentId);
          const updated = {
            ...biz,
            payments: biz.payments.filter(p => p.id !== paymentId),
            bankAccounts: biz.bankAccounts.map(a =>
              a.id === existing?.accountId
                ? { ...a, balance: (a.balance || 0) + (existing?.amount || 0) }
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
          {editing ? 'Edit Payment' : 'New Payment'}
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
        <Text style={styles.label}>Pay to *</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowSupplierPicker(true)}
        >
          <Text style={supplier ? styles.pickerValue : styles.pickerPlaceholder}>
            {supplier ? supplier.displayName : 'Select supplier...'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.label}>Amount *</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Pay from account *</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowAccountPicker(true)}
        >
          <Text style={account ? styles.pickerValue : styles.pickerPlaceholder}>
            {account ? account.name : 'Select account...'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
        />

        <Text style={styles.label}>Reference / Cheque no.</Text>
        <TextInput
          style={styles.input}
          value={reference}
          onChangeText={setReference}
          placeholder="Optional"
          placeholderTextColor={colors.textTertiary}
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          placeholderTextColor={colors.textTertiary}
          multiline
        />

        {supplier && amount && account && (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Payment summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>To</Text>
              <Text style={styles.summaryValue}>{supplier.displayName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>From</Text>
              <Text style={styles.summaryValue}>{account.name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={[styles.summaryValue, { color: '#EF4444', fontSize: 18 }]}>
                {biz.meta?.currency} {parseFloat(amount || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {editing && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.deleteBtnText}>Delete Payment</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={showSupplierPicker} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Supplier</Text>
            <TouchableOpacity onPress={() => setShowSupplierPicker(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={biz.suppliers || []}
            keyExtractor={s => s.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setSupplier(item);
                  setShowSupplierPicker(false);
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
                No suppliers. Add one from Purchases → Suppliers.
              </Text>
            }
          />
        </SafeAreaView>
      </Modal>

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
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    gap: 8,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 13, color: '#991B1B' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#991B1B' },
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