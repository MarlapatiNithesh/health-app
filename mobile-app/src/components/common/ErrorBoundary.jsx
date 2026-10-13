import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { toNative } from '../../native/nativeBridge';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[React ErrorBoundary caught error]:', error, errorInfo);

    // Forward to native shell so Metro console logs the exact error
    try {
      toNative('WEB_CONSOLE_ERROR', {
        message: error ? (error.message || String(error)) : 'Unknown React error',
        stack: errorInfo?.componentStack || error?.stack || '',
      });
    } catch {}
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleResetState = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 mb-4 shadow-sm">
            <AlertTriangle size={32} />
          </div>
          
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mb-1">
            Something went wrong
          </h2>
          <p className="text-xs text-slate-500 font-medium max-w-xs mb-4">
            An unexpected error occurred while rendering the interface.
          </p>

          {this.state.error?.message && (
            <div className="w-full max-w-sm bg-rose-50/80 border border-rose-200/80 rounded-2xl p-3 mb-6 text-left">
              <p className="text-[11px] font-mono font-semibold text-rose-700 break-words">
                {this.state.error.message}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2.5 w-full max-w-xs">
            <button
              onClick={this.handleReload}
              className="w-full py-3 px-4 bg-[#00A8D0] hover:bg-[#0096ba] active:scale-[0.98] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
            >
              <RefreshCw size={14} />
              <span>Reload App</span>
            </button>

            <button
              onClick={this.handleResetState}
              className="w-full py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.98] text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition"
            >
              <RotateCcw size={14} />
              <span>Reset State & Reload</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
