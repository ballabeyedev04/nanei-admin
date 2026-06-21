import React from 'react';
import logger from './logger';

interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { hasError: boolean; errorId: string; }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorId: '' };
  }

  static getDerivedStateFromError() {
    return { hasError: true, errorId: Date.now().toString(36) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('React ErrorBoundary caught', {
      message: error.message,
      componentStack: info.componentStack?.slice(0, 500),
      errorId: this.state.errorId,
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-md">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Une erreur est survenue</h2>
            <p className="text-gray-500 text-sm mb-6">Référence : {this.state.errorId}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-orange-500 text-white px-6 py-2 rounded-xl font-semibold hover:bg-orange-600"
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
