import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const sections = [
  {
    title: 'Inventory',
    items: [
      {
        label: 'Inventory Items',
        icon: 'cube-outline',
        color: '#3B82F6',
        bg: '#EFF6FF',
        route: 'Inventory',
      },
      {
        label: 'Inventory Write-offs',
        icon: 'alert-circle-outline',
        color: '#EF4444',
        bg: '#FEF2F2',
        route: 'InventoryWriteOff',
      },
    ],
  },
  {
  title: 'Accounting',
  items: [
    {
      label: 'Statistics & Reports',
      icon: 'bar-chart-outline',
      color: '#0077C5',
      bg: '#E8F4FD',
      route: 'Statistics',
    },
    {
      label: 'Income & Expense Accounts',
      icon: 'trending-up-outline',
      color: '#10B981',
      bg: '#ECFDF5',
      route: 'AccountsManager',
    },
    {
      label: 'Journal Entries',
      icon: 'book-outline',
      color: '#8B5CF6',
      bg: '#F5F3FF',
      route: 'JournalEntries',
    },
  ],
},
  {
    title: 'Business',
    items: [
      {
        label: 'Settings',
        icon: 'settings-outline',
        color: '#6B7280',
        bg: '#F9FAFB',
        route: 'Settings',
      },
      {
        label: 'Backup & Restore',
        icon: 'cloud-outline',
        color: '#0077C5',
        bg: '#E8F4FD',
        route: 'BackupRestore',
      },
    ],
  },
];

export default function MoreScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.row,
                    idx < section.items.length - 1 && styles.rowBorder,
                  ]}
                  onPress={() =>
                    navigation.navigate(item.route, { businessId })
                  }
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  content: { padding: 16, paddingBottom: 48 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
});