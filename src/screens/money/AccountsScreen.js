import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { loadBusiness, saveBusiness, generateId } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

export default function AccountsScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [biz, setBiz] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const accounts = biz?.bankAccounts || [];
  const cur = biz?.meta?.currency || 'PKR';
  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);

  const addAccount = () => {
    Alert.prompt(
      'New Account',
      'Enter account name (e.g. HBL Current Account):',
      async (name) => {
        if (!name?.trim()) return;
        Alert.alert(
          'Account type',
          'What type of account is this?',
          [
            {
              text: 'Cash',
              onPress: async () => {
                const newAcc = {
                  id: generateId(),
                  name: name.trim(),
                  type: 'cash',
                  balance: 0,
                };
                const updated = {
                  ...biz,
                  bankAccounts: [...accounts, newAcc],
                };
                await saveBusiness(updated);
                loadBusiness(businessId).then(setBiz);
              },
            },
            {
              text: 'Bank',
              onPress: async () => {
                const newAcc = {
                  id: generateId(),
                  name: name.trim(),
                  type: 'bank',
                  balance: 0,
                };
                const updated = {
                  ...biz,
                  bankAccounts: [...accounts, newAcc],
                };
                await saveBusiness(updated);
                loadBusiness(businessId).then(setBiz);
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      },
      'plain-text'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Bank & Cash Accounts</Text>
        <TouchableOpacity onPress={addAccount}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total balance</Text>
        <Text style={styles.totalValue}>
          {cur} {totalBalance.toLocaleString()}
        </Text>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons
              name="business-outline"
              size={48}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyTitle}>No accounts yet</Text>
            <Text style={styles.emptySub}>
              Tap + to add a bank or cash account
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={[
              styles.accountIcon,
              { backgroundColor: item.type === 'cash' ? '#ECFDF5' : '#EFF6FF' },
            ]}>
              <Ionicons
                name={item.type === 'cash' ? 'cash-outline' : 'business-outline'}
                size={22}
                color={item.type === 'cash' ? '#10B981' : '#3B82F6'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>{item.name}</Text>
              <Text style={styles.accountType}>
                {item.type === 'cash' ? 'Cash account' : 'Bank account'}
              </Text>
            </View>
            <Text style={[
              styles.accountBalance,
              { color: (item.balance || 0) >= 0 ? '#10B981' : '#EF4444' },
            ]}>
              {cur} {(item.balance || 0).toLocaleString()}
            </Text>
          </View>
        )}
      />
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
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  totalCard: {
    backgroundColor: colors.primary,
    margin: 16,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  totalValue: { fontSize: 28, fontWeight: '700', color: '#fff' },
  list: { paddingHorizontal: 16, gap: 8, paddingBottom: 40 },
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
  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  accountType: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  accountBalance: { fontSize: 16, fontWeight: '700' },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.textSecondary },
  emptySub: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});