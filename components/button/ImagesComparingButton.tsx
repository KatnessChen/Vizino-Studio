import React, { useState } from 'react';
import { Tooltip } from 'antd';
import { CompareArrows as CompareIcon } from '@mui/icons-material';
import { Button } from 'antd';
import ImagesComparingModal from '../modal/ImagesComparingModal';
import { ImageData } from '@/types';

interface ImagesComparingButtonProps {
  totalSelectedPhotos: number;
  selectedPhotos?: ImageData[];
  isToolbarMode?: boolean;
}

const ImagesComparingButton: React.FC<ImagesComparingButtonProps> = ({
  totalSelectedPhotos,
  selectedPhotos = [],
  isToolbarMode = false,
}) => {
  const [showCompareModal, setShowCompareModal] = useState(false);
  const isEnabled = totalSelectedPhotos >= 2;

  const handleClick = () => {
    if (isEnabled) {
      setShowCompareModal(true);
    }
  };

  const tooltipTitle = isEnabled
    ? `Compare ${totalSelectedPhotos} image${totalSelectedPhotos !== 1 ? 's' : ''} (Original & Generated)`
    : 'Select at least 2 images from Original or Generated to compare';

  if (isToolbarMode) {
    // Toolbar mode: icon-only button
    return (
      <>
        <Tooltip title={tooltipTitle}>
          <Button
            type="text"
            size="small"
            icon={
              <CompareIcon style={{ fontSize: '18px', color: isEnabled ? 'gray' : 'lightgray' }} />
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
            images={selectedPhotos}
            onClose={() => setShowCompareModal(false)}
          />
        )}
      </>
    );
  }

  // Panel mode: full button (for backward compatibility)
  return (
    <>
      <div className="flex items-center gap-2">
        <Tooltip title={tooltipTitle}>
          <Button
            type="default"
            size="large"
            onClick={handleClick}
            disabled={!isEnabled}
            icon={<CompareIcon sx={{ fontSize: 20 }} />}
            className="flex-1"
          >
            Compare ({totalSelectedPhotos})
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
