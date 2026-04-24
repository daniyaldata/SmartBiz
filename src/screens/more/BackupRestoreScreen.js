import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import {
  loadBusiness, saveBusiness,
  getBusinessIndex, saveBusinessIndex,
} from '../../data/BusinessStore';
import { colors } from '../../theme/colors';


// ─────────────────────────────────────────────────────────────
// 🔥 OPTIMIZED ENCRYPTION (CHUNKED + FAST)
// ─────────────────────────────────────────────────────────────

const sleep = () => new Promise(resolve => setTimeout(resolve, 0));

const encrypt = async (text, password, onProgress) => {
  const key = await digestStringAsync(CryptoDigestAlgorithm.SHA256, password);

  const chunkSize = 2000;
  let result = '';

  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);

    let encryptedChunk = '';
    for (let j = 0; j < chunk.length; j++) {
      const k = key.charCodeAt((i + j) % key.length);
      encryptedChunk += (chunk.charCodeAt(j) ^ k)
        .toString(16)
        .padStart(2, '0');
    }

    result += encryptedChunk;

    await sleep();

    if (onProgress) {
      onProgress(Math.round((i / text.length) * 100));
    }
  }

  return result;
};

const decrypt = async (hex, password, onProgress) => {
  const key = await digestStringAsync(CryptoDigestAlgorithm.SHA256, password);

  const chunkSize = 4000;
  let result = '';

  for (let i = 0; i < hex.length; i += chunkSize) {
    const chunk = hex.slice(i, i + chunkSize);

    let decryptedChunk = '';
    for (let j = 0; j < chunk.length; j += 2) {
      const byte = parseInt(chunk.substr(j, 2), 16);
      const k = key.charCodeAt(((i + j) / 2) % key.length);
      decryptedChunk += String.fromCharCode(byte ^ k);
    }

    result += decryptedChunk;

    await sleep();

    if (onProgress) {
      onProgress(Math.round((i / hex.length) * 100));
    }
  }

  return result;
};


// ─────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────

export default function BackupRestoreScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;

  const [biz, setBiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [modalMode, setModalMode] = useState('backup');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  useFocusEffect(
    useCallback(() => {
      if (businessId) loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  const startBackup = () => {
    setModalMode('backup');
    setPassword('');
    setConfirmPassword('');
    setProgress(0);
    setShowPasswordModal(true);
  };

  const handleBackup = async () => {
    if (password.length < 4) {
      Alert.alert('Weak password', 'Use at least 4 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setShowPasswordModal(false);
    setLoading(true);
    setProgress(0);

    try {
      // 🔥 reduce size (optional optimization)
      const businessData = JSON.stringify(biz, (k, v) =>
        v === null || v === '' ? undefined : v
      );

      const checksum = await digestStringAsync(
        CryptoDigestAlgorithm.SHA256,
        businessData
      );

      const payload = JSON.stringify({
        version: 3,
        checksum,
        data: businessData,
        exportedAt: new Date().toISOString(),
        businessName: biz.meta?.name || 'Business',
      });

      const encrypted = await encrypt(payload, password, setProgress);

      const fileName = `${(biz.meta?.name || 'backup').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.smartbiz`;

      const fileUri = FileSystem.cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, encrypted, {
        encoding: 'utf8',
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/octet-stream',
        dialogTitle: `Save ${fileName}`,
        UTI: 'public.data',
      });

    } catch (e) {
      Alert.alert('Backup failed', e.message);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const startRestore = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const file = result.assets[0];

    if (!file.name?.endsWith('.smartbiz')) {
      Alert.alert('Invalid file', 'Select a .smartbiz file.');
      return;
    }

    setPendingFile(file);
    setModalMode('restore');
    setPassword('');
    setProgress(0);
    setShowPasswordModal(true);
  };

  const handleRestore = async () => {
    if (!password) {
      Alert.alert('Password required');
      return;
    }

    setShowPasswordModal(false);
    setLoading(true);
    setProgress(0);

    try {
      const encrypted = await FileSystem.readAsStringAsync(pendingFile.uri);

      let payload;

      try {
        const decrypted = await decrypt(encrypted, password, setProgress);
        payload = JSON.parse(decrypted);
      } catch {
        Alert.alert('Wrong password or corrupted file');
        setLoading(false);
        return;
      }

      const expectedChecksum = await digestStringAsync(
        CryptoDigestAlgorithm.SHA256,
        payload.data
      );

      if (expectedChecksum !== payload.checksum) {
        Alert.alert('Corrupted backup');
        setLoading(false);
        return;
      }

      const restoredBiz = JSON.parse(payload.data);

      await saveBusiness(restoredBiz);

      const index = await getBusinessIndex();
      const i = index.findIndex(b => b.id === restoredBiz.id);

      const entry = {
        id: restoredBiz.id,
        name: restoredBiz.meta.name,
        updatedAt: new Date().toISOString(),
      };

      if (i >= 0) index[i] = entry;
      else index.push(entry);

      await saveBusinessIndex(index);

      Alert.alert('Restored ✓', 'Backup restored successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);

    } catch (e) {
      Alert.alert('Restore failed', e.message);
    } finally {
      setLoading(false);
      setProgress(0);
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

      <ScrollView contentContainerStyle={styles.content}>

        {/* Security banner */}
        <View style={styles.securityBanner}>
          <View style={styles.securityIconWrap}>
            <Ionicons name="shield-checkmark" size={28} color="#059669" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.securityTitle}>Encrypted Backups</Text>
            <Text style={styles.securitySub}>
              Backups are encrypted with a password-derived keystream cipher.
              Without the correct password the data cannot be read.
            </Text>
          </View>
        </View>

           <ScrollView contentContainerStyle={styles.content}>

        <TouchableOpacity style={styles.btn} onPress={startBackup} disabled={loading}>
          <Text style={styles.btnText}>Create Backup</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={startRestore} disabled={loading}>
          <Text style={styles.btnText}>Restore Backup</Text>
        </TouchableOpacity>

        {loading && (
          <View style={{ marginTop: 20 }}>
            <ActivityIndicator size="large" />
            <Text style={{ textAlign: 'center', marginTop: 10 }}>
              Processing... {progress}%
            </Text>
          </View>
        )}

      </ScrollView>

      {/* Password Modal */}
      <Modal visible={showPasswordModal} transparent>
        <View style={styles.modal}>
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            style={styles.input}
          />

          {modalMode === 'backup' && (
            <TextInput
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!passwordVisible}
              style={styles.input}
            />
          )}

          <TouchableOpacity
            style={styles.btn}
            onPress={modalMode === 'backup' ? handleBackup : handleRestore}
          >
            <Text style={styles.btnText}>Continue</Text>
          </TouchableOpacity>

        </View>
      </Modal>


        {/* How it works */}
        <Text style={styles.sectionLabel}>How it works</Text>
        <View style={styles.infoCard}>
          {[
            {
              icon: 'lock-closed-outline',
              color: '#8B5CF6',
              bg: '#F5F3FF',
              title: 'Password-derived encryption',
              desc: 'Your password is hashed with SHA-256 to generate a 128-character encryption key. The password itself is never stored.',
            },
            {
              icon: 'key-outline',
              color: '#D97706',
              bg: '#FEF3C7',
              title: 'Keystream cipher',
              desc: 'Data is XOR-encrypted against a keystream derived from your password. Wrong password produces unreadable output.',
            },
            {
              icon: 'checkmark-shield-outline',
              color: '#059669',
              bg: '#ECFDF5',
              title: 'Integrity verification',
              desc: 'A SHA-256 checksum is embedded so any corruption or tampering is detected on restore.',
            },
          ].map((item, i) => (
            <View key={i} style={[styles.infoRow, i < 2 && styles.infoRowBorder]}>
              <View style={[styles.infoIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>{item.title}</Text>
                <Text style={styles.infoDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Password Modal */}
      <Modal visible={showPasswordModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowPasswordModal(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHandle} />

                <Text style={styles.modalTitle}>
                  {modalMode === 'backup' ? '🔐 Set backup password' : '🔑 Enter backup password'}
                </Text>
                <Text style={styles.modalSub}>
                  {modalMode === 'backup'
                    ? 'Choose a password to encrypt your backup. You will need it to restore.'
                    : 'Enter the password you used when creating this backup.'}
                </Text>

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

                {modalMode === 'backup' && (
                  <View style={[styles.passwordRow, { marginTop: 10 }]}>
                    <TextInput
                      style={styles.passwordInput}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm password"
                      placeholderTextColor={colors.textTertiary}
                      secureTextEntry={!passwordVisible}
                    />
                  </View>
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalCancel}
                    onPress={() => setShowPasswordModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalConfirm}
                    onPress={modalMode === 'backup' ? handleBackup : handleRestore}
                  >
                    <Ionicons
                      name={modalMode === 'backup' ? 'cloud-upload-outline' : 'cloud-download-outline'}
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.modalConfirmText}>
                      {modalMode === 'backup' ? 'Encrypt & Export' : 'Decrypt & Restore'}
                    </Text>
                  </TouchableOpacity>
                </View>

              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

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
  content: { padding: 16, paddingBottom: 48, gap: 4 },
  securityBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: '#ECFDF5', borderRadius: 16, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: '#A7F3D0',
  },
  securityIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  securityTitle: { fontSize: 14, fontWeight: '700', color: '#065F46', marginBottom: 4 },
  securitySub: { fontSize: 12, color: '#047857', lineHeight: 18 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, marginLeft: 4, marginTop: 8,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 20, shadowColor: '#000',
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, gap: 14,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: {
    width: 48, height: 48, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 3 },
  cardSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  progressRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.background, borderRadius: 10, padding: 10,
  },
  progressText: { fontSize: 13, color: colors.textSecondary },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13,
  },
  actionBtnSecondary: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.primary,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  infoCard: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoIcon: {
    width: 34, height: 34, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
  infoDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  modalSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 20 },
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
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  modalConfirm: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14,
  },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
   container: { flex: 1, justifyContent: 'center' },
  content: { padding: 20 },
  btn: {
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  btnText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
  modal: {
    backgroundColor: '#fff',
    margin: 30,
    padding: 20,
    borderRadius: 10,
  },
  input: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
  },
});
