import React, { useState } from 'react';
import { Button, Spin } from 'antd';
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
      type="primary"
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
      }}
    >
      {loading ? 'Signing in...' : 'Sign in with Google'}
    </Button>
  );
};

export default GoogleLoginButton;
