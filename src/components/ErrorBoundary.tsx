import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070707] flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-red-500/20 rounded-xl max-w-lg w-full p-6 text-center shadow-xl space-y-4">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-2 text-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-zinc-100 font-sans">Something went wrong</h2>
            <p className="text-sm text-zinc-400 font-sans leading-relaxed">
              We've encountered an unexpected error. Usually this is just a temporary glitch.
              Try refreshing the page or restarting the app if you're on desktop.
            </p>
            {this.state.error && (
              <div className="bg-[#121212] border border-[#27272a] rounded-lg p-3 text-left mt-4 overflow-auto max-h-[150px]">
                <code className="text-xs text-red-300 font-mono">
                  {this.state.error.message}
                </code>
              </div>
            )}
            <div className="pt-4 flex justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[13px] font-medium rounded-lg transition-colors border border-zinc-700 font-sans shadow-sm cursor-pointer"
              >
                Reload workspace
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
