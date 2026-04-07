import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const parseDate = (str) => {
  if (!str) return new Date();
  const parts = str.split('-');
  if (parts.length === 3) {
    return new Date(
      parseInt(parts[0]),
      parseInt(parts[1]) - 1,
      parseInt(parts[2])
    );
  }
  return new Date();
};

const toYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const formatDisplay = (str, fmt = 'DD/MM/YYYY') => {
  if (!str) return '';
  const parts = str.split('-');
  if (parts.length !== 3) return str;
  const [y, m, d] = parts;
  if (fmt === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
  if (fmt === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
  return `${d}/${m}/${y}`;
};

export default function DateField({
  label,
  value,
  onChange,
  placeholder,
  dateFormat,
  optional,
}) {
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState(parseDate(value));

  const handleChange = (event, selected) => {
    if (Platform.OS === 'android') {
      setShow(false);
      if (selected && event.type !== 'dismissed') {
        onChange(toYMD(selected));
      }
    } else {
      if (selected) setTempDate(selected);
    }
  };

  const confirmIOS = () => {
    onChange(toYMD(tempDate));
    setShow(false);
  };

  const clearDate = () => {
    onChange('');
    setShow(false);
  };

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {optional
            ? <Text style={styles.optional}> (optional)</Text>
            : null}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[styles.field, !value && styles.fieldEmpty]}
        onPress={() => {
          setTempDate(parseDate(value));
          setShow(true);
        }}
      >
        <Ionicons
          name="calendar-outline"
          size={18}
          color={value ? colors.primary : colors.textTertiary}
        />
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]}>
          {value
            ? formatDisplay(value, dateFormat)
            : placeholder || 'Select date'}
        </Text>
        {value ? (
          <TouchableOpacity
            onPress={clearDate}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
        )}
      </TouchableOpacity>

      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          visible={show}
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <View style={styles.overlay}>
            <View style={[
              styles.pickerSheet,
              { paddingBottom: insets.bottom || 16 },
            ]}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>
                  {label || 'Select Date'}
                </Text>
                <TouchableOpacity onPress={confirmIOS}>
                  <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleChange}
                style={styles.picker}
                textColor={colors.textPrimary}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 7,
    marginTop: 16,
  },
  optional: {
    fontWeight: '400',
    textTransform: 'none',
    color: colors.textTertiary,
    fontSize: 11,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  fieldEmpty: { backgroundColor: colors.background },
  fieldText: { flex: 1, fontSize: 15, color: colors.textPrimary },
  fieldPlaceholder: { color: colors.textTertiary },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cancelText: { fontSize: 15, color: colors.textSecondary },
  doneText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  picker: { height: 200 },
});