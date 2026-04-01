import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, SafeAreaView, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getBusinessIndex, importBusiness } from '../data/BusinessStore';
import { colors } from '../theme/colors';

export default function BusinessListScreen({ navigation }) {
  const [businesses, setBusinesses] = useState([]);

  useFocusEffect(
    useCallback(() => {
      getBusinessIndex().then(setBusinesses);
    }, [])
  );

  const openBusiness = (biz) => {
    navigation.navigate('Main', { businessId: biz.id });
  };

  const handleImport = async () => {
    try {
      const biz = await importBusiness();
      if (biz) {
        Alert.alert(
          'Restored!',
          `"${biz.meta.name}" has been imported successfully.`
        );
        getBusinessIndex().then(setBusinesses);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not read the file. Make sure it is a .smartbiz file.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SmartBiz</Text>
          <Text style={styles.headerSub}>Select a business to open</Text>
        </View>
        <TouchableOpacity style={styles.restoreBtn} onPress={handleImport}>
          <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
          <Text style={styles.restoreText}>Restore</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={businesses}
        keyExtractor={b => b.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => openBusiness(item)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.name[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bizName}>{item.name}</Text>
              <Text style={styles.bizSub}>
                Last updated {new Date(item.updatedAt).toLocaleDateString()}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🏢</Text>
            <Text style={styles.emptyTitle}>No businesses yet</Text>
            <Text style={styles.emptySub}>
              Tap the + button below to create your first business
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateBusiness')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  headerSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  restoreText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    gap: 10,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  bizName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bizSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
  },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 100,
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    backgroundColor: colors.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});