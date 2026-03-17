import React from 'react';
import { Avatar, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '../../contexts/AuthContext';
import { setShowLoginRequiredModal } from '@/stores/guestStore';

const Header: React.FC = () => {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const ALLOWED_EMAILS = (process.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const email = user?.email?.toLowerCase();
  const isAdmins = email && ALLOWED_EMAILS.includes(email);

  const navigate = useNavigate();

  // Clicking the Avatar should navigate to User Profile if logged in, otherwise show login modal
  const goToUserProfile = () => {
    if (user) {
      navigate(ROUTES.USER_PROFILE);
    } else {
      dispatch(setShowLoginRequiredModal(true));
    }
  };

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
            <div 
              onClick={goToUserProfile}
              className={`p-0 border-2 ${user ? 'border-white/30 hover:border-white/50' : 'border-gray-400/30 hover:border-gray-400/50'} rounded-full cursor-pointer transition-all duration-200`}
            >
              <Avatar
                alt={user?.displayName || 'User'}
                src={user?.photoURL || undefined}
                size={32}
              />
            </div>
          </div>
        </div>
      </nav>
      {/* Spacer to prevent content from going under fixed header */}
      <div className="w-full" style={{ height: 'var(--header-height)' }} />
    </>
  );
};

export default Header;
