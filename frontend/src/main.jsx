import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Note: Monaco workers are managed internally by @monaco-editor/react.
// No manual monaco-editor imports needed here.

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
);
