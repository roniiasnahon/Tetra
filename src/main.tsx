import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const originalError = console.error;
console.error = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Maximum update depth exceeded')) {
    originalError('MAXIMUM UPDATE DEPTH EXCEEDED DETECTED!!!');
    try {
      const err = new Error();
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stack: err.stack, message: args[0] })
      });
    } catch(e) {}
    originalError(new Error().stack);
  }
  originalError(...args);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
