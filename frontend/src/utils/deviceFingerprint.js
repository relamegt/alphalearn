// Generate device fingerprint for session tracking
export const generateDeviceFingerprint = () => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('alphalearn', 2, 2);

        const fingerprint = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            languages: navigator.languages?.join(','),
            platform: navigator.platform,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            screenResolution: `${screen.width}x${screen.height}x${screen.colorDepth}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),
            canvasFingerprint: canvas.toDataURL(),
            webglVendor: getWebGLVendor(),
        };

        return btoa(JSON.stringify(fingerprint));
    } catch (error) {
        console.error('Fingerprint generation error:', error);
        return btoa(JSON.stringify({ userAgent: navigator.userAgent }));
    }
};

// Get WebGL vendor for enhanced fingerprinting
const getWebGLVendor = () => {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return 'unknown';

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        return debugInfo
            ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
            : 'unknown';
    } catch {
        return 'unknown';
    }
};

export default generateDeviceFingerprint;
