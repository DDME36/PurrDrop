'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🐱 PurrDrop Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          fontFamily: '"IBM Plex Sans Thai", sans-serif',
          background: 'linear-gradient(180deg, #fffaf0, #fdf3ff)',
          color: '#5a4a42',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '72px', marginBottom: '16px' }}>😿</div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            marginBottom: '8px',
            fontFamily: '"Mitr", sans-serif',
          }}>
            อุ๊บส์! มีข้อผิดพลาด
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#8b7b73',
            marginBottom: '24px',
            maxWidth: '400px',
            lineHeight: '1.6',
          }}>
            PurrDrop เจอปัญหาบางอย่าง ลอง refresh หน้าเว็บดูนะ
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '12px 32px',
              borderRadius: '16px',
              border: 'none',
              background: 'linear-gradient(135deg, #ffb3d1, #ffd3b6)',
              color: '#5a4a42',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(255, 179, 209, 0.4)',
              transition: 'transform 0.2s',
            }}
            onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            🔄 ลองใหม่
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre style={{
              marginTop: '24px',
              padding: '16px',
              background: 'rgba(0,0,0,0.05)',
              borderRadius: '12px',
              fontSize: '12px',
              maxWidth: '500px',
              overflow: 'auto',
              textAlign: 'left',
            }}>
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
