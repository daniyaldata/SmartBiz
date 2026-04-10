import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

const STATUS = {
  invoiced:   { bg: '#DCFCE7', text: '#16A34A', label: 'Invoiced' },
  uninvoiced: { bg: '#FEF3C7', text: '#D97706', label: 'Un-invoiced' },
};

export default function PurchaseQuotesScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const quotes = (biz?.purchaseQuotes || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const cur = biz?.meta?.currency || 'PKR';

  const getStatus = (quote) =>
    quote.convertedToInvoiceId ? 'invoiced' : 'uninvoiced';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Purchase Quotes</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={quotes}
        keyExtractor={q => q.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons
              name="clipboard-outline"
              size={52}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyTitle}>No quotes yet</Text>
            <Text style={styles.emptySub}>
              Tap + to create a purchase quote from a supplier
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const status = getStatus(item);
          const st = STATUS[status];
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('PurchaseQuoteView', {
                  businessId,
                  quoteId: item.id,
                })
              }
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardNum}>
                    PQUO-{item.number || item.id.slice(-4)}
                  </Text>
                  <Text style={styles.cardSupplier}>
                    {item.supplierName || '—'}
                  </Text>
                  <Text style={styles.cardDate}>
                    {new Date(item.date).toLocaleDateString()}
                    {item.expiryDate
                      ? ` · Expires ${new Date(item.expiryDate).toLocaleDateString()}`
                      : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.cardAmount}>
                    {cur} {(item.total || 0).toLocaleString()}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.badgeText, { color: st.text }]}>
                      {st.label}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          navigation.navigate('PurchaseQuoteForm', { businessId })
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
  list: { padding: 12, gap: 8, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardNum: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardSupplier: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  cardDate: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  cardAmount: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
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
});