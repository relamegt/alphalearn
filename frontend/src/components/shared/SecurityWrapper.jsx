import { useEffect } from 'react';
import { initSecurityFeatures } from '../../utils/disableInspect';
import toast from 'react-hot-toast';

const SecurityWrapper = ({ children }) => {
    useEffect(() => {
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
    }, []);

    return <>{children}</>;
};

export default SecurityWrapper;
