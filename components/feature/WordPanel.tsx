import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { PersonalEntry } from '@/services/personalDictionary';
import { theme } from '@/constants/theme';

type HintStatus = 'green' | 'yellow' | 'red';
export const WordPanel = memo(function WordPanel({ character, onReveal, onPinyinShown, hintStatus }: { character: PersonalEntry | null; onReveal: () => void; onPinyinShown: () => void; hintStatus: HintStatus }) {
  const [revealed, setRevealed] = useState(false);
  const [showPinyin, setShowPinyin] = useState(false);
  useEffect(() => { setRevealed(false); setShowPinyin(false); }, [character?.id]);
  if (!character) return <View style={styles.empty}><Text style={styles.emptyText}>Добавьте первый иероглиф в личный словарь</Text></View>;
  const reveal = () => { if (!revealed) { setRevealed(true); onReveal(); } };
  const toggleInfo = () => { setShowPinyin(p => { const next = !p; if (next) onPinyinShown(); return next; }); };
  const emoji = hintStatus === 'red' ? '😞' : hintStatus === 'yellow' ? '😐' : '😊';
  return <View style={styles.wrapper}>
    <Pressable accessibilityRole="button" accessibilityLabel={revealed ? 'Иероглиф раскрыт' : 'Открыть иероглиф'} onPress={reveal} style={styles.characterBlock}>
      <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={[styles.character, !revealed && styles.frosted]}>{revealed ? character.hanzi : '汉字'}</Text>
      {!revealed ? <Text style={styles.frostedLabel}>Нажмите, чтобы открыть</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`Прослушать произношение ${character.hanzi}`} onPress={() => { Speech.stop(); Speech.speak(character.hanzi, { language: 'zh-CN', rate: 0.82 }); }} style={styles.speakButton}>
        <Ionicons name="volume-high-outline" size={19} color={theme.colors.primary} />
      </Pressable>
    </Pressable>
    <View style={styles.details}>
      <Pressable accessibilityRole="button" onPress={toggleInfo} style={styles.infoToggle}>
        <Text style={styles.infoText}>{showPinyin ? character.pinyin : character.meaning}</Text>
      </Pressable>
      <Text style={styles.streak}>{character.mastered ? 'Освоен' : `Успешных написаний подряд: ${character.streak} / 10`}</Text>
    </View>
  </View>;
});
const styles = StyleSheet.create({
  wrapper: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, paddingHorizontal: theme.spacing.sm, paddingVertical: 0 },
  characterBlock: { alignItems: 'center', justifyContent: 'center', minWidth: 62 },
  character: { fontSize: 54, lineHeight: 60, color: theme.colors.ink, includeFontPadding: false },
  frosted: { color: '#AEB6C0', opacity: 0.32, textShadowColor: '#FFFFFF', textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } },
  frostedLabel: { fontSize: 8, color: theme.colors.subtle, marginTop: -1 },
  speakButton: { width: 32, height: 28, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, minWidth: 0, gap: 3 },
  infoToggle: { minHeight: 34, justifyContent: 'center' },
  infoText: { fontSize: theme.font.title - 1, fontWeight: '700', color: theme.colors.primary },
  streak: { fontSize: theme.font.tiny, color: theme.colors.subtle },
  empty: { minHeight: 74, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: theme.colors.subtle, fontSize: theme.font.body },
});