import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function PartyField({
  label,
  value,
  onSelect,
  onClear,
  customers,
  suppliers,
  placeholder,
  showType,
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const matched = [];

    (customers || []).forEach(c => {
      if (
        c.displayName?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      ) {
        matched.push({ ...c, _type: 'customer' });
      }
    });

    (suppliers || []).forEach(s => {
      if (
        s.displayName?.toLowerCase().includes(q) ||
        s.phone?.includes(q)
      ) {
        matched.push({ ...s, _type: 'supplier' });
      }
    });

    matched.push({
      id: '__freetext__',
      displayName: query.trim(),
      _type: 'freetext',
    });

    return matched;
  }, [query, customers, suppliers]);

  const handleSelect = (item) => {
    setQuery('');
    setFocused(false);
    onSelect(item);
  };

  const handleClear = () => {
    setQuery('');
    setFocused(false);
    onClear();
  };

  const getAvatarStyle = (type) => {
    if (type === 'customer') return styles.avatarCustomer;
    if (type === 'supplier') return styles.avatarSupplier;
    return styles.avatarFree;
  };

  const getAvatarTextStyle = (type) => {
    if (type === 'customer') return styles.avatarTextCustomer;
    if (type === 'supplier') return styles.avatarTextSupplier;
    return styles.avatarTextFree;
  };

  const getBadgeStyle = (type) => {
    if (type === 'customer') return styles.badgeCustomer;
    if (type === 'supplier') return styles.badgeSupplier;
    return styles.badgeFree;
  };

  const getBadgeTextStyle = (type) => {
    if (type === 'customer') return styles.badgeTextCustomer;
    if (type === 'supplier') return styles.badgeTextSupplier;
    return styles.badgeTextFree;
  };

  const getBadgeLabel = (type) => {
    if (type === 'customer') return 'Customer';
    if (type === 'supplier') return 'Supplier';
    return 'Free text';
  };

  const getInitials = (item) => {
    if (item._type === 'freetext') return '+';
    return (item.displayName || '?')[0].toUpperCase();
  };

  // Show selected state
  if (value && !focused) {
    const isLinked = value._type === 'customer' || value._type === 'supplier';
    return (
      <View style={styles.container}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={[
          styles.selectedField,
          isLinked && styles.selectedFieldLinked,
        ]}>
          <View style={[
            styles.avatar,
            getAvatarStyle(value._type),
          ]}>
            <Text style={getAvatarTextStyle(value._type)}>
              {getInitials(value)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[
              styles.selectedName,
              isLinked && { color: '#14532D' },
            ]}>
              {value.displayName}
            </Text>
            <Text style={[
              styles.selectedSub,
              isLinked && { color: '#16A34A' },
            ]}>
              {value._type === 'customer'
                ? 'Customer · linked to ledger'
                : value._type === 'supplier'
                ? 'Supplier · linked to ledger'
                : 'Free text name'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="close-circle"
              size={20}
              color={isLinked ? '#16A34A' : colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[
        styles.searchField,
        focused && styles.searchFieldFocused,
      ]}>
        <Ionicons
          name="search-outline"
          size={18}
          color={focused ? colors.primary : colors.textTertiary}
        />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          placeholder={placeholder || 'Search or type a name...'}
          placeholderTextColor={colors.textTertiary}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (query.trim()) {
              handleSelect({
                id: '__freetext__',
                displayName: query.trim(),
                _type: 'freetext',
              });
            }
          }}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {focused && results.length > 0 && (
        <View style={styles.dropdown}>
          {results.map((item, idx) => (
            <TouchableOpacity
              key={item.id || idx}
              style={[
                styles.resultItem,
                idx < results.length - 1 && styles.resultItemBorder,
              ]}
              onPress={() => handleSelect(item)}
            >
              <View style={[styles.avatar, getAvatarStyle(item._type)]}>
                <Text style={getAvatarTextStyle(item._type)}>
                  {getInitials(item)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>
                  {item._type === 'freetext'
                    ? `Use "${item.displayName}"`
                    : item.displayName}
                </Text>
                <Text style={styles.resultSub}>
                  {item._type === 'customer'
                    ? `Customer${item.phone ? ' · ' + item.phone : ''}`
                    : item._type === 'supplier'
                    ? `Supplier${item.phone ? ' · ' + item.phone : ''}`
                    : 'Save as free text name'}
                </Text>
              </View>
              <View style={[styles.badge, getBadgeStyle(item._type)]}>
                <Text style={[styles.badgeText, getBadgeTextStyle(item._type)]}>
                  {getBadgeLabel(item._type)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {focused && query.length === 0 && (
        <View style={styles.hint}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.hintText}>
            Type a name to search customers, suppliers, or enter any name
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 7,
    marginTop: 12,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: colors.background,
  },
  searchFieldFocused: {
    borderColor: colors.primary,
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 10,
  },
  resultItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarCustomer: { backgroundColor: '#EEEDFE' },
  avatarSupplier: { backgroundColor: '#FAEEDA' },
  avatarFree: { backgroundColor: colors.background },
  avatarTextCustomer: { fontSize: 13, fontWeight: '700', color: '#534AB7' },
  avatarTextSupplier: { fontSize: 13, fontWeight: '700', color: '#854F0B' },
  avatarTextFree: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  resultName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  resultSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    flexShrink: 0,
  },
  badgeCustomer: { backgroundColor: '#EEEDFE' },
  badgeSupplier: { backgroundColor: '#FAEEDA' },
  badgeFree: { backgroundColor: colors.background },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeTextCustomer: { color: '#534AB7' },
  badgeTextSupplier: { color: '#854F0B' },
  badgeTextFree: { color: colors.textSecondary },
  selectedField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: colors.background,
  },
  selectedFieldLinked: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  selectedName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  selectedSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  hintText: {
    fontSize: 12,
    color: colors.textTertiary,
    flex: 1,
    lineHeight: 17,
  },
});