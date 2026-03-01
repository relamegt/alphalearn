import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import queryClient from './services/queryClient';
import './index.css';

// Note: Monaco workers are managed internally by @monaco-editor/react.
// No manual monaco-editor imports needed here.

if (import.meta.env.PROD) {
    console.log = () => { };
    console.info = () => { };
    console.debug = () => { };
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <QueryClientProvider client={queryClient}>
        <App />
        {/* DevTools only appear in development — zero bundle cost in production */}
        {import.meta.env.DEV && (
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
        )}
    </QueryClientProvider>
);
