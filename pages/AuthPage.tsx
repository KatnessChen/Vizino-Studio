import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Box, Typography, Stack, Paper, Divider, useTheme } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { ROUTES } from '@/constants/routes';
import GoogleLoginButton from '@/components/button/GoogleLoginButton';
import { useAuth } from '@/contexts/AuthContext';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const theme = useTheme();

  // Redirect to project page if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate(ROUTES.HOME);
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleLoginSuccess = () => {
    setError(null);
    // Navigation will happen automatically when isAuthenticated changes
  };

  const handleLoginError = (errorMsg: string) => {
    console.error('Login error:', errorMsg);
    setError(errorMsg);
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Stack alignItems="center" spacing={2}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <Typography variant="body1" color="textSecondary">
            Loading...
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.secondary.light} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 2,
          }}
        >
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontWeight: 700,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
              }}
              className="cursor-default"
            >
              Vizion
            </Typography>
            <Typography
              variant="subtitle1"
              color="textSecondary"
              sx={{
                fontWeight: 300,
                fontSize: '1.1rem',
              }}
              className="cursor-default"
            >
              Your AI Interior Designer
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Description */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="body1" paragraph>
              Welcome to Vizion Studio – your personal AI interior design assistant. Visualize your
              spaces in any color or texture before you renovate.
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ArrowForwardIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                Recolor walls with any Benjamin Moore color
              </Typography>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ArrowForwardIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                Add textures to enhance your design
              </Typography>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ArrowForwardIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                Compare multiple design options
              </Typography>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ArrowForwardIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                Save and organize your designs by projects and spaces
              </Typography>
            </Stack>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Error Message */}
          {error && (
            <Box
              sx={{
                p: 2,
                mb: 3,
                bgcolor: 'error.light',
                border: `1px solid ${theme.palette.error.main}`,
                borderRadius: 1,
              }}
            >
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            </Box>
          )}

          {/* Login Section */}
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                mb: 2,
                textAlign: 'center',
              }}
            >
              Sign in with your Google account
            </Typography>
            <GoogleLoginButton
              onSuccess={handleLoginSuccess}
              onError={handleLoginError}
              variant="contained"
              fullWidth
            />
          </Box>
        </Paper>

        {/* Background Decoration */}
        <Box
          sx={{
            position: 'fixed',
            bottom: -100,
            right: -100,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${theme.palette.primary.main}10 0%, transparent 70%)`,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        />
        <Box
          sx={{
            position: 'fixed',
            top: -50,
            left: -50,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${theme.palette.secondary.main}10 0%, transparent 70%)`,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        />
      </Container>
    </Box>
  );
};

export default AuthPage;
