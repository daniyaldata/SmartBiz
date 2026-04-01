import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    icon: '📊',
    title: 'Full accounting\nin your pocket',
    subtitle: 'Sales, purchases, inventory and reports — everything a small business needs, offline and always available.',
  },
  {
    id: '2',
    icon: '🔒',
    title: 'Your data,\nyour file',
    subtitle: 'All your business data lives in one file on your phone. Back it up to WhatsApp or Google Drive anytime.',
  },
  {
    id: '3',
    icon: '📄',
    title: 'Professional invoices\nin seconds',
    subtitle: 'Create invoices with your logo, share as PDF to WhatsApp or email. Track who still owes you.',
  },
];

export default function OnboardingScreen({ navigation }) {
  const [current, setCurrent] = useState(0);
  const flatRef = useRef();

  const goNext = () => {
    if (current < slides.length - 1) {
      const next = current + 1;
      flatRef.current.scrollToIndex({ index: next });
      setCurrent(next);
    } else {
      navigation.replace('CreateBusiness');
    }
  };

  const skip = () => navigation.replace('CreateBusiness');

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipBtn} onPress={skip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={i => i.id}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrent(idx);
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === current && styles.dotActive]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
          <Text style={styles.nextText}>
            {current === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  skipBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 8,
  },
  skipText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  slide: {
    width,
    paddingHorizontal: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 80,
    marginBottom: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    alignItems: 'center',
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 28,
  },
  nextBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  nextText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});