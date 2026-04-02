import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness } from '../../data/BusinessStore';
import { generateReceiptPdf } from '../../data/PdfGenerator';
import { colors } from '../../theme/colors';

export default function ReceiptsScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const receipts = (biz?.receipts || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const cur = biz?.meta?.currency || 'PKR';
  const totalReceipts = receipts.reduce((s, r) => s + (r.amount || 0), 0);

  const handleSharePdf = async (receipt) => {
    try {
      await generateReceiptPdf(receipt, biz);
    } catch (e) {
      Alert.alert('Error', 'Could not generate PDF.');
    }
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
          <Text style={styles.summaryLabel}>Total received</Text>
          <Text style={styles.summaryValue}>
            {cur} {totalReceipts.toLocaleString()}
          </Text>
        </View>
      )}

      <FlatList
        data={receipts}
        keyExtractor={r => r.id}
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
              Tap + to record a customer payment
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <View style={styles.iconWrap}>
                <Ionicons
                  name="arrow-down-circle-outline"
                  size={22}
                  color="#10B981"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {item.customerName || '—'}
                </Text>
                <Text style={styles.cardSub}>
                  {item.accountName || 'Cash'} ·{' '}
                  {new Date(item.date).toLocaleDateString()}
                </Text>
                {item.reference ? (
                  <Text style={styles.cardRef}>Ref: {item.reference}</Text>
                ) : null}
              </View>
              <Text style={styles.cardAmount}>
                + {cur} {(item.amount || 0).toLocaleString()}
              </Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() =>
                  navigation.navigate('ReceiptForm', {
                    businessId,
                    receiptId: item.id,
                  })
                }
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnGreen]}
                onPress={() => handleSharePdf(item)}
              >
                <Ionicons name="share-outline" size={16} color="#10B981" />
                <Text style={[styles.actionText, { color: '#10B981' }]}>
                  PDF
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ReceiptForm', { businessId })}
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
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  summaryLabel: { fontSize: 13, color: '#065F46', fontWeight: '500' },
  summaryValue: { fontSize: 16, fontWeight: '700', color: '#065F46' },
  list: { padding: 12, gap: 8, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardRef: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },
  cardAmount: { fontSize: 15, fontWeight: '700', color: '#10B981' },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnGreen: { borderColor: '#D1FAE5', backgroundColor: '#F0FDF4' },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
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
    backgroundColor: '#10B981',
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});