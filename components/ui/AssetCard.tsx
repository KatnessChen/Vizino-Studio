import React, { useState, useEffect } from 'react';
import { CheckCircle as CheckmarkBadgeIcon, Info as InfoIcon } from '@mui/icons-material';
import { EyeFilled } from '@ant-design/icons';
import { Texture, Item, ImageData } from '@/types';
import { imageCache } from '@/utils/imageCache';
import MyButton from '../button/MyButton';

type Asset = Texture | Item | ImageData;

interface AssetCardProps {
  asset: Asset;
  isSelected: boolean;
  base64?: string | undefined;
  onViewExpand?: () => void;
  onViewDetails?: () => void;
  onSelect?: () => void;
}

const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  isSelected,
  base64,
  onViewExpand,
  onViewDetails,
  onSelect,
}) => {
  const [cachedImageSrc, setCachedImageSrc] = useState<string | null>(null);
  const [isLoadingCache, setIsLoadingCache] = useState(false);

  // Check if asset is ImageData type
  const isImageData = 'imageDownloadUrl' in asset;

  // Load cached image for ImageData type
  useEffect(() => {
    if (!isImageData) return;

    const loadCachedImage = async () => {
      try {
        setIsLoadingCache(true);
        const imageData = asset as ImageData;
        const cachedBase64 = await imageCache.get(imageData.imageDownloadUrl);
        if (cachedBase64) {
          setCachedImageSrc(`data:${imageData.mimeType};base64,${cachedBase64}`);
        }
      } catch (error) {
        console.warn('[AssetCard] Failed to load cached image:', error);
      } finally {
        setIsLoadingCache(false);
      }
    };

    loadCachedImage();
  }, [asset, isImageData]);

  // Get image source based on asset type
  const getImageSrc = () => {
    if (isImageData) {
      const imageData = asset as ImageData;
      return cachedImageSrc || imageData.imageDownloadUrl;
    }
    return base64 ? `data:image/jpeg;base64,${base64}` : null;
  };

  const imageSrc = getImageSrc();

  const [showButtons, setShowButtons] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setShowButtons(true)}
      onMouseLeave={() => setShowButtons(false)}
      style={{
        width: '100%',
        height: '100%',
        minWidth: '160px',
        minHeight: '160px',
        position: 'relative',
        border: isSelected ? '2px solid #6366f1' : '2px solid #d1d5db',
        borderRadius: '6px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
      }}
    >
      {/* Asset preview */}
      {imageSrc ? (
        <img
          src={imageSrc}
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
            {isLoadingCache ? 'Loading...' : 'Loading...'}
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
      {isSelected && (
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

      {/* Buttons for ImageData type - top left corner */}
      {(onViewExpand || onViewDetails) && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            display: 'flex',
            gap: '8px',
            zIndex: 10,
            opacity: showButtons ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          {onViewExpand && (
            <MyButton
              onClick={(e) => {
                e.stopPropagation();
                onViewExpand();
              }}
              icon={<EyeFilled style={{ fontSize: '16px' }} />}
            >
              View
            </MyButton>
          )}
          {onViewDetails && (
            <MyButton
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails();
              }}
              icon={<InfoIcon style={{ fontSize: '16px' }} />}
            >
              Details
            </MyButton>
          )}
        </div>
      )}
    </div>
  );
};

export default AssetCard;
