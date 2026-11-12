import { memo, useEffect, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category } from '@/services/characters';
import { theme } from '@/constants/theme';
interface CategoryStripProps { items: Category[]; selectedId: string; onSelect: (id: string) => void; disabled?: boolean; compact?: boolean; }
export const CategoryStrip = memo(function CategoryStrip({ items, selectedId, onSelect, disabled = false, compact = false }: CategoryStripProps) {
  const list = useRef<FlatList<Category>>(null);
  useEffect(() => {
    const index = items.findIndex(item => item.id === selectedId);
    if (index >= 0) list.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
  }, [selectedId, items]);
  return <View style={[styles.outer, compact ? styles.compactOuter : null]}><FlatList ref={list} horizontal data={items} keyExtractor={item => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} onScrollToIndexFailed={({ averageItemLength, index }) => list.current?.scrollToOffset({ offset: averageItemLength * index, animated: true })} renderItem={({ item }) => {
    const selected = item.id === selectedId;
    return <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{ selected, disabled }} accessibilityLabel={item.title} onPress={() => onSelect(item.id)} style={({ pressed }) => [styles.chip, selected ? styles.selected : null, pressed ? styles.pressed : null]}><Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={16} color={selected ? theme.colors.white : theme.colors.subtle} /><Text numberOfLines={1} style={[styles.label, selected ? styles.selectedLabel : null]}>{item.shortTitle}</Text></Pressable>;
  }} /></View>;
});
const styles = StyleSheet.create({
  outer: { height: 48 }, compactOuter: { height: 40 }, content: { alignItems: 'center', gap: theme.spacing.sm, paddingRight: theme.spacing.md },
  chip: { height: 40, paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceTint, flexDirection: 'row', alignItems: 'center' },
  selected: { backgroundColor: theme.colors.primary }, label: { fontSize: theme.font.small, color: theme.colors.subtle, fontWeight: '600', includeFontPadding: false }, selectedLabel: { color: theme.colors.white }, pressed: { opacity: 0.7 },
});
