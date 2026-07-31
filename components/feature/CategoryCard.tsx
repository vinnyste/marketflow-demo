import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Category } from '@/types/database';
import { Colors, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';

interface Props {
  category: Category;
  selected?: boolean;
  onPress: () => void;
}

export function CategoryCard({ category, selected, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        selected && styles.selected,
        pressed && { opacity: 0.8 },
      ]}
      onPress={onPress}
    >
      {category.image_url ? (
        <Image
          source={{ uri: category.image_url }}
          style={[styles.image, selected && styles.imageSelected]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder, selected && styles.imageSelected]} />
      )}
      <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={1}>
        {category.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  selected: {},
  image: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  imageSelected: {
    borderColor: Colors.primary,
    ...Shadow.gold,
  },
  imagePlaceholder: {
    backgroundColor: Colors.surfaceElevated,
  },
  name: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    maxWidth: 70,
  },
  nameSelected: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
});
