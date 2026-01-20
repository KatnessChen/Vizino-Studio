import React, { useState, useRef } from 'react';
import { Modal, Button, Alert, Skeleton, Input, Tooltip } from 'antd';
import { CloudUpload as UploadIcon, Close as CloseIcon } from '@mui/icons-material';
import {
  MAX_FILE_SIZE_MB,
  MAX_IMAGES_PER_SPACE,
  MAX_CUSTOM_ASSET_NAME_LENGTH,
  MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH,
} from '@/constants/constants';

interface FilePreview {
  file: File;
  preview: string;
  id: string;
  width: number;
  height: number;
  name?: string;
  description?: string;
  error?: string;
}

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (
    files: Array<{ file: File; width: number; height: number; name?: string; description?: string }>
  ) => Promise<void>;
  currentCount?: number;
  title?: string;
  mode?: 'image' | 'asset'; // 'image' for Gallery, 'asset' for Texture/Item
  assetType?: 'texture' | 'item';
  existingNames?: Set<string>;
}

const BatchUploadModal: React.FC<BatchUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  currentCount = 0,
  title = 'Upload Images',
  mode = 'image',
  assetType = 'texture',
  existingNames = new Set(),
}) => {
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingPreviews, setIsLoadingPreviews] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hoverPreview, setHoverPreview] = useState<{ preview: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = MAX_IMAGES_PER_SPACE - currentCount;
  const acceptedFileTypes = '.jpg, .jpeg, .png';
  const isAssetMode = mode === 'asset';
  const assetLabel = assetType === 'texture' ? 'Texture' : 'Item';

  const validateFile = (file: File): string | null => {
    // Check file type - only allow jpg, jpeg, png
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      return `${file.name}: Only .jpg, .jpeg, .png files are allowed`;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `${file.name}: File size exceeds ${MAX_FILE_SIZE_MB}MB`;
    }

    return null;
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  };

  const generateDefaultName = (fileName: string): string => {
    // Return the full file name without extension
    const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    return baseName;
  };

  const handleFilesSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    setIsLoadingPreviews(true);
    const newFiles: FilePreview[] = [];
    const errors: string[] = [];

    // Check if adding these files would exceed the limit BEFORE processing
    const totalFilesAfterAdding = filePreviews.length + files.length;
    if (totalFilesAfterAdding > remainingSlots) {
      const canAdd = remainingSlots - filePreviews.length;
      setError(
        `Cannot add ${files.length} file(s). You can only add ${canAdd} more file(s). (${remainingSlots} total slots remaining)`
      );
      setIsLoadingPreviews(false);
      return;
    }

    // Process files sequentially to get dimensions
    for (const file of Array.from(files)) {
      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(validationError);
        continue;
      }

      // Check for duplicates
      const isDuplicate = filePreviews.some((fp) => fp.file.name === file.name);
      if (isDuplicate) {
        errors.push(`${file.name}: Already added`);
        continue;
      }

      try {
        // Get image dimensions
        const { width, height } = await getImageDimensions(file);

        // Create preview
        const preview = URL.createObjectURL(file);
        const defaultName = generateDefaultName(file.name);

        newFiles.push({
          file,
          preview,
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          width,
          height,
          name: defaultName,
          description: '',
        });
      } catch (error) {
        errors.push(`${file.name}: Failed to process image`);
      }
    }

    if (errors.length > 0) {
      setError(errors.join(', '));
    }

    if (newFiles.length > 0) {
      setFilePreviews((prev) => [...prev, ...newFiles]);
    }

    setIsLoadingPreviews(false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesSelect(e.target.files);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFilesSelect(e.dataTransfer.files);
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

  const handleRemoveFile = (id: string) => {
    setFilePreviews((prev) => {
      const updated = prev.filter((fp) => fp.id !== id);
      // Revoke object URL to free memory
      const removed = prev.find((fp) => fp.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.preview);
      }
      return updated;
    });
    setError(null);
  };

  const handleNameChange = (id: string, name: string) => {
    setFilePreviews((prev) =>
      prev.map((fp) => {
        if (fp.id === id) {
          const trimmedName = name.substring(0, MAX_CUSTOM_ASSET_NAME_LENGTH);
          
          // Only validate in asset mode
          if (isAssetMode) {
            let error: string | undefined;
            if (!name.trim()) {
              error = 'Name required';
            } else if (name.length > MAX_CUSTOM_ASSET_NAME_LENGTH) {
              error = `Max ${MAX_CUSTOM_ASSET_NAME_LENGTH} chars`;
            } else if (existingNames.has(name.toLowerCase())) {
              error = 'Name exists';
            } else if (
              prev.some((f) => f.id !== id && f.name?.toLowerCase() === name.toLowerCase())
            ) {
              error = 'Duplicate name';
            }
            return { ...fp, name: trimmedName, error };
          }
          
          // Image mode: no validation, just length limit
          return { ...fp, name: trimmedName };
        }
        return fp;
      })
    );
  };

  const handleDescriptionChange = (id: string, description: string) => {
    setFilePreviews((prev) =>
      prev.map((fp) =>
        fp.id === id
          ? { ...fp, description: description.substring(0, MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH) }
          : fp
      )
    );
  };

  const handleUpload = async () => {
    if (filePreviews.length === 0) return;

    // Validate all files have valid names (only for asset mode)
    if (isAssetMode) {
      const hasErrors = filePreviews.some((fp) => fp.error || !fp.name?.trim());
      if (hasErrors) {
        setError('Please fix all errors before uploading');
        return;
      }
    }

    setIsUploading(true);
    setError(null);

    try {
      const filesWithMetadata = filePreviews.map((fp) => ({
        file: fp.file,
        width: fp.width,
        height: fp.height,
        name: fp.name?.trim(),
        description: fp.description?.trim(),
      }));

      await onUpload(filesWithMetadata);

      // Clean up previews
      filePreviews.forEach((fp) => URL.revokeObjectURL(fp.preview));
      setFilePreviews([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    // Clean up previews
    filePreviews.forEach((fp) => URL.revokeObjectURL(fp.preview));
    setFilePreviews([]);
    setError(null);
    onClose();
  };

  return (
    <Modal
      title={title}
      open={isOpen}
      onCancel={handleClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={isUploading}>
          Cancel
        </Button>,
        <Button
          key="upload"
          type="primary"
          onClick={handleUpload}
          loading={isUploading}
          disabled={filePreviews.length === 0}
        >
          Upload {filePreviews.length > 0 && `(${filePreviews.length})`}
        </Button>,
      ]}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFileTypes}
        multiple
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />

      {/* Upload area */}
      <div
        className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-all ${
          isDragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{ cursor: 'pointer' }}
      >
        <UploadIcon style={{ fontSize: 48, color: '#9ca3af' }} />
        <p className="mt-2 text-sm font-semibold text-gray-700">
          Click or drag files to upload
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Accepted: {acceptedFileTypes} • Max {MAX_FILE_SIZE_MB}MB per file •{' '}
          {remainingSlots} slots remaining
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* File previews - Horizontal layout */}
      {filePreviews.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-700">
              Preview Files ({filePreviews.length})
            </h4>
            <Alert
              title="Hover over images to preview them in full size"
              type="info"
              showIcon
              className="py-1 px-2"
              style={{ fontSize: '11px', lineHeight: '1.2' }}
            />
          </div>

          {/* Custom scrollbar styles */}
          <style>{`
            .preview-scroll::-webkit-scrollbar {
              width: 10px;
              height: 10px;
            }
            .preview-scroll::-webkit-scrollbar-track {
              background: #f1f1f1;
              border-radius: 5px;
            }
            .preview-scroll::-webkit-scrollbar-thumb {
              background: #888;
              border-radius: 5px;
            }
            .preview-scroll::-webkit-scrollbar-thumb:hover {
              background: #555;
            }
            
            @keyframes hoverModalFadeIn {
              from {
                opacity: 0;
                transform: translateY(10px) scale(1.5);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1.5);
              }
            }
            
            .hover-modal-animate {
              animation: hoverModalFadeIn 0.25s ease-out;
            }
          `}</style>
          
          {isLoadingPreviews && (
            <div className="mb-2 text-sm text-blue-600 font-medium animate-pulse">
               Processing images... please wait
            </div>
          )}

          <div className="preview-scroll max-h-96 overflow-y-auto space-y-3 pr-2">
            {isLoadingPreviews ? (
              // Show skeletons while loading
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="rounded-lg border border-gray-200 overflow-hidden bg-white p-3 flex gap-3"
                >
                  <Skeleton.Image active style={{ width: '96px', height: '96px' }} />
                  <div className="flex-1">
                    <Skeleton active paragraph={{ rows: 2 }} />
                  </div>
                </div>
              ))
            ) : (
              filePreviews.map((fp) => (
                <div
                  key={fp.id}
                  className="relative group rounded-lg border border-gray-200 overflow-hidden bg-white p-3 flex gap-3 items-center"
                >
                  {/* Remove button */}
                  <Tooltip title="Remove from upload list">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(fp.id);
                      }}
                      className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-gray-300 hover:text-gray-800 cursor-pointer"
                      disabled={isUploading}
                    >
                      <CloseIcon style={{ fontSize: 16 }} />
                    </button>
                  </Tooltip>

                  {/* Image preview */}
                  <div
                    className="w-48 h-32 flex-shrink-0 bg-gray-100 rounded cursor-pointer"
                    style={{
                      backgroundImage: `url(${fp.preview})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }}
                    onMouseEnter={() =>
                      setHoverPreview({ preview: fp.preview, name: fp.file.name })
                    }
                    onMouseLeave={() => setHoverPreview(null)}
                  />

                  {/* File info or metadata inputs */}
                  <div className="flex-1 space-y-2">
                    {isAssetMode ? (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {assetLabel} Name *
                            <span className="text-gray-500 ml-1">
                              ({fp.name?.length || 0}/{MAX_CUSTOM_ASSET_NAME_LENGTH})
                            </span>
                          </label>
                          <Input
                            value={fp.name || ''}
                            onChange={(e) => handleNameChange(fp.id, e.target.value)}
                            placeholder={`Enter ${assetLabel.toLowerCase()} name`}
                            status={fp.error ? 'error' : ''}
                            disabled={isUploading}
                            size="small"
                          />
                          {fp.error && <p className="text-xs text-red-600 mt-1">{fp.error}</p>}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Description (Optional)
                            <span className="text-gray-500 ml-1">
                              ({fp.description?.length || 0}/{MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH})
                            </span>
                          </label>
                          <Input.TextArea
                            value={fp.description}
                            onChange={(e) => handleDescriptionChange(fp.id, e.target.value)}
                            placeholder="Add description"
                            disabled={isUploading}
                            size="small"
                            rows={2}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            File Name
                            <span className="text-gray-500 ml-1">
                              ({fp.name?.length || 0}/{MAX_CUSTOM_ASSET_NAME_LENGTH})
                            </span>
                          </label>
                          <Input
                            value={fp.name || ''}
                            onChange={(e) => handleNameChange(fp.id, e.target.value)}
                            placeholder="Enter file name"
                            disabled={isUploading}
                            size="small"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Description (Optional)
                            <span className="text-gray-500 ml-1">
                              ({fp.description?.length || 0}/{MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH})
                            </span>
                          </label>
                          <Input.TextArea
                            value={fp.description}
                            onChange={(e) => handleDescriptionChange(fp.id, e.target.value)}
                            placeholder="Add description"
                            disabled={isUploading}
                            size="small"
                            rows={2}
                          />
                        </div>
                      </>
                    )}
                    
                    <p className="text-xs text-gray-500">
                      {(fp.file.size / 1024 / 1024).toFixed(2)} MB • {fp.width} × {fp.height} px
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Hover preview modal with animation */}
      {hoverPreview && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(0, 0, 0, 0.75)' }}
        >
          <div
            className="hover-modal-animate relative bg-white rounded-lg shadow-2xl overflow-hidden"
            style={{
              maxWidth: '60vw',
              maxHeight: '60vh',
              transform: 'scale(1.5)',
            }}
          >
            <img
              src={hoverPreview.preview}
              alt={hoverPreview.name}
              className="w-full h-full object-cotain"
              style={{ maxWidth: '60vw', maxHeight: '60vh' }}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-2 text-xs text-center">
              {hoverPreview.name}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default BatchUploadModal;
