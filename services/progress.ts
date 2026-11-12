import AsyncStorage from '@react-native-async-storage/async-storage';
import { Character, characters, getTopicCharacters } from './characters';
export interface CharacterProgress { streak: number; attempts: number; successes: number; lastPracticed: number; }
export interface StudyState { categoryId: string; currentId: string | null; progress: Record<string, CharacterProgress>; }
export type StudyMode = 'learn' | 'review';
export function getMasteredCharacters(categoryId: string, progress: StudyState['progress']): Character[] {
  return getTopicCharacters(categoryId).filter(item => (progress[item.id]?.streak ?? 0) >= 10);
}
// Review uses its own selection and never writes to the adaptive progress.
export function chooseReviewCharacter(categoryId: string, progress: StudyState['progress'], previousId?: string | null): Character | null {
  const mastered = getMasteredCharacters(categoryId, progress);
  const pool = mastered.length > 1 ? mastered.filter(item => item.id !== previousId) : mastered;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
const storageKey = 'shtrikh:progress:v1';
export function chooseCharacter(categoryId: string, progress: StudyState['progress'], previousId?: string | null): Character | null {
  const available = getTopicCharacters(categoryId).filter(item => (progress[item.id]?.streak ?? 0) < 10);
  const pool = available.length > 1 ? available.filter(item => item.id !== previousId) : available;
  if (!pool.length) return null;
  const weights = pool.map(item => 1 / (1 + (progress[item.id]?.streak ?? 0) * 1.6 + (progress[item.id]?.successes ?? 0) * 0.15));
  let pick = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < pool.length; i++) { pick -= weights[i]; if (pick <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
export function initialStudyState(): StudyState { return { categoryId: 'verbs', currentId: '去', progress: {} }; }
export async function loadProgress(): Promise<StudyState> {
  const raw = await AsyncStorage.getItem(storageKey);
  if (!raw) return initialStudyState();
  const value = JSON.parse(raw) as StudyState;
  const categoryId = getTopicCharacters(value.categoryId ?? '').length ? value.categoryId : 'verbs';
  const progress: StudyState['progress'] = {};
  for (const item of characters) {
    const entry = value.progress?.[item.id];
    if (entry && Number.isFinite(entry.streak) && Number.isFinite(entry.attempts) && Number.isFinite(entry.successes)) {
      progress[item.id] = { streak: Math.max(0, Math.min(10, Math.floor(entry.streak))), attempts: Math.max(0, entry.attempts), successes: Math.max(0, entry.successes), lastPracticed: entry.lastPracticed || 0 };
    }
  }
  const current = getTopicCharacters(categoryId).find(item => item.id === value.currentId && (progress[item.id]?.streak ?? 0) < 10);
  return { categoryId, progress, currentId: current?.id ?? chooseCharacter(categoryId, progress)?.id ?? null };
}
let queue: Promise<unknown> = Promise.resolve();
export function saveProgress(state: StudyState): Promise<void> {
  const json = JSON.stringify(state);
  const write = queue.catch(() => undefined).then(() => AsyncStorage.setItem(storageKey, json));
  queue = write;
  return write;
}
export function recordAttempt(state: StudyState, correct: boolean, usedHint: boolean): StudyState {
  if (!state.currentId || (state.progress[state.currentId]?.streak ?? 0) >= 10) return state;
  const id = state.currentId;
  const previous = state.progress[id] ?? { streak: 0, attempts: 0, successes: 0, lastPracticed: 0 };
  const progress = { ...state.progress, [id]: { streak: correct && !usedHint ? previous.streak + 1 : 0, attempts: previous.attempts + 1, successes: previous.successes + (correct && !usedHint ? 1 : 0), lastPracticed: Date.now() } };
  return { ...state, progress, currentId: correct ? chooseCharacter(state.categoryId, progress, id)?.id ?? null : id };
}
