import React, { useState } from 'react';
import { Button } from 'antd';
import { GoogleOutlined, LoadingOutlined } from '@ant-design/icons';
import { signInWithGoogle } from '@/services/authService';

interface GoogleLoginButtonProps {
  onSuccess?: (user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
  }) => void;
  onError?: (error: string) => void;
  fullWidth?: boolean;
  disabled?: boolean;
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  onSuccess,
  onError,
  fullWidth = false,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle();

      if (result.success && result.user) {
        // Popup authentication succeeded, user data is available
        console.log('User signed in');
        onSuccess?.(result.user);
        setLoading(false);
      } else if (result.success && 'isRedirecting' in result && result.isRedirecting) {
        // Redirect authentication initiated (Safari or popup blocked)
        // Page will reload, so we keep the loading state
        console.log('Redirecting to Google sign-in page...');
        // Don't set loading to false - page will redirect
      } else if (!result.success) {
        // Authentication failed
        const errMsg =
          'error' in result && typeof (result as Record<string, unknown>)['error'] === 'string'
            ? (result as Record<string, string>)['error']
            : 'Failed to sign in with Google';
        onError?.(errMsg);
        setLoading(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in with Google';
      onError?.(errorMessage);
      console.error('Login error:', error);
      setLoading(false);
    }
  };

  return (
    <Button
      block={fullWidth}
      disabled={disabled || loading}
      onClick={handleGoogleLogin}
      icon={loading ? <LoadingOutlined spin /> : <GoogleOutlined />}
      size="large"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: 'linear-gradient(135deg, #e0e7ff 0%, #f5f3ff 100%)',
        color: '#4f46e5',
        border: '1px solid #c7d2fe',
        borderRadius: '0.375rem',
      }}
    >
      {loading ? 'Signing in...' : 'Sign in with Google'}
    </Button>
  );
};

export default GoogleLoginButton;
