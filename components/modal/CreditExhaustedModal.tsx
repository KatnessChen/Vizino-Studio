import React from 'react';
import { Modal, Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { DEFAULT_CREDIT_LIMIT } from '@/constants/constants';
import VPointsProgressBar from '@/components/VPointsProgressBar';

interface CreditExhaustedModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalCredits: number;
  limit?: number;
}

/**
 * Modal shown when user's V points credit limit is reached
 * Directs user to profile page to add their own API key
 */
const CreditExhaustedModal: React.FC<CreditExhaustedModalProps> = ({
  isOpen,
  onClose,
  totalCredits,
  limit = DEFAULT_CREDIT_LIMIT,
}) => {
  const navigate = useNavigate();

  const handleGoToProfile = () => {
    onClose();
    navigate(ROUTES.USER_PROFILE);
  };

  const percentage = Math.min(Math.round((totalCredits / limit) * 100), 100);

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      title="Credit Exhausted"
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="profile" type="primary" onClick={handleGoToProfile}>
          Go to Profile
        </Button>,
      ]}
      width={480}
    >
      <div className="py-4">
        {/* Credit Usage Display */}
        <VPointsProgressBar
          totalCredits={totalCredits}
          usagePercentage={percentage}
          limit={limit}
          className="mb-6"
        />

        {/* Message */}
        <Typography.Paragraph className="text-gray-700 mb-4">
          You've used all your free V points. To continue using generative AI features, please add
          your own Gemini API key in your profile settings.
        </Typography.Paragraph>
      </div>
    </Modal>
  );
};

export default CreditExhaustedModal;
