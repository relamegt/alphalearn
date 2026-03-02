// Check if running in development mode
const isDevelopment = () => {
    return import.meta.env.MODE === 'development' ||
        import.meta.env.DEV === true ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
};

// Disable right-click globally
export const disableRightClick = () => {
    if (isDevelopment()) {
        console.log('🔓 Right-click enabled (Development mode)');
        return () => { };
    }

    const contextMenuHandler = (e) => {
        e.preventDefault();
        return false;
    };
    document.addEventListener('contextmenu', contextMenuHandler);
    console.log('🔒 Right-click disabled (Production mode)');
    return () => document.removeEventListener('contextmenu', contextMenuHandler);
};

// Disable F12, Ctrl+Shift+I/C/J, Ctrl+U
export const disableDevTools = () => {
    if (isDevelopment()) {
        console.log('🔓 DevTools shortcuts enabled (Development mode)');
        return () => { };
    }

    const keydownHandler = (e) => {
        // F12
        if (e.key === 'F12') {
            e.preventDefault();
            alert('🔒 Inspection tools are disabled for security reasons. (Active only in workspace/contests)');
            return false;
        }

        // Ctrl+Shift+I (Inspect)
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
            e.preventDefault();
            alert('🔒 Inspection tools are disabled for security reasons. (Active only in workspace/contests)');
            return false;
        }

        // Ctrl+Shift+C (Inspect element)
        if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
            e.preventDefault();
            return false;
        }

        // Ctrl+Shift+J (Console)
        if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
            e.preventDefault();
            return false;
        }

        // Ctrl+U (View source)
        if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
            e.preventDefault();
            return false;
        }
    };

    document.addEventListener('keydown', keydownHandler);
    console.log('🔒 DevTools shortcuts disabled (Production mode)');
    return () => document.removeEventListener('keydown', keydownHandler);
};

// Detect DevTools open
// NOTE: Size-based detection (outerWidth vs innerWidth) is unreliable — it produces
// false positives when the user zooms the page or when the OS scrollbar is visible.
// We disable that heuristic entirely and rely only on keyboard-shortcut blocking above.
export const detectDevTools = (_onDetect) => {
    // No-op: size-based polling removed to prevent false positives on zoom.
    return () => { };
};

// Apply secure mode to body
export const enableSecureMode = () => {
    if (isDevelopment()) {
        console.log('🔓 Secure mode disabled (Development mode)');
        return () => { };
    }

    document.body.classList.add('secure-mode');
    console.log('🔒 Secure mode enabled (Production mode)');
    return () => document.body.classList.remove('secure-mode');
};

export const disableSecureMode = () => {
    document.body.classList.remove('secure-mode');
};

// Initialize all security features
export const initSecurityFeatures = (onDevToolsDetect = null) => {
    if (isDevelopment()) {
        console.log('🔓 DEVELOPMENT MODE: Security features disabled');
        return () => { };
    }

    console.log('🔒 PRODUCTION MODE: Target Security features enabled');

    const cleanupRightClick = disableRightClick();
    const cleanupDevTools = disableDevTools();
    const cleanupSecureMode = enableSecureMode();

    let cleanupDetect = () => { };
    if (onDevToolsDetect) {
        cleanupDetect = detectDevTools(onDevToolsDetect);
    }

    return () => {
        cleanupRightClick();
        cleanupDevTools();
        cleanupSecureMode();
        cleanupDetect();
    };
};
