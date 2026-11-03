import { useEffect, useRef } from 'react';
import { streamApi, type Reading, type Alert } from '../services/api';

interface UseLiveStreamArgs {
  onReading?: (r: Reading) => void;
  onAlert?: (a: Alert) => void;
}

export function useLiveStream({ onReading, onAlert }: UseLiveStreamArgs): void {
  const readingRef = useRef(onReading);
  const alertRef = useRef(onAlert);
  readingRef.current = onReading;
  alertRef.current = onAlert;

  useEffect(() => {
    const unsubscribe = streamApi.subscribe({
      onReading: r => readingRef.current?.(r),
      onAlert: a => alertRef.current?.(a),
    });
    return unsubscribe;
  }, []);
}