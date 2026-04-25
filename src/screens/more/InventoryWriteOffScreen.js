import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ScrollView, Alert, ActivityIndicator,
  StatusBar, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, saveBusiness, generateId } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';


 // Calculate weighted average cost for this item from its full purchase history
const getWeightedAvgCost = (item, biz) => {
  let runningQty   = item.openingStock || 0;
  let runningValue = runningQty * (item.openingStockRate || item.costPrice || 0);

  // Add all purchase invoices
  (biz.purchaseInvoices || []).forEach(inv => {
    (inv.lines || []).forEach(line => {
      const match =
        line.description?.toLowerCase().trim() ===
          item.name?.toLowerCase().trim() ||
        line.itemId === item.id;
      if (!match) return;
      const qty  = parseFloat(line.qty)  || 0;
      const rate = parseFloat(line.rate) || 0;
      if (qty <= 0) return;
      runningQty   += qty;
      runningValue += qty * rate;
    });
  });

  // Add journal inventory cost adjustments (no qty — pure cost additions)
  (biz.journalEntries || []).forEach(je => {
    (je.lines || []).forEach(line => {
      if (line.accountCategory !== 'inventory') return;
      if (line.accountId !== item.id) return;
      const qty   = parseFloat(line.qty) || 0;
      const debit = line.debit || 0;
      if (qty === 0 && debit > 0) {
        // Cost adjustment only — adds to value without qty
        runningValue += debit;
      }
    });
  });

  return runningQty > 0 ? runningValue / runningQty : (item.costPrice || 0);
};

export default function InventoryWriteOffScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);
  const insets = useSafeAreaInsets();

  const [showForm, setShowForm] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const writeOffs = (biz?.inventoryWriteOffs || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const cur = biz?.meta?.currency || 'PKR';
  const writeOffAmount = selectedItem && biz
  ? (parseFloat(qty) || 0) * getWeightedAvgCost(selectedItem, biz)
  : 0;

  const openForm = () => {
    setSelectedItem(null);
    setQty('');
    setReason('');
    setDate(new Date().toISOString().split('T')[0]);
    setShowForm(true);
  };
  
 

  const handleSave = async () => {
    if (!selectedItem) {
      Alert.alert('Select item', 'Please select an inventory item.');
      return;
    }
    const qtyNum = parseFloat(qty);
    if (!qtyNum || qtyNum <= 0) {
      Alert.alert('Invalid quantity', 'Please enter a valid quantity.');
      return;
    }
    if (qtyNum > (selectedItem.stock || 0)) {
      Alert.alert(
        'Insufficient stock',
        `Only ${selectedItem.stock} units available.`
      );
      return;
    }
    setSaving(true);
    try {
      const avgCost = getWeightedAvgCost(selectedItem, biz);
      const amount  = Math.round(qtyNum * avgCost * 100) / 100;
      const writeOff = {
         id: generateId(),
         itemId: selectedItem.id,
         itemName: selectedItem.name,
         qty: qtyNum,
         costPrice: avgCost,   // store the actual avg cost used, not item.costPrice
         amount,
        reason: reason.trim(),
        date,
        createdAt: new Date().toISOString(),
      };

      const updated = { ...biz };
      updated.items = biz.items.map(i =>
        i.id === selectedItem.id
          ? { ...i, stock: (i.stock || 0) - qtyNum }
          : i
      );
      updated.inventoryWriteOffs = [...(biz.inventoryWriteOffs || []), writeOff];

      const expenseAccount = (biz.expenseAccounts || []).find(a => a.code === '7100');
      const txn = {
        id: generateId(),
        transactionType: 'payment',
        partyType: null,
        partyId: null,
        partyName: null,
        accountId: null,
        accountName: null,
        expenseAccountId: expenseAccount?.id || 'exp-13',
        expenseAccountName: 'Inventory Write-off Loss',
        linkedInvoiceId: null,
        amount,
        date,
        reference: `Write-off: ${selectedItem.name} x${qtyNum}`,
        notes: reason.trim(),
        createdAt: new Date().toISOString(),
        isWriteOff: true,
      };
      updated.transactions = [...(biz.transactions || []), txn];

      await saveBusiness(updated);
      setBiz(updated);
      setShowForm(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save write-off.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (writeOff) => {
    Alert.alert(
      'Reverse Write-off',
      'This will restore the stock and reverse the expense.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reverse',
          style: 'destructive',
          onPress: async () => {
            const updated = { ...biz };
            updated.items = biz.items.map(i =>
              i.id === writeOff.itemId
                ? { ...i, stock: (i.stock || 0) + writeOff.qty }
                : i
            );
            updated.inventoryWriteOffs = biz.inventoryWriteOffs.filter(
              w => w.id !== writeOff.id
            );
            updated.transactions = (biz.transactions || []).filter(
              t => !(t.isWriteOff && t.reference?.includes(writeOff.itemName))
            );
            await saveBusiness(updated);
            setBiz(updated);
          },
        },
      ]
    );
  };

  const modalPadding = {
    paddingTop: insets.top + 8,
    paddingBottom: insets.bottom + 8,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Inventory Write-offs</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={writeOffs}
        keyExtractor={w => w.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="alert-circle-outline" size={52} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No write-offs yet</Text>
            <Text style={styles.emptySub}>Record damaged or lost inventory</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardIcon}>
                <Ionicons name="alert-circle-outline" size={22} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.itemName}</Text>
                <Text style={styles.cardSub}>
                  Qty: {item.qty} · {new Date(item.date).toLocaleDateString()}
                </Text>
                {item.reason ? (
                  <Text style={styles.cardRef}>Reason: {item.reason}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardAmount}>
                  {cur} {(item.amount || 0).toLocaleString()}
                </Text>
                <Text style={styles.cardAmountSub}>Loss</Text>
              </View>
            </View>
            <View style={styles.journalEntry}>
              <View style={styles.journalRow}>
                <View style={styles.drBadge}>
                  <Text style={styles.drText}>DR</Text>
                </View>
                <Text style={styles.journalAcc}>Write-off Loss</Text>
                <Text style={styles.journalAmt}>
                  {cur} {(item.amount || 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.journalRow}>
                <View style={styles.crBadge}>
                  <Text style={styles.crText}>CR</Text>
                </View>
                <Text style={styles.journalAcc}>Inventory — {item.itemName}</Text>
                <Text style={styles.journalAmt}>
                  {cur} {(item.amount || 0).toLocaleString()}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.reverseBtn}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="refresh-outline" size={15} color="#EF4444" />
              <Text style={styles.reverseBtnText}>Reverse Write-off</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={openForm}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* ── WRITE-OFF FORM MODAL ── */}
      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top || 44 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowForm(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Record Write-off</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
            <Text style={styles.label}>Inventory item *</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => {
                setShowForm(false);
                setTimeout(() => setShowItemPicker(true), 400);
              }}
            >
              <View style={{ flex: 1 }}>
                {selectedItem ? (
                  <>
                    <Text style={styles.pickerValue}>{selectedItem.name}</Text>
                    <Text style={styles.pickerSub}>
                      Stock: {selectedItem.stock || 0} units ·
                      Cost: {cur} {(selectedItem.costPrice || 0).toLocaleString()}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.pickerPlaceholder}>
                    Tap to select item...
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>

            <Text style={styles.label}>Quantity *</Text>
            <TextInput
              style={styles.input}
              value={qty}
              onChangeText={setQty}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            {selectedItem && qty && parseFloat(qty) > 0 && (
              <Text style={styles.hint}>
                Remaining stock after write-off:{' '}
                <Text style={{ fontWeight: '700' }}>
                  {Math.max(0, (selectedItem.stock || 0) - (parseFloat(qty) || 0))} units
                </Text>
              </Text>
            )}

            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.label}>Reason</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Damaged, Expired, Lost..."
              placeholderTextColor={colors.textTertiary}
              multiline
            />

            {selectedItem && writeOffAmount > 0 && (
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>Journal entry preview</Text>
                <View style={styles.journalRow}>
                  <View style={styles.drBadge}>
                    <Text style={styles.drText}>DR</Text>
                  </View>
                  <Text style={styles.journalAcc}>Inventory Write-off Loss</Text>
                  <Text style={styles.journalAmt}>
                    {cur} {writeOffAmount.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.journalRow}>
                  <View style={styles.crBadge}>
                    <Text style={styles.crText}>CR</Text>
                  </View>
                  <Text style={styles.journalAcc}>
                    Inventory — {selectedItem.name}
                  </Text>
                  <Text style={styles.journalAmt}>
                    {cur} {writeOffAmount.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── ITEM PICKER MODAL ── */}
      <Modal
        visible={showItemPicker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top || 44 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowItemPicker(false);
                setTimeout(() => setShowForm(true), 400);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Item</Text>
            <View style={{ width: 22 }} />
          </View>

          <FlatList
            data={(biz?.items || []).filter(i => (i.stock || 0) > 0)}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setSelectedItem(item);
                  setShowItemPicker(false);
                  setTimeout(() => setShowForm(true), 400);
                }}
              >
                <View style={styles.modalItemIcon}>
                  <Ionicons name="cube-outline" size={20} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalItemName}>{item.name}</Text>
                  <Text style={styles.modalItemSub}>
                    Stock: {item.stock || 0} units ·
                    Cost price: {cur} {(item.costPrice || 0).toLocaleString()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="cube-outline" size={44} color={colors.textTertiary} />
                <Text style={styles.emptyTitle}>No items with stock</Text>
                <Text style={styles.emptySub}>
                  Add items from More → Inventory Items first.
                </Text>
              </View>
            }
          />
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
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  list: { padding: 12, gap: 10, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  cardIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardRef: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  cardAmount: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  cardAmountSub: { fontSize: 11, color: colors.textTertiary },
  journalEntry: {
    backgroundColor: colors.background, borderRadius: 10,
    padding: 10, gap: 6, marginBottom: 10,
  },
  journalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  drBadge: {
    backgroundColor: '#FEE2E2', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  drText: { fontSize: 10, fontWeight: '700', color: '#DC2626' },
  crBadge: {
    backgroundColor: '#DCFCE7', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  crText: { fontSize: 10, fontWeight: '700', color: '#16A34A' },
  journalAcc: { flex: 1, fontSize: 12, color: colors.textSecondary },
  journalAmt: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  reverseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#FECACA',
  },
  reverseBtnText: { fontSize: 13, fontWeight: '600', color: '#EF4444' },
  emptyBox: { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 28, right: 20,
    backgroundColor: '#EF4444', width: 58, height: 58, borderRadius: 29,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#EF4444', shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  // Modal styles — using plain View not SafeAreaView inside modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
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
  hint: { fontSize: 12, color: colors.textTertiary, marginTop: 4 },
  picker: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 11,
    paddingHorizontal: 14, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center',
  },
  pickerValue: { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  pickerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  pickerPlaceholder: { fontSize: 15, color: colors.textTertiary },
  previewBox: {
    backgroundColor: colors.background, borderRadius: 12,
    padding: 14, marginTop: 20, gap: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  previewTitle: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  modalItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12,
  },
  modalItemIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
  },
  modalItemName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  modalItemSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});