import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  loadBusiness, saveBusiness, generateId,
  applyPurchaseInvoiceToInventory,
  reversePurchaseInvoiceFromInventory,
} from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

export default function ItemFormScreen({ route, navigation }) {
  const { businessId, itemId } = route?.params || {};
  const [biz, setBiz]         = useState(null);
  const [loading, setLoading] = useState(false);

  // Basic item info
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit]               = useState('');
  const [sku, setSku]                 = useState('');

  // Pricing — user-set defaults, never auto-changed
  const [salePrice, setSalePrice]         = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');

  // Opening stock — treated as the first purchase
  const [openingQty, setOpeningQty]       = useState('');
  const [openingRate, setOpeningRate]     = useState('');

  const editing = !!itemId;

  useEffect(() => {
    loadBusiness(businessId).then(b => {
      setBiz(b);
      if (itemId) {
        const item = b?.items?.find(i => i.id === itemId);
        if (item) {
          setName(item.name || '');
          setDescription(item.description || '');
          setUnit(item.unit || '');
          setSku(item.sku || '');
          setSalePrice(item.salePrice?.toString() || '');
          // purchasePrice = user-set default rate (renamed from costPrice)
          setPurchasePrice(item.purchasePrice?.toString() ||
            item.costPrice?.toString() || '');
          setOpeningQty(item.openingStock?.toString() || '');
          setOpeningRate(item.openingStockRate?.toString() ||
            item.costPrice?.toString() || '');
        }
      }
    });
  }, [businessId, itemId]);

  const openingValue = (parseFloat(openingQty) || 0) *
    (parseFloat(openingRate) || 0);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter an item name.');
      return;
    }

    const parsedPurchasePrice = parseFloat(purchasePrice) || 0;
    const parsedSalePrice     = parseFloat(salePrice) || 0;
    const parsedOpeningQty    = parseFloat(openingQty) || 0;
    const parsedOpeningRate   = parseFloat(openingRate) || 0;

    setLoading(true);
    try {
      const existing = itemId
        ? biz.items?.find(i => i.id === itemId)
        : null;

      // Calculate stock:
      // For new items: stock = opening qty
      // For edits: preserve movements (purchases/sales after creation)
      //   by taking (current stock - old opening stock) + new opening stock
      let newStock;
      if (existing) {
        const oldOpeningQty = existing.openingStock || 0;
        const movements     = (existing.stock || 0) - oldOpeningQty;
        newStock = parsedOpeningQty + movements;
      } else {
        newStock = parsedOpeningQty;
      }

      const item = {
        id:               itemId || generateId(),
        name:             name.trim(),
        description:      description.trim(),
        unit:             unit.trim(),
        sku:              sku.trim(),
        salePrice:        parsedSalePrice,
        // purchasePrice = user's default purchase rate for pre-filling invoices
        // This NEVER changes automatically — only when user edits this form
        purchasePrice:    parsedPurchasePrice,
        // Keep costPrice as alias for backwards compatibility
        // with any existing code that reads it
        costPrice:        parsedPurchasePrice,
        // Opening stock fields — treated as first purchase entry
        openingStock:     parsedOpeningQty,
        openingStockRate: parsedOpeningRate,
        openingStockValue:openingValue,
        // stock = authoritative current count
        // Updated by: purchase invoices (+), sales invoices (-), write-offs (-)
        stock:            Math.max(
          existing
            ? -(existing.stock || 0 - newStock) // allow negative from oversell
            : 0,
          newStock
        ),
        createdAt:        existing?.createdAt || new Date().toISOString(),
      };

      // For new items, set stock directly
      if (!existing) {
        item.stock = parsedOpeningQty;
      }

      const updated = { ...biz };
      if (itemId) {
        updated.items = biz.items.map(i => i.id === itemId ? item : i);
      } else {
        updated.items = [...(biz.items || []), item];
      }

      await saveBusiness(updated);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save item: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      'This will remove the item from your inventory. Existing invoice records will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const updated = {
              ...biz,
              items: biz.items.filter(i => i.id !== itemId),
            };
            await saveBusiness(updated);
            navigation.goBack();
          },
        },
      ]
    );
  };

  if (!biz) return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );

  const existingItem = itemId ? biz.items?.find(i => i.id === itemId) : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editing ? 'Edit Item' : 'New Item'}
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

        {/* Item details */}
        <Text style={styles.sectionLabel}>Item details</Text>
        <Text style={styles.label}>Item name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Basmati Rice"
          placeholderTextColor={colors.textTertiary}
          autoFocus
        />
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="Optional"
          placeholderTextColor={colors.textTertiary}
        />
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Unit</Text>
            <TextInput
              style={styles.input}
              value={unit}
              onChangeText={setUnit}
              placeholder="kg, pcs, ltr"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>SKU / Code</Text>
            <TextInput
              style={styles.input}
              value={sku}
              onChangeText={setSku}
              placeholder="Optional"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>

        {/* Pricing */}
        <Text style={styles.sectionLabel}>Default prices</Text>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color="#3B82F6" />
          <Text style={styles.infoText}>
            These are your default rates that pre-fill when you add this item
            to a sales or purchase invoice. Change them here anytime — they do
            not affect past invoices.
          </Text>
        </View>
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Sale price</Text>
            <TextInput
              style={styles.input}
              value={salePrice}
              onChangeText={setSalePrice}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Purchase price</Text>
            <TextInput
              style={styles.input}
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Opening stock */}
        <Text style={styles.sectionLabel}>Opening stock</Text>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color="#3B82F6" />
          <Text style={styles.infoText}>
            Enter the stock you had when you started using SmartBiz. This is
            treated as your first purchase entry — it sets the initial average
            cost for profit calculations and appears as the first line in the
            inventory ledger. Leave at zero if starting fresh.
          </Text>
        </View>
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Opening qty</Text>
            <TextInput
              style={styles.input}
              value={openingQty}
              onChangeText={setOpeningQty}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Rate per unit</Text>
            <TextInput
              style={styles.input}
              value={openingRate}
              onChangeText={setOpeningRate}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Opening value summary */}
        {(parseFloat(openingQty) > 0 || parseFloat(openingRate) > 0) && (
          <View style={styles.openingValueBox}>
            <Text style={styles.openingValueLabel}>Opening stock value</Text>
            <Text style={styles.openingValueAmount}>
              {biz.meta?.currency} {openingValue.toLocaleString()}
            </Text>
            <Text style={styles.openingValueSub}>
              {openingQty || 0} units × {biz.meta?.currency} {openingRate || 0}
            </Text>
            <Text style={styles.openingValueNote}>
              Balanced against Opening Equity in Balance Sheet
            </Text>
          </View>
        )}

        {/* Current stock (edit mode only) */}
        {editing && existingItem && (
          <View style={styles.stockInfoBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stockInfoLabel}>Current stock</Text>
              <Text style={styles.stockInfoSub}>
                Opening {existingItem.openingStock || 0} + purchases −
                sales − write-offs
              </Text>
            </View>
            <Text style={[
              styles.stockInfoValue,
              { color: (existingItem.stock || 0) < 0 ? '#EF4444' : '#10B981' },
            ]}>
              {existingItem.stock || 0} units
            </Text>
          </View>
        )}

        {editing && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.deleteBtnText}>Delete Item</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#fff' },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  saveBtn:     { fontSize: 16, color: colors.primary, fontWeight: '700' },
  form:        { padding: 16, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: 20, marginBottom: 10, marginLeft: 2,
  },
  label: {
    fontSize: 13, fontWeight: '600', color: colors.textSecondary,
    marginBottom: 6, marginTop: 4,
  },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 11,
    paddingHorizontal: 13, paddingVertical: 12,
    fontSize: 15, color: colors.textPrimary, marginBottom: 10,
  },
  row2: { flexDirection: 'row', gap: 10 },
  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#EFF6FF', borderRadius: 10,
    padding: 12, marginBottom: 12,
  },
  infoText: { flex: 1, fontSize: 12, color: '#1E40AF', lineHeight: 18 },
  openingValueBox: {
    backgroundColor: '#F0FDF4', borderRadius: 12,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#BBF7D0',
  },
  openingValueLabel:  { fontSize: 12, color: '#15803D', marginBottom: 3 },
  openingValueAmount: { fontSize: 20, fontWeight: '700', color: '#15803D' },
  openingValueSub:    { fontSize: 12, color: '#16A34A', marginTop: 2 },
  openingValueNote: {
    fontSize: 11, color: '#6B7280', marginTop: 6, fontStyle: 'italic',
  },
  stockInfoBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 10,
    padding: 14, marginBottom: 12,
  },
  stockInfoLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  stockInfoSub:   { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  stockInfoValue: { fontSize: 20, fontWeight: '700' },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderColor: colors.danger,
    borderRadius: 12, paddingVertical: 14, marginTop: 24,
  },
  deleteBtnText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});