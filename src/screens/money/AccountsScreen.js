import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Modal, TextInput,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, saveBusiness, generateId } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

const ACCOUNT_TYPES = [
  { id: 'cash', label: 'Cash', icon: 'cash-outline', color: '#10B981', bg: '#ECFDF5' },
  { id: 'bank', label: 'Bank', icon: 'business-outline', color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'mobile', label: 'Mobile Wallet', icon: 'phone-portrait-outline', color: '#8B5CF6', bg: '#F5F3FF' },
];

export default function AccountsScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('cash');
  const [openingBalance, setOpeningBalance] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const accounts = biz?.bankAccounts || [];
  const cur = biz?.meta?.currency || 'PKR';
  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);

  const openCreateForm = () => {
    setEditingAccount(null);
    setAccName('');
    setAccType('cash');
    setOpeningBalance('');
    setShowForm(true);
  };

  const openEditForm = (account) => {
    setEditingAccount(account);
    setAccName(account.name);
    setAccType(account.type);
    setOpeningBalance(account.openingBalance?.toString() || '0');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!accName.trim()) {
      Alert.alert('Required', 'Please enter account name.');
      return;
    }
    setSaving(true);
    try {
      const ob = parseFloat(openingBalance) || 0;

      if (editingAccount) {
        // Editing — recalculate balance
        // balance = openingBalance + all receipts - all payments for this account
        const receiptsTotal = (biz.receipts || [])
          .filter(r => r.accountId === editingAccount.id)
          .reduce((s, r) => s + (r.amount || 0), 0);
        const paymentsTotal = (biz.payments || [])
          .filter(p => p.accountId === editingAccount.id)
          .reduce((s, p) => s + (p.amount || 0), 0);
        const newBalance = ob + receiptsTotal - paymentsTotal;

        const updated = {
          ...biz,
          bankAccounts: biz.bankAccounts.map(a =>
            a.id === editingAccount.id
              ? {
                  ...a,
                  name: accName.trim(),
                  type: accType,
                  openingBalance: ob,
                  balance: newBalance,
                }
              : a
          ),
        };
        await saveBusiness(updated);
      } else {
        // New account
        const newAccount = {
          id: generateId(),
          name: accName.trim(),
          type: accType,
          openingBalance: ob,
          balance: ob,
        };
        const updated = {
          ...biz,
          bankAccounts: [...accounts, newAccount],
        };
        await saveBusiness(updated);
      }
      setShowForm(false);
      loadBusiness(businessId).then(setBiz);
    } catch (e) {
      Alert.alert('Error', 'Could not save account.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Account',
      'This will delete the account. Transactions linked to it will remain but won\'t affect this account balance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = {
              ...biz,
              bankAccounts: biz.bankAccounts.filter(
                a => a.id !== editingAccount.id
              ),
            };
            await saveBusiness(updated);
            setShowForm(false);
            loadBusiness(businessId).then(setBiz);
          },
        },
      ]
    );
  };

  const getTypeInfo = (type) =>
    ACCOUNT_TYPES.find(t => t.id === type) || ACCOUNT_TYPES[0];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Bank & Cash Accounts</Text>
        <TouchableOpacity onPress={openCreateForm}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total balance</Text>
        <Text style={styles.totalValue}>
          {cur} {totalBalance.toLocaleString()}
        </Text>
        <Text style={styles.totalSub}>{accounts.length} account{accounts.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="wallet-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No accounts yet</Text>
            <Text style={styles.emptySub}>Tap + to add a cash or bank account</Text>
          </View>
        }
        renderItem={({ item }) => {
          const typeInfo = getTypeInfo(item.type);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('AccountLedger', {
                  businessId,
                  accountId: item.id,
                })
              }
            >
              <View style={[styles.accountIcon, { backgroundColor: typeInfo.bg }]}>
                <Ionicons name={typeInfo.icon} size={22} color={typeInfo.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountName}>{item.name}</Text>
                <Text style={styles.accountType}>{typeInfo.label}</Text>
                {item.openingBalance > 0 && (
                  <Text style={styles.accountOB}>
                    Opening: {cur} {(item.openingBalance || 0).toLocaleString()}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[
                  styles.accountBalance,
                  { color: (item.balance || 0) >= 0 ? '#10B981' : '#EF4444' },
                ]}>
                  {cur} {(item.balance || 0).toLocaleString()}
                </Text>
                <TouchableOpacity onPress={() => openEditForm(item)}>
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Create / Edit Account Modal */}
      <Modal visible={showForm} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingAccount ? 'Edit Account' : 'New Account'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={styles.saveText}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Account name *</Text>
            <TextInput
              style={styles.input}
              value={accName}
              onChangeText={setAccName}
              placeholder="e.g. HBL Current Account"
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />

            <Text style={styles.label}>Account type</Text>
            <View style={styles.typeRow}>
              {ACCOUNT_TYPES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.typeBtn,
                    accType === t.id && {
                      borderColor: t.color,
                      backgroundColor: t.bg,
                    },
                  ]}
                  onPress={() => setAccType(t.id)}
                >
                  <Ionicons
                    name={t.icon}
                    size={20}
                    color={accType === t.id ? t.color : colors.textSecondary}
                  />
                  <Text style={[
                    styles.typeBtnText,
                    accType === t.id && { color: t.color, fontWeight: '700' },
                  ]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Opening balance</Text>
            <TextInput
              style={styles.input}
              value={openingBalance}
              onChangeText={setOpeningBalance}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            <Text style={styles.hint}>
              Enter the balance already in this account before you started using SmartBiz.
            </Text>

            {editingAccount && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={styles.deleteBtnText}>Delete Account</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  totalCard: {
    backgroundColor: colors.primary,
    margin: 16,
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    gap: 4,
  },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  totalValue: { fontSize: 30, fontWeight: '700', color: '#fff' },
  totalSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  list: { paddingHorizontal: 16, gap: 8, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  accountIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  accountType: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  accountOB: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  accountBalance: { fontSize: 16, fontWeight: '700' },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  saveText: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  formContent: { padding: 16, paddingBottom: 48 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.textPrimary,
  },
  hint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 6,
    lineHeight: 18,
  },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  typeBtnText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 36,
  },
  deleteBtnText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});