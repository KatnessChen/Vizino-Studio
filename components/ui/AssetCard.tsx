import React, { useState, useEffect } from 'react';
import { EyeFilled, SettingOutlined, CheckCircleFilled, ArrowUpOutlined } from '@ant-design/icons';
import { Dropdown, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { Texture, Item, ImageData } from '@/types';
import { imageCache } from '@/utils/imageCache';
import { devWarn } from '@/utils/devLogger';
import MyButton from '../button/MyButton';
import { RESOLUTION_2K } from '@/constants/constants';

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
  onDelete?: () => void;
  onCopy?: () => void;
  onUpscale?: () => void;
  renderPreview?: () => React.ReactNode;
  showViewButton?: boolean;
  editLabel?: string;
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
  onDelete,
  onCopy,
  onUpscale,
  renderPreview,
  showViewButton = true,
  editLabel = 'Edit',
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
        devWarn('[AssetCard] Failed to load cached image:', error);
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
      key: 'edit',
      label: editLabel,
      onClick: ({ domEvent }: { domEvent: React.MouseEvent }) => {
        domEvent.stopPropagation();
        onRename();
      },
    },
    onViewDetails && {
      key: 'details',
      label: 'History',
      onClick: ({ domEvent }: { domEvent: React.MouseEvent }) => {
        domEvent.stopPropagation();
        onViewDetails();
      },
    },
    // Scale Up option - show for all ImageData when onUpscale is provided
    // Disabled with tooltip when resolution is already above 2K
    onUpscale &&
      isImageData &&
      (() => {
        const resolution = (asset as ImageData).currentResolution;
        const isAlreadyUpscaled = resolution && resolution !== RESOLUTION_2K;
        return {
          key: 'upscale',
          label: isAlreadyUpscaled ? (
            <Tooltip title="Image has already been scaled up" placement="left">
              <span>Scale Up</span>
            </Tooltip>
          ) : (
            <Tooltip title="Use AI Upscale to infer image details" placement="left">
              <span>Scale Up</span>
            </Tooltip>
          ),
          disabled: !!isAlreadyUpscaled,
          onClick: isAlreadyUpscaled
            ? undefined
            : ({ domEvent }: { domEvent: React.MouseEvent }) => {
                domEvent.stopPropagation();
                onUpscale();
              },
        };
      })(),
    onDelete && {
      key: 'delete',
      label: 'Delete',
      danger: true,
      onClick: ({ domEvent }: { domEvent: React.MouseEvent }) => {
        domEvent.stopPropagation();
        onDelete();
      },
    },
  ].filter(Boolean) as Exclude<MenuProps['items'], undefined>;

  // Show gear icon if any operation is available
  const hasOperations = onRename || onCopy || onDelete || onUpscale;
  return (
    <div
      onClick={(e) => onSelect?.(e)}
      onMouseEnter={() => setShowButtons(true)}
      onMouseLeave={() => setShowButtons(false)}
      className={`w-full min-w-[160px] ${isList ? 'min-h-[120px]' : 'min-h-[200px]'} relative border-2 ${isSelected ? 'border-[#bd6dff] asset-card-selected' : 'border-[#d1d5db]'} rounded-md cursor-pointer ${isList ? 'flex-row' : 'flex-col'} flex bg-[#f9fafb] overflow-hidden ${isSelected ? 'shadow-[0_8px_24px_rgba(99, 102, 241, 0.5)]' : 'shadow-[0_2px_8px_rgba(0,0,0,0.08)]'}`}
    >
      {/* Image container */}
      <div
        className={
          isList
            ? 'relative overflow-hidden w-[140px] min-h-[120px] flex-none'
            : `flex-1 relative overflow-hidden ${renderPreview ? 'h-full' : 'min-h-[140px]'}`
        }
        style={renderPreview ? { padding: 0 } : undefined}
      >
        {/* Selection Badge */}
        {isSelected && (
          <div className="absolute top-2 left-2 z-10 text-indigo-500 bg-white rounded-full shadow-md leading-[0]">
            <CheckCircleFilled className="text-xl" />
          </div>
        )}

        {/* Asset preview */}
        {renderPreview ? (
          <div className="absolute inset-0 w-full h-full">{renderPreview()}</div>
        ) : imageSrc ? (
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
          className={`absolute top-2 right-2 z-10 flex gap-1.5 items-center p-1 rounded-md bg-gray-100 backdrop-blur-sm transition-opacity duration-200 ${showButtons ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'}`}
        >
          {onViewExpand && showViewButton && (
            <MyButton
              onClick={(e) => {
                e.stopPropagation();
                onViewExpand();
              }}
              icon={<EyeFilled className="text-[16px]" />}
              className="view-button !bg-white !text-slate-700 opacity-90 shadow-sm !border-none transition-all duration-200 ease-in-out hover:!bg-white hover:scale-105 hover:opacity-100"
            >
              View
            </MyButton>
          )}

          {(onViewDetails || hasOperations) && (
            <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
              <div
                onClick={(e) => e.stopPropagation()}
                className="gear-button w-8 h-8 rounded-md bg-white opacity-90 flex items-center justify-center cursor-pointer shadow-sm transition-all duration-200 ease-in-out hover:opacity-100 hover:scale-105"
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
