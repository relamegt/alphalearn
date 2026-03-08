import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

const DARK_MODE_ENABLED = import.meta.env.VITE_ENABLE_DARK_MODE === 'true';
const STORAGE_KEY = 'alphalearn-theme';

export const ThemeProvider = ({ children }) => {
    const [theme, setThemeState] = useState(() => {
        if (!DARK_MODE_ENABLED) return 'light';

        // One-time migration to dark mode for Everyone
        const migrationKey = 'theme_migrated_to_dark_v1';
        const isMigrated = localStorage.getItem(migrationKey);

        if (!isMigrated) {
            localStorage.setItem(migrationKey, 'true');
            localStorage.setItem(STORAGE_KEY, 'dark');
            return 'dark';
        }

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'dark' || stored === 'light') return stored;
        } catch { /* ignore */ }
        return 'dark';
    });

    const isDark = theme === 'dark' && DARK_MODE_ENABLED;

    // Apply the theme class to <html> and persist
    useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch { /* ignore */ }
    }, [theme, isDark]);

    const toggleTheme = useCallback(() => {
        if (!DARK_MODE_ENABLED) return;
        setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
    }, []);

    const setTheme = useCallback((t) => {
        if (!DARK_MODE_ENABLED && t === 'dark') return;
        setThemeState(t);
    }, []);

    return (
        <ThemeContext.Provider value={{
            theme,
            isDark,
            toggleTheme,
            setTheme,
            darkModeEnabled: DARK_MODE_ENABLED,
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
    return ctx;
};

export default ThemeContext;
