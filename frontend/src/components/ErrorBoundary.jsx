import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center bg-brand-900 p-6 text-center text-brand-100">
        <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
        <p className="mt-2 text-sm">An unexpected error occurred. Reloading usually fixes it.</p>
        <button onClick={() => window.location.reload()} className="primary-button mt-6 bg-cream px-6 py-2 text-sm text-brand-900 hover:bg-white">
          Reload
        </button>
      </div>
    );
  }
}
