import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const [reviewVisible, setReviewVisible] = useState(false);
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

  const chooseForReview = (id: string) => {
    practice.selectCharacter(id);
    setReviewVisible(false);
  };

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <StatusBar style="dark" />
    <View style={[styles.page, compact ? styles.compactPage : null]}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.brandMark}><Text style={styles.brandCharacter}>汉</Text></View>
          <View><Text style={styles.brandTitle}>HanziCramming</Text><Text style={styles.brandSubtitle}>ЛИЧНЫЙ СЛОВАРЬ И ТРЕНИРОВКА</Text></View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Открыть список для повторения" onPress={() => setReviewVisible(true)} disabled={!practice.activeCount} style={[styles.progress, !practice.activeCount && styles.disabled]}>
          <Ionicons name="leaf-outline" size={17} color={theme.colors.primary} />
          <View style={styles.progressLabels}>
            <Text style={styles.reviewLabel}>Повторение</Text>
            <Text style={styles.progressText}>{practice.totalMastered} / {practice.activeCount}</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.addPanel}>
        <View style={styles.addRow}>
          <TextInput value={hanzi} onChangeText={v => setHanzi(Array.from(v).slice(0, 1).join(''))} placeholder="Иероглиф" placeholderTextColor={theme.colors.subtle} style={styles.hanziInput} maxLength={2} multiline={false} numberOfLines={1} ellipsizeMode="tail" />
          <Pressable accessibilityRole="button" onPress={add} disabled={!hanzi.trim() || !practice.ready} style={[styles.addButton, (!hanzi.trim() || !practice.ready) && styles.disabled]}>
            <Ionicons name="add" size={20} color={theme.colors.white} /><Text style={styles.addButtonText} numberOfLines={1}>Добавить</Text>
          </Pressable>
        </View>
        <View style={styles.detailRow}>
          <TextInput value={pinyin} onChangeText={setPinyin} placeholder="Пиньинь" placeholderTextColor={theme.colors.subtle} style={styles.detailInput} autoCapitalize="none" multiline={false} numberOfLines={1} ellipsizeMode="tail" />
          <TextInput value={meaning} onChangeText={setMeaning} placeholder="Перевод" placeholderTextColor={theme.colors.subtle} style={styles.detailInput} multiline={false} numberOfLines={1} ellipsizeMode="tail" />
        </View>
        <Text style={styles.inputHint}>Пиньинь и перевод заполняются автоматически, если иероглиф есть в словаре.</Text>
      </View>

      {practice.notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{practice.notice}</Text> : null}
      {practice.storageError ? <Text style={styles.storageWarning}>{practice.storageError}</Text> : null}

      <WordPanel character={practice.character} />

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

    <Modal visible={reviewVisible} animationType="slide" transparent onRequestClose={() => setReviewVisible(false)}>
      <View style={styles.modalBackdrop}>
        <SafeAreaView style={styles.modalSheet} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Повторение</Text>
              <Text style={styles.modalSubtitle}>Ваш личный словарь · {practice.activeCount}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={() => setReviewVisible(false)} style={styles.closeButton}>
              <Ionicons name="close" size={23} color={theme.colors.primary} />
            </Pressable>
          </View>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeadText, styles.numberCell]}>№</Text>
            <Text style={[styles.tableHeadText, styles.hanziCell]}>Знак</Text>
            <Text style={[styles.tableHeadText, styles.infoCell]}>Перевод</Text>
            <Text style={[styles.tableHeadText, styles.infoCell]}>Пиньинь</Text>
          </View>
          <ScrollView style={styles.tableScroll} contentContainerStyle={styles.tableContent}>
            {practice.activeCharacters.map((item, index) => (
              <Pressable key={item.id} accessibilityRole="button" onPress={() => chooseForReview(item.id)} style={[styles.tableRow, practice.character?.id === item.id && styles.tableRowSelected]}>
                <Text style={[styles.numberCell, styles.tableNumber]}>{index + 1}</Text>
                <Text style={[styles.hanziCell, styles.tableHanzi]}>{item.hanzi}{item.mastered ? ' ✓' : ''}</Text>
                <Text style={[styles.infoCell, styles.tableInfo]}>{item.meaning}</Text>
                <Text style={[styles.infoCell, styles.tableInfo]}>{item.pinyin}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.modalHint}>Нажмите на строку, чтобы выбрать иероглиф для тренировки.</Text>
        </SafeAreaView>
      </View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  page: { flex: 1, width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, gap: theme.spacing.xs },
  compactPage: { paddingVertical: 3, gap: 3 },
  header: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1, minWidth: 0 },
  brandMark: { width: 34, height: 34, backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  brandCharacter: { fontSize: 24, color: theme.colors.white },
  brandTitle: { fontSize: 19, fontWeight: '700', color: theme.colors.ink },
  brandSubtitle: { fontSize: 8, color: theme.colors.subtle, letterSpacing: 0.6 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.primarySoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.pill, marginLeft: 6 },
  progressLabels: { alignItems: 'center' },
  reviewLabel: { color: theme.colors.primary, fontWeight: '600', fontSize: 10 },
  progressText: { color: theme.colors.primary, fontWeight: '700', fontSize: theme.font.small },
  addPanel: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 7, gap: 6, borderWidth: 1, borderColor: theme.colors.border },
  addRow: { flexDirection: 'row', gap: 6 },
  hanziInput: { flex: 1, minWidth: 0, height: 42, borderRadius: theme.radius.sm, backgroundColor: theme.colors.board, paddingHorizontal: 12, paddingVertical: 0, color: theme.colors.ink, fontSize: 16, includeFontPadding: false, textAlignVertical: 'center' },
  addButton: { minWidth: 112, height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 10, backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm },
  addButtonText: { color: theme.colors.white, fontSize: theme.font.small, fontWeight: '600', flexShrink: 1 },
  detailRow: { flexDirection: 'row', gap: 6 },
  detailInput: { flex: 1, minWidth: 0, height: 38, borderRadius: theme.radius.sm, backgroundColor: theme.colors.board, paddingHorizontal: 10, paddingVertical: 0, color: theme.colors.ink, fontSize: 13, includeFontPadding: false, textAlignVertical: 'center' },
  inputHint: { color: theme.colors.subtle, fontSize: 9, lineHeight: 12, paddingHorizontal: 3 },
  notice: { color: theme.colors.primary, fontSize: theme.font.tiny, lineHeight: 16 },
  storageWarning: { color: theme.colors.dangerText, fontSize: theme.font.tiny },
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20, 30, 26, 0.42)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '88%', minHeight: '55%', backgroundColor: theme.colors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 },
  modalTitle: { color: theme.colors.ink, fontSize: 22, fontWeight: '700' },
  modalSubtitle: { color: theme.colors.subtle, fontSize: 12, marginTop: 2 },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 38, paddingHorizontal: 7, backgroundColor: theme.colors.primarySoft, borderTopLeftRadius: 9, borderTopRightRadius: 9 },
  tableHeadText: { color: theme.colors.primary, fontSize: 11, fontWeight: '700' },
  numberCell: { width: '9%', textAlign: 'center' },
  hanziCell: { width: '17%', textAlign: 'center' },
  infoCell: { width: '37%', paddingHorizontal: 5 },
  tableScroll: { flexGrow: 0, flexShrink: 1 },
  tableContent: { paddingBottom: 4 },
  tableRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 7, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface },
  tableRowSelected: { backgroundColor: theme.colors.primarySoft },
  tableNumber: { color: theme.colors.subtle, fontSize: 13 },
  tableHanzi: { color: theme.colors.ink, fontSize: 25 },
  tableInfo: { color: theme.colors.ink, fontSize: 13, lineHeight: 18, flexWrap: 'wrap' },
  modalHint: { color: theme.colors.subtle, fontSize: 11, textAlign: 'center', paddingTop: 10, paddingBottom: 3 },
});
