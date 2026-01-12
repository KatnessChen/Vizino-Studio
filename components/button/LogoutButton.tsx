import React, { useState } from 'react';
import { Button, CircularProgress, Box } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { signOutUser } from '@/services/authService';

interface LogoutButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  variant?: 'contained' | 'outlined' | 'text';
  disabled?: boolean;
}

const LogoutButton: React.FC<LogoutButtonProps> = ({
  onSuccess,
  onError,
  variant = 'outlined',
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const result = await signOutUser();

      if (result.success) {
        onSuccess?.();
      } else {
        onError?.(result.error);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to sign out';
      onError?.(errorMessage);
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box position="relative">
      <Button
        variant={variant as any}
        color="primary"
        disabled={disabled || loading}
        onClick={handleLogout}
        startIcon={loading ? <CircularProgress size={20} /> : <LogoutIcon />}
        sx={{
          textTransform: 'none',
          fontSize: '0.875rem',
        }}
      >
        {loading ? 'Signing out...' : 'Sign out'}
      </Button>
    </Box>
  );
};

export default LogoutButton;
