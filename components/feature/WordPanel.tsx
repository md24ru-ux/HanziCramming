import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { Character } from '@/services/characters';
import { theme } from '@/constants/theme';
interface WordPanelProps { character: Character; exampleView: number; onCycle: () => void; compact: boolean; landscape: boolean; }
const viewLabels = ['КИТАЙСКИЙ', 'ПИНЬИНЬ', 'ПЕРЕВОД'];
export const WordPanel = memo(function WordPanel({ character, exampleView, onCycle, compact, landscape }: WordPanelProps) {
  const examples = [character.example, character.examplePinyin, character.exampleMeaning];
  return <View style={[styles.wrapper, landscape ? styles.landscape : null]}>
    <View style={[styles.wordRow, compact ? styles.compactWord : null]}>
      <View style={styles.characterBlock}><Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={[styles.character, compact ? styles.smallCharacter : null]}>{character.hanzi}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Прослушать произношение ${character.hanzi}, ${character.pinyin}`} onPress={() => { Speech.stop(); Speech.speak(character.hanzi, { language: 'zh-CN', rate: 0.82 }); }} style={({ pressed }) => [styles.speakButton, pressed ? styles.pressed : null]}><Ionicons name="volume-high-outline" size={18} color={theme.colors.primary} /></Pressable></View>
      <View style={styles.pronunciation}><Text style={[styles.pinyin, compact ? styles.smallPinyin : null]}>{character.pinyin}</Text><View style={styles.pinyinLine} /></View>
      <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={3} style={styles.meaning}>{character.meaning}</Text>
    </View>
    <Pressable onPress={onCycle} accessibilityRole="button" accessibilityLabel={`Пример: ${examples[exampleView]}. Нажмите, чтобы показать ${viewLabels[(exampleView + 1) % 3].toLowerCase()}.`} style={({ pressed }) => [styles.example, compact ? styles.compactExample : null, pressed ? styles.pressed : null]}>
      <View style={styles.exampleHeader}><Text style={styles.exampleLabel}>ПРИМЕР · {viewLabels[exampleView]}</Text><View style={styles.dots}><View style={[styles.dot, exampleView === 0 ? styles.activeDot : null]} /><View style={[styles.dot, exampleView === 1 ? styles.activeDot : null]} /><View style={[styles.dot, exampleView === 2 ? styles.activeDot : null]} /></View></View>
      <View style={styles.sentenceRow}><Text numberOfLines={compact ? 2 : 3} adjustsFontSizeToFit minimumFontScale={0.65} style={[styles.sentence, exampleView === 0 ? styles.chineseSentence : null, compact ? styles.compactSentence : null]}>{examples[exampleView]}</Text><Ionicons name="repeat-outline" size={18} color={theme.colors.subtle} /></View>
    </Pressable>
  </View>;
});
const styles = StyleSheet.create({
  wrapper: { gap: theme.spacing.sm }, landscape: { gap: theme.spacing.md }, wordRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, minHeight: 84 }, compactWord: { minHeight: 56, gap: theme.spacing.sm },
  characterBlock: { width: 72, alignItems: 'center', justifyContent: 'center' }, speakButton: { width: 30, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceTint, marginTop: -2 }, character: { fontSize: theme.font.hanzi, lineHeight: 78, fontWeight: '500', color: theme.colors.ink, includeFontPadding: false }, smallCharacter: { fontSize: 44, lineHeight: 54 },
  pronunciation: { alignItems: 'flex-start', maxWidth: 90 }, pinyin: { fontSize: theme.font.title, color: theme.colors.primary, fontWeight: '600', includeFontPadding: false }, smallPinyin: { fontSize: theme.font.section }, pinyinLine: { height: 2, width: 20, backgroundColor: theme.colors.accent, marginTop: theme.spacing.xs }, meaning: { flex: 1, fontSize: theme.font.body, lineHeight: 21, color: theme.colors.ink, includeFontPadding: false },
  example: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing.md, minHeight: 90 }, compactExample: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, minHeight: 64 }, exampleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xs }, exampleLabel: { fontSize: theme.font.tiny, color: theme.colors.subtle, letterSpacing: 0.8, fontWeight: '600' }, dots: { flexDirection: 'row', gap: theme.spacing.xs }, dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.border }, activeDot: { backgroundColor: theme.colors.primary }, sentenceRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }, sentence: { flex: 1, color: theme.colors.ink, fontSize: theme.font.body, lineHeight: 23 }, chineseSentence: { fontSize: 21, lineHeight: 29 }, compactSentence: { fontSize: theme.font.body, lineHeight: 21 }, pressed: { opacity: 0.65 },
});
