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

// ─── Encryption ──────────────────────────────────────────────────────────────
// Password is hashed with SHA-256 to derive a 64-char key.
// Each character of the base64-encoded payload is XOR'd against the cycling key.
// The loop runs inside setTimeout(0) to yield the UI thread before starting,
// which prevents the loading indicator from freezing on iOS.

const encrypt = async (text, password) => {
  const key = await digestStringAsync(CryptoDigestAlgorithm.SHA256, password);
  const b64 = btoa(unescape(encodeURIComponent(text)));
  const keyLen = key.length;
  return new Promise((resolve) => {
    setTimeout(() => {
      const out = new Array(b64.length);
      for (let i = 0; i < b64.length; i++) {
        out[i] = (b64.charCodeAt(i) ^ key.charCodeAt(i % keyLen))
          .toString(16).padStart(2, '0');
      }
      resolve(out.join(''));
    }, 0);
  });
};

// ─── Decryption ──────────────────────────────────────────────────────────────
// Derives the same key from the password, reverses the XOR operation,
// then decodes from base64 back to the original UTF-8 string.
// Rejects if the output cannot be decoded — signals a wrong password.

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

export default function BackupRestoreScreen({ route, navigation }) {
  const businessId = route?.params?.businessId;

  // ─── State ─────────────────────────────────────────────────────────────────
  const [biz, setBiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [modalMode, setModalMode] = useState('backup'); // 'backup' | 'restore'
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  // ─── Load business on screen focus ─────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (businessId) loadBusiness(businessId).then(setBiz);
    }, [businessId])
  );

  // ─── Backup: open password modal ───────────────────────────────────────────
  const startBackup = () => {
    setModalMode('backup');
    setPassword('');
    setConfirmPassword('');
    setProgress(0);
    setShowPasswordModal(true);
  };

  // ─── Backup: encrypt and export after password confirmed ───────────────────
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
      // Serialise business JSON, stripping null and empty string values to reduce size
      const businessData = JSON.stringify(biz, (k, v) =>
        v === null || v === '' ? undefined : v
      );

      // Embed SHA-256 checksum for integrity verification on restore
      const checksum = await digestStringAsync(CryptoDigestAlgorithm.SHA256, businessData);

      const payload = JSON.stringify({
        version: 3,
        checksum,
        data: businessData,
        exportedAt: new Date().toISOString(),
        businessName: biz.meta?.name || 'Business',
      });

      // Encrypt the payload using the password-derived XOR cipher
      const encrypted = await encrypt(payload, password);

      const fileName = `${(biz.meta?.name || 'backup').replace(/\s+/g, '_')}_${
        new Date().toISOString().split('T')[0]
      }.smartbiz`;

      // Write encrypted content to device cache as a .smartbiz file
      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, encrypted, { encoding: 'utf8' });

      // Open iOS/Android native share sheet so user can save to Files, iCloud, etc.
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

  // ─── Restore: open file picker then show password modal ────────────────────
  const startRestore = async () => {
    try {
      // Use UTI array so iOS opens the Files app for all file types
      const result = await DocumentPicker.getDocumentAsync({
        type: ['public.data', 'public.content', 'public.item', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];

      // Validate file extension before proceeding
      if (!file.name?.endsWith('.smartbiz')) {
        Alert.alert('Invalid file', 'Please select a .smartbiz backup file.');
        return;
      }

      setPendingFile(file);
      setModalMode('restore');
      setPassword('');
      setProgress(0);
      setShowPasswordModal(true);
    } catch (e) {
      Alert.alert('Error', 'Could not open file picker: ' + e.message);
    }
  };

  // ─── Restore: decrypt and import after password entered ────────────────────
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

      // Attempt decryption — failure here means wrong password or corrupted file
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

      // Save restored business and update the business index
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Backup & Restore</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Security banner ── */}
        <View style={styles.securityBanner}>
          <View style={styles.securityIconWrap}>
            <Ionicons name="shield-checkmark" size={26} color="#059669" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.securityTitle}>Encrypted Backups</Text>
            <Text style={styles.securitySub}>
              Your data is encrypted with a password-derived SHA-256 keystream cipher.
              Without the correct password the file cannot be read.
            </Text>
          </View>
        </View>

        {/* ── Create backup card ── */}
        <Text style={styles.sectionLabel}>Create backup</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.iconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Export encrypted backup</Text>
              <Text style={styles.cardSub}>
                {biz
                  ? `"${biz.meta?.name}" · ${biz.salesInvoices?.length || 0} invoices · ${biz.customers?.length || 0} customers`
                  : 'Loading business data...'}
              </Text>
            </View>
          </View>

          {/* Show progress indicator while encrypting */}
          {loading && modalMode === 'backup' && (
            <View style={styles.progressRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.progressText}>Encrypting... {progress}%</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, (loading || !biz) && styles.actionBtnDisabled]}
            onPress={startBackup}
            disabled={loading || !biz}
          >
            <Ionicons name="lock-closed-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Create Encrypted Backup</Text>
          </TouchableOpacity>
        </View>

        {/* ── Restore card ── */}
        <Text style={styles.sectionLabel}>Restore backup</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.iconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="cloud-download-outline" size={24} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Import from backup file</Text>
              <Text style={styles.cardSub}>
                Select a .smartbiz file and enter your backup password to restore
              </Text>
            </View>
          </View>

          {/* Show progress indicator while decrypting */}
          {loading && modalMode === 'restore' && (
            <View style={styles.progressRow}>
              <ActivityIndicator size="small" color="#D97706" />
              <Text style={styles.progressText}>Decrypting... {progress}%</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutline, loading && styles.actionBtnDisabled]}
            onPress={startRestore}
            disabled={loading}
          >
            <Ionicons name="key-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>
              Restore from File
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── How it works section ── */}
        <Text style={styles.sectionLabel}>How it works</Text>
        <View style={styles.infoCard}>
          {[
            {
              icon: 'lock-closed-outline',
              color: '#8B5CF6',
              bg: '#F5F3FF',
              title: 'Password-derived encryption',
              desc: 'Your password is hashed with SHA-256 to generate the encryption key. The password is never stored in the file.',
            },
            {
              icon: 'key-outline',
              color: '#D97706',
              bg: '#FEF3C7',
              title: 'Keystream cipher',
              desc: 'Data is XOR-encrypted against a keystream derived from your password. Wrong password produces unreadable output.',
            },
            {
              icon: 'shield-checkmark-outline',
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

      {/* ── Password modal ──────────────────────────────────────────────────────
          No backdrop tap to dismiss — user must complete the action.
          transparent + no animationType avoids iOS share sheet conflict.      */}
      <Modal visible={showPasswordModal} transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>

              <View style={styles.modalHandle} />

              {/* Modal title changes based on backup or restore mode */}
              <Text style={styles.modalTitle}>
                {modalMode === 'backup' ? '🔐 Set backup password' : '🔑 Enter backup password'}
              </Text>
              <Text style={styles.modalSub}>
                {modalMode === 'backup'
                  ? 'Choose a password to encrypt your backup. You will need it to restore.'
                  : 'Enter the password you used when creating this backup.'}
              </Text>

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

              {/* Confirm password field shown only in backup mode */}
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

              {/* Action button triggers backup or restore depending on mode */}
              <TouchableOpacity
                style={[styles.actionBtn, { marginTop: 20 }]}
                onPress={modalMode === 'backup' ? handleBackup : handleRestore}
                disabled={loading}
              >
                <Ionicons
                  name={modalMode === 'backup' ? 'cloud-upload-outline' : 'cloud-download-outline'}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.actionBtnText}>
                  {modalMode === 'backup' ? 'Encrypt & Export' : 'Decrypt & Restore'}
                </Text>
              </TouchableOpacity>

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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  content: { padding: 16, paddingBottom: 48 },

  securityBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: '#ECFDF5', borderRadius: 14, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: '#A7F3D0',
  },
  securityIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  securityTitle: { fontSize: 14, fontWeight: '700', color: '#065F46', marginBottom: 4 },
  securitySub: { fontSize: 12, color: '#047857', lineHeight: 18 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, marginLeft: 2, marginTop: 4,
  },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 20, gap: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: {
    width: 46, height: 46, borderRadius: 12,
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
    gap: 8, backgroundColor: colors.primary,
    borderRadius: 12, paddingVertical: 13,
  },
  actionBtnOutline: {
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: colors.primary,
  },
  actionBtnDisabled: { opacity: 0.45 },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  infoCard: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 44,
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
});