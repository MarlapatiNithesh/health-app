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
        <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-500/10">
            <AlertTriangle size={32} />
          </div>
          
          <h2 className="text-xl font-black text-white tracking-tight mb-1">
            Something went wrong
          </h2>
          <p className="text-xs text-slate-400 font-medium max-w-xs mb-4">
            An unexpected error occurred while rendering the interface.
          </p>

          {this.state.error?.message && (
            <div className="w-full max-w-sm glass-subcard bg-rose-950/30 border border-rose-500/30 rounded-2xl p-3.5 mb-6 text-left">
              <p className="text-[11px] font-mono font-semibold text-rose-300 break-words">
                {this.state.error.message}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2.5 w-full max-w-xs">
            <button
              onClick={this.handleReload}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-teal-400 hover:opacity-95 text-slate-950 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Reload App</span>
            </button>

            <button
              onClick={this.handleResetState}
              className="w-full py-2.5 px-4 glass-subcard bg-slate-900/80 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
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
