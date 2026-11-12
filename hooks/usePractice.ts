import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { categories, characters, getTopicCharacters } from '@/services/characters';
import { CharacterShape, evaluateWriting, loadShape, Point } from '@/services/strokes';
import { getMasteredCharacters } from '@/services/progress';
import { useStudy } from './useStudy';

type ToleranceMode = 'L' | 'M' | 'H';
const settingsKey = 'hanzipractice:settings:v1';
const attemptsKey = 'hanzipractice:attempts:v1';
const toleranceValues: Record<ToleranceMode, number> = { L: 20, M: 15, H: 10 };

export function usePractice() {
  const { state, ready, storageError, studyMode, review, selectMode, selectCategory, submitAttempt } = useStudy();
  const isReview = studyMode === 'review';
  const currentId = isReview ? review.currentId : state.currentId;
  const categoryId = isReview ? review.categoryId : state.categoryId;
  const character = characters.find(item => item.id === currentId) ?? null;
  const category = categories.find(item => item.id === categoryId) ?? categories[0];
  const [shape, setShape] = useState<CharacterShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [liveStroke, setLiveStroke] = useState<Point[]>([]);
  const live = useRef<Point[]>([]);
  const [hint, setHint] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [exampleView, setExampleView] = useState(0);
  const [checking, setChecking] = useState(false);
  const [awaitingRetry, setAwaitingRetry] = useState(false);
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [toleranceMode, setToleranceMode] = useState<ToleranceMode>('L');
  const [boardScale, setBoardScaleState] = useState(0.9);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [attemptMap, setAttemptMap] = useState<Record<string, number>>({});
  const [attemptsLoaded, setAttemptsLoaded] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearInk = useCallback(() => { live.current = []; setLiveStroke([]); setStrokes([]); }, []);
  const cancelStroke = useCallback(() => { live.current = []; setLiveStroke([]); }, []);

  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(settingsKey), AsyncStorage.getItem(attemptsKey)]).then(([rawSettings, rawAttempts]) => {
      if (!active) return;
      if (rawSettings) {
        try { const value = JSON.parse(rawSettings); if (['L', 'M', 'H'].includes(value.toleranceMode)) setToleranceMode(value.toleranceMode); if (Number.isFinite(value.boardScale)) setBoardScaleState(Math.max(0.6, Math.min(0.9, value.boardScale))); } catch { /* Keep defaults for invalid settings. */ }
      }
      if (rawAttempts) { try { const value = JSON.parse(rawAttempts); if (value && typeof value === 'object') setAttemptMap(value); } catch { /* Keep an empty counter map. */ } }
      setSettingsLoaded(true); setAttemptsLoaded(true);
    }).catch(() => { if (active) { setSettingsLoaded(true); setAttemptsLoaded(true); } });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (settingsLoaded) AsyncStorage.setItem(settingsKey, JSON.stringify({ toleranceMode, boardScale })).catch(() => undefined); }, [settingsLoaded, toleranceMode, boardScale]);
  useEffect(() => { if (character) setAttemptCount(attemptMap[character.id] ?? 0); else setAttemptCount(0); }, [character?.id, attemptMap]);
  useEffect(() => {
    if (!attemptsLoaded || !ready) return;
    const merged = { ...attemptMap }; let changed = false;
    Object.entries(state.progress).forEach(([id, entry]) => { if ((merged[id] ?? 0) < entry.attempts) { merged[id] = entry.attempts; changed = true; } });
    if (changed) setAttemptMap(merged);
    AsyncStorage.setItem(attemptsKey, JSON.stringify(merged)).catch(() => undefined);
  }, [attemptsLoaded, ready, state.progress, attemptMap]);

  const setBoardScale = useCallback((scale: number) => setBoardScaleState(previous => Math.max(0.6, Math.min(0.9, scale))), []);
  const resizeBoard = useCallback((factor: number) => setBoardScaleState(previous => Math.max(0.6, Math.min(0.9, previous * factor))), []);
  const cycleTolerance = useCallback(() => setToleranceMode(previous => previous === 'L' ? 'M' : previous === 'M' ? 'H' : 'L'), []);

  useEffect(() => {
    let active = true;
    if (timer.current) clearTimeout(timer.current);
    setChecking(false); setAwaitingRetry(false); setFlash(null); clearInk(); setHint(false); setUsedHint(false); setExampleView(0); setFeedback(''); setShape(null); setLoadError('');
    if (!ready || !character) { setLoading(!ready); return () => { active = false; }; }
    setLoading(true);
    loadShape(character.hanzi).then(data => { if (active) setShape(data); }).catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'Образец не загружен.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (timer.current) clearTimeout(timer.current); };
  }, [character?.id, categoryId, studyMode, ready, reload, clearInk]);

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
    if (points.length) setStrokes(previous => [...previous, points.length === 1 ? [...points, { x: points[0].x + 0.1, y: points[0].y + 0.1 }] : points]);
    live.current = []; setLiveStroke([]);
  }, []);
  const toggleHint = useCallback(() => { if (!shape || checking || awaitingRetry) return; setHint(previous => !previous); setUsedHint(true); }, [shape, checking, awaitingRetry]);
  const clear = useCallback(() => { if (!checking && !awaitingRetry) { clearInk(); setFeedback(''); setFlash(null); } }, [checking, awaitingRetry, clearInk]);

  const retry = useCallback(() => {
    if (!awaitingRetry) return;
    clearInk(); setHint(false); setUsedHint(false); setExampleView(0); setFlash(null); setAwaitingRetry(false); setFeedback('');
  }, [awaitingRetry, clearInk]);

  const check = useCallback(() => {
    if (awaitingRetry) { retry(); return; }
    if (!shape || checking || !attemptsLoaded || !strokes.length || live.current.length) return;
    const verdict = evaluateWriting(strokes, shape, toleranceValues[toleranceMode]);
    if (character && attemptsLoaded) {
      const nextCount = (attemptMap[character.id] ?? 0) + 1;
      const nextMap = { ...attemptMap, [character.id]: nextCount };
      setAttemptMap(nextMap); setAttemptCount(nextCount);
      AsyncStorage.setItem(attemptsKey, JSON.stringify(nextMap)).catch(() => undefined);
    }
    setFeedback(verdict.message); setFlash(verdict.correct ? 'success' : 'error');
    if (verdict.correct) {
      setChecking(true);
      timer.current = setTimeout(() => {
        clearInk(); setHint(false); setUsedHint(false); setExampleView(0); setFlash(null); setChecking(false);
        submitAttempt(true, usedHint);
      }, 700);
    } else {
      setChecking(false); setAwaitingRetry(true);
      submitAttempt(false, usedHint);
    }
  }, [awaitingRetry, retry, shape, checking, strokes, toleranceMode, character, attemptsLoaded, attemptMap, clearInk, submitAttempt, usedHint]);

  const topic = useMemo(() => getTopicCharacters(categoryId), [categoryId]);
  const mastered = topic.filter(item => (state.progress[item.id]?.streak ?? 0) >= 10).length;
  const totalMastered = characters.filter(item => (state.progress[item.id]?.streak ?? 0) >= 10).length;
  const streak = character ? state.progress[character.id]?.streak ?? 0 : 0;
  const nextCategory = categories.find(item => item.id !== category.id && getTopicCharacters(item.id).some(char => (state.progress[char.id]?.streak ?? 0) < 10));
  const nextReviewCategory = categories.find(item => item.id !== category.id && getMasteredCharacters(item.id, state.progress).length > 0);
  return { character, category, categories, ready, attemptsLoaded, storageError, studyMode, isReview, shape, loading, loadError, strokes, liveStroke, hint, usedHint, exampleView, checking, awaitingRetry, flash, feedback, mastered, totalMastered, streak, nextCategory, nextReviewCategory, attemptCount, toleranceMode, toleranceLimit: toleranceValues[toleranceMode], boardScale,
    beginStroke, moveStroke, endStroke, cancelStroke, toggleHint, clear, check, retryLoad: () => setReload(value => value + 1), cycleExample: () => setExampleView(value => (value + 1) % 3), selectCategory, selectMode, cycleTolerance, resizeBoard, setBoardScale };
}
