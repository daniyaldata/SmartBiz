import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Alert, TextInput, Modal,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import {
  getBusinessIndex, saveBusiness, saveBusinessIndex,
} from '../data/BusinessStore';
import { colors } from '../theme/colors';

// ─── Decryption ───────────────────────────────────────────────────────────────
// Same logic as BackupRestoreScreen — derives SHA-256 key from password,
// reverses the XOR cipher, then decodes from base64 back to UTF-8 string.

const decrypt = async (hex, password) => {
  const key = await digestStringAsync(CryptoDigestAlgorithm.SHA256, password);
  const keyLen = key.length;
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const chars = new Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
          chars[i / 2] = String.fromCharCode(
            parseInt(hex.substr(i, 2), 16) ^ key.charCodeAt((i / 2) % keyLen)
          );
        }
        resolve(decodeURIComponent(escape(atob(chars.join('')))));
      } catch (e) {
        reject(e);
      }
    }, 0);
  });
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BusinessListScreen({ navigation }) {
  const [businesses, setBusinesses] = useState([]);

  // ─── Restore state ─────────────────────────────────────────────────────────
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [loading, setLoading] = useState(false);

  // ─── Load business list on focus ───────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      getBusinessIndex().then(setBusinesses);
    }, [])
  );

  // ─── Open a business ───────────────────────────────────────────────────────
  const openBusiness = (biz) => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main', params: { businessId: biz.id } }],
    });
  };

  // ─── Step 1: Open file picker and validate the selected file ───────────────
  const handleImport = async () => {
    try {
      // UTI array ensures iOS opens the Files app for all file types
      const result = await DocumentPicker.getDocumentAsync({
        type: ['public.data', 'public.content', 'public.item', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];

      // Validate extension before asking for password
      if (!file.name?.endsWith('.smartbiz')) {
        Alert.alert('Invalid file', 'Please select a .smartbiz backup file.');
        return;
      }

      // Store file and show password modal
      setPendingFile(file);
      setPassword('');
      setPasswordVisible(false);
      setShowPasswordModal(true);

    } catch (e) {
      Alert.alert('Error', 'Could not open file picker: ' + e.message);
    }
  };

  // ─── Step 2: Decrypt and restore after password entered ────────────────────
  const handleRestore = async () => {
    if (!password) {
      Alert.alert('Password required', 'Enter the password used when creating this backup.');
      return;
    }

    setShowPasswordModal(false);
    setLoading(true);

    try {
      // Read the encrypted file content
      const encrypted = await FileSystem.readAsStringAsync(pendingFile.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      let payload;

      // Attempt decryption — throws if password is wrong or file is corrupted
      try {
        const decrypted = await decrypt(encrypted, password);
        payload = JSON.parse(decrypted);
      } catch {
        Alert.alert('Wrong password', 'Could not decrypt this backup. Check your password and try again.');
        setLoading(false);
        return;
      }

      // Verify SHA-256 checksum to detect tampering or corruption
      const expectedChecksum = await digestStringAsync(
        CryptoDigestAlgorithm.SHA256, payload.data
      );
      if (expectedChecksum !== payload.checksum) {
        Alert.alert('Corrupted backup', 'Checksum verification failed. The file may be corrupted.');
        setLoading(false);
        return;
      }

      const restoredBiz = JSON.parse(payload.data);

      // Save restored business and update the index
      const index = await getBusinessIndex();
const existing = index.findIndex(b => b.id === restoredBiz.id);

if (existing >= 0) {
  // Business already exists — ask user what to do
  Alert.alert(
    'Business already exists',
    `"${restoredBiz.meta.name}" is already on this device. What would you like to do?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Overwrite',
        style: 'destructive',
        onPress: async () => {
          // Replace existing business with restored data
          await saveBusiness(restoredBiz);
          index[existing] = {
            id: restoredBiz.id,
            name: restoredBiz.meta.name,
            updatedAt: new Date().toISOString(),
          };
          await saveBusinessIndex(index);
          getBusinessIndex().then(setBusinesses);
          Alert.alert('Restored ✓', `"${restoredBiz.meta.name}" has been overwritten.`);
        },
      },
      {
        text: 'Add as new',
        onPress: async () => {
          // Generate a new unique ID so both businesses coexist
          const newId = restoredBiz.id + '_' + Date.now();
          const newBiz = {
            ...restoredBiz,
            id: newId,
            meta: { ...restoredBiz.meta, name: restoredBiz.meta.name + ' (restored)' },
          };
          await saveBusiness(newBiz);
          index.push({
            id: newId,
            name: newBiz.meta.name,
            updatedAt: new Date().toISOString(),
          });
          await saveBusinessIndex(index);
          getBusinessIndex().then(setBusinesses);
          Alert.alert('Added ✓', `"${newBiz.meta.name}" added as a new business.`);
        },
      },
    ]
  );
} else {
  // Business does not exist on device — add it directly
  await saveBusiness(restoredBiz);
  index.push({
    id: restoredBiz.id,
    name: restoredBiz.meta.name,
    updatedAt: new Date().toISOString(),
  });
  await saveBusinessIndex(index);
  getBusinessIndex().then(setBusinesses);
  Alert.alert('Restored ✓', `"${restoredBiz.meta.name}" has been added to your businesses.`);
}

    } catch (e) {
      Alert.alert('Restore failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SmartBiz</Text>
          <Text style={styles.headerSub}>Select a business to open</Text>
        </View>
        <TouchableOpacity
          style={[styles.restoreBtn, loading && { opacity: 0.5 }]}
          onPress={handleImport}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
          }
          <Text style={styles.restoreText}>{loading ? 'Restoring...' : 'Restore'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Business list ── */}
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
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
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

      {/* ── FAB: create new business ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateBusiness')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* ── Password modal ──────────────────────────────────────────────────────
          No backdrop tap to dismiss — user must complete or close explicitly.
          transparent + no animationType avoids iOS share sheet conflict.      */}
      <Modal visible={showPasswordModal} transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>

              <View style={styles.modalHandle} />

              <Text style={styles.modalTitle}>🔑 Enter backup password</Text>
              <Text style={styles.modalSub}>
                Enter the password you used when creating this backup.
              </Text>

              {/* Show selected filename so user can confirm correct file */}
              {pendingFile && (
                <View style={styles.fileRow}>
                  <Ionicons name="document-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.fileName} numberOfLines={1}>
                    {pendingFile.name}
                  </Text>
                </View>
              )}

              {/* Password input with show/hide toggle */}
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry={!passwordVisible}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setPasswordVisible(v => !v)}
                >
                  <Ionicons
                    name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Action buttons row */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowPasswordModal(false);
                    setPassword('');
                    setPendingFile(null);
                  }}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleRestore}
                  disabled={loading}
                >
                  <Ionicons name="cloud-download-outline" size={18} color="#fff" />
                  <Text style={styles.confirmText}>Decrypt & Restore</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.primary },
  headerSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  restoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  restoreText: { color: colors.primary, fontSize: 13, fontWeight: '600' },

  list: { padding: 16, gap: 10, paddingBottom: 100 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  bizName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  bizSub: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },

  emptyBox: {
    alignItems: 'center', paddingTop: 100, gap: 10, paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 56, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  emptySub: {
    fontSize: 14, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },

  fab: {
    position: 'absolute', bottom: 32, right: 24,
    backgroundColor: colors.primary,
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.4,
    shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 44,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 8,
  },
  modalSub: {
    fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 16,
  },

  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.background, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16,
  },
  fileName: {
    fontSize: 13, color: colors.textSecondary, flex: 1,
  },

  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
  },
  passwordInput: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: colors.textPrimary,
  },
  eyeBtn: { paddingHorizontal: 14 },

  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  confirmBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14,
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});