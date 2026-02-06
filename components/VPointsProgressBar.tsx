import React from 'react';
import { Typography, Progress } from 'antd';
import { DEFAULT_CREDIT_LIMIT } from '@/constants/constants';
import VPointsIcon from './icons/VPointsIcon';

const { Text } = Typography;

interface VPointsProgressBarProps {
  totalCredits: number;
  usagePercentage: number;
  limit?: number;
  className?: string;
  showTitle?: boolean;
  showDetails?: boolean;
}

/**
 * Get stroke color gradient based on usage percentage
 * Exported for reuse and testing
 */
export const getStrokeColor = (usagePercentage: number): { '0%': string; '100%': string } => {
  if (usagePercentage >= 100) return { '0%': '#f5222d', '100%': '#fa8c16' }; // Orange-Red
  if (usagePercentage >= 80) return { '0%': '#fa8c16', '100%': '#ffec3d' }; // Orange-Yellow
  return { '0%': '#1890ff', '100%': '#722ed1' }; // Blue-Purple
};

/**
 * Reusable V Points Progress Bar with dynamic color gradients
 * @param totalCredits - Total V Points consumed
 * @param usagePercentage - Percentage of usage
 */
const VPointsProgressBar: React.FC<VPointsProgressBarProps> = ({
  totalCredits,
  usagePercentage,
  limit = DEFAULT_CREDIT_LIMIT,
  className = '',
  showTitle = true,
  showDetails = true,
}) => {
  const getProgressStatus = () => {
    if (usagePercentage >= 100) return 'exception';
    if (usagePercentage >= 80) return 'active';
    return 'normal';
  };

  return (
    <div className={`v-points-progress-container ${className}`}>
      {showTitle && (
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <VPointsIcon size={32} showText={true} />
          </div>
          <Text strong>
            {totalCredits} / {limit}
          </Text>
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Progress
            percent={Math.min(usagePercentage, 100)}
            status={getProgressStatus()}
            strokeColor={getStrokeColor(usagePercentage)}
            size={10}
            showInfo={false}
          />
        </div>
        {showDetails && (
          <Text className="text-gray-400 text-xs whitespace-nowrap w-16 text-right">
            {Math.round(usagePercentage)}% used
          </Text>
        )}
      </div>
    </div>
  );
};

export default VPointsProgressBar;
