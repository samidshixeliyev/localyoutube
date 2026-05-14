import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);

function getInitial() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  } catch { return false; }
}

export const ThemeProvider = ({ children }) => {
  const [dark, setDark] = useState(() => {
    const initial = getInitial();
    // Sync DOM immediately (the index.html script already did this,
    // but we double-check here in case React hydrates differently)
    document.documentElement.classList.toggle('dark', initial);
    return initial;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = () => setDark(d => !d);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};
