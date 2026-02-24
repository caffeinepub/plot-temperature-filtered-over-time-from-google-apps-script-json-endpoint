import { useState } from 'react';
import { logSystemPages } from '@/logSystems/logSystemPages';

export function useLogSystemNavigation() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? logSystemPages.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === logSystemPages.length - 1 ? 0 : prev + 1));
  };

  const goToPageId = (pageId: string) => {
    const index = logSystemPages.findIndex((page) => page.id === pageId);
    if (index !== -1) {
      setCurrentIndex(index);
    }
  };

  const currentPage = logSystemPages[currentIndex];

  return {
    currentPage,
    currentIndex,
    totalPages: logSystemPages.length,
    goToPrevious,
    goToNext,
    goToPageId,
  };
}
