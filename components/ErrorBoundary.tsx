import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Result } from 'antd';
import posthog from 'posthog-js';
import { ReloadOutlined, HomeOutlined } from '@ant-design/icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  level?: 'app' | 'page' | 'component';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Send error to PostHog for tracking
    posthog.captureException(error, {
      componentStack: errorInfo.componentStack,
      level: this.props.level || 'component',
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI based on error level
      const { level = 'component' } = this.props;
      const { error, errorInfo } = this.state;

      // App-level error (most critical)
      if (level === 'app') {
        return (
          <div className="h-screen flex items-center justify-center bg-gray-50">
            <Result
              title="We're Sorry"
              subTitle="Something went wrong. Please try refreshing the page."
              extra={[
                <Button
                  type="primary"
                  key="reload"
                  icon={<ReloadOutlined />}
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </Button>,
                <Button
                  key="home"
                  icon={<HomeOutlined />}
                  onClick={this.handleGoHome}
                >
                  Go Home
                </Button>,
              ]}
            >
              {process.env.NODE_ENV === 'development' && error && (
                <div className="mt-4 text-left">
                  <div className="bg-red-50 border border-red-200 rounded p-4">
                    <div className="font-semibold text-red-800 mb-2">
                      Developer Info (Development Mode Only)
                    </div>
                    <div className="text-sm text-red-700">
                      <p className="font-mono mb-2">
                        <strong>Error:</strong> {error.toString()}
                      </p>
                      {errorInfo && (
                        <pre className="overflow-auto max-h-64 bg-white p-2 rounded border border-red-300">
                          {errorInfo.componentStack}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Result>
          </div>
        );
      }

      // Page-level error
      if (level === 'page') {
        return (
          <div className="min-h-[400px] flex items-center justify-center p-8">
            <Result
              title="Page Load Failed"
              subTitle="We sincerely apologize for the inconvenience. This page encountered an error. Please try reloading."
              extra={[
                <Button
                  type="primary"
                  key="retry"
                  icon={<ReloadOutlined />}
                  onClick={this.handleReset}
                >
                  Retry
                </Button>,
                <Button
                  key="home"
                  icon={<HomeOutlined />}
                  onClick={this.handleGoHome}
                >
                  Go Home
                </Button>,
              ]}
            >
              {process.env.NODE_ENV === 'development' && error && (
                <div className="mt-4 text-left max-w-2xl mx-auto">
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                    <div className="font-semibold text-yellow-800 mb-2">
                      Developer Info
                    </div>
                    <div className="text-sm text-yellow-700">
                      <p className="font-mono mb-2">
                        <strong>Error:</strong> {error.toString()}
                      </p>
                      {errorInfo && (
                        <pre className="overflow-auto max-h-48 bg-white p-2 rounded border border-yellow-300 text-xs">
                          {errorInfo.componentStack}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Result>
          </div>
        );
      }

      // Component-level error (least critical)
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-red-500">
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 mb-1">
                Component Load Error
              </h3>
              <p className="text-sm text-red-700 mb-2">
                We sincerely apologize. This component encountered an error. Please try reloading.
              </p>
              <Button
                size="small"
                type="primary"
                danger
                icon={<ReloadOutlined />}
                onClick={this.handleReset}
              >
                Retry
              </Button>
              {process.env.NODE_ENV === 'development' && error && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-red-800 mb-2">
                    Developer Info
                  </div>
                  <div className="text-xs text-red-700">
                    <p className="font-mono mb-1">{error.toString()}</p>
                    {errorInfo && (
                      <pre className="overflow-auto max-h-32 bg-white p-2 rounded text-xs">
                        {errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

