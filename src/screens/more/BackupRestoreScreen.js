import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { loadBusiness, saveBusiness } from '../../data/BusinessStore';
import { colors } from '../../theme/colors';

export default function BackupRestoreScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;
  const [loading, setLoading] = useState(false);

  const handleBackup = async () => {
    setLoading(true);
    try {
      const biz = await loadBusiness(businessId);
      const json = JSON.stringify(biz, null, 2);
      const fileName = `${biz.meta.name.replace(/\s+/g, '_')}_${
        new Date().toISOString().split('T')[0]
      }.smartbiz`;
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Save SmartBiz backup',
      });
    } catch (e) {
      Alert.alert('Error', 'Could not create backup: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const content = await FileSystem.readAsStringAsync(
        result.assets[0].uri,
        { encoding: FileSystem.EncodingType.UTF8 }
      );
      const biz = JSON.parse(content);
      biz.id = Date.now().toString();
      await saveBusiness(biz);
      Alert.alert(
        'Restored!',
        `"${biz.meta.name}" has been imported. Go back to the business list to open it.`
      );
    } catch (e) {
      Alert.alert('Error', 'Could not restore. Make sure it is a valid .smartbiz file.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Backup & Restore</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={36} color={colors.primary} />
          <Text style={styles.infoTitle}>Your data is in your hands</Text>
          <Text style={styles.infoText}>
            All your business data is stored in a single .smartbiz file on
            this phone. Back it up regularly to Google Drive, WhatsApp, or
            email. Restore anytime on any phone.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={handleBackup}
          disabled={loading}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
            {loading
              ? <ActivityIndicator size="small" color="#2563EB" />
              : <Ionicons name="cloud-upload-outline" size={26} color="#2563EB" />
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Backup this business</Text>
            <Text style={styles.actionSub}>
              Export .smartbiz file and share via WhatsApp, Drive, or email
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={handleRestore}>
          <View style={[styles.actionIcon, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="cloud-download-outline" size={26} color="#059669" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Restore a business</Text>
            <Text style={styles.actionSub}>
              Import from a .smartbiz backup file
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
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
  content: { padding: 16, gap: 12 },
  infoCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 13,
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 21,
    opacity: 0.85,
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  actionSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
});