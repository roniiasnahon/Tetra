
const originalError = console.error;
console.error = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Maximum update depth exceeded')) {
        console.trace("Max update depth exceeded trace:");
    }
    originalError(...args);
};
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
