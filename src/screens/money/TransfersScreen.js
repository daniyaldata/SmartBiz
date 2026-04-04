import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, deleteTransaction } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

export default function TransfersScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const transfers = (biz?.transactions || [])
    .filter(t => t.transactionType === 'transfer')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const cur = biz?.meta?.currency || 'PKR';

  const handleDelete = (txn) => {
    Alert.alert('Delete Transfer', 'This will reverse the transfer between accounts.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const updated = await deleteTransaction(biz, txn.id);
          setBiz(updated);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Transfers</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={transfers}
        keyExtractor={t => t.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="swap-horizontal-outline" size={52} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No transfers yet</Text>
            <Text style={styles.emptySub}>Tap + to transfer between accounts</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.iconWrap}>
                <Ionicons name="swap-horizontal-outline" size={22} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.transferFlow}>
                  <Text style={styles.fromAcc} numberOfLines={1}>
                    {item.fromAccountName}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.textTertiary} />
                  <Text style={styles.toAcc} numberOfLines={1}>
                    {item.toAccountName}
                  </Text>
                </View>
                <Text style={styles.cardSub}>
                  {new Date(item.date).toLocaleDateString()}
                  {item.reference ? ` · Ref: ${item.reference}` : ''}
                </Text>
              </View>
              <Text style={styles.cardAmount}>
                {cur} {(item.amount || 0).toLocaleString()}
              </Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('TransactionForm', {
                  businessId, transactionId: item.id,
                })}
              >
                <Ionicons name="create-outline" size={15} color={colors.primary} />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: '#FECACA' }]}
                onPress={() => handleDelete(item)}
              >
                <Ionicons name="trash-outline" size={15} color="#EF4444" />
                <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('TransactionForm', {
          businessId, defaultType: 'transfer',
        })}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  list: { padding: 12, gap: 8, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#F5F3FF', justifyContent: 'center', alignItems: 'center',
  },
  transferFlow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  fromAcc: { fontSize: 13, fontWeight: '600', color: '#991B1B', flex: 1 },
  toAcc: { fontSize: 13, fontWeight: '600', color: '#14532D', flex: 1 },
  cardSub: { fontSize: 12, color: colors.textSecondary },
  cardAmount: { fontSize: 15, fontWeight: '700', color: '#8B5CF6' },
  cardActions: {
    flexDirection: 'row', gap: 6,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border,
  },
  actionText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  emptyBox: { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 28, right: 20,
    backgroundColor: '#8B5CF6', width: 58, height: 58, borderRadius: 29,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#8B5CF6', shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
});