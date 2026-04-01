import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, saveBusiness, generateId } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

export default function SupplierFormScreen({ route, navigation }) {
  const { businessId, supplierId } = route?.params || {};
  const [biz, setBiz] = useState(null);
  const [loading, setLoading] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');

  useEffect(() => {
    loadBusiness(businessId).then(b => {
      setBiz(b);
      if (supplierId) {
        const s = b?.suppliers?.find(x => x.id === supplierId);
        if (s) {
          setDisplayName(s.displayName || '');
          setFullName(s.fullName || '');
          setPhone(s.phone || '');
          setEmail(s.email || '');
          setAddress(s.address || '');
          setOpeningBalance(s.openingBalance?.toString() || '');
        }
      }
    });
  }, [businessId, supplierId]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Required', 'Please enter a display name.');
      return;
    }
    setLoading(true);
    try {
      const supplier = {
        id: supplierId || generateId(),
        displayName: displayName.trim(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        openingBalance: parseFloat(openingBalance) || 0,
        createdAt: new Date().toISOString(),
      };
      const updated = { ...biz };
      if (supplierId) {
        updated.suppliers = biz.suppliers.map(s =>
          s.id === supplierId ? supplier : s
        );
      } else {
        updated.suppliers = [...(biz.suppliers || []), supplier];
      }
      await saveBusiness(updated);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save supplier.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Supplier', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = {
            ...biz,
            suppliers: biz.suppliers.filter(s => s.id !== supplierId),
          };
          await saveBusiness(updated);
          navigation.goBack();
        },
      },
    ]);
  };

  const fields = [
    { label: 'Display name *', value: displayName, set: setDisplayName, placeholder: 'e.g. Ali Traders' },
    { label: 'Full name', value: fullName, set: setFullName, placeholder: 'Optional' },
    { label: 'Phone', value: phone, set: setPhone, placeholder: '03XX-XXXXXXX', keyboard: 'phone-pad' },
    { label: 'Email', value: email, set: setEmail, placeholder: 'Optional', keyboard: 'email-address' },
    { label: 'Address', value: address, set: setAddress, placeholder: 'Optional', multi: true },
    { label: 'Opening balance', value: openingBalance, set: setOpeningBalance, placeholder: '0', keyboard: 'numeric' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {supplierId ? 'Edit Supplier' : 'New Supplier'}
        </Text>
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
              style={[styles.input, f.multi && { height: 80, textAlignVertical: 'top' }]}
              value={f.value}
              onChangeText={f.set}
              placeholder={f.placeholder}
              placeholderTextColor={colors.textTertiary}
              keyboardType={f.keyboard || 'default'}
              multiline={f.multi}
            />
          </View>
        ))}

        {supplierId && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.deleteText}>Delete Supplier</Text>
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