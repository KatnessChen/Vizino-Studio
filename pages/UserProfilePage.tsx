import React, { useState } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Button,
  Collapse,
  Input,
  Switch,
  message,
  Tooltip,
  Modal,
} from 'antd';
import { devError } from '@/utils/devLogger';
import {
  ArrowLeftOutlined,
  ExportOutlined,
  DownOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { backendService } from '@/services/backendService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { decryptUserApiKey } from '@/services/userService';
import { useCreditCheck } from '@/hooks/useCreditCheck';
import { CREDIT_MULTIPLIERS } from '@/constants/constants';
import { ROUTES } from '@/constants/routes';
import VPointsProgressBar from '@/components/VPointsProgressBar';
import VPointsIcon from '@/components/icons/VPointsIcon';
import LogoutButton from '@/components/button/LogoutButton';

const { Title, Text, Paragraph } = Typography;

interface ApiKeyManagerUser {
  uid: string;
  apiKey?: {
    geminiKey?: string;
    isActive: boolean;
  };
}

/**
 * User Profile Page - Displays V points usage and credit information
 */
const UserProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { isLoading, totalCredits, usagePercentage, usage, refresh, limit } = useCreditCheck({
    userId: user?.uid,
  });

  // Promotion code state
  const [promoCode, setPromoCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const handleRedeemCode = async () => {
    if (!user || !promoCode.trim()) return;

    setRedeeming(true);
    try {
      const result = await backendService.redeemPromotionCode(promoCode.trim());
      message.success(`Successfully redeemed credits!`);
      setPromoCode('');
      if ((refreshUser as any)) await (refreshUser as any)(); // Try AuthContext refreshUser
    } catch (error) {
      devError('Failed to redeem promotion code:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to redeem promotion code';
      message.error(errorMessage);
    } finally {
      setRedeeming(false);
    }
  };

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="text-center p-8">
          <Title level={4}>Please sign in</Title>
          <Paragraph className="text-gray-600">
            You need to be signed in to view your profile.
          </Paragraph>
          <Button type="primary" onClick={() => navigate(ROUTES.HOME)}>
            Go to Home
          </Button>
        </Card>
      </div>
    );
  }

  // Build usage data for table (assume new format: { onVPoints, onOwnKey })
  const usageTableData = Object.entries(usage || {})
    .map(([taskName, counts]) => {
      const { onVPoints = 0, onOwnKey = 0 } =
        (counts as { onVPoints?: number; onOwnKey?: number }) || {};
      const totalUses = onVPoints + onOwnKey;
      const multiplier = CREDIT_MULTIPLIERS[taskName] ?? 1;
      const credits = onVPoints * multiplier;

      return {
        key: taskName,
        taskName,
        onVPoints,
        totalUses,
        multiplier,
        credits,
      };
    })
    .filter((row) => row.totalUses > 0)
    .sort((a, b) => b.credits - a.credits); // Sort by credits consumed (highest first)

  const columns = [
    {
      title: 'Task',
      dataIndex: 'taskName',
      key: 'taskName',
      render: (taskName: string) => (
        <span className="capitalize">{taskName.replace(/_/g, ' ')}</span>
      ),
    },
    {
      title: 'On V Points',
      dataIndex: 'onVPoints',
      key: 'onVPoints',
      width: 120,
      align: 'right' as const,
    },
    {
      title: 'Multiplier',
      dataIndex: 'multiplier',
      key: 'multiplier',
      width: 100,
      align: 'right' as const,
      render: (multiplier: number) => (
        <Tag color={multiplier > 1 ? 'orange' : 'default'}>×{multiplier}</Tag>
      ),
    },
    {
      title: (
        <div className="flex items-center justify-end gap-1">
          <VPointsIcon size={18} />
        </div>
      ),
      dataIndex: 'credits',
      key: 'credits',
      width: 60,
      align: 'right' as const,
      render: (credits: number) => (
        <div className="flex items-center justify-end gap-1">
          <Text strong>{credits}</Text>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back Button */}
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(ROUTES.HOME)} className="mb-6">
        Back to Home
      </Button>

      <Title level={4} className="mb-6">
        User Profile
      </Title>

      <div className="flex flex-col gap-2">
        {/* User Info */}
        <Card className="mb-8">
          <div className="flex items-center gap-4">
            {user?.photoURL && (
              <img src={user.photoURL} alt="Profile" className="w-16 h-16 rounded-full" />
            )}
            <div>
              <Title level={4} className="m-0">
                {user?.displayName || 'User'}
              </Title>
              <Text className="text-gray-500">{user?.email}</Text>
            </div>
          </div>
        </Card>

        {/* V Points Usage */}
        <Card title="Usage" className="mb-8" loading={isLoading}>
          {/* Progress Bar Component */}
          <VPointsProgressBar
            totalCredits={totalCredits}
            usagePercentage={usagePercentage}
            limit={limit}
          />
          {/* Usage Detail Breakdown - Integrated inside Card */}
          <Collapse ghost className="usage-breakdown-collapse mt-2">
            <Collapse.Panel
              header={
                <div className="flex justify-end p-0">
                  <style>
                    {`
                    .usage-breakdown-collapse .ant-collapse-header {
                      padding-right: 0 !important;
                      padding-left: 0 !important;
                    }
                  `}
                  </style>
                  <div className="flex items-center gap-1 px-3 py-1 bg-gray-50 rounded-full border border-gray-100 hover:bg-gray-100 transition-colors w-fit">
                    <Text className="text-gray-500 text-xs font-medium">
                      Show detailed breakdown
                    </Text>
                    <DownOutlined className="text-gray-400 text-[10px]" />
                  </div>
                </div>
              }
              key="1"
              showArrow={false}
            >
              <div className="pt-2">
                <Table
                  dataSource={usageTableData}
                  columns={columns}
                  pagination={false}
                  size="small"
                  locale={{ emptyText: 'No data' }}
                  summary={() => (
                    <Table.Summary.Row className="bg-gray-50 border-t">
                      <Table.Summary.Cell index={0}>
                        <Text strong>Total</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <Text strong>
                          {usageTableData.reduce((sum, row) => sum + row.onVPoints, 0)}
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} />
                      <Table.Summary.Cell index={3} align="right">
                        <div className="flex items-center justify-end gap-1">
                          <Text strong className="text-blue-600">
                            {usageTableData.reduce((sum, row) => sum + row.credits, 0)}
                          </Text>
                        </div>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                />
              </div>
            </Collapse.Panel>
          </Collapse>
        </Card>

        {/* Promotion Code Section */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <span>Promotion Code</span>
            </div>
          }
          className="mb-8"
        >
          <Paragraph className="text-gray-600 mb-4">
            Enter a promotion code to increase your V Points credits
          </Paragraph>
          <div className="flex gap-2">
            <Input
              placeholder="Enter promotion code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              onPressEnter={handleRedeemCode}
              disabled={redeeming}
            />
            <Button
              type="primary"
              onClick={handleRedeemCode}
              loading={redeeming}
              disabled={!promoCode.trim()}
            >
              Redeem
            </Button>
          </div>
        </Card>

        {/* API Key Section */}
        {user && (
          <Card
            title={
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span>Manage Gemini API Key</span>
                  <Tooltip title="Enter your Gemini API Key to use your own quota. Your key is securely encrypted before being stored.">
                    <InfoCircleOutlined className="text-gray-400" />
                  </Tooltip>
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm"
                >
                  Get API Key <ExportOutlined />
                </a>
              </div>
            }
            className="mb-8"
          >
            <ApiKeyManager user={user} />
          </Card>
        )}

        {/* Sign out */}
        <Card className="mt-8">
          <LogoutButton
            onSuccess={() => {
              message.success('Signed out');
              navigate(ROUTES.HOME);
            }}
            onError={(err) => {
              message.error(err || 'Failed to sign out');
            }}
          />
        </Card>
      </div>
    </div>
  );
};

/**
 * Component to manage custom API Key - Simplified & Modern Design
 */
const ApiKeyManager: React.FC<{ user: ApiKeyManagerUser }> = ({ user }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(false);

  const hasKey = !!user?.apiKey?.geminiKey;
  const isActive = user?.apiKey?.isActive ?? true;

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return;
    setLoading(true);
    try {
      await backendService.updateUserAiKey(apiKeyInput.trim(), true);
      setIsEditing(false);
      setApiKeyInput('');
      message.success('API Key saved');
    } catch (error) {
      devError(error);
      message.error('Failed to save API Key');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveKey = async () => {
    Modal.confirm({
      title: 'Remove API Key?',
      content: 'Use V Points for image generations.',
      okText: 'Remove',
      okType: 'danger',
      onOk: async () => {
        setLoading(true);
        try {
          await backendService.updateUserAiKey('', false);
          message.success('API Key removed');
        } catch (error) {          devError(error);
          message.error('Failed to remove API Key');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleToggleActive = async (checked: boolean) => {
    setLoading(true);
    try {
      await backendService.updateUserAiKey(user?.apiKey?.geminiKey || '', checked);
    } catch (error) {
      devError(error);
      message.error('Failed to update');
    } finally {
      setLoading(false);
    }
  };

  // Not connected and not editing: show connect button
  if (!hasKey && !isEditing) {
    return (
      <Button type="default" onClick={() => setIsEditing(true)} className="h-auto py-3">
        Add API Key
      </Button>
    );
  }

  // Connected or editing: unified input
  const handleCopyKey = async () => {
    if (!user?.apiKey?.geminiKey) {
      message.error('No API key to copy');
      return;
    }
    try {
      const decrypted = decryptUserApiKey(user.apiKey.geminiKey);
      if (!decrypted) throw new Error('Decryption returned empty');
      await navigator.clipboard.writeText(decrypted);
      message.success('API key copied to clipboard');
    } catch (err) {
      devError('Failed to copy API key:', err);
      message.error('Failed to copy API key');
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Input.Password
        placeholder={isEditing ? '' : '*********************************'}
        disabled={!isEditing && hasKey}
        value={apiKeyInput}
        onChange={(e) => setApiKeyInput(e.target.value)}
        onBlur={(e) => setApiKeyInput(e.target.value.trim())}
        onPressEnter={isEditing ? handleSaveKey : undefined}
        className="flex-1"
      />

      {hasKey && (
        <Tooltip
          title={isActive ? 'Disable API key (use V Points)' : 'Enable key (use your own quota)'}
        >
          <Switch checked={isActive} onChange={handleToggleActive} loading={loading} size="small" />
        </Tooltip>
      )}

      {isEditing ? (
        <>
          <Button
            type="primary"
            size="small"
            onClick={handleSaveKey}
            loading={loading}
            disabled={!apiKeyInput.trim()}
          >
            Save
          </Button>
          <Button
            size="small"
            onClick={() => {
              setIsEditing(false);
              setApiKeyInput('');
            }}
          >
            Cancel
          </Button>
        </>
      ) : hasKey ? (
        <div className="flex items-center gap-1">
          <Tooltip title="Copy API Key">
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={handleCopyKey} />
          </Tooltip>
          <Tooltip title="Edit API Key">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setIsEditing(true)}
            />
          </Tooltip>
          <Tooltip title="Delete API Key">
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={handleRemoveKey}
              loading={loading}
            />
          </Tooltip>
        </div>
      ) : null}
    </div>
  );
};

export default UserProfilePage;
