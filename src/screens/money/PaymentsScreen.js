import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

export default function PaymentsScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const payments = (biz?.payments || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const cur = biz?.meta?.currency || 'PKR';
  const totalPayments = payments.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Payments</Text>
        <View style={{ width: 22 }} />
      </View>

      {payments.length > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryLabel}>Total paid out</Text>
          <Text style={styles.summaryValue}>
            {cur} {totalPayments.toLocaleString()}
          </Text>
        </View>
      )}

      <FlatList
        data={payments}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons
              name="arrow-up-circle-outline"
              size={52}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyTitle}>No payments yet</Text>
            <Text style={styles.emptySub}>
              Tap + to record a supplier payment
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate('PaymentForm', {
                businessId,
                paymentId: item.id,
              })
            }
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name="arrow-up-circle-outline"
                size={22}
                color="#EF4444"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {item.supplierName || '—'}
              </Text>
              <Text style={styles.cardSub}>
                {item.accountName || 'Cash on Hand'} ·{' '}
                {new Date(item.date).toLocaleDateString()}
              </Text>
              {item.reference ? (
                <Text style={styles.cardRef}>Ref: {item.reference}</Text>
              ) : null}
            </View>
            <Text style={styles.cardAmount}>
              − {cur} {(item.amount || 0).toLocaleString()}
            </Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          navigation.navigate('PaymentForm', { businessId })
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
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  summaryLabel: { fontSize: 13, color: '#991B1B', fontWeight: '500' },
  summaryValue: { fontSize: 16, fontWeight: '700', color: '#991B1B' },
  list: { padding: 12, gap: 8, paddingBottom: 100 },
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
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardRef: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },
  cardAmount: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  emptySub: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    backgroundColor: '#EF4444',
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});