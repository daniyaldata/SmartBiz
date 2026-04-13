import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  loadBusiness, saveBusiness, generateId,
  applyPurchaseInvoiceToInventory,
  reversePurchaseInvoiceFromInventory,
} from '../../data/BusinessStore';
import ModalSheet from '../../components/ModalSheet';
import DateField from '../../components/DateField';
import { colors } from '../../theme/colors';

export default function PurchaseInvoiceFormScreen({ route, navigation }) {
  const { businessId, invoiceId } = route?.params || {};
  const [biz, setBiz] = useState(null);
  const [loading, setLoading] = useState(false);

  const [supplier, setSupplier] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([
    { id: generateId(), description: '', qty: '1', rate: '' },
  ]);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [activeLineId, setActiveLineId] = useState(null);

  const editing = !!invoiceId;

  useEffect(() => {
    loadBusiness(businessId).then(b => {
      setBiz(b);
      if (invoiceId) {
        const inv = b?.purchaseInvoices?.find(i => i.id === invoiceId);
        if (inv) {
          setSupplier(b.suppliers?.find(s => s.id === inv.supplierId) || null);
          setDate(inv.date || '');
          setDueDate(inv.dueDate || '');
          setNotes(inv.notes || '');
          setLines(inv.lines?.length
            ? inv.lines
            : [{ id: generateId(), description: '', qty: '1', rate: '' }]
          );
        }
      }
    });
  }, [businessId, invoiceId]);

  const total = lines.reduce((sum, l) =>
    sum + (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0), 0
  );

  const updateLine = (id, field, value) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));

  const addLine = () =>
    setLines(prev => [...prev, { id: generateId(), description: '', qty: '1', rate: '' }]);

  const removeLine = (id) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const handleSave = async () => {
    if (!supplier) {
      Alert.alert('Select supplier', 'Please choose a supplier.');
      return;
    }
    if (lines.some(l => !l.description.trim())) {
      Alert.alert('Incomplete', 'Please fill all item descriptions.');
      return;
    }
    setLoading(true);
    try {
      const existing = invoiceId
        ? biz.purchaseInvoices?.find(i => i.id === invoiceId)
        : null;
      const invoice = {
        id: invoiceId || generateId(),
        number: existing?.number ||
          String((biz.purchaseInvoices?.length || 0) + 1).padStart(4, '0'),
        supplierId: supplier.id,
        supplierName: supplier.displayName,
        lines,
        total,
        amountPaid: existing?.amountPaid || 0,
        date,
        dueDate,
        notes,
        createdAt: existing?.createdAt || new Date().toISOString(),
      };

      const updated = { ...biz };
      if (invoiceId) {
        const oldInvoice = biz.purchaseInvoices?.find(i => i.id === invoiceId);
        updated.purchaseInvoices = biz.purchaseInvoices.map(i =>
    i.id === invoiceId ? invoice : i
        );
        updated.items = applyPurchaseInvoiceToInventory(updated, invoice, oldInvoice);
      } else {
        updated.purchaseInvoices = [...(biz.purchaseInvoices || []), invoice];
        updated.items = applyPurchaseInvoiceToInventory(updated, invoice);
      }
      await saveBusiness(updated);

      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save invoice.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Invoice', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const invoiceToDelete = biz.purchaseInvoices?.find(i => i.id === invoiceId);
          const updated = {
            ...biz,
            purchaseInvoices: biz.purchaseInvoices.filter(i => i.id !== invoiceId),
            items: invoiceToDelete
              ? reversePurchaseInvoiceFromInventory(biz, invoiceToDelete)
              : biz.items,
          };
          await saveBusiness(updated);
          
          navigation.goBack();
        },
      },
    ]);
  };

  if (!biz) return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editing ? 'Edit Purchase' : 'New Purchase'}
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
        <Text style={styles.label}>Supplier *</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowSupplierPicker(true)}
        >
          <Text style={supplier ? styles.pickerValue : styles.pickerPlaceholder}>
            {supplier ? supplier.displayName : 'Select a supplier...'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <DateField
          label="Date"
          value={date}
          onChange={setDate}
          dateFormat={biz?.settings?.dateFormat}
        />
        <DateField
          label="Due date"
          value={dueDate}
          onChange={setDueDate}
          dateFormat={biz?.settings?.dateFormat}
          optional
        />

        <Text style={styles.label}>Items</Text>
        {lines.map((line, idx) => (
          <View key={line.id} style={styles.lineCard}>
            <View style={styles.lineTop}>
              <Text style={styles.lineNum}>Item {idx + 1}</Text>
              <TouchableOpacity onPress={() => {
                setActiveLineId(line.id);
                setShowItemPicker(true);
              }}>
                <Text style={styles.pickItemBtn}>Pick from inventory</Text>
              </TouchableOpacity>
              {lines.length > 1 && (
                <TouchableOpacity onPress={() => removeLine(line.id)}>
                  <Ionicons name="trash-outline" size={17} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Description *"
              placeholderTextColor={colors.textTertiary}
              value={line.description}
              onChangeText={v => updateLine(line.id, 'description', v)}
            />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  placeholder="Qty"
                  placeholderTextColor={colors.textTertiary}
                  value={line.qty}
                  onChangeText={v => updateLine(line.id, 'qty', v)}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 2 }}>
                <TextInput
                  style={styles.input}
                  placeholder="Rate"
                  placeholderTextColor={colors.textTertiary}
                  value={line.rate}
                  onChangeText={v => updateLine(line.id, 'rate', v)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.lineTotalWrap}>
                <Text style={styles.lineTotalText}>
                  {(
                    (parseFloat(line.qty) || 0) * (parseFloat(line.rate) || 0)
                  ).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addLineBtn} onPress={addLine}>
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addLineText}>Add another item</Text>
        </TouchableOpacity>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={[styles.totalValue, { color: '#EF4444' }]}>
            {biz.meta?.currency} {total.toLocaleString()}
          </Text>
        </View>

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          placeholder="Optional notes..."
          placeholderTextColor={colors.textTertiary}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {editing && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.deleteBtnText}>Delete Invoice</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <ModalSheet
        visible={showSupplierPicker}
        onClose={() => setShowSupplierPicker(false)}
        title="Select Supplier"
      >
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
      </ModalSheet>

      <ModalSheet
        visible={showItemPicker}
        onClose={() => setShowItemPicker(false)}
        title="Select Item"
      >
        <FlatList
          data={biz.items || []}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.modalItem}
              onPress={() => {
                updateLine(activeLineId, 'description', item.name);
                updateLine(activeLineId, 'rate', item.costPrice?.toString() || '');
                setShowItemPicker(false);
                setActiveLineId(null);
              }}
            >
              <View style={styles.modalItemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalItemName}>{item.name}</Text>
                  <Text style={styles.modalItemSub}>
                    Cost price: {biz.meta?.currency}{' '}
                    {(item.costPrice || 0).toLocaleString()}
                  </Text>
                </View>
                {item.stock !== undefined && (
                  <View style={styles.stockBadge}>
                    <Text style={styles.stockText}>Stock: {item.stock}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.modalEmpty}>
              No items. Add from More → Inventory Items.
            </Text>
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
  form: { padding: 16, paddingBottom: 48 },
  label: {
    fontSize: 12, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 7, marginTop: 16,
  },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 11,
    paddingHorizontal: 13, paddingVertical: 11,
    fontSize: 15, color: colors.textPrimary, marginBottom: 8,
  },
  picker: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 11,
    paddingHorizontal: 13, paddingVertical: 13,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  pickerValue: { fontSize: 15, color: colors.textPrimary },
  pickerPlaceholder: { fontSize: 15, color: colors.textTertiary },
  row2: { flexDirection: 'row', gap: 8 },
  lineCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 12, marginBottom: 10, backgroundColor: colors.background,
  },
  lineTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  lineNum: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  pickItemBtn: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  lineTotalWrap: { flex: 1, justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 8 },
  lineTotalText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  addLineBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 12,
  },
  addLineText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1.5, borderTopColor: colors.border,
    paddingTop: 16, marginTop: 4, marginBottom: 16,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  totalValue: { fontSize: 22, fontWeight: '700' },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderColor: colors.danger,
    borderRadius: 12, paddingVertical: 14, marginTop: 24,
  },
  deleteBtnText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  modalItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalItemRow: { flexDirection: 'row', alignItems: 'center' },
  modalItemName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  modalItemSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  stockBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  stockText: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  modalEmpty: {
    textAlign: 'center', color: colors.textTertiary,
    padding: 40, fontSize: 14, lineHeight: 22,
  },
});