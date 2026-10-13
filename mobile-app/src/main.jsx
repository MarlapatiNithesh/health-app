import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';
import './index.css';

if (typeof window !== 'undefined') {
  window.React = React;
  window.useRef = React.useRef;
  window.useState = React.useState;
  window.useEffect = React.useEffect;
  window.useCallback = React.useCallback;
  window.useMemo = React.useMemo;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
