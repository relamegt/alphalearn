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
        return;
    }

    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });
    console.log('🔒 Right-click disabled (Production mode)');
};

// Disable F12, Ctrl+Shift+I/C/J, Ctrl+U
export const disableDevTools = () => {
    if (isDevelopment()) {
        console.log('🔓 DevTools shortcuts enabled (Development mode)');
        return;
    }

    document.addEventListener('keydown', (e) => {
        // F12
        if (e.key === 'F12') {
            e.preventDefault();
            alert('🔒 Inspection tools are disabled for security reasons.');
            return false;
        }

        // Ctrl+Shift+I (Inspect)
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            e.preventDefault();
            alert('🔒 Inspection tools are disabled for security reasons.');
            return false;
        }

        // Ctrl+Shift+C (Inspect element)
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            return false;
        }

        // Ctrl+Shift+J (Console)
        if (e.ctrlKey && e.shiftKey && e.key === 'J') {
            e.preventDefault();
            return false;
        }

        // Ctrl+U (View source)
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            return false;
        }
    });
    console.log('🔒 DevTools shortcuts disabled (Production mode)');
};

// Detect DevTools open (size-based detection)
export const detectDevTools = (onDetect) => {
    if (isDevelopment()) {
        console.log('🔓 DevTools detection disabled (Development mode)');
        return () => { }; // Return empty cleanup function
    }

    const threshold = 160;
    let isOpen = false;

    const checkDevTools = () => {
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;

        if ((widthThreshold || heightThreshold) && !isOpen) {
            isOpen = true;
            if (onDetect) {
                onDetect();
            }
        } else if (!(widthThreshold || heightThreshold) && isOpen) {
            isOpen = false;
        }
    };

    const interval = setInterval(checkDevTools, 1000);

    console.log('🔒 DevTools detection enabled (Production mode)');

    // Cleanup
    return () => clearInterval(interval);
};

// Apply secure mode to body
export const enableSecureMode = () => {
    if (isDevelopment()) {
        console.log('🔓 Secure mode disabled (Development mode)');
        return;
    }

    document.body.classList.add('secure-mode');
    console.log('🔒 Secure mode enabled (Production mode)');
};

export const disableSecureMode = () => {
    document.body.classList.remove('secure-mode');
};

// Initialize all security features
export const initSecurityFeatures = (onDevToolsDetect = null) => {
    if (isDevelopment()) {
        console.log('');
        console.log('═══════════════════════════════════════════════════');
        console.log('🔓 DEVELOPMENT MODE: All security features disabled');
        console.log('   - Right-click: ENABLED');
        console.log('   - DevTools shortcuts: ENABLED');
        console.log('   - DevTools detection: DISABLED');
        console.log('   - Secure mode: DISABLED');
        console.log('═══════════════════════════════════════════════════');
        console.log('');
        return () => { }; // Return empty cleanup function
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('🔒 PRODUCTION MODE: All security features enabled');
    console.log('   - Right-click: DISABLED');
    console.log('   - DevTools shortcuts: DISABLED');
    console.log('   - DevTools detection: ENABLED');
    console.log('   - Secure mode: ENABLED');
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    disableRightClick();
    disableDevTools();
    enableSecureMode();

    if (onDevToolsDetect) {
        const cleanup = detectDevTools(onDevToolsDetect);
        return cleanup;
    }

    return () => { };
};
