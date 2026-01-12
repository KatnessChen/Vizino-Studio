import React, { useState } from 'react';
import { RadioGroup, Radio, FormControlLabel } from '@mui/material';

interface CopyImageModalProps {
  isOpen: boolean;
  numberOfImages: number;
  imageType: 'original' | 'updated';
  onConfirm: (copyMode: 'duplicate-as-original' | 'keep-history') => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const CopyImageModal: React.FC<CopyImageModalProps> = ({
  isOpen,
  numberOfImages,
  imageType,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const [selectedMode, setSelectedMode] = useState<'duplicate-as-original' | 'keep-history'>(
    'duplicate-as-original'
  );

  if (!isOpen) return null;

  const handleConfirm = () => {
    // For original images, always use 'duplicate-as-original'
    const finalMode = imageType === 'original' ? 'duplicate-as-original' : selectedMode;
    onConfirm(finalMode);
  };

  const handleModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMode(event.target.value as 'duplicate-as-original' | 'keep-history');
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Copy Image{numberOfImages > 1 ? 's' : ''}
        </h3>

        {imageType === 'updated' && (
          <div className="mb-6">
            <p className="text-sm text-gray-700 font-semibold mb-3">Select copy method:</p>
            <RadioGroup value={selectedMode} onChange={handleModeChange}>
              <FormControlLabel
                value="duplicate-as-original"
                control={<Radio />}
                label={
                  <div>
                    <p className="font-medium text-gray-800">Duplicate as original image</p>
                    <p className="text-sm text-gray-600">
                      The operation history will not be kept. Take the updated image as a brand new
                      image
                    </p>
                  </div>
                }
                className="mb-3"
              />
              <FormControlLabel
                value="keep-history"
                control={<Radio />}
                label={
                  <div>
                    <p className="font-medium text-gray-800">Simply duplicate the image</p>
                    <p className="text-sm text-gray-600">Keeping its operation history</p>
                  </div>
                }
              />
            </RadioGroup>
          </div>
        )}

        {imageType === 'original' && (
          <div className="mb-6 p-4 bg-blue-50 rounded-md border border-blue-200">
            <p className="text-sm text-gray-700">
              The original image will be duplicated as a brand new image.
            </p>
          </div>
        )}

        <div className="flex gap-4 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="px-6 py-2 border border-transparent text-white rounded-md shadow-sm bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CopyImageModal;
