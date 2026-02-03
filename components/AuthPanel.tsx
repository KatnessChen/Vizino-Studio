import React, { useState } from 'react';
import { Box, Typography, Stack, Divider } from '@mui/material';
import { useDispatch } from 'react-redux';
import GoogleLoginButton from './button/GoogleLoginButton';
import LogoutButton from './button/LogoutButton';
import { useAuth } from '@/contexts/AuthContext';
import { useGuest } from '@/contexts/GuestContext';
import { clearGuestState } from '@/stores/guestStore';
import { resetTaskState } from '@/stores/taskStore';

const AuthPanel: React.FC = () => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { clearGuestSession } = useGuest();
  const dispatch = useDispatch();

  const [error, setError] = useState<string | null>(null);

  const handleLoginSuccess = async () => {
    setError(null);

    // Clear guest session (IndexedDB + Redux)
    try {
      await clearGuestSession();
      dispatch(clearGuestState());
      dispatch(resetTaskState());
      console.log('[AuthPanel] Guest session cleared after login');
    } catch (error) {
      console.error('[AuthPanel] Failed to clear guest session:', error);
    }
  };

  const handleLoginError = (errorMsg: string) => {
    console.error('Login error:', errorMsg);
    setError(errorMsg);
  };

  const handleLogoutSuccess = () => {
    console.log('User logged out');
    setError(null);
  };

  const handleLogoutError = (errorMsg: string) => {
    console.error('Logout error:', errorMsg);
    setError(errorMsg);
  };

  // Show loading state during authentication check
  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading authentication...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {!isAuthenticated ? (
        // Login View
        <Box>
          <Typography variant="h6" component="h2" gutterBottom>
            Welcome to Vizino AI
          </Typography>
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{
              mb: 3,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              fontWeight: 600,
              fontSize: '10px',
              color: 'indigo.600',
            }}
          >
            From Visual Instruction to Precise Design
          </Typography>

          <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
            Sign in to unlock advanced AI features and precise design tools.
          </Typography>

          {error && (
            <Box
              sx={{
                p: 2,
                mb: 3,
                bgcolor: '#ffebee',
                border: '1px solid #ef5350',
                borderRadius: 1,
              }}
            >
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            </Box>
          )}

          <GoogleLoginButton onSuccess={handleLoginSuccess} onError={handleLoginError} fullWidth />
        </Box>
      ) : (
        // Authenticated View
        <Box>
          <Stack spacing={2} sx={{ mb: 3 }}>
            <Box>
              <Typography variant="subtitle2" color="textSecondary">
                Name
              </Typography>
              <Typography variant="body1">{user?.displayName || 'Not provided'}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="textSecondary">
                Email
              </Typography>
              <Typography variant="body1">{user?.email}</Typography>
            </Box>
          </Stack>

          <Divider sx={{ my: 3 }} />

          {error && (
            <Box
              sx={{
                p: 2,
                mb: 3,
                bgcolor: '#ffebee',
                border: '1px solid #ef5350',
                borderRadius: 1,
              }}
            >
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            </Box>
          )}

          <LogoutButton onSuccess={handleLogoutSuccess} onError={handleLogoutError} />
        </Box>
      )}
    </Box>
  );
};

export default AuthPanel;
