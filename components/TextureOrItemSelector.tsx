import { useState, useCallback, useEffect } from 'react';
import { Radio, Space, Upload, Button, Modal, Input, Card } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import { Alert } from '@mui/material';
import { Snackbar } from '@mui/material';
import { Texture, Item } from '@/types';
import { useCustomAssets } from '@/hooks/useCustomAssets';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/stores/store';
import { imageCache } from '@/utils/imageCache';
import { imageDownloadUrlToBase64 } from '@/utils';
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
import { CheckCircle as CheckmarkBadgeIcon } from '@mui/icons-material';

type AssetType = 'texture' | 'item';
type Asset = Texture | Item;

interface TextureOrItemSelectorProps {
  type: AssetType;
  title?: string;
  onSelect?: (asset: Asset | null) => void;
  onError?: (error: string) => void;
}

const TextureOrItemSelector: React.FC<TextureOrItemSelectorProps> = ({
  type,
  title,
  onSelect,
  onError,
}) => {
  const dispatch = useDispatch();
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
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });
  const [base64Map, setBase64Map] = useState<Map<string, string>>(new Map());

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
    async (file: File, name: string, description: string) => {
      try {
        const newAsset = await addAsset({ name, file, description });

        setUploadError(null);
        setToast({
          open: true,
          message: `${isTexture ? 'Texture' : 'Home item'} "${name}" added successfully!`,
          severity: 'success',
        });

        // Select the newly uploaded asset
        if (newAsset) {
          if (isTexture) {
            dispatch(setSelectedTexture(newAsset as Texture));
          } else {
            dispatch(setSelectedItem(newAsset as Item));
          }
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Failed to save ${isTexture ? 'texture' : 'home item'}`;
        setUploadError(message);
        onError?.(message);
        setToast({
          open: true,
          message,
          severity: 'error',
        });
      }
    },
    [dispatch, addAsset, onError, isTexture]
  );

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

  const handleFileSelect = (file: File) => {
    setUploadError(null);

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(`${isTexture ? 'Texture' : 'Item'} file must be smaller than 5MB`);
      return false;
    }

    // Set default name from file name
    const defaultName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    setAssetName(defaultName.substring(0, MAX_CUSTOM_ASSET_NAME_LENGTH));
    setPendingFile(file);
    setShowNameModal(true);

    return false; // Prevent default upload
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

  const defaultTitle = isTexture ? 'Textures' : 'Items';
  const uploadButtonLabel = isTexture ? 'Upload Texture' : 'Upload Item';
  const modalTitle = isTexture ? 'Add Texture' : 'Add Home Item';
  const modalOkText = isTexture ? 'Upload Texture' : 'Upload Home Item';
  const selectorRadioClassName = isTexture ? 'texture-selector-radio' : 'item-selector-radio';
  const namePlaceholder = isTexture
    ? 'Enter texture name (e.g., Faux Brick)'
    : 'Enter item name (e.g., Modern Sofa)';
  const descriptionPlaceholder = isTexture
    ? 'Add description about this texture (e.g., For accent walls)'
    : 'Add description about this item (e.g., Gray fabric sectional sofa)';
  const previewAlt = isTexture ? 'Texture preview' : 'Item preview';

  return (
    <Card
      title={
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <span>{title || defaultTitle}</span>
          <Upload
            beforeUpload={handleFileSelect}
            accept="image/*"
            maxCount={1}
            showUploadList={false}
          >
            <Button icon={<CloudUploadOutlined />} size="small">
              <span className="hidden sm:inline ml-1">{uploadButtonLabel}</span>
            </Button>
          </Upload>
        </div>
      }
    >
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
      ) : customAssets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#999', fontStyle: 'italic' }}>
          No {isTexture ? 'textures' : 'items'} available. Click "Upload{' '}
          {isTexture ? 'Texture' : 'Item'}" to add one.
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
          `}</style>
          <Space orientation="vertical" style={{ width: '100%' }} size="small">
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
              style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
              className={selectorRadioClassName}
            >
              <div
                style={{
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  paddingBottom: '8px',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fit, minmax(160px, 200px))`,
                    gap: '8px',
                    minWidth: 'min-content',
                  }}
                >
                  {customAssets.map((asset) => (
                    <div
                      key={asset.id}
                      style={{
                        minWidth: '160px',
                        minHeight: '160px',
                        position: 'relative',
                      }}
                    >
                      <Radio
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
                          padding: '0',
                          border:
                            selectedAsset?.id === asset.id
                              ? '2px solid #6366f1'
                              : '1px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#f9fafb',
                          transition: 'all 0.3s ease',
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        {/* Asset preview */}
                        {base64Map.has(asset.id) ? (
                          <img
                            src={`data:image/jpeg;base64,${base64Map.get(asset.id)}`}
                            alt={asset.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              position: 'absolute',
                              inset: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#e5e7eb',
                              position: 'absolute',
                              inset: 0,
                            }}
                          >
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              Loading...
                            </span>
                          </div>
                        )}

                        {/* Asset name overlay - bottom left */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '0',
                            left: '0',
                            right: '0',
                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            color: '#ffffff',
                            padding: '8px',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            textAlign: 'left',
                            zIndex: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {asset.name}
                        </div>

                        {/* Checkmark - top right corner when selected */}
                        {selectedAsset?.id === asset.id && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              zIndex: 10,
                            }}
                          >
                            <CheckmarkBadgeIcon
                              style={{
                                fontSize: '24px',
                                color: '#6366f1',
                                fontWeight: 'bold',
                              }}
                            />
                          </div>
                        )}

                        {/* Hover overlay with description */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.3s ease',
                            padding: '16px',
                            zIndex: 1,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.opacity = '1';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.opacity = '0';
                          }}
                        >
                          <div
                            style={{
                              color: '#ffffff',
                              fontSize: '1rem',
                              fontWeight: 600,
                              marginBottom: '8px',
                              textAlign: 'center',
                            }}
                          >
                            {asset.name}
                          </div>
                          {asset.description && (
                            <div
                              style={{
                                color: '#d1d5db',
                                fontSize: '0.75rem',
                                fontStyle: 'italic',
                                textAlign: 'center',
                              }}
                            >
                              {asset.description}
                            </div>
                          )}
                        </div>
                      </Radio>
                    </div>
                  ))}
                </div>
              </div>
            </Radio.Group>
          </Space>
        </>
      )}

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
          severity={toast.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

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
    </Card>
  );
};

export default TextureOrItemSelector;
