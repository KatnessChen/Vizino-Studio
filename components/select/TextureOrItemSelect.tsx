import { useState, useCallback, useEffect } from 'react';
import { Radio, Modal, Input, Card, Button, message } from 'antd';
import { Alert } from '@mui/material';
import { PlusOutlined, LockOutlined } from '@ant-design/icons';
import { Texture, Item } from '@/types';
import { useCustomAssets } from '@/hooks/useCustomAssets';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/stores/store';
import { imageCache } from '@/utils/imageCache';
import { imageDownloadUrlToBase64 } from '@/utils';
import { Timestamp } from 'firebase/firestore';
import {
  setSelectedTexture,
  selectSelectedTexture,
  setSelectedItem,
  selectSelectedItem,
} from '@/stores/taskStore';
import {
  MAX_CUSTOM_ASSET_NAME_LENGTH,
  MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH,
} from '@/constants/constants';
import ImageDisplayModal from '../modal/ImageDisplayModal';
import BatchUploadModal from '../modal/BatchUploadModal';
import AssetCard from '@/components/ui/AssetCard';
import { setShowLoginRequiredModal } from '@/stores/guestStore';
import { useGuest } from '@/contexts/GuestContext';
import MyEmpty from '@/components/ui/MyEmpty';

type AssetType = 'texture' | 'item';
type Asset = Texture | Item;

interface TextureOrItemSelectProps {
  type: AssetType;
  title?: string;
  onSelect?: (asset: Asset | null) => void;
  onError?: (error: string) => void;
}

const TextureOrItemSelect: React.FC<TextureOrItemSelectProps> = ({
  type,
  title,
  onSelect,
  onError,
}) => {
  const dispatch = useDispatch();
  const { isGuestMode } = useGuest();
  const activeProjectId = useSelector((state: RootState) => state.project.activeProjectId);

  // Load data based on type
  const { customAssets, isLoadingAssets, loadAssetsError, addAsset } = useCustomAssets(
    type,
    activeProjectId
  );

  const isTexture = type === 'texture';

  const selectedAsset = useSelector((state: RootState) =>
    isTexture ? selectSelectedTexture(state) : selectSelectedItem(state)
  );

  // State
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [assetName, setAssetName] = useState<string>('');
  const [assetDescription, setAssetDescription] = useState<string>('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [base64Map, setBase64Map] = useState<Map<string, string>>(new Map());
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedAssetForView, setSelectedAssetForView] = useState<Asset | null>(null);
  const [showBatchUploadModal, setShowBatchUploadModal] = useState(false);

  // Load asset previews from cache
  useEffect(() => {
    const loadAssetPreviews = async () => {
      const newMap = new Map<string, string>();

      for (const asset of customAssets) {
        const downloadUrl = isTexture
          ? (asset as Texture).textureImageDownloadUrl
          : (asset as Item).itemImageDownloadUrl;

        if (downloadUrl) {
          try {
            // Try to get from cache first
            let base64 = await imageCache.get(downloadUrl);

            // If not in cache, convert and cache it
            if (!base64) {
              base64 = await imageDownloadUrlToBase64(downloadUrl);
            }

            if (base64) {
              newMap.set(asset.id, base64);
            }
          } catch (error) {
            console.warn(`Failed to load ${type} preview for ${asset.name}:`, error);
          }
        }
      }

      setBase64Map(newMap);
    };

    if (customAssets.length > 0) {
      loadAssetPreviews();
    }
  }, [customAssets, type, isTexture]);

  // Handle asset upload to Firestore
  const handleAssetUpload = useCallback(
    async (
      file: File,
      name: string,
      description: string,
      dimensions?: { width: number; height: number; aspect_ratio: number }
    ) => {
      try {
        const newAsset = await addAsset({
          name,
          file,
          description,
          width: dimensions?.width,
          height: dimensions?.height,
          aspect_ratio: dimensions?.aspect_ratio,
        });

        setUploadError(null);
        message.success(`${isTexture ? 'Texture' : 'Home item'} "${name}" added successfully!`);

        // Select the newly uploaded asset
        if (newAsset) {
          if (isTexture) {
            dispatch(setSelectedTexture(newAsset as Texture));
          } else {
            dispatch(setSelectedItem(newAsset as Item));
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : `Failed to save ${isTexture ? 'texture' : 'home item'}`;
        setUploadError(errorMessage);
        onError?.(errorMessage);
        message.error(errorMessage);
      }
    },
    [dispatch, addAsset, onError, isTexture]
  );

  // Handle batch asset upload
  const handleBatchAssetUpload = async (
    filesWithMetadata: Array<{
      file: File;
      width: number;
      height: number;
      name?: string;
      description?: string;
    }>
  ) => {
    for (const { file, name, description, width, height } of filesWithMetadata) {
      if (!name) continue; // Skip if no name
      try {
        const aspect_ratio = width && height ? width / height : undefined;
        await handleAssetUpload(
          file,
          name,
          description || '',
          aspect_ratio && width && height ? { width, height, aspect_ratio } : undefined
        );
      } catch (error) {
        console.error('Failed to upload asset:', name, error);
        throw error; // Stop on first error
      }
    }
  };

  const existingNames = new Set(customAssets.map((a) => a.name.toLowerCase()));

  const validateAssetName = (name: string): string | null => {
    if (!name.trim()) {
      return `${isTexture ? 'Texture' : 'Item'} name cannot be empty`;
    }
    if (name.length > MAX_CUSTOM_ASSET_NAME_LENGTH) {
      return `${isTexture ? 'Texture' : 'Item'} name must be ${MAX_CUSTOM_ASSET_NAME_LENGTH} characters or less`;
    }
    if (existingNames.has(name.toLowerCase())) {
      return `This ${isTexture ? 'texture' : 'item'} name already exists`;
    }
    return null;
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile) return;

    const nameError = validateAssetName(assetName);
    if (nameError) {
      setUploadError(nameError);
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      // For single upload, we might not have dimensions immediately unless we read the file
      // Since this is a minor case compared to batch upload, we can skip calculating dimensions here
      // or implement a quick image load if critical. For now, proceeding without dimensions for single upload.
      await handleAssetUpload(pendingFile, assetName.trim(), assetDescription.trim());

      // Reset state
      setPendingFile(null);
      setAssetName('');
      setAssetDescription('');
      setShowNameModal(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to upload ${isTexture ? 'texture' : 'home item'}`;
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const defaultTitle = isTexture ? 'Textures' : 'Objects';
  const modalTitle = isTexture ? 'Add Texture' : 'Add Home Item';
  const modalOkText = isTexture ? 'Upload Texture' : 'Upload Objects';
  const selectorRadioClassName = isTexture ? 'texture-selector-radio' : 'item-selector-radio';
  const namePlaceholder = isTexture
    ? 'Enter texture name (e.g., Faux Brick)'
    : 'Enter object name (e.g., Modern Sofa)';
  const descriptionPlaceholder = isTexture
    ? 'Add description about this texture (e.g., For accent walls)'
    : 'Add description about this object (e.g., Gray fabric sectional sofa)';
  const previewAlt = isTexture ? 'Texture preview' : 'Object preview';

  // Calculate current asset index for navigation
  const currentAssetIndex = selectedAssetForView
    ? customAssets.findIndex((asset) => asset.id === selectedAssetForView.id)
    : -1;

  const handlePrevious = useCallback(() => {
    if (currentAssetIndex > 0) {
      setSelectedAssetForView(customAssets[currentAssetIndex - 1]);
    }
  }, [currentAssetIndex, customAssets]);

  const handleNext = useCallback(() => {
    if (currentAssetIndex >= 0 && currentAssetIndex < customAssets.length - 1) {
      setSelectedAssetForView(customAssets[currentAssetIndex + 1]);
    }
  }, [currentAssetIndex, customAssets]);

  const cardTitle = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>{title || defaultTitle}</span>
      <Button
        icon={<PlusOutlined />}
        onClick={() => {
          if (isGuestMode) {
            dispatch(setShowLoginRequiredModal(true));
          } else {
            setShowBatchUploadModal(true);
          }
        }}
        style={isGuestMode ? { opacity: 0.6 } : undefined}
      >
        {title || defaultTitle}
        {isGuestMode && <LockOutlined />}
      </Button>
    </div>
  );

  return (
    <Card title={cardTitle}>
      {(uploadError || loadAssetsError) && (
        <Alert
          title="Error"
          severity="error"
          onClose={() => setUploadError(null)}
          style={{ marginBottom: 16 }}
        >
          {uploadError || loadAssetsError}
        </Alert>
      )}

      {isLoadingAssets ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading {isTexture ? 'textures' : 'items'}...</span>
        </div>
      ) : (
        <>
          <style>{`
            .${selectorRadioClassName} .ant-radio-inner {
              display: none !important;
            }
            .${selectorRadioClassName} .ant-radio {
              margin-right: 0 !important;
            }
            .${selectorRadioClassName} .ant-radio-label {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0 !important;
            }
          `}</style>
          {customAssets.length === 0 ? (
            <div className="p-8">
              <MyEmpty description={`No ${isTexture ? 'textures' : 'items'} found`} />
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '16px',
              }}
            >
              <Radio.Group
                value={selectedAsset?.id || undefined}
                onChange={(e) => {
                  const asset = customAssets.find((a) => a.id === e.target.value);
                  if (asset) {
                    // Toggle logic: if clicking the same asset, deselect it
                    if (selectedAsset?.id === asset.id) {
                      if (isTexture) {
                        dispatch(setSelectedTexture(null));
                      } else {
                        dispatch(setSelectedItem(null));
                      }
                      if (onSelect) onSelect(null);
                    } else {
                      if (isTexture) {
                        dispatch(setSelectedTexture(asset as Texture));
                      } else {
                        dispatch(setSelectedItem(asset as Item));
                      }
                      if (onSelect) onSelect(asset);
                    }
                  }
                }}
                style={{ width: '100%', display: 'contents' }}
                className={selectorRadioClassName}
              >
                {customAssets.map((asset) => (
                  <Radio
                    key={asset.id}
                    value={asset.id}
                    onClick={(e) => {
                      // Toggle logic: if clicking the same asset, deselect it
                      if (selectedAsset?.id === asset.id) {
                        e.preventDefault();
                        if (isTexture) {
                          dispatch(setSelectedTexture(null));
                        } else {
                          dispatch(setSelectedItem(null));
                        }
                        if (onSelect) onSelect(null);
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      minHeight: '160px',
                      margin: 0,
                      padding: 0,
                    }}
                  >
                    <AssetCard
                      asset={asset}
                      isSelected={selectedAsset?.id === asset.id}
                      base64={base64Map.get(asset.id)}
                      onViewExpand={() => {
                        setSelectedAssetForView(asset);
                        setShowImageModal(true);
                      }}
                    />
                  </Radio>
                ))}
              </Radio.Group>
            </div>
          )}
        </>
      )}



      {/* Image Display Modal */}
      {selectedAssetForView && (
        <ImageDisplayModal
          isOpen={showImageModal}
          image={{
            id: selectedAssetForView.id,
            name: selectedAssetForView.name,
            imageDownloadUrl: isTexture
              ? (selectedAssetForView as Texture).textureImageDownloadUrl
              : (selectedAssetForView as Item).itemImageDownloadUrl,
            mimeType: 'image/jpeg',
            createdAt: Timestamp.fromDate(new Date()),
            updatedAt: Timestamp.fromDate(new Date()),
            spaceId: '',
            evolutionChain: [],
            parentImageId: null,
            storageFilePath: '',
            isDeleted: false,
            deletedAt: null,
            order: null,
          }}
          onClose={() => {
            setShowImageModal(false);
            setSelectedAssetForView(null);
          }}
          currentImageIndex={currentAssetIndex}
          totalImages={customAssets.length}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )}

      {/* Asset Name Input Modal */}
      <Modal
        title={modalTitle}
        open={showNameModal}
        onOk={handleConfirmUpload}
        onCancel={() => {
          setPendingFile(null);
          setAssetName('');
          setAssetDescription('');
          setShowNameModal(false);
          setUploadError(null);
        }}
        confirmLoading={isUploading}
        okText={modalOkText}
        cancelText="Cancel"
        okButtonProps={{ disabled: isUploading }}
      >
        <div style={{ marginBottom: 16 }}>
          <label
            style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}
          >
            {isTexture ? 'Texture' : 'Item'} Name
            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 8 }}>
              {assetName.length}/{MAX_CUSTOM_ASSET_NAME_LENGTH}
            </span>
          </label>
          <Input
            value={assetName}
            onChange={(e) =>
              setAssetName(e.target.value.substring(0, MAX_CUSTOM_ASSET_NAME_LENGTH))
            }
            placeholder={namePlaceholder}
            maxLength={MAX_CUSTOM_ASSET_NAME_LENGTH}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}
          >
            Description (Optional)
            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 8 }}>
              {assetDescription.length}/{MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH}
            </span>
          </label>
          <Input.TextArea
            value={assetDescription}
            onChange={(e) =>
              setAssetDescription(e.target.value.substring(0, MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH))
            }
            placeholder={descriptionPlaceholder}
            maxLength={MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH}
            rows={2}
          />
        </div>

        {uploadError && (
          <Alert title="Error" onClose={() => setUploadError(null)} style={{ marginBottom: 16 }}>
            {uploadError}
          </Alert>
        )}

        {pendingFile && (
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                marginBottom: 8,
              }}
            >
              Preview
            </label>
            <img
              src={URL.createObjectURL(pendingFile)}
              alt={previewAlt}
              style={{
                width: '100%',
                maxHeight: '200px',
                objectFit: 'contain',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
              }}
            />
          </div>
        )}
      </Modal>

      {/* Batch Upload Modal */}
      <BatchUploadModal
        isOpen={showBatchUploadModal}
        onClose={() => setShowBatchUploadModal(false)}
        onUpload={handleBatchAssetUpload}
        mode="asset"
        assetType={type}
        existingNames={existingNames}
        title={`Upload ${isTexture ? 'Textures' : 'Items'}`}
        currentCount={0}
      />
    </Card>
  );
};

export default TextureOrItemSelect;
