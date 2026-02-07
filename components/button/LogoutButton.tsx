import React, { useState } from 'react';
import { Button } from 'antd';
import { LogoutOutlined, LoadingOutlined } from '@ant-design/icons';
import { signOutUser } from '@/services/authService';

interface LogoutButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

const LogoutButton: React.FC<LogoutButtonProps> = ({ onSuccess, onError, disabled = false }) => {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const result = await signOutUser();

      if (result.success) {
        onSuccess?.();
      } else {
        onError?.(result.error || 'Failed to sign out');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign out';
      onError?.(errorMessage);
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="default"
      disabled={disabled || loading}
      onClick={handleLogout}
      icon={loading ? <LoadingOutlined spin /> : <LogoutOutlined />}
    >
      {loading ? 'Signing out...' : 'Sign out'}
    </Button>
  );
};

export default LogoutButton;
