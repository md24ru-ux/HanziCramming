import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { StudyMode } from '@/services/progress';
interface PracticeModeStripProps {
  compact?: boolean; mode: StudyMode; totalMastered: number; disabled: boolean;
  toleranceMode: 'L' | 'M' | 'H'; toleranceLimit: number;
  onSelect: (mode: StudyMode) => void; onCycleTolerance: () => void;
}
export const PracticeModeStrip = memo(function PracticeModeStrip({ compact = false, mode, totalMastered, disabled, toleranceMode, toleranceLimit, onSelect, onCycleTolerance }: PracticeModeStripProps) {
  return <View style={[styles.container, compact ? styles.compactContainer : null, disabled ? styles.disabled : null]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Обучение. Основная адаптивная выдача." accessibilityState={{ selected: mode === 'learn', disabled }} disabled={disabled} onPress={() => onSelect('learn')} style={({ pressed }) => [styles.option, compact ? styles.compactOption : null, mode === 'learn' ? styles.selected : null, pressed ? styles.pressed : null]}>
      <Ionicons name="leaf-outline" size={18} color={mode === 'learn' ? theme.colors.white : theme.colors.primary} />
      <View style={styles.textBlock}><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.label, mode === 'learn' ? styles.selectedText : null]}>Обучение</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.caption, mode === 'learn' ? styles.selectedText : null]}>Адаптивная выдача</Text></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Повторение освоенных иероглифов. Освоено ${totalMastered}.`} accessibilityState={{ selected: mode === 'review', disabled }} disabled={disabled} onPress={() => onSelect('review')} style={({ pressed }) => [styles.option, compact ? styles.compactOption : null, mode === 'review' ? styles.selected : null, pressed ? styles.pressed : null]}>
      <Ionicons name="repeat-outline" size={18} color={mode === 'review' ? theme.colors.white : theme.colors.primary} />
      <View style={styles.textBlock}><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.label, mode === 'review' ? styles.selectedText : null]}>Повторение</Text><Text numberOfLines={1} style={[styles.caption, mode === 'review' ? styles.selectedText : null]}>Освоено: {totalMastered}</Text></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Уровень допуска ${toleranceMode}, менее ${toleranceLimit} процентов. Нажмите для переключения.`} accessibilityState={{ disabled }} disabled={disabled} onPress={onCycleTolerance} style={({ pressed }) => [styles.tolerance, compact ? styles.compactTolerance : null, pressed ? styles.pressed : null]}>
      <Text style={styles.toleranceLetter}>{toleranceMode}</Text><Text style={styles.toleranceCaption}>{`<${toleranceLimit}%`}</Text>
    </Pressable>
  </View>;
});
const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: theme.spacing.xs, padding: theme.spacing.xs, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceTint, alignItems: 'stretch' }, compactContainer: { padding: 3, gap: 3 },
  option: { flex: 1, minWidth: 0, height: 48, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm },
  compactOption: { height: 42, paddingHorizontal: 5, gap: 4 }, selected: { backgroundColor: theme.colors.primary }, textBlock: { flexShrink: 1, gap: theme.spacing.xs },
  label: { color: theme.colors.primary, fontSize: theme.font.body, fontWeight: '600', includeFontPadding: false },
  caption: { color: theme.colors.subtle, fontSize: theme.font.tiny, includeFontPadding: false }, selectedText: { color: theme.colors.white }, pressed: { opacity: 0.7 }, disabled: { opacity: 0.55 },
  tolerance: { width: 54, height: 48, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }, compactTolerance: { width: 48, height: 42 }, toleranceLetter: { color: theme.colors.primary, fontWeight: '800', fontSize: 18, lineHeight: 21, includeFontPadding: false }, toleranceCaption: { color: theme.colors.subtle, fontSize: 9, lineHeight: 11, includeFontPadding: false },
});
