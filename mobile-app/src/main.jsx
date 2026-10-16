import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';
import './index.css';

// OAuth Callback Handler for Open Wearables (/wearables/callback)
if (typeof window !== 'undefined' && window.location.pathname.includes('/wearables/callback')) {
  const params = new URLSearchParams(window.location.search || window.location.hash.replace(/^#/, '?'));
  const provider = params.get('provider') || params.get('state');
  const status = params.get('status') || (params.get('code') ? 'authorized' : 'unknown');
  const error = params.get('error') || params.get('error_description');

  if (window.opener) {
    if (error) {
      window.opener.postMessage({
        type: 'WEARABLE_AUTH_ERROR',
        provider,
        message: error,
      }, window.location.origin);
    } else {
      window.opener.postMessage({
        type: 'WEARABLE_AUTH_SUCCESS',
        provider,
        status,
      }, window.location.origin);
    }
    window.close();
  } else {
    window.location.replace('/');
  }
}

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
