import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the app.
 *
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorCount: 0,
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log error details to console
        console.error('❌ ErrorBoundary caught an error:', error, errorInfo);

        // Update state with error details
        this.setState(prevState => ({
            error,
            errorInfo,
            errorCount: prevState.errorCount + 1,
        }));

        // You could also log to an error reporting service here
        // Example: logErrorToService(error, errorInfo);
    }

    handleReset = () => {
        // Reset error boundary state
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });

        // Optionally reload the page
        window.location.reload();
    };

    handleGoHome = () => {
        // Clear error state
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });

        // Navigate to home
        if (this.props.navigateTo) {
            this.props.navigateTo('Home');
        } else {
            window.location.href = '/';
        }
    };

    render() {
        if (this.state.hasError) {
            // Fallback UI
            return (
                <div className="min-h-screen w-full bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4 font-sans">
                    <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-red-200/50 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-full">
                                    <AlertTriangle size={32} />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold">Something Went Wrong</h1>
                                    <p className="text-red-100 text-sm mt-1">
                                        The application encountered an unexpected error
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Error Details */}
                        <div className="p-6 space-y-4">
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <h2 className="text-sm font-bold text-red-900 mb-2">Error Details</h2>
                                <p className="text-xs text-red-700 font-mono break-words">
                                    {this.state.error && this.state.error.toString()}
                                </p>
                            </div>

                            {/* Stack Trace (Collapsed by default in production) */}
                            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                                <details className="bg-slate-100 border border-slate-300 rounded-lg p-4">
                                    <summary className="text-xs font-bold text-slate-700 cursor-pointer hover:text-slate-900">
                                        Stack Trace (Development Only)
                                    </summary>
                                    <pre className="text-xs text-slate-600 mt-2 overflow-auto max-h-64 font-mono">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                </details>
                            )}

                            {/* Suggestions */}
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <h3 className="text-sm font-bold text-amber-900 mb-2">What can you do?</h3>
                                <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                                    <li>Try reloading the page</li>
                                    <li>Check your internet connection</li>
                                    <li>Ensure your project files are accessible</li>
                                    <li>Clear browser cache and reload</li>
                                    {this.state.errorCount > 1 && (
                                        <li className="text-red-700 font-semibold">
                                            Error occurred {this.state.errorCount} times - consider restarting the application
                                        </li>
                                    )}
                                </ul>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={this.handleReset}
                                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                                >
                                    <RefreshCw size={16} />
                                    Reload Page
                                </button>
                                <button
                                    onClick={this.handleGoHome}
                                    className="flex-1 flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                                >
                                    <Home size={16} />
                                    Go Home
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 text-center">
                            <p className="text-xs text-slate-600">
                                If this problem persists, please contact support or check the console for more details
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        // Render children normally if no error
        return this.props.children;
    }
}

export default ErrorBoundary;
