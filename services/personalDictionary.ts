import AsyncStorage from '@react-native-async-storage/async-storage';
import { Character, characters } from './characters';

export interface PersonalEntry {
  id: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  streak: number;
  attempts: number;
  successes: number;
  mastered: boolean;
  addedAt: number;
  lastPracticed: number;
}
export interface WaitingEntry {
  id: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  reason: 'offline' | 'missing';
  addedAt: number;
}
export interface DictionaryData { active: PersonalEntry[]; waiting: WaitingEntry[]; currentId: string | null; }
const key = 'hanzicramming:personal-dictionary:v1';
const empty: DictionaryData = { active: [], waiting: [], currentId: null };

export function dictionaryLookup(hanzi: string): Pick<Character, 'pinyin' | 'meaning'> | null {
  const found = characters.find(item => item.hanzi === hanzi);
  return found ? { pinyin: found.pinyin, meaning: found.meaning } : null;
}
export async function loadPersonalDictionary(): Promise<DictionaryData> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return empty;
  try {
    const value = JSON.parse(raw) as Partial<DictionaryData>;
    const active = Array.isArray(value.active) ? value.active.filter(x => x && typeof x.hanzi === 'string') : [];
    const waiting = Array.isArray(value.waiting) ? value.waiting.filter(x => x && typeof x.hanzi === 'string') : [];
    const currentId = active.some(x => x.id === value.currentId && !x.mastered) ? value.currentId! : active.find(x => !x.mastered)?.id ?? null;
    return { active, waiting, currentId };
  } catch { return empty; }
}
let writeQueue: Promise<unknown> = Promise.resolve();
export function savePersonalDictionary(value: DictionaryData): Promise<void> {
  const write = writeQueue.catch(() => undefined).then(() => AsyncStorage.setItem(key, JSON.stringify(value)));
  writeQueue = write;
  return write;
}
export function makeEntry(hanzi: string, pinyin: string, meaning: string): PersonalEntry {
  return { id: hanzi, hanzi, pinyin, meaning, streak: 0, attempts: 0, successes: 0, mastered: false, addedAt: Date.now(), lastPracticed: 0 };
}
