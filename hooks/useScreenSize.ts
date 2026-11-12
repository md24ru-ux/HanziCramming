import { Dimensions } from 'react-native';
import { useEffect, useState } from 'react';
export function useScreenSize() {
  const [size, setSize] = useState({ width: 375, height: 667 });
  useEffect(() => {
    const update = () => { const next = Dimensions.get('window'); setSize({ width: Math.max(1, next.width || 375), height: Math.max(1, next.height || 667) }); };
    update(); const subscription = Dimensions.addEventListener('change', update);
    return () => subscription.remove();
  }, []);
  return size;
}
