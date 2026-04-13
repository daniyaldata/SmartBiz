import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, deleteTransaction } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

export default function ReceiptsScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const receipts = (biz?.transactions || [])
    .filter(t => t.transactionType === 'receipt')
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const cur = biz?.meta?.currency || 'PKR';
  const total = receipts.reduce((s, t) => s + (t.amount || 0), 0);

  const handleDelete = (txn) => {
    Alert.alert(
      'Delete Receipt',
      `Delete receipt of ${cur} ${txn.amount?.toLocaleString()}? This will reverse the bank balance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const updated = await deleteTransaction(biz, txn.id);
            setBiz(updated);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Receipts</Text>
        <View style={{ width: 22 }} />
      </View>

      {receipts.length > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>Total receipts</Text>
          <Text style={styles.summaryValue}>
            {cur} {total.toLocaleString()}
          </Text>
        </View>
      )}

      <FlatList
        data={receipts}
        keyExtractor={t => t.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons
              name="arrow-down-circle-outline"
              size={52}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyTitle}>No receipts yet</Text>
            <Text style={styles.emptySub}>
              Record money received from customers or other sources
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={[styles.iconWrap, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons
                  name="arrow-down-circle-outline"
                  size={22}
                  color="#10B981"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.partyName || item.incomeAccountName || 'Receipt'}
                </Text>
                {item.reference ? (
                  <Text style={styles.cardRef}>Ref: {item.reference}</Text>
                ) : null}
                <Text style={styles.cardDate}>
                  {new Date(item.date).toLocaleDateString()}
                  {item.accountName ? ` · ${item.accountName}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.cardAmount}>
                  + {cur} {(item.amount || 0).toLocaleString()}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          navigation.navigate('TransactionForm', {
            businessId, defaultType: 'receipt',
          })
        }
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
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  summaryBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#ECFDF5', borderBottomWidth: 1, borderBottomColor: '#A7F3D0',
  },
  summaryText:  { fontSize: 13, color: '#065F46' },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#065F46' },
  list: { padding: 12, gap: 8, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 42, height: 42, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  cardName:   { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  cardRef:    { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardDate:   { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  cardAmount: { fontSize: 15, fontWeight: '700', color: '#10B981' },
  emptyBox: {
    alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 40,
  },
  emptyTitle:  { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  emptySub:    { fontSize: 13, color: colors.textTertiary, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 28, right: 20,
    backgroundColor: '#10B981', width: 58, height: 58, borderRadius: 29,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#10B981', shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
});