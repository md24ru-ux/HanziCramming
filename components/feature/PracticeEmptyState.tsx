import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
interface PracticeEmptyStateProps {
  categoryTitle: string; title: string; description: string;
  actionLabel: string; actionCaption?: string; onAction: () => void;
  compact: boolean; landscape: boolean; review: boolean;
}
export const PracticeEmptyState = memo(function PracticeEmptyState({ categoryTitle, title, description, actionLabel, actionCaption, onAction, compact, landscape, review }: PracticeEmptyStateProps) {
  return <View style={[styles.container, landscape ? styles.wideContainer : null]}>
    <View style={[styles.info, landscape ? styles.wideInfo : null]}>
      {!compact && !landscape ? <View style={styles.mark}><Ionicons name={review ? 'repeat-outline' : 'checkmark-done-outline'} size={48} color={theme.colors.primary} /></View> : null}
      <Text style={[styles.eyebrow, landscape ? styles.leftText : null]}>{categoryTitle}</Text>
      <Text style={[styles.title, compact ? styles.compactTitle : null, landscape ? styles.leftText : null]}>{title}</Text>
      <Text style={[styles.description, landscape ? styles.leftText : null]}>{description}</Text>
    </View>
    <View style={[styles.actions, landscape ? styles.wideActions : null]}>
      <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}><Text style={styles.buttonText}>{actionLabel}</Text><Ionicons name="arrow-forward-outline" size={20} color={theme.colors.white} /></Pressable>
      {actionCaption ? <Text style={styles.caption}>{actionCaption}</Text> : null}
    </View>
  </View>;
});
const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, width: '100%', maxWidth: 720, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
  wideContainer: { flexDirection: 'row', gap: theme.spacing.lg }, info: { width: '100%', maxWidth: 420, alignItems: 'center', gap: theme.spacing.sm, flexShrink: 1 }, wideInfo: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  mark: { width: 88, height: 88, borderRadius: theme.radius.lg, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.sm },
  eyebrow: { color: theme.colors.subtle, fontSize: theme.font.small, textAlign: 'center' }, title: { fontSize: theme.font.large, fontWeight: '700', color: theme.colors.primary, textAlign: 'center', includeFontPadding: false }, compactTitle: { fontSize: theme.font.title },
  description: { fontSize: theme.font.body, lineHeight: 24, color: theme.colors.subtle, textAlign: 'center' }, leftText: { textAlign: 'left' },
  actions: { width: '100%', maxWidth: 420, gap: theme.spacing.sm }, wideActions: { width: '38%', maxWidth: 260 },
  button: { minHeight: 52, width: '100%', borderRadius: theme.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.primary, padding: theme.spacing.sm },
  buttonText: { flexShrink: 1, textAlign: 'center', color: theme.colors.white, fontSize: theme.font.body, fontWeight: '600', includeFontPadding: false }, caption: { fontSize: theme.font.small, color: theme.colors.subtle, textAlign: 'center' }, pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
