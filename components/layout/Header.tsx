import React, { useState, useEffect, useRef } from 'react';
import { Avatar, IconButton } from '@mui/material';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import AuthPanel from '../AuthPanel';
import { useAuth } from '../../contexts/AuthContext';

const Header: React.FC = () => {
  const { user } = useAuth();
  const ALLOWED_EMAILS = (process.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const email = user?.email?.toLowerCase();
  const isAdmins = email && ALLOWED_EMAILS.includes(email);

  const navigate = useNavigate();
  const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(false);
  const authPanelRef = useRef<HTMLDivElement>(null);

  const toggleAuthPopover = () => {
    setIsAuthPanelOpen((isOpen) => !isOpen);
  };

  // Close AuthPanel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (authPanelRef.current && !authPanelRef.current.contains(event.target as Node)) {
        setIsAuthPanelOpen(false);
      }
    };

    if (isAuthPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isAuthPanelOpen]);

  return (
    <>
      {/* Header Bar */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 shadow-lg">
        <div className="flex items-center justify-between px-6 py-2">
          {/* Brand Section */}
          <div className="flex items-center gap-4">
            <div className="flex items-center cursor-pointer" onClick={() => navigate(ROUTES.HOME)}>
              <div className="text-xl text-white">Vizino AI</div>
              <div className="text-white/80 font-medium text-xs mt-1.5 ml-3 tracking-tight uppercase">

                Precise AI Design
              </div>
            </div>
          </div>

          {/* Right Section - Profile */}
          <div className="flex items-center gap-2">
            {isAdmins && (
              <Button
                type="link"
                onClick={() => navigate(ROUTES.ADMIN_SETTING)}
                className="!text-white/75"
              >

                Admin Settings
              </Button>
            )}
            <IconButton
              onClick={toggleAuthPopover}
              sx={{
                p: 0,
                border: '2px solid rgba(255,255,255,0.3)',
                '&:hover': { border: '2px solid rgba(255,255,255,0.5)' },
              }}
            >
              <Avatar
                alt={user?.displayName || 'User'}
                src={user?.photoURL || undefined}
                sx={{ width: 32, height: 32 }}
              />
            </IconButton>
          </div>
        </div>
      </nav>
      {/* Spacer to prevent content from going under fixed header */}
      <div className="w-full" style={{ height: 'var(--header-height)' }} />
      {/* Auth Panel Popover */}
      {isAuthPanelOpen && (
        <div
          ref={authPanelRef}
          className="absolute right-6 top-12 w-[400px] max-w-[90vw] z-[1000] bg-white rounded-lg shadow-xl border border-gray-200"
        >
          <AuthPanel />
        </div>
      )}

    </>
  );
};

export default Header;
