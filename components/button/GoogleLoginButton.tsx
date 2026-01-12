import React, { useState } from 'react';
import { Button, CircularProgress, Box } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { signInWithGoogle } from '@/services/authService';

interface GoogleLoginButtonProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
  variant?: 'contained' | 'outlined' | 'text';
  fullWidth?: boolean;
  disabled?: boolean;
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  onSuccess,
  onError,
  variant = 'contained',
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
    <Box position="relative">
      <Button
        variant={variant as any}
        color="primary"
        fullWidth={fullWidth}
        disabled={disabled || loading}
        onClick={handleGoogleLogin}
        startIcon={loading ? <CircularProgress size={20} /> : <GoogleIcon />}
        sx={{
          textTransform: 'none',
          fontSize: '1rem',
          padding: fullWidth ? '12px 24px' : undefined,
        }}
      >
        {loading ? 'Signing in...' : 'Sign in with Google'}
      </Button>
    </Box>
  );
};

export default GoogleLoginButton;
