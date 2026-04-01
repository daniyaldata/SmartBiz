import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, saveBusiness, generateId } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

export default function ItemFormScreen({ route, navigation }) {
  const { businessId, itemId } = route?.params || {};
  const [biz, setBiz] = useState(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('');

  useEffect(() => {
    loadBusiness(businessId).then(b => {
      setBiz(b);
      if (itemId) {
        const item = b?.items?.find(i => i.id === itemId);
        if (item) {
          setName(item.name || '');
          setDescription(item.description || '');
          setSalePrice(item.salePrice?.toString() || '');
          setCostPrice(item.costPrice?.toString() || '');
          setStock(item.stock?.toString() || '');
          setUnit(item.unit || '');
        }
      }
    });
  }, [businessId, itemId]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter item name.');
      return;
    }
    setLoading(true);
    try {
      const item = {
        id: itemId || generateId(),
        name: name.trim(),
        description: description.trim(),
        salePrice: parseFloat(salePrice) || 0,
        costPrice: parseFloat(costPrice) || 0,
        stock: parseFloat(stock) || 0,
        unit: unit.trim(),
        createdAt: new Date().toISOString(),
      };
      const updated = { ...biz };
      if (itemId) {
        updated.items = biz.items.map(i => i.id === itemId ? item : i);
      } else {
        updated.items = [...(biz.items || []), item];
      }
      await saveBusiness(updated);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save item.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Item', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = {
            ...biz,
            items: biz.items.filter(i => i.id !== itemId),
          };
          await saveBusiness(updated);
          navigation.goBack();
        },
      },
    ]);
  };

  const fields = [
    { label: 'Item name *', value: name, set: setName, placeholder: 'e.g. Rice 1kg' },
    { label: 'Description', value: description, set: setDescription, placeholder: 'Optional', multi: true },
    { label: 'Sale price', value: salePrice, set: setSalePrice, placeholder: '0', keyboard: 'numeric' },
    { label: 'Cost price', value: costPrice, set: setCostPrice, placeholder: '0', keyboard: 'numeric' },
    { label: 'Opening stock', value: stock, set: setStock, placeholder: '0', keyboard: 'numeric' },
    { label: 'Unit', value: unit, set: setUnit, placeholder: 'e.g. kg, pcs, box' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{itemId ? 'Edit Item' : 'New Item'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={styles.saveText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
      >
        {fields.map(f => (
          <View key={f.label}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput
              style={[styles.input, f.multi && { height: 70, textAlignVertical: 'top' }]}
              value={f.value}
              onChangeText={f.set}
              placeholder={f.placeholder}
              placeholderTextColor={colors.textTertiary}
              keyboardType={f.keyboard || 'default'}
              multiline={f.multi}
            />
          </View>
        ))}

        {itemId && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.deleteText}>Delete Item</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  saveText: { fontSize: 16, color: colors.primary, fontWeight: '700' },
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
    marginTop: 32,
  },
  deleteText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});