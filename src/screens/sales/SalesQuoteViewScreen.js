import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  loadBusiness, saveBusiness, generateId,
  applySalesInvoiceToInventory,
} from '../../data/BusinessStore';
import { generateQuotePdf } from '../../data/PdfGenerator';
import { colors } from '../../theme/colors';

export default function SalesQuoteViewScreen({ route, navigation }) {
  const { businessId, quoteId } = route?.params || {};
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  if (!biz) return <View style={styles.container} />;

  const quote = biz.salesQuotes?.find(q => q.id === quoteId);

  if (!quote) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={{ color: colors.textSecondary }}>Quote not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cur = biz.meta?.currency || 'PKR';
  const isInvoiced = !!quote.convertedToInvoiceId;

  const handleConvert = () => {
    if (isInvoiced) {
      Alert.alert(
        'Already invoiced',
        'This quote has already been converted to a sales invoice.'
      );
      return;
    }
    Alert.alert(
      'Convert to Invoice',
      'This will create a new sales invoice with the same details as this quote.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert',
          onPress: async () => {
            const invoice = {
              id: generateId(),
              number: String(
                (biz.salesInvoices?.length || 0) + 1
              ).padStart(4, '0'),
              customerId: quote.customerId,
              customerName: quote.customerName,
              lines: quote.lines,
              total: quote.total,
              amountPaid: 0,
              date: new Date().toISOString().split('T')[0],
              dueDate: '',
              notes: quote.notes,
              createdAt: new Date().toISOString(),
            };
            const bizWithInvoice = {
               ...biz,
               salesInvoices: [...(biz.salesInvoices || []), invoice],
               salesQuotes: biz.salesQuotes.map(q =>
                q.id === quoteId
                  ? { ...q, convertedToInvoiceId: invoice.id }
                  : q
               ),
            };
            const updated = {
               ...bizWithInvoice,
               items: applySalesInvoiceToInventory(bizWithInvoice, invoice),
            };
            await saveBusiness(updated);
            
            Alert.alert(
              'Converted!',
              `Sales invoice INV-${invoice.number} has been created.`,
              [
                {
                  text: 'View Invoice',
                  onPress: () =>
                    navigation.navigate('SalesInvoiceView', {
                      businessId,
                      invoiceId: invoice.id,
                    }),
                },
                {
                  text: 'Stay here',
                  onPress: () => loadBusiness(businessId).then(setBiz),
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleClone = async () => {
    const cloned = {
      ...quote,
      id: generateId(),
      number: String(
        (biz.salesQuotes?.length || 0) + 1
      ).padStart(4, '0'),
      convertedToInvoiceId: null,
      date: new Date().toISOString().split('T')[0],
      expiryDate: '',
      createdAt: new Date().toISOString(),
    };
    const updated = {
      ...biz,
      salesQuotes: [...biz.salesQuotes, cloned],
    };
    await saveBusiness(updated);
    Alert.alert('Cloned!', `Quote QUO-${cloned.number} created.`);
    navigation.replace('SalesQuoteView', {
      businessId,
      quoteId: cloned.id,
    });
  };

  const handleSharePdf = async () => {
    try {
      await generateQuotePdf(quote, biz, 'sales');
    } catch (e) {
      Alert.alert('Error', 'Could not generate PDF: ' + e.message);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Quote', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const updated = {
            ...biz,
            salesQuotes: biz.salesQuotes.filter(q => q.id !== quoteId),
          };
          await saveBusiness(updated);
          navigation.goBack();
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
        <Text style={styles.headerTitle}>
          QUO-{quote.number || quoteId.slice(-4)}
        </Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('SalesQuoteForm', { businessId, quoteId })
          }
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Status banner */}
        <View style={[
          styles.statusBanner,
          { backgroundColor: isInvoiced ? '#DCFCE7' : '#EFF6FF' },
        ]}>
          <Ionicons
            name={isInvoiced ? 'checkmark-circle' : 'clipboard-outline'}
            size={20}
            color={isInvoiced ? '#16A34A' : '#1D4ED8'}
          />
          <View style={{ flex: 1 }}>
            <Text style={[
              styles.statusText,
              { color: isInvoiced ? '#16A34A' : '#1D4ED8' },
            ]}>
              {isInvoiced ? 'Invoiced' : 'Un-invoiced'}
            </Text>
            {isInvoiced && (
              <Text style={styles.statusSub}>
                Converted to sales invoice
              </Text>
            )}
          </View>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Customer</Text>
            <Text style={styles.detailValue}>{quote.customerName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>
              {new Date(quote.date).toLocaleDateString()}
            </Text>
          </View>
          {quote.expiryDate ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expiry date</Text>
              <Text style={styles.detailValue}>
                {new Date(quote.expiryDate).toLocaleDateString()}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Line items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items</Text>
          <View style={styles.lineHeader}>
            <Text style={[styles.lineCol, { flex: 3 }]}>Description</Text>
            <Text style={[styles.lineCol, { textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.lineCol, { textAlign: 'right' }]}>Amount</Text>
          </View>
          {(quote.lines || []).map((line, i) => (
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
            <Text style={styles.totalValue}>
              {cur} {(quote.total || 0).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {quote.notes ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes</Text>
            <Text style={styles.notesText}>{quote.notes}</Text>
          </View>
        ) : null}

        {/* Actions */}
        <TouchableOpacity style={styles.pdfBtn} onPress={handleSharePdf}>
          <Ionicons name="share-outline" size={20} color="#fff" />
          <Text style={styles.pdfBtnText}>Share Quote PDF</Text>
        </TouchableOpacity>

        {!isInvoiced && (
          <TouchableOpacity style={styles.convertBtn} onPress={handleConvert}>
            <Ionicons name="arrow-forward-circle-outline" size={20} color="#fff" />
            <Text style={styles.convertBtnText}>Convert to Sales Invoice</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.outlineBtn} onPress={handleClone}>
          <Ionicons name="copy-outline" size={20} color={colors.primary} />
          <Text style={styles.outlineBtnText}>Clone Quote</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.outlineBtn, { borderColor: colors.danger }]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
          <Text style={[styles.outlineBtnText, { color: colors.danger }]}>
            Delete Quote
          </Text>
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
  statusBanner: {
    borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  statusText: { fontSize: 15, fontWeight: '700' },
  statusSub:  { fontSize: 12, color: '#16A34A', marginTop: 2 },
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
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 12, marginTop: 4,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  totalValue: { fontSize: 18, fontWeight: '700', color: colors.primary },
  notesText:  { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  pdfBtn: {
    backgroundColor: colors.primary, borderRadius: 13, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  pdfBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  convertBtn: {
    backgroundColor: '#16A34A', borderRadius: 13, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  convertBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  outlineBtn: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 13,
    paddingVertical: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  outlineBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});