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
      className={`w-full min-w-[160px] ${isList ? 'min-h-[120px]' : 'min-h-[200px]'} relative border-2 ${isSelected ? 'border-[#bd6dff]' : 'border-[#d1d5db]'} rounded-md cursor-pointer ${isList ? 'flex-row' : 'flex-col'} flex bg-[#f9fafb] overflow-hidden ${isSelected ? 'shadow-[0_8px_24px_rgba(99,102,241,0.5)]' : 'shadow-[0_2px_8px_rgba(0,0,0,0.08)]'}`}
    >
      {/* Image container */}
      <div
        className={
          isList
            ? 'relative overflow-hidden w-[140px] min-h-[120px] flex-none'
            : 'flex-1 relative overflow-hidden min-h-[140px]'
        }
      >
        {/* Asset preview */}
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={asset.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-[#e5e7eb]">
            <span className="text-[0.75rem] text-[#6b7280]">{isLoadingCache && 'Loading...'}</span>
          </div>
        )}
      </div>

      {/* Toolbar - top-right of the card (keeps same buttons) */}
      {(onViewExpand || onViewDetails || hasOperations) && (
        <div
          className={`absolute top-2 right-2 z-10 flex gap-1.5 items-center p-1 rounded-md bg-[rgba(255,255,255,0.05)] backdrop-blur-sm transition-opacity duration-300 ${showButtons ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'}`}
        >
          {onViewExpand && (
            <MyButton
              onClick={(e) => {
                e.stopPropagation();
                onViewExpand();
              }}
              icon={<EyeFilled className="text-[16px]" />}
            >
              View
            </MyButton>
          )}

          {onViewExpand && (onViewDetails || hasOperations) && (
            <div className="w-px h-6 bg-white/20 mx-0.5" />
          )}

          {(onViewDetails || hasOperations) && (
            <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
              <div
                onClick={(e) => e.stopPropagation()}
                className="gear-button w-8 h-8 rounded-md bg-white opacity-90 flex items-center justify-center cursor-pointer shadow-sm"
              >
                <SettingOutlined className="text-[16px] text-slate-700" />
              </div>
            </Dropdown>
          )}
        </div>
      )}

      {/* Right column for list layout */}
      {isList ? (
        <div className="p-3 flex flex-col justify-center flex-1 min-w-0 gap-1.5">
          <div className="text-sm font-semibold text-slate-900 truncate">{asset.name}</div>
          <div className="text-xs text-slate-500">
            {isImageData ? (asset as ImageData).mimeType : ''}
          </div>
        </div>
      ) : (
        /* Asset name - below image */
        <div className="p-2.5 bg-white border-t border-gray-200 text-sm font-medium text-slate-700 text-left truncate">
          {asset.name}
        </div>
      )}
    </div>
  );
};

export default AssetCard;
