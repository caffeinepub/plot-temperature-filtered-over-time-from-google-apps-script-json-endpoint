import { useState, useEffect } from 'react';

const THEME_STORAGE_KEY = 'app-theme-mode';

export function useThemeSession() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize from session storage or default to false
    const stored = sessionStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark';
  });

  useEffect(() => {
    // Synchronize document class with state
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Persist to session storage
    sessionStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  return {
    isDarkMode,
    toggleTheme,
  };
}
