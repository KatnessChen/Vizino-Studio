import React, { useState, useEffect } from 'react';
import { Card, Switch, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/contexts/AuthContext';
import { AdminSettings } from '@/utils/storageUtils';

const ALLOWED_EMAILS = ((import.meta as any).env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

const AdminSettingPage: React.FC = () => {
  const { user, adminSettings, updateAdminSettings } = useAuth();
  const navigate = useNavigate();
  const email = user?.email?.toLowerCase();
  const isAdmins = email && ALLOWED_EMAILS.includes(email);

  // Local state for form
  const [formSettings, setFormSettings] = useState<AdminSettings>(adminSettings);
  const [isDirty, setIsDirty] = useState(false);

  // Track changes
  useEffect(() => {
    const dirty = JSON.stringify(formSettings) !== JSON.stringify(adminSettings);
    setIsDirty(dirty);
  }, [formSettings, adminSettings]);

  const handleSave = () => {
    updateAdminSettings(formSettings);
    // Refresh and go to home page
    window.location.href = ROUTES.HOME;
  };

  if (!isAdmins) {
    // Lazy load to avoid circular import
    const NotFoundPage = React.lazy(() => import('./NotFoundPage'));
    return (
      <React.Suspense
        fallback={<div style={{ textAlign: 'center', marginTop: 64 }}>Loading...</div>}
      >
        <NotFoundPage />
      </React.Suspense>
    );
  }

  return (
    <div
      className="bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 py-8 px-4"
      style={{ minHeight: 'calc(100vh - var(--header-height))' }}
    >
      {/* Go Back Button */}
      <div className="max-w-2xl mx-auto mb-4">
        <Button
          type="text"
          onClick={() => navigate(-1)}
          className="text-gray-600 hover:text-gray-900"
        >
          &lt; Go Back
        </Button>
      </div>

      {/* Settings Panel */}
      <div className="max-w-2xl mx-auto">
        <Card title="Admin Settings" className="shadow-lg">
          <div className="space-y-6">
            {/* Mock Limit Reached Switch */}
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium text-gray-900">Mock Limit Reached</div>
                <div className="text-sm text-gray-500">
                  Enable to simulate limit reached scenario for testing
                </div>
              </div>
              <Switch
                checked={formSettings.mock_limit_reached}
                onChange={(checked) =>
                  setFormSettings({ ...formSettings, mock_limit_reached: checked })
                }
              />
            </div>

            <div className="border-t pt-4 mt-6 space-y-3">
              {/* Save Button */}
              <Button type="primary" block disabled={!isDirty} onClick={handleSave}>
                Save and Refresh
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettingPage;
