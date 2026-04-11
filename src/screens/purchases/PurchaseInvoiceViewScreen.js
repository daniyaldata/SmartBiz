import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  loadBusiness, saveBusiness,
  getInvoiceStatus, generateId,
} from '../../data/BusinessStore';
import { generatePurchasePdf } from '../../data/PdfGenerator';
import { colors } from '../../theme/colors';

const STATUS = {
  paid:    { bg: '#DCFCE7', text: '#16A34A', label: 'Paid' },
  partial: { bg: '#FEF3C7', text: '#D97706', label: 'Partially Paid' },
  due:     { bg: '#FEE2E2', text: '#DC2626', label: 'Payment Due' },
};

export default function PurchaseInvoiceViewScreen({ route, navigation }) {
  const { businessId, invoiceId } = route?.params || {};
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  if (!biz) return <View style={styles.container} />;

  const invoice = biz.purchaseInvoices?.find(i => i.id === invoiceId);

  if (!invoice) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ color: colors.textSecondary }}>Invoice not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cur     = biz.meta?.currency || 'PKR';
  const status  = getInvoiceStatus(invoice);
  const st      = STATUS[status];
  const balance = invoice.total - (invoice.amountPaid || 0);

  const handleClone = async () => {
    const cloned = {
      ...invoice,
      id: generateId(),
      number: String(
        (biz.purchaseInvoices?.length || 0) + 1
      ).padStart(4, '0'),
      amountPaid: 0,
      date: new Date().toISOString().split('T')[0],
      dueDate: '',
      createdAt: new Date().toISOString(),
    };
    const updated = {
      ...biz,
      purchaseInvoices: [...biz.purchaseInvoices, cloned],
    };
    await saveBusiness(updated);
    Alert.alert('Cloned!', `Bill BILL-${cloned.number} created.`);
    navigation.replace('PurchaseInvoiceView', {
      businessId, invoiceId: cloned.id,
    });
  };

  const handleSharePdf = async () => {
    try {
      await generatePurchasePdf(invoice, biz);
    } catch (e) {
      Alert.alert('Error', 'Could not generate PDF: ' + e.message);
    }
  };

  // Opens TransactionForm pre-filled with this invoice's supplier + invoice
  const handleRecordPayment = () => {
    navigation.navigate('TransactionForm', {
      businessId,
      defaultType: 'payment',
      prefillSupplierId: invoice.supplierId,
      prefillSupplierName: invoice.supplierName,
      prefillInvoiceId: invoice.id,
      prefillInvoiceNumber: invoice.number,
      prefillAmount: balance.toString(),
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          BILL-{invoice.number || invoiceId.slice(-4)}
        </Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('PurchaseInvoiceForm', { businessId, invoiceId })
          }
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Status */}
        <View style={[styles.statusBanner, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
          {balance > 0 && (
            <Text style={[styles.statusBalance, { color: st.text }]}>
              Balance Due: {cur} {balance.toLocaleString()}
            </Text>
          )}
        </View>

        {/* Details */}
        <View style={styles.card}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Supplier</Text>
            <Text style={styles.detailValue}>{invoice.supplierName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>
              {new Date(invoice.date).toLocaleDateString()}
            </Text>
          </View>
          {invoice.dueDate ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Due date</Text>
              <Text style={styles.detailValue}>
                {new Date(invoice.dueDate).toLocaleDateString()}
              </Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount paid</Text>
            <Text style={[styles.detailValue, { color: '#10B981' }]}>
              {cur} {(invoice.amountPaid || 0).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Line items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items</Text>
          <View style={styles.lineHeader}>
            <Text style={[styles.lineCol, { flex: 3 }]}>Description</Text>
            <Text style={[styles.lineCol, { textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.lineCol, { textAlign: 'right' }]}>Amount</Text>
          </View>
          {(invoice.lines || []).map((line, i) => (
            <View key={i} style={styles.lineRow}>
              <Text style={[styles.lineCell, { flex: 3 }]}>
                {line.description}
              </Text>
              <Text style={[styles.lineCell, { textAlign: 'center' }]}>
                {line.qty} × {(parseFloat(line.rate) || 0).toLocaleString()}
              </Text>
              <Text style={[
                styles.lineCell,
                { textAlign: 'right', fontWeight: '600' },
              ]}>
                {(
                  (parseFloat(line.qty) || 0) * (parseFloat(line.rate) || 0)
                ).toLocaleString()}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={[styles.totalValue, { color: '#EF4444' }]}>
              {cur} {(invoice.total || 0).toLocaleString()}
            </Text>
          </View>
        </View>

        {invoice.notes ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Actions */}
        <TouchableOpacity style={styles.pdfBtn} onPress={handleSharePdf}>
          <Ionicons name="share-outline" size={20} color="#fff" />
          <Text style={styles.pdfBtnText}>Share Bill PDF</Text>
        </TouchableOpacity>

        {status !== 'paid' && (
          <TouchableOpacity style={styles.paymentBtn} onPress={handleRecordPayment}>
            <Ionicons name="cash-outline" size={20} color="#fff" />
            <Text style={styles.paymentBtnText}>Record New Payment</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.outlineBtn} onPress={handleClone}>
          <Ionicons name="copy-outline" size={20} color={colors.primary} />
          <Text style={styles.outlineBtnText}>Clone Bill</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  statusBanner: { borderRadius: 14, padding: 16, alignItems: 'center', gap: 4 },
  statusText: { fontSize: 16, fontWeight: '700' },
  statusBalance: { fontSize: 14, fontWeight: '500' },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardTitle: {
    fontSize: 12, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  detailLabel: { fontSize: 14, color: colors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  lineHeader: {
    flexDirection: 'row', paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4,
  },
  lineCol: {
    flex: 1, fontSize: 11, fontWeight: '700',
    color: colors.textSecondary, textTransform: 'uppercase',
  },
  lineRow: {
    flexDirection: 'row', paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  lineCell: { flex: 1, fontSize: 14, color: colors.textPrimary },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  totalValue: { fontSize: 18, fontWeight: '700' },
  notesText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  pdfBtn: {
    backgroundColor: '#EF4444', borderRadius: 13, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  pdfBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  paymentBtn: {
    backgroundColor: '#10B981', borderRadius: 13, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  paymentBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  outlineBtn: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 13,
    paddingVertical: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  outlineBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});