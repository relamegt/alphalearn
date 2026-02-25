import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initSecurityFeatures } from '../../utils/disableInspect';
import toast from 'react-hot-toast';

const SecurityWrapper = ({ children }) => {
    const location = useLocation();

    useEffect(() => {
        // Only trigger security logic on problem workspaces, contest pages, and coding environments.
        const isSecureRoute = location.pathname.startsWith('/problems') ||
            location.pathname.startsWith('/contests') ||
            location.pathname.startsWith('/workspace') ||
            // Account for any potential dynamic coding route names the user prefers.
            location.pathname.includes('/code');

        if (!isSecureRoute) {
            return; // Don't run security features on regular pages
        }

        // Initialize security features and handle devtools detection
        const cleanup = initSecurityFeatures(() => {
            toast.error('DevTools detected! Please close inspection tools.', {
                duration: 5000,
                icon: '🔒',
                style: {
                    background: '#FEF2F2',
                    color: '#991B1B',
                    border: '1px solid #FCA5A5',
                },
            });
        });

        return () => {
            cleanup();
        };
    }, [location.pathname]);

    return <>{children}</>;
};

export default SecurityWrapper;
