import React from 'react';
import { Modal, Button, Typography, Space } from 'antd';
import { ThunderboltOutlined, UserOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface GreetingModalProps {
  open: boolean;
  onSignIn: () => void;
  onTakeTour: () => void;
  onClose: () => void;
}

const GreetingModal: React.FC<GreetingModalProps> = ({ open, onSignIn, onTakeTour }) => {
  return (
    <Modal
      open={open}
      footer={null}
      closable={false}
      centered
      width={480}
      styles={{
        body: { padding: '40px 32px' },
        mask: { backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
      }}
    >
      <div className="text-center">
        {/* Logo or Icon */}
        <div
          className="mx-auto mb-6 w-16 h-16 flex items-center justify-center rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #7c3aed 100%)',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.35)',
          }}
        >
          <span className="text-3xl">✨</span>
        </div>

        {/* Greeting Message */}
        <Title level={2} style={{ margin: '0 0 8px 0', fontSize: '28px' }}>
          Welcome to Vizino AI
        </Title>
        <Text
          className="block mb-6 uppercase tracking-widest text-indigo-600 font-bold"
          style={{ fontSize: '12px' }}
        >
          From Visual Instruction to Precise Design
        </Text>

        {/* Introduction */}
        <Paragraph
          className="text-gray-600 mb-10 text-pretty"
          style={{ fontSize: '16px', lineHeight: '1.6' }}
        >
          <strong>Experience state-of-the-art AI design.</strong> Recolor walls, remix textures, add
          objects, and use custom prompts with flawless precision.
        </Paragraph>

        {/* Actions */}
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Button
            type="primary"
            size="large"
            block
            icon={<ThunderboltOutlined />}
            onClick={onTakeTour}
            style={{
              height: '52px',
              fontSize: '16px',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #7c3aed 100%)',
              border: 'none',
              borderRadius: '12px',
            }}
          >
            Take a Tour
          </Button>
          <Button
            size="large"
            block
            icon={<UserOutlined />}
            onClick={onSignIn}
            style={{
              height: '52px',
              fontSize: '16px',
              fontWeight: 500,
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              color: '#374151',
            }}
          >
            Sign In to Your Account
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default GreetingModal;
