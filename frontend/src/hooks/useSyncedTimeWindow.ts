import { useState, useCallback, useMemo } from 'react';

export interface TimeWindow {
  startIndex: number;
  endIndex: number;
}

export function useSyncedTimeWindow(dataLength: number) {
  const [timeWindow, setTimeWindow] = useState<TimeWindow | null>(null);

  const visibleRange = useMemo(() => {
    if (!timeWindow || dataLength === 0) {
      return { startIndex: 0, endIndex: dataLength - 1 };
    }
    return {
      startIndex: Math.max(0, timeWindow.startIndex),
      endIndex: Math.min(dataLength - 1, timeWindow.endIndex),
    };
  }, [timeWindow, dataLength]);

  const setRange = useCallback((startIndex: number, endIndex: number) => {
    setTimeWindow({ startIndex, endIndex });
  }, []);

  const resetZoom = useCallback(() => {
    setTimeWindow(null);
  }, []);

  const isZoomed = timeWindow !== null;

  return {
    visibleRange,
    setRange,
    resetZoom,
    isZoomed,
  };
}
