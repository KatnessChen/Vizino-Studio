import React from 'react';
import { Box, Typography, Stack, Divider } from '@mui/material';
import GoogleLoginButton from './button/GoogleLoginButton';
import LogoutButton from './button/LogoutButton';
import { useAuth } from '@/contexts/AuthContext';

const AuthPanel: React.FC = () => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [error, setError] = React.useState<string | null>(null);

  const handleLoginSuccess = () => {
    setError(null);
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

  const firstName = user?.displayName?.split(' ')[0] || '';

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
          <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3 }}>
            Welcome to Vizion Studio
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

          <GoogleLoginButton
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
            variant="contained"
            fullWidth
          />
        </Box>
      ) : (
        // Authenticated View
        <Box>
          <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3 }}>
            Hi {firstName || ''}, Welcome back!
          </Typography>

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

          <LogoutButton
            onSuccess={handleLogoutSuccess}
            onError={handleLogoutError}
            variant="outlined"
          />
        </Box>
      )}
    </Box>
  );
};

export default AuthPanel;
