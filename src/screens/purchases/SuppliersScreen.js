import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, getSupplierBalance } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

export default function SuppliersScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const suppliers = (biz?.suppliers || []).filter(s =>
    s.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  );

  const cur = biz?.meta?.currency || 'PKR';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Suppliers</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search suppliers..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={suppliers}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No suppliers yet</Text>
            <Text style={styles.emptySub}>Tap + to add your first supplier</Text>
          </View>
        }
        renderItem={({ item }) => {
          const balance = getSupplierBalance(biz, item.id);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('SupplierLedger', {
                  businessId,
                  supplierId: item.id,
                })
              }
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.displayName?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.displayName}</Text>
                {item.phone ? (
                  <Text style={styles.sub}>{item.phone}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {balance > 0 ? (
                  <>
                    <Text style={styles.balanceLabel}>Payable</Text>
                    <Text style={styles.balanceAmt}>
                      {cur} {balance.toLocaleString()}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.clearedText}>Cleared</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('SupplierForm', { businessId })}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
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
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.textPrimary },
  list: { padding: 16, gap: 8, paddingBottom: 100 },
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#F59E0B' },
  name: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  balanceLabel: { fontSize: 11, color: colors.textSecondary },
  balanceAmt: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  clearedText: { fontSize: 13, color: colors.success, fontWeight: '600' },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    backgroundColor: '#F59E0B',
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});