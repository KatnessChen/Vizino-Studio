import React, { useRef, useState } from 'react';
import { MAX_FILE_SIZE_MB } from '@/constants/constants';
import { CloudUploadOutlined as UploadIcon } from '@ant-design/icons';
import { devError } from '@/utils/devLogger';

interface UploadCardProps {
  onImageUpload: (file: File) => void;
  onError: (message: string) => void;
  isLimitReached?: boolean;
}

const UploadCard: React.FC<UploadCardProps> = ({
  onImageUpload,
  onError,
  isLimitReached = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = async (files: FileList | null) => {
    if (isLimitReached) {
      onError('Image limit reached. Delete images to upload new ones.');
      return;
    }
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.type.startsWith('image/')) {
        onError('Please upload an image file (e.g., JPG, PNG, GIF).');
        return;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        onError(`File size exceeds the limit of ${MAX_FILE_SIZE_MB}MB.`);
        return;
      }

      try {
        onImageUpload(file);
      } catch (error) {
        onError('Failed to process image file.');
        devError('File upload error:', error);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFileChange(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  return (
    <div
      className={`relative group rounded-lg overflow-hidden shadow-md bg-white transition-all duration-200 ${
        isLimitReached ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-lg'
      }
                  ${isDragOver && !isLimitReached ? 'ring-2 ring-blue-500' : ''}`}
      onDrop={isLimitReached ? undefined : handleDrop}
      onDragOver={isLimitReached ? undefined : handleDragOver}
      onDragLeave={isLimitReached ? undefined : handleDragLeave}
      onClick={() => !isLimitReached && fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => handleFileChange(e.target.files)}
        disabled={isLimitReached}
        aria-label="Upload image file"
      />

      {/* Upload area matching AssetCard height */}
      <div
        className={`w-full h-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg transition-all duration-200 ${
          isLimitReached
            ? 'bg-gray-100 border-gray-200 text-gray-500'
            : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 hover:border-blue-400 hover:from-blue-50 hover:to-blue-100'
        }`}
      >
        <UploadIcon
          className={`text-4xl transition-colors ${
            isLimitReached ? 'text-gray-400' : 'text-gray-500 group-hover:text-blue-500'
          }`}
        />
        <p
          className={`mt-2 text-sm font-semibold transition-colors ${
            isLimitReached ? 'text-gray-500' : 'text-gray-600 group-hover:text-blue-600'
          }`}
        >
          {isLimitReached ? 'Limit Reached' : 'Click or Drop'}
        </p>
        <p className={`text-xs mt-1 ${isLimitReached ? 'text-gray-500' : 'text-gray-500'}`}>
          {isLimitReached ? 'Delete images to upload more' : `${MAX_FILE_SIZE_MB} MB max`}
        </p>
      </div>
    </div>
  );
};

export default UploadCard;
