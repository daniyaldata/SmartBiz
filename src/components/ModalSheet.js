import React from 'react';
import {
  View, Text, StyleSheet, Modal,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function ModalSheet({
  visible,
  onClose,
  title,
  children,
  rightAction,
  rightActionLabel,
  rightActionLoading,
  rightActionColor,
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top || 44 }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.sideBtn}
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          <View style={styles.sideBtn}>
            {rightAction ? (
              <TouchableOpacity
                onPress={rightAction}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                disabled={rightActionLoading}
              >
                {rightActionLoading ? (
                  <ActivityIndicator size="small" color={rightActionColor || colors.primary} />
                ) : (
                  <Text style={[
                    styles.rightText,
                    { color: rightActionColor || colors.primary },
                  ]}>
                    {rightActionLabel || 'Save'}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sideBtn: {
    width: 56,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  rightText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
});