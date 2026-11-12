import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { PersonalEntry } from '@/services/personalDictionary';
import { theme } from '@/constants/theme';

export const WordPanel = memo(function WordPanel({ character }: { character: PersonalEntry | null }) {
  if (!character) return <View style={styles.empty}><Text style={styles.emptyText}>Добавьте первый иероглиф в личный словарь</Text></View>;
  return <View style={styles.wrapper}>
    <View style={styles.characterBlock}>
      <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={styles.character}>{character.hanzi}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Прослушать произношение ${character.hanzi}`} onPress={() => { Speech.stop(); Speech.speak(character.hanzi, { language: 'zh-CN', rate: 0.82 }); }} style={styles.speakButton}>
        <Ionicons name="volume-high-outline" size={19} color={theme.colors.primary} />
      </Pressable>
    </View>
    <View style={styles.details}>
      <Text style={styles.pinyin}>{character.pinyin}</Text>
      <Text style={styles.meaning}>{character.meaning}</Text>
      <Text style={styles.streak}>{character.mastered ? 'Освоен' : `Успешных написаний подряд: ${character.streak} / 10`}</Text>
    </View>
  </View>;
});
const styles = StyleSheet.create({
  wrapper: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, paddingHorizontal: theme.spacing.sm, paddingVertical: 0 },
  characterBlock: { alignItems: 'center', justifyContent: 'center', minWidth: 62 },
  character: { fontSize: 54, lineHeight: 60, color: theme.colors.ink, includeFontPadding: false },
  speakButton: { width: 32, height: 28, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, minWidth: 0, gap: 3 },
  pinyin: { fontSize: theme.font.title - 1, fontWeight: '700', color: theme.colors.primary },
  meaning: { fontSize: theme.font.small, color: theme.colors.ink },
  streak: { fontSize: theme.font.tiny, color: theme.colors.subtle },
  empty: { minHeight: 74, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: theme.colors.subtle, fontSize: theme.font.body },
});
