import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { CharacterShape, evaluateWriting, loadShape, Point } from '@/services/strokes';
import { DictionaryData, PersonalEntry, WaitingEntry, dictionaryLookup, loadPersonalDictionary, makeEntry, savePersonalDictionary } from '@/services/personalDictionary';

type ToleranceMode = 'L' | 'M' | 'H';
const settingsKey = 'hanzicramming:settings:v1';
const toleranceValues: Record<ToleranceMode, number> = { L: 20, M: 15, H: 10 };
const missingMessage = 'Эталон написания не найден. Иероглиф сохранён в списке ожидания, но пока недоступен для тренировки. Приложение повторит поиск эталона позднее.';
const offlineMessage = 'Интернет не доступен. Не удалось проверить наличие эталона';

export function usePractice() {
  const [data, setData] = useState<DictionaryData>({ active: [], waiting: [], currentId: null });
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [shape, setShape] = useState<CharacterShape | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [liveStroke, setLiveStroke] = useState<Point[]>([]);
  const live = useRef<Point[]>([]);
  const [hint, setHint] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [checking, setChecking] = useState(false);
  const [awaitingRetry, setAwaitingRetry] = useState(false);
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [toleranceMode, setToleranceMode] = useState<ToleranceMode>('L');
  const [boardScale, setBoardScaleState] = useState(0.9);
  const [attemptsLoaded, setAttemptsLoaded] = useState(true);
  const [attemptCount, setAttemptCount] = useState(0);
  const [notice, setNotice] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const character = data.active.find(x => x.id === data.currentId) ?? null;

  useEffect(() => {
    let active = true;
    Promise.all([loadPersonalDictionary(), AsyncStorage.getItem(settingsKey)]).then(([saved, rawSettings]) => {
      if (!active) return;
      setData(saved);
      if (rawSettings) {
        try { const v = JSON.parse(rawSettings); if (['L','M','H'].includes(v.toleranceMode)) setToleranceMode(v.toleranceMode); if (Number.isFinite(v.boardScale)) setBoardScaleState(Math.max(0.6, Math.min(0.9, v.boardScale))); } catch {}
      }
    }).catch(() => { if (active) setStorageError('Не удалось прочитать личный словарь.'); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (ready) savePersonalDictionary(data).then(() => setStorageError('')).catch(() => setStorageError('Изменения пока не сохранены на устройстве.')); }, [data, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(settingsKey, JSON.stringify({ toleranceMode, boardScale })).catch(() => undefined); }, [ready, toleranceMode, boardScale]);
  useEffect(() => { setAttemptCount(character?.attempts ?? 0); }, [character?.id, character?.attempts]);

  const clearInk = useCallback(() => { live.current = []; setLiveStroke([]); setStrokes([]); }, []);
  const resetSession = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setChecking(false); setAwaitingRetry(false); setFlash(null); clearInk(); setHint(false); setUsedHint(false); setFeedback(''); setShape(null); setLoadError('');
  }, [clearInk]);

  const loadReference = useCallback(async (hanzi: string) => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) throw new Error(offlineMessage);
    return loadShape(hanzi);
  }, []);

  useEffect(() => {
    let active = true;
    resetSession();
    if (!ready || !character) { setLoading(false); return () => { active = false; }; }
    setLoading(true);
    loadReference(character.hanzi).then(v => { if (active) { setShape(v); setNotice(current => current === offlineMessage ? '' : current); } })
      .catch(e => { if (active) setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить эталон.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (timer.current) clearTimeout(timer.current); };
  }, [ready, character?.id, reload, loadReference, resetSession]);

  const retryWaiting = useCallback(async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected || !data.waiting.length) return;
    for (const item of data.waiting) {
      try {
        await loadShape(item.hanzi);
        setNotice(current => current === offlineMessage ? '' : current);
        setData(prev => {
          const pending = prev.waiting.find(x => x.id === item.id);
          if (!pending || prev.active.some(x => x.id === item.id)) return prev;
          const entry = makeEntry(item.hanzi, item.pinyin, item.meaning);
          return { ...prev, waiting: prev.waiting.filter(x => x.id !== item.id), active: [...prev.active, entry], currentId: prev.currentId ?? entry.id };
        });
      } catch { /* Keep unavailable characters in the waiting list for the next check. */ }
    }
  }, [data.waiting]);

  useEffect(() => {
    if (!ready || !data.waiting.length) return;
    const unsubscribe = NetInfo.addEventListener(state => { if (state.isConnected) retryWaiting(); });
    NetInfo.fetch().then(state => { if (state.isConnected) retryWaiting(); });
    const interval = setInterval(() => retryWaiting(), 6 * 60 * 60 * 1000);
    return () => { unsubscribe(); clearInterval(interval); };
  }, [ready, data.waiting.length, retryWaiting]);

  const addCharacter = useCallback(async (rawHanzi: string, manualPinyin = '', manualMeaning = '') => {
    // Keep the full input intact for Chinese IME composition, then process each Hanzi separately.
    const characters = Array.from(rawHanzi.trim()).filter(char => /[\u3400-\u9FFF]/u.test(char));
    if (!characters.length) {
      setNotice('Введите китайский иероглиф или слово.');
      return 'invalid';
    }

    const canUseManualDetails = characters.length === 1;
    const active = [...data.active];
    const waiting = [...data.waiting];
    let addedCount = 0;
    let offlineCount = 0;
    let missingCount = 0;
    let existsCount = 0;
    let needsDetails = false;
    let selectedId: string | null = null;

    for (const hanzi of characters) {
      if (active.some(x => x.id === hanzi)) {
        existsCount += 1;
        selectedId ??= hanzi;
        continue;
      }
      if (waiting.some(x => x.id === hanzi)) {
        existsCount += 1;
        continue;
      }

      const known = dictionaryLookup(hanzi);
      const pinyin = known?.pinyin ?? (canUseManualDetails ? manualPinyin.trim() : '');
      const meaning = known?.meaning ?? (canUseManualDetails ? manualMeaning.trim() : '');
      if (!pinyin || !meaning) {
        needsDetails = true;
        continue;
      }

      try {
        const net = await NetInfo.fetch();
        if (!net.isConnected) throw new Error(offlineMessage);
        await loadShape(hanzi);
        const entry = makeEntry(hanzi, pinyin, meaning);
        active.push(entry);
        addedCount += 1;
        selectedId ??= entry.id;
      } catch (e) {
        const message = e instanceof Error ? e.message : '';
        const offline = message === offlineMessage || message === 'NETWORK_UNAVAILABLE' || !(await NetInfo.fetch()).isConnected;
        waiting.push({
          id: hanzi, hanzi, pinyin, meaning,
          reason: offline ? 'offline' : 'missing',
          addedAt: Date.now(),
        });
        if (offline) offlineCount += 1;
        else missingCount += 1;
      }
    }

    if (addedCount || offlineCount || missingCount) {
      setData(prev => ({
        ...prev,
        active,
        waiting,
        currentId: selectedId && active.some(x => x.id === selectedId) ? selectedId : prev.currentId,
      }));
    } else if (selectedId) {
      setData(prev => ({ ...prev, currentId: selectedId }));
    }

    if (needsDetails) {
      setNotice(characters.length > 1
        ? 'Некоторые иероглифы отсутствуют в словаре. Добавьте каждый такой знак отдельно, указав его пиньинь и перевод.'
        : 'Для нового иероглифа укажите пиньинь и перевод.');
      return 'details';
    }
    if (offlineCount) {
      setNotice(offlineMessage);
      return 'offline';
    }
    if (missingCount) {
      setNotice(missingMessage);
      return 'missing';
    }
    if (addedCount) {
      setNotice(addedCount === 1 ? 'Иероглиф добавлен. Можно начинать тренировку.' : `Добавлено иероглифов: ${addedCount}. Каждый доступен для отдельной тренировки.`);
      return 'added';
    }
    setNotice('Эти иероглифы уже есть в личном словаре или списке ожидания.');
    return existsCount ? 'exists' : 'invalid';
  }, [data.active, data.waiting]);

  const selectCharacter = useCallback((id: string) => {
    if (!checking && !awaitingRetry && data.active.some(x => x.id === id)) {
      setData(p => ({ ...p, currentId: id }));
    }
  }, [checking, awaitingRetry, data.active]);

  const beginStroke = useCallback((point: Point) => {
    if (checking || awaitingRetry || !shape || loading) return;
    live.current = [point]; setLiveStroke([point]); setFeedback('');
  }, [checking, awaitingRetry, shape, loading]);
  const moveStroke = useCallback((point: Point) => {
    const previous = live.current[live.current.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) < 2) return;
    live.current = [...live.current, point]; setLiveStroke(live.current);
  }, []);
  const endStroke = useCallback(() => {
    const points = live.current;
    if (points.length) setStrokes(p => [...p, points.length === 1 ? [...points, { x: points[0].x + 0.1, y: points[0].y + 0.1 }] : points]);
    live.current = []; setLiveStroke([]);
  }, []);
  const toggleHint = useCallback(() => { if (!shape || checking || awaitingRetry) return; setHint(p => !p); setUsedHint(true); }, [shape, checking, awaitingRetry]);
  const clear = useCallback(() => { if (!checking && !awaitingRetry) { clearInk(); setFeedback(''); setFlash(null); } }, [checking, awaitingRetry, clearInk]);
  const retry = useCallback(() => { if (!awaitingRetry) return; clearInk(); setHint(false); setUsedHint(false); setFlash(null); setAwaitingRetry(false); setFeedback(''); }, [awaitingRetry, clearInk]);

  const submit = useCallback((correct: boolean) => {
    if (!character) return;
    setData(prev => {
      const item = prev.active.find(x => x.id === character.id);
      if (!item) return prev;
      const streak = correct && !usedHint ? item.streak + 1 : 0;
      const updated: PersonalEntry = { ...item, streak, attempts: item.attempts + 1, successes: item.successes + (correct && !usedHint ? 1 : 0), mastered: streak >= 10, lastPracticed: Date.now() };
      const active = prev.active.map(x => x.id === item.id ? updated : x);
      const next = active.find(x => !x.mastered && x.id !== item.id) ?? (updated.mastered ? active.find(x => !x.mastered) : updated);
      return { ...prev, active, currentId: correct ? (next?.id ?? updated.id) : item.id };
    });
  }, [character, usedHint]);

  const check = useCallback(() => {
    if (awaitingRetry) { retry(); return; }
    if (!shape || checking || !strokes.length || live.current.length) return;
    const verdict = evaluateWriting(strokes, shape, toleranceValues[toleranceMode]);
    setAttemptCount(p => p + 1);
    setFeedback(verdict.message); setFlash(verdict.correct ? 'success' : 'error');
    if (verdict.correct) {
      setChecking(true);
      timer.current = setTimeout(() => {
        clearInk(); setHint(false); setUsedHint(false); setFlash(null); setChecking(false); submit(true);
      }, 700);
    } else {
      setAwaitingRetry(true);
      submit(false);
    }
  }, [awaitingRetry, retry, shape, checking, strokes, toleranceMode, clearInk, submit]);

  const setBoardScale = useCallback((scale: number) => setBoardScaleState(p => Math.max(0.6, Math.min(0.9, scale))), []);
  const resizeBoard = useCallback((factor: number) => setBoardScaleState(p => Math.max(0.6, Math.min(0.9, p * factor))), []);
  const cycleTolerance = useCallback(() => setToleranceMode(p => p === 'L' ? 'M' : p === 'M' ? 'H' : 'L'), []);
  const selectTolerance = useCallback((mode: ToleranceMode) => setToleranceMode(mode), []);
  const retryLoad = useCallback(() => setReload(p => p + 1), []);
  return {
    character, ready, attemptsLoaded, storageError, studyMode: 'learn' as const, isReview: false,
    shape, loading, loadError, strokes, liveStroke, hint, usedHint, checking, awaitingRetry, flash, feedback,
    mastered: data.active.filter(x => x.mastered).length, totalMastered: data.active.filter(x => x.mastered).length,
    streak: character?.streak ?? 0, attemptCount, toleranceMode, toleranceLimit: toleranceValues[toleranceMode], boardScale,
    activeCharacters: data.active, waitingCharacters: data.waiting, activeCount: data.active.length, waitingCount: data.waiting.length,
    notice, clearNotice: () => setNotice(''), addCharacter, selectCharacter, retryWaiting,
    beginStroke, moveStroke, endStroke, cancelStroke: () => { live.current = []; setLiveStroke([]); },
    toggleHint, clear, check, retryLoad, cycleTolerance, selectTolerance, resizeBoard, setBoardScale,
    selectMode: () => undefined, selectCategory: () => undefined,
  };
}
