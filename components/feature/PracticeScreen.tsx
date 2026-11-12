import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { usePractice } from '@/hooks/usePractice';
import { useScreenSize } from '@/hooks/useScreenSize';
import { WritingBoard } from './WritingBoard';
import { WordPanel } from './WordPanel';
import { dictionaryLookup } from '@/services/personalDictionary';

export function PracticeScreen() {
  const practice = usePractice();
  const screen = useScreenSize();
  const compact = screen.height < 850;
  const [hanzi, setHanzi] = useState('');
  const [pinyin, setPinyin] = useState('');
  const [meaning, setMeaning] = useState('');
  const [boardSpace, setBoardSpace] = useState({ width: 280, height: 280 });
  const measureBoard = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBoardSpace(prev => prev.width === width && prev.height === height ? prev : { width: Math.max(1, width), height: Math.max(1, height) });
  }, []);
  const boardSize = Math.max(1, Math.min(screen.width * practice.boardScale, boardSpace.width, boardSpace.height, 520));
  const disabled = !practice.shape || !practice.attemptsLoaded || practice.checking || practice.loading || practice.liveStroke.length > 0 || (!practice.awaitingRetry && !practice.strokes.length);

  useEffect(() => {
    const found = dictionaryLookup(Array.from(hanzi.trim())[0] ?? '');
    if (found) { setPinyin(found.pinyin); setMeaning(found.meaning); }
    else if (!hanzi.trim()) { setPinyin(''); setMeaning(''); }
  }, [hanzi]);

  const add = async () => {
    const result = await practice.addCharacter(hanzi, pinyin, meaning);
    if (result === 'added' || result === 'offline' || result === 'missing' || result === 'exists' || result === 'pending') {
      setHanzi(''); setPinyin(''); setMeaning('');
    }
  };

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <StatusBar style="dark" />
    <View style={[styles.page, compact ? styles.compactPage : null]}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.brandMark}><Text style={styles.brandCharacter}>汉</Text></View>
          <View><Text style={styles.brandTitle}>HanziCramming</Text><Text style={styles.brandSubtitle}>ЛИЧНЫЙ СЛОВАРЬ И ТРЕНИРОВКА</Text></View>
        </View>
        <View style={styles.progress}>
          <Ionicons name="leaf-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.progressText}>{practice.totalMastered} / {practice.activeCount}</Text>
        </View>
      </View>

      <View style={styles.addPanel}>
        <View style={styles.addRow}>
          <TextInput value={hanzi} onChangeText={v => setHanzi(Array.from(v).slice(0, 1).join(''))} placeholder="Вставьте иероглиф" placeholderTextColor={theme.colors.subtle} style={styles.hanziInput} maxLength={2} />
          <Pressable accessibilityRole="button" onPress={add} disabled={!hanzi.trim() || !practice.ready} style={[styles.addButton, (!hanzi.trim() || !practice.ready) && styles.disabled]}>
            <Ionicons name="add" size={20} color={theme.colors.white} /><Text style={styles.addButtonText}>Добавить</Text>
          </Pressable>
        </View>
        <View style={styles.detailRow}>
          <TextInput value={pinyin} onChangeText={setPinyin} placeholder="Пиньинь (если неизвестен)" placeholderTextColor={theme.colors.subtle} style={styles.detailInput} autoCapitalize="none" />
          <TextInput value={meaning} onChangeText={setMeaning} placeholder="Перевод" placeholderTextColor={theme.colors.subtle} style={styles.detailInput} />
        </View>
      </View>

      {practice.notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{practice.notice}</Text> : null}
      {practice.storageError ? <Text style={styles.storageWarning}>{practice.storageError}</Text> : null}

      <WordPanel character={practice.character} />
      {practice.activeCount > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.characterList}>{practice.activeCharacters.map(item => <Pressable key={item.id} onPress={() => practice.selectCharacter(item.id)} style={[styles.characterChip, practice.character?.id === item.id && styles.characterChipSelected]}><Text style={[styles.characterChipText, practice.character?.id === item.id && styles.characterChipTextSelected]}>{item.hanzi}{item.mastered ? ' ✓' : ''}</Text></Pressable>)}</ScrollView> : null}

      {practice.waitingCount > 0 ? <View style={styles.waitingRow}>
        <Text numberOfLines={2} style={styles.waitingText}>Ожидают эталона: {practice.waitingCharacters.map(x => x.hanzi).join('、')}</Text>
        <Pressable onPress={practice.retryWaiting} style={styles.retryWaiting}><Ionicons name="refresh" size={17} color={theme.colors.primary} /></Pressable>
      </View> : null}

      <View style={styles.modeRow}>
        <Text style={styles.modeLabel}>Точность</Text>
        {(['L','M','H'] as const).map(mode => <Pressable key={mode} onPress={() => practice.selectTolerance(mode)} style={[styles.modeButton, practice.toleranceMode === mode && styles.modeSelected]}>
          <Text style={[styles.modeText, practice.toleranceMode === mode && styles.modeTextSelected]}>{mode}</Text>
        </Pressable>)}
        <Text style={styles.modeHint}>{practice.toleranceLimit}%</Text>
      </View>

      {!practice.ready ? <View style={styles.loading}><ActivityIndicator color={theme.colors.primary} /><Text style={styles.loadingText}>Загружаем личный словарь…</Text></View>
      : practice.character ? <View style={styles.practiceBody}>
        <View style={styles.boardSpace} onLayout={measureBoard}>
          <WritingBoard size={boardSize} shape={practice.shape} strokes={practice.strokes} liveStroke={practice.liveStroke} hint={practice.hint} loading={practice.loading} error={practice.loadError} checking={practice.checking} awaitingRetry={practice.awaitingRetry} flash={practice.flash} onBegin={practice.beginStroke} onMove={practice.moveStroke} onEnd={practice.endStroke} onCancel={practice.cancelStroke} onHint={practice.toggleHint} onClear={practice.clear} onRetry={practice.retryLoad} onResize={practice.resizeBoard} />
        </View>
        <View style={styles.footer}>
          <Text numberOfLines={1} style={styles.footerText}>{practice.feedback || `Попытка ${practice.attemptCount + (practice.flash ? 0 : 1)} · серия ${practice.streak}/10`}</Text>
          <Text style={styles.strokeCount}>{practice.strokes.length} / {practice.shape?.strokes.length ?? '…'}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={practice.check} disabled={disabled} style={[styles.checkButton, disabled && styles.disabled]}>
          <Ionicons name={practice.awaitingRetry ? 'repeat-outline' : 'checkmark-outline'} size={22} color={theme.colors.white} />
          <Text style={styles.checkText}>{practice.checking ? 'Проверяем…' : practice.awaitingRetry ? 'Повторить' : 'Проверить'}</Text>
        </Pressable>
      </View> : <View style={styles.emptyState}>
        <Ionicons name="book-outline" size={40} color={theme.colors.primary} />
        <Text style={styles.emptyTitle}>Личный словарь пока пуст</Text>
        <Text style={styles.emptyText}>Вставьте китайский иероглиф в поле выше. Он появится здесь после проверки эталона написания.</Text>
      </View>}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  page: { flex: 1, width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, gap: theme.spacing.xs },
  compactPage: { paddingVertical: 3, gap: 3 },
  header: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 34, height: 34, backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  brandCharacter: { fontSize: 24, color: theme.colors.white },
  brandTitle: { fontSize: 19, fontWeight: '700', color: theme.colors.ink },
  brandSubtitle: { fontSize: 8, color: theme.colors.subtle, letterSpacing: 0.6 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.colors.primarySoft, paddingHorizontal: 11, paddingVertical: 7, borderRadius: theme.radius.pill },
  progressText: { color: theme.colors.primary, fontWeight: '700', fontSize: theme.font.small },
  addPanel: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 7, gap: 6, borderWidth: 1, borderColor: theme.colors.border },
  addRow: { flexDirection: 'row', gap: 6 },
  hanziInput: { flex: 1, minWidth: 0, height: 40, borderRadius: theme.radius.sm, backgroundColor: theme.colors.board, paddingHorizontal: 12, color: theme.colors.ink, fontSize: 18 },
  addButton: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 12, backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm },
  addButtonText: { color: theme.colors.white, fontSize: theme.font.small, fontWeight: '600' },
  detailRow: { flexDirection: 'row', gap: 6 },
  detailInput: { flex: 1, minWidth: 0, height: 34, borderRadius: theme.radius.sm, backgroundColor: theme.colors.board, paddingHorizontal: 9, color: theme.colors.ink, fontSize: 12 },
  notice: { color: theme.colors.primary, fontSize: theme.font.tiny, lineHeight: 16 },
  storageWarning: { color: theme.colors.dangerText, fontSize: theme.font.tiny },
  characterList: { alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  characterChip: { minWidth: 34, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, backgroundColor: theme.colors.surfaceTint },
  characterChipSelected: { backgroundColor: theme.colors.primary },
  characterChipText: { color: theme.colors.primary, fontSize: 15 },
  characterChipTextSelected: { color: theme.colors.white },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  waitingText: { flex: 1, color: theme.colors.subtle, fontSize: theme.font.tiny },
  retryWaiting: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'flex-end' },
  modeLabel: { color: theme.colors.subtle, fontSize: theme.font.tiny, marginRight: 4 },
  modeButton: { width: 30, height: 27, borderRadius: 6, backgroundColor: theme.colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  modeSelected: { backgroundColor: theme.colors.primary },
  modeText: { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },
  modeTextSelected: { color: theme.colors.white },
  modeHint: { color: theme.colors.subtle, fontSize: 10, minWidth: 30 },
  practiceBody: { flex: 1, minHeight: 0, gap: 5 },
  boardSpace: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  footer: { minHeight: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  footerText: { flex: 1, color: theme.colors.subtle, fontSize: theme.font.tiny },
  strokeCount: { color: theme.colors.subtle, fontSize: theme.font.tiny },
  checkButton: { height: 42, width: '100%', borderRadius: theme.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.primary },
  checkText: { color: theme.colors.white, fontSize: theme.font.body, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: theme.colors.subtle },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 25 },
  emptyTitle: { color: theme.colors.primary, fontSize: 19, fontWeight: '700' },
  emptyText: { color: theme.colors.subtle, textAlign: 'center', lineHeight: 22 },
});
