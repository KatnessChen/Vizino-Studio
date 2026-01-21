import React, { useState, useEffect } from 'react';
import { Box, Typography, Stack, Divider, CircularProgress } from '@mui/material';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import GoogleLoginButton from './button/GoogleLoginButton';
import LogoutButton from './button/LogoutButton';
import { useAuth } from '@/contexts/AuthContext';
import { useGuest } from '@/contexts/GuestContext';
import { selectGuestImages, clearGuestState } from '@/stores/guestStore';
import { resetTaskState } from '@/stores/taskStore';
import { migrateGuestDataToUser } from '@/utils/migrateGuestData';
import { generateRoute } from '@/constants/routes';

const AuthPanel: React.FC = () => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { guestSessionId, clearGuestSession } = useGuest();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const guestImages = useSelector(selectGuestImages);
  
  const [error, setError] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const migrationAttemptedRef = React.useRef(false);

  // Check if there's guest data to migrate when user logs in
  useEffect(() => {
    const handleGuestDataMigration = async () => {
      // Only migrate if:
      // 1. User just logged in (isAuthenticated is true)
      // 2. There's a guest session ID
      // 3. There are guest images to migrate
      // 4. Not currently migrating
      // 5. Haven't already attempted migration
      if (
        isAuthenticated && 
        guestSessionId && 
        guestImages.length > 0 && 
        !isMigrating &&
        !migrationAttemptedRef.current
      ) {
        migrationAttemptedRef.current = true;
        setIsMigrating(true);
        
        try {
          console.log('[AuthPanel] Starting guest data migration...');
          const result = await migrateGuestDataToUser(guestSessionId, user!.uid);
          
          console.log('[AuthPanel] Migration complete:', result);
          
          // Clear guest session from context
          clearGuestSession();
          
          // Clear guest store and task store via Redux
          dispatch(clearGuestState());
          dispatch(resetTaskState());
          
          // Show success message
          message.success('Your guest work has been saved to your account!');
          
          // Navigate to the migrated project/space
          if (result.projectId && result.spaceId) {
            // Use the default names used in migration
            const projectName = 'My First Project';
            const spaceName = 'My First Space';
            navigate(generateRoute.space(projectName, result.projectId, spaceName, result.spaceId));
            
            // Reload to fetch the newly created project data
            window.location.reload();
          }
        } catch (error) {
          console.error('[AuthPanel] Migration failed:', error);
          message.error('Failed to migrate your work. Please contact support.');
          migrationAttemptedRef.current = false; // Allow retry on failure
        } finally {
          setIsMigrating(false);
        }
      }
    };

    handleGuestDataMigration();
  }, [isAuthenticated, guestSessionId, guestImages.length, user, clearGuestSession, navigate, dispatch]);

  const handleLoginSuccess = () => {
    setError(null);
    // Migration will be handled by the useEffect above
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

  // Show loading state during authentication check
  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading authentication...</Typography>
      </Box>
    );
  }

  // Show loading state during migration
  if (isMigrating) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={40} sx={{ color: '#6366f1' }} />
        <Typography variant="body1" sx={{ fontWeight: 600, color: '#6366f1' }}>
          Migrating your work...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please wait while we save your guest designs to your account.
        </Typography>
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
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600, fontSize: '10px', color: 'indigo.600' }}>
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

          <GoogleLoginButton
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
            fullWidth
          />
        </Box>
      ) : (
        // Authenticated View
        <Box>
          <Typography variant="h6" component="h2" gutterBottom sx={{ fontWeight: 700 }}>
            Hi {firstName || ''}, Ready to Design?
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.6 }}>
            Continue creating bespoke designs with flawless AI execution.
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
          />
        </Box>
      )}
    </Box>
  );
};

export default AuthPanel;

