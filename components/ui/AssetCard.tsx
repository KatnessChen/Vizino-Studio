import React, { useState, useEffect } from 'react';
import { EyeFilled, SettingOutlined } from '@ant-design/icons';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Texture, Item, ImageData } from '@/types';
import { imageCache } from '@/utils/imageCache';
import MyButton from '../button/MyButton';
import './AssetCard.css';

type Asset = Texture | Item | ImageData;

interface AssetCardProps {
  asset: Asset;
  isSelected: boolean;
  base64?: string | undefined;
  layout?: 'grid' | 'list';
  onViewExpand?: () => void;
  onViewDetails?: () => void;
  onSelect?: (event?: React.MouseEvent) => void;
  onRename?: () => void;
  onCopy?: () => void;
}

const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  isSelected,
  base64,
  layout = 'grid',
  onViewExpand,
  onViewDetails,
  onSelect,
  onRename,
  onCopy,
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
  const isList = layout === 'list';

  // Menu items for gear dropdown
  const menuItems = [
    onRename && {
      key: 'rename',
      label: 'Rename',
      onClick: ({ domEvent }: { domEvent: React.MouseEvent }) => {
        domEvent.stopPropagation();
        onRename();
      },
    },
    onCopy && {
      key: 'copy',
      label: 'Copy',
      onClick: ({ domEvent }: { domEvent: React.MouseEvent }) => {
        domEvent.stopPropagation();
        onCopy();
      },
    },
    onViewDetails && {
      key: 'details',
      label: 'Details',
      onClick: ({ domEvent }: { domEvent: React.MouseEvent }) => {
        domEvent.stopPropagation();
        onViewDetails();
      },
    },
  ].filter(Boolean) as Exclude<MenuProps['items'], undefined>;

  // Show gear icon if any operation is available
  const hasOperations = onRename || onCopy;
  return (
    <div
      onClick={(e) => onSelect?.(e)}
      onMouseEnter={() => setShowButtons(true)}
      onMouseLeave={() => setShowButtons(false)}
      style={{
        width: '100%',
        height: '100%',
        minWidth: '160px',
        minHeight: isList ? '120px' : '200px',
        position: 'relative',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: isSelected ? '#bd6dff' : '#d1d5db',
        borderRadius: '6px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: isList ? 'row' : 'column',
        backgroundColor: '#f9fafb',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        boxShadow: isSelected
          ? '0 8px 24px rgba(99, 102, 241, 0.5)'
          : '0 2px 8px rgba(0, 0, 0, 0.08)',
      }}
    >
      {/* Image container */}
      <div
        style={
          isList
            ? {
                width: '140px',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                flex: '0 0 140px',
              }
            : {
                flex: 1,
                position: 'relative',
                overflow: 'hidden',
                minHeight: '140px',
              }
        }
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
              {isLoadingCache && 'Loading...'}
            </span>
          </div>
        )}
      </div>

      {/* Toolbar - top-right of the card (keeps same buttons) */}
      {(onViewExpand || onViewDetails || hasOperations) && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 10,
            opacity: showButtons ? 1 : 0,
            visibility: showButtons ? 'visible' : 'hidden',
            transition: 'opacity 0.3s ease, visibility 0.3s ease',
            pointerEvents: showButtons ? 'auto' : 'none',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            padding: '4px 6px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(4px)',
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

          {onViewExpand && (onViewDetails || hasOperations) && (
            <div
              style={{
                width: '1px',
                height: '24px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                margin: '0 2px',
              }}
            />
          )}

          {(onViewDetails || hasOperations) && (
            <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
              <div
                onClick={(e) => e.stopPropagation()}
                className="gear-button"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.2s ease',
                }}
              >
                <SettingOutlined style={{ fontSize: '16px', color: '#374151' }} />
              </div>
            </Dropdown>
          )}
        </div>
      )}

      {/* Right column for list layout */}
      {isList ? (
        <div
          style={{
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            minWidth: 0,
            gap: 6,
          }}
        >
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {asset.name}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            {isImageData ? (asset as ImageData).mimeType : ''}
          </div>
        </div>
      ) : (
        /* Asset name - below image */
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e5e7eb',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#374151',
            textAlign: 'left',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {asset.name}
        </div>
      )}
    </div>
  );
};

export default AssetCard;
