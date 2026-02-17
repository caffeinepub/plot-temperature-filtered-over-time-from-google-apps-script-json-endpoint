import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';

/**
 * Hook that derives a global "last updated" timestamp from the temperature-series query cache.
 * This ensures the timestamp stays consistent across page navigation and only updates on manual refresh.
 */
export function useGlobalLastUpdated(): string {
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  useEffect(() => {
    // Subscribe to query cache changes
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event?.query.queryKey[0] === 'temperature-series' &&
        event?.type === 'updated'
      ) {
        const queryState = queryClient.getQueryState(['temperature-series']);
        if (queryState?.dataUpdatedAt) {
          setLastUpdated(queryState.dataUpdatedAt);
        }
      }
    });

    // Initialize with current value
    const queryState = queryClient.getQueryState(['temperature-series']);
    if (queryState?.dataUpdatedAt) {
      setLastUpdated(queryState.dataUpdatedAt);
    }

    return unsubscribe;
  }, [queryClient]);

  if (!lastUpdated || lastUpdated === 0) {
    return '--:--:--';
  }

  return format(new Date(lastUpdated), 'HH:mm:ss');
}
