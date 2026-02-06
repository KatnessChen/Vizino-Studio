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
import {
  ArrowLeftOutlined,
  DownOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { updateUserAiKey, toggleUserAiKeyStatus } from '@/services/userService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCreditCheck } from '@/hooks/useCreditCheck';
import { CREDIT_MULTIPLIERS } from '@/constants/constants';
import { ROUTES } from '@/constants/routes';
import VPointsProgressBar from '@/components/VPointsProgressBar';
import VPointsIcon from '@/components/icons/VPointsIcon';

const { Title, Text, Paragraph } = Typography;

/**
 * User Profile Page - Displays V points usage and credit information
 */
const UserProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { isLoading, totalCredits, usagePercentage, usage, hasEnabledOwnKey } = useCreditCheck({
    userId: user?.uid,
  });

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

  // Build usage data for table
  const usageTableData = Object.entries(usage || {}).map(([taskName, count]) => ({
    key: taskName,
    taskName,
    count: count as number,
    multiplier: CREDIT_MULTIPLIERS[taskName] ?? 1,
    credits: (count as number) * (CREDIT_MULTIPLIERS[taskName] ?? 1),
  }));

  // Sort by credits consumed (highest first)
  usageTableData.sort((a, b) => b.credits - a.credits);

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
      title: 'Uses',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      align: 'right' as const,
    },
    {
      title: 'Multiplier',
      dataIndex: 'multiplier',
      key: 'multiplier',
      width: 100,
      align: 'center' as const,
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
      width: 100,
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

      {/* User Info */}
      <Card className="mb-6">
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

      {/* V Points Usage - Hidden if user has enabled their own API key */}
      {!hasEnabledOwnKey && (
        <Card title="V Points Usage" className="mb-6" loading={isLoading}>
          {/* Progress Bar Component */}
          <VPointsProgressBar totalCredits={totalCredits} usagePercentage={usagePercentage} />
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
                          {usageTableData.reduce((sum, row) => sum + row.count, 0)}
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} />
                      <Table.Summary.Cell index={3} align="right">
                        <div className="flex items-center justify-end gap-1">
                          <Text strong className="text-blue-600">
                            {totalCredits}
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
      )}

      {/* API Key Section (Placeholder) */}
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
              Get API Key →
            </a>
          </div>
        }
        className="mb-6"
      >
        <ApiKeyManager user={user} />
      </Card>
    </div>
  );
};

/**
 * Component to manage custom API Key - Simplified & Modern Design
 */
const ApiKeyManager: React.FC<{ user: any }> = ({ user }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(false);

  const hasKey = !!user?.apiKey?.geminiKey;
  const isActive = user?.apiKey?.isActive ?? true;

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return;
    setLoading(true);
    try {
      await updateUserAiKey(user.uid, apiKeyInput.trim(), true);
      setIsEditing(false);
      setApiKeyInput('');
      message.success('API Key saved');
    } catch (error) {
      console.error(error);
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
          await updateUserAiKey(user.uid, '', false);
          message.success('API Key removed');
        } catch (error) {
          console.error(error);
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
      await toggleUserAiKeyStatus(user.uid, checked);
    } catch (error) {
      console.error(error);
      message.error('Failed to update');
    } finally {
      setLoading(false);
    }
  };

  // Not connected and not editing: show connect button
  if (!hasKey && !isEditing) {
    return (
      <Button
        type="default"
        size="large"
        block
        onClick={() => setIsEditing(true)}
        className="h-auto py-3"
      >
        <div className="text-left">
          <div className="font-medium">Add API Key</div>
        </div>
      </Button>
    );
  }

  // Connected or editing: unified input
  return (
    <div className="flex items-center gap-3">
      <Input.Password
        placeholder={isEditing ? '' : '***'}
        disabled={!isEditing && hasKey}
        value={apiKeyInput}
        onChange={(e) => setApiKeyInput(e.target.value)}
        onPressEnter={isEditing ? handleSaveKey : undefined}
        className="flex-1"
      />

      {hasKey && <Switch checked={isActive} onChange={handleToggleActive} loading={loading} />}

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
        <>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setIsEditing(true)}
          />
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={handleRemoveKey}
            loading={loading}
          />
        </>
      ) : null}
    </div>
  );
};

export default UserProfilePage;
