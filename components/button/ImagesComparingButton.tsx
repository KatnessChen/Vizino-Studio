import React, { useState } from 'react';
import { Tooltip, Button } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import ImagesComparingModal from '../modal/ImagesComparingModal';
import { ImageData } from '@/types';

interface ImagesComparingButtonProps {
  totalSelectedCount: number;
  selectedAssets?: ImageData[];
}

const ImagesComparingButton: React.FC<ImagesComparingButtonProps> = ({
  totalSelectedCount,
  selectedAssets = [],
}) => {
  const [showCompareModal, setShowCompareModal] = useState(false);
  const isEnabled = totalSelectedCount >= 2;

  const handleClick = () => {
    if (isEnabled) {
      setShowCompareModal(true);
    }
  };

  const tooltipTitle = isEnabled
    ? `Compare ${totalSelectedCount} asset${totalSelectedCount !== 1 ? 's' : ''}`
    : 'Select at least 2 assets to compare';

  return (
    <>
      <Tooltip title={tooltipTitle}>
        <Button
          type="text"
          size="small"
          icon={
            <SwapOutlined style={{ fontSize: '18px', color: isEnabled ? 'gray' : 'lightgray' }} />
          }
          onClick={handleClick}
          disabled={!isEnabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#ffffff',
            margin: '3px 6px 0px 6px',
          }}
        />
      </Tooltip>

      {/* Compare Photos Modal */}
      {showCompareModal && (
        <ImagesComparingModal
          isOpen={showCompareModal}
          selectedAssets={selectedAssets}
          onClose={() => setShowCompareModal(false)}
        />
      )}
    </>
  );
};

export default ImagesComparingButton;
