import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, saveBusiness, generateId } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

const INCOME_GROUPS = ['Revenue', 'Other Income'];
const EXPENSE_GROUPS = [
  'Cost of Sales',
  'Operating Expenses',
  'Administrative Expenses',
  'Financial Expenses',
];

const TABS = [
  { id: 'income', label: 'Income', color: '#10B981', bg: '#ECFDF5', icon: 'trending-up-outline' },
  { id: 'expense', label: 'Expenses', color: '#EF4444', bg: '#FEF2F2', icon: 'trending-down-outline' },
];

export default function AccountsManagerScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const insets = useSafeAreaInsets();
  const [biz, setBiz] = useState(null);
  const [activeTab, setActiveTab] = useState('income');
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [saving, setSaving] = useState(false);

  const [accName, setAccName] = useState('');
  const [accCode, setAccCode] = useState('');
  const [accGroup, setAccGroup] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const incomeAccounts = biz?.incomeAccounts || [];
  const expenseAccounts = biz?.expenseAccounts || [];
  const currentList = activeTab === 'income' ? incomeAccounts : expenseAccounts;
  const currentTab = TABS.find(t => t.id === activeTab);
  const groups = activeTab === 'income' ? INCOME_GROUPS : EXPENSE_GROUPS;

  const openCreate = () => {
    setEditingAccount(null);
    setAccName('');
    setAccCode('');
    setAccGroup(groups[0]);
    setShowForm(true);
  };

  const openEdit = (account) => {
    setEditingAccount(account);
    setAccName(account.name);
    setAccCode(account.code || '');
    setAccGroup(account.group || groups[0]);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!accName.trim()) {
      Alert.alert('Required', 'Please enter account name.');
      return;
    }
    setSaving(true);
    try {
      const account = {
        id: editingAccount?.id || generateId(),
        name: accName.trim(),
        code: accCode.trim(),
        type: activeTab,
        group: accGroup,
        isDefault: editingAccount?.isDefault || false,
      };
      const updated = { ...biz };
      if (activeTab === 'income') {
        updated.incomeAccounts = editingAccount
          ? biz.incomeAccounts.map(a => a.id === editingAccount.id ? account : a)
          : [...incomeAccounts, account];
      } else {
        updated.expenseAccounts = editingAccount
          ? biz.expenseAccounts.map(a => a.id === editingAccount.id ? account : a)
          : [...expenseAccounts, account];
      }
      await saveBusiness(updated);
      setBiz(updated);
      setShowForm(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save account.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (editingAccount?.isDefault) {
      Alert.alert('Cannot delete', 'Default accounts cannot be deleted, but you can rename them.');
      return;
    }
    Alert.alert('Delete Account', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const updated = { ...biz };
          if (activeTab === 'income') {
            updated.incomeAccounts = biz.incomeAccounts.filter(a => a.id !== editingAccount.id);
          } else {
            updated.expenseAccounts = biz.expenseAccounts.filter(a => a.id !== editingAccount.id);
          }
          await saveBusiness(updated);
          setBiz(updated);
          setShowForm(false);
        },
      },
    ]);
  };

  const grouped = currentList.reduce((acc, item) => {
    const g = item.group || 'Other';
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Income & Expense Accounts</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && { backgroundColor: tab.bg, borderColor: tab.color },
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.id ? tab.color : colors.textTertiary}
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.id && { color: tab.color, fontWeight: '700' },
            ]}>
              {tab.label}
            </Text>
            <View style={[
              styles.tabCount,
              activeTab === tab.id && { backgroundColor: tab.color },
            ]}>
              <Text style={[
                styles.tabCountText,
                activeTab === tab.id && { color: '#fff' },
              ]}>
                {tab.id === 'income' ? incomeAccounts.length : expenseAccounts.length}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {Object.entries(grouped).map(([group, accounts]) => (
          <View key={group} style={styles.group}>
            <Text style={styles.groupLabel}>{group}</Text>
            <View style={styles.groupCard}>
              {accounts.map((account, idx) => (
                <TouchableOpacity
                  key={account.id}
                  style={[
                    styles.accountRow,
                    idx < accounts.length - 1 && styles.accountRowBorder,
                  ]}
                  onPress={() => openEdit(account)}
                >
                  <View style={[styles.accountIcon, { backgroundColor: currentTab?.bg }]}>
                    <Ionicons
                      name={activeTab === 'income' ? 'trending-up-outline' : 'trending-down-outline'}
                      size={16}
                      color={currentTab?.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountName}>{account.name}</Text>
                    {account.code ? (
                      <Text style={styles.accountCode}>Code: {account.code}</Text>
                    ) : null}
                  </View>
                  {account.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        {currentList.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons
              name={activeTab === 'income' ? 'trending-up-outline' : 'trending-down-outline'}
              size={48}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyTitle}>No {activeTab} accounts</Text>
            <Text style={styles.emptySub}>Tap + to create one</Text>
          </View>
        )}
      </ScrollView>

      {/* Form Modal — plain View with insets, NOT SafeAreaView */}
      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top || 44 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowForm(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingAccount
                ? 'Edit Account'
                : `New ${activeTab === 'income' ? 'Income' : 'Expense'} Account`}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
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
              placeholder={activeTab === 'income'
                ? 'e.g. Rental Income'
                : 'e.g. Office Supplies'}
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />

            <Text style={styles.label}>Account code</Text>
            <TextInput
              style={styles.input}
              value={accCode}
              onChangeText={setAccCode}
              placeholder="e.g. 4500"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Group / Category</Text>
            <View style={styles.groupPicker}>
              {groups.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.groupBtn,
                    accGroup === g && {
                      borderColor: currentTab?.color,
                      backgroundColor: currentTab?.bg,
                    },
                  ]}
                  onPress={() => setAccGroup(g)}
                >
                  <Text style={[
                    styles.groupBtnText,
                    accGroup === g && { color: currentTab?.color, fontWeight: '700' },
                  ]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {editingAccount && (
              <TouchableOpacity
                style={[styles.deleteBtn, editingAccount?.isDefault && { opacity: 0.4 }]}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={styles.deleteBtnText}>
                  {editingAccount?.isDefault
                    ? 'Cannot delete default account'
                    : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>
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
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  tabRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12,
    gap: 10, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
  },
  tabText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  tabCount: {
    backgroundColor: colors.border, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  tabCountText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  list: { padding: 16, paddingBottom: 48 },
  group: { marginBottom: 20 },
  groupLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, marginLeft: 4,
  },
  groupCard: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  accountRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
  },
  accountRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  accountIcon: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  accountName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  accountCode: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  defaultBadge: {
    backgroundColor: colors.primaryLight, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2, marginRight: 4,
  },
  defaultBadgeText: { fontSize: 10, color: colors.primary, fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: 13, color: colors.textTertiary },

  // Modal uses plain View, NOT SafeAreaView
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  saveText: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  formContent: { padding: 16, paddingBottom: 48 },
  label: {
    fontSize: 12, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8, marginTop: 20,
  },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 11,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: colors.textPrimary,
  },
  groupPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 9, borderWidth: 1.5, borderColor: colors.border,
  },
  groupBtnText: { fontSize: 13, color: colors.textSecondary },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderColor: colors.danger,
    borderRadius: 12, paddingVertical: 14, marginTop: 36,
  },
  deleteBtnText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});