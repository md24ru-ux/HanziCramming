import { createContext, ReactNode, useCallback, useEffect, useState } from 'react';
import { categories, characters } from '@/services/characters';
import { chooseCharacter, chooseReviewCharacter, getMasteredCharacters, initialStudyState, loadProgress, recordAttempt, saveProgress, StudyMode, StudyState } from '@/services/progress';
interface StudyContextValue {
  state: StudyState; ready: boolean; storageError: string; studyMode: StudyMode;
  review: { categoryId: string; currentId: string | null };
  selectMode: (mode: StudyMode) => void;
  selectCategory: (id: string) => void;
  selectCharacter: (id: string) => void;
  submitAttempt: (correct: boolean, usedHint: boolean) => void;
}
export const StudyContext = createContext<StudyContextValue | undefined>(undefined);
export function StudyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StudyState>(initialStudyState);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  // Session-only review state: the adaptive word, category, and all progress stay intact.
  const [studyMode, setStudyMode] = useState<StudyMode>('learn');
  const [review, setReview] = useState<{ categoryId: string; currentId: string | null }>({ categoryId: 'verbs', currentId: null });
  useEffect(() => {
    let active = true;
    loadProgress().then(value => { if (active) setState(value); }).catch(() => { if (active) setStorageError('Не удалось прочитать сохранённый прогресс.'); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    saveProgress(state).then(() => { if (active) setStorageError(''); }).catch(() => { if (active) setStorageError('Прогресс пока не сохранён на устройстве.'); });
    return () => { active = false; };
  }, [state, ready]);
  const selectMode = useCallback((mode: StudyMode) => {
    if (!ready || mode === studyMode) return;
    if (mode === 'review') {
      const categoryId = getMasteredCharacters(state.categoryId, state.progress).length ? state.categoryId
        : categories.find(item => getMasteredCharacters(item.id, state.progress).length)?.id ?? state.categoryId;
      setReview({ categoryId, currentId: chooseReviewCharacter(categoryId, state.progress)?.id ?? null });
    }
    setStudyMode(mode);
  }, [ready, studyMode, state.categoryId, state.progress]);
  const selectCategory = useCallback((id: string) => {
    if (!ready || !categories.some(item => item.id === id)) return;
    if (studyMode === 'review') {
      setReview(previous => ({ categoryId: id, currentId: chooseReviewCharacter(id, state.progress, id === previous.categoryId ? previous.currentId : null)?.id ?? null }));
      return;
    }
    setState(previous => ({ ...previous, categoryId: id, currentId: chooseCharacter(id, previous.progress, id === previous.categoryId ? previous.currentId : null)?.id ?? null }));
  }, [ready, studyMode, state.progress]);
  const selectCharacter = useCallback((id: string) => {
    if (!ready) return;
    const selected = characters.find(item => item.id === id);
    if (!selected) return;
    if (studyMode === 'review') {
      if (getMasteredCharacters(selected.categoryId, state.progress).some(item => item.id === id)) {
        setReview({ categoryId: selected.categoryId, currentId: id });
      } else {
        // A character not mastered yet cannot be selected in review mode; open it in learning mode.
        setStudyMode('learn');
        setState(previous => ({ ...previous, categoryId: selected.categoryId, currentId: selected.id }));
      }
      return;
    }
    setState(previous => ({ ...previous, categoryId: selected.categoryId, currentId: selected.id }));
  }, [ready, studyMode, state.progress]);
  const submitAttempt = useCallback((correct: boolean, usedHint: boolean) => {
    if (!ready) return;
    if (studyMode === 'review') {
      // Even errors and hints do not reset mastery or alter any learning statistics.
      if (correct) setReview(previous => ({ ...previous, currentId: chooseReviewCharacter(previous.categoryId, state.progress, previous.currentId)?.id ?? null }));
      return;
    }
    setState(previous => recordAttempt(previous, correct, usedHint));
  }, [ready, studyMode, state.progress]);
  return <StudyContext.Provider value={{ state, ready, storageError, studyMode, review, selectMode, selectCategory, selectCharacter, submitAttempt }}>{children}</StudyContext.Provider>;
}
