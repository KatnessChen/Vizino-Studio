import React, { useState } from 'react';
import { Tooltip } from '@mui/material';
import { CompareArrows as CompareIcon } from '@mui/icons-material';
import { Button } from 'antd';
import ImagesComparingModal from '../modal/ImagesComparingModal';
import { ImageData } from '@/types';

interface ImagesComparingButtonProps {
  totalSelectedPhotos: number;
  isEnabled: boolean;
  onClick: () => void;
  selectedPhotos?: ImageData[];
}

const ImagesComparingButton: React.FC<ImagesComparingButtonProps> = ({
  totalSelectedPhotos,
  isEnabled,
  onClick,
  selectedPhotos = [],
}) => {
  const [showCompareModal, setShowCompareModal] = useState(false);

  const handleClick = () => {
    setShowCompareModal(true);
    onClick();
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Tooltip title="Select 2-4 photos to compare side by side" placement="right" arrow>
          <Button
            type="default"
            size="large"
            onClick={handleClick}
            disabled={!isEnabled}
            icon={<CompareIcon sx={{ fontSize: 20 }} />}
            className="flex-1"
          >
            Compare ({totalSelectedPhotos}/4)
          </Button>
        </Tooltip>
      </div>

      {/* Compare Photos Modal */}
      {showCompareModal && (
        <ImagesComparingModal
          isOpen={showCompareModal}
          images={selectedPhotos}
          onClose={() => setShowCompareModal(false)}
        />
      )}
    </>
  );
};

export default ImagesComparingButton;
