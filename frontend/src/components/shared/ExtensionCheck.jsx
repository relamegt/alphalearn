import { useState, useEffect } from 'react';

const ExtensionCheck = ({ children }) => {
    const [isInstalled, setIsInstalled] = useState(false);
    const [checking, setChecking] = useState(true);

    // Development bypass
    const isDevelopment = import.meta.env.MODE === 'development' ||
        window.location.hostname === 'localhost';

    useEffect(() => {
        // Immediate check for dev mode
        if (isDevelopment) {
            console.log('⚠️ Development Mode: Bypassing Extension Check');
            setIsInstalled(true);
            setChecking(false);
            return;
        }

        const interval = setInterval(() => {
            if (window.__ALPHALEARN_EXTENSION_INSTALLED__) {
                setIsInstalled(true);
                setChecking(false);
                clearInterval(interval);
            }
        }, 500);

        const timeout = setTimeout(() => {
            clearInterval(interval);
            setChecking(false);
        }, 3000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [isDevelopment]);

    if (checking && !isInstalled) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="text-center">
                    <div className="spinner mb-4"></div>
                    <p className="text-gray-600">Verifying security requirements...</p>
                </div>
            </div>
        );
    }

    if (!isInstalled && !isDevelopment) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Extension Required</h2>
                    <p className="text-gray-600 mb-6">
                        To participate in contests and solve problems, you must have the AlphaLearn Browser Extension installed and active.
                    </p>
                    <a
                        href="#"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        Download Extension
                    </a>
                    <div className="mt-4 text-sm text-gray-500">
                        Please refresh this page after installation.
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default ExtensionCheck;
