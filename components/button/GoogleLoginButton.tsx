import React, { useState } from 'react';
import { Button } from 'antd';
import { GoogleOutlined, LoadingOutlined } from '@ant-design/icons';
import { signInWithGoogle } from '@/services/authService';

interface GoogleLoginButtonProps {
  onSuccess?: (user: any) => void;
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

      if (result.success) {
        // Popup authentication succeeded, user data is available
        console.log('User signed in');
        onSuccess?.(result.user);
        setLoading(false);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to sign in with Google';
      onError?.(errorMessage);
      console.error('Login error:', error);
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
