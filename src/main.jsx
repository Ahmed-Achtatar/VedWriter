import { StrictMode } from 'react'
import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class AppErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[app] render failure', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', gap: 12, padding: 32, textAlign: 'center', color: '#1f2937' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>VedWriter needs to reload</h1>
        <p style={{ margin: 0, color: '#6b7280' }}>Your local data is safe. Reload the app to restore the workspace.</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>Reload VedWriter</button>
      </main>
    );
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
