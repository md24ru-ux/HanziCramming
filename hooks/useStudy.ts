import { useContext } from 'react';
import { StudyContext } from '@/contexts/StudyContext';
export function useStudy() {
  const value = useContext(StudyContext);
  if (!value) throw new Error('useStudy requires StudyProvider');
  return value;
}
