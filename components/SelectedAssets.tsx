import React, { useMemo, useState, useEffect } from 'react';
import { Typography } from 'antd';
import { devWarn } from '@/utils/devLogger';
import { imageCache } from '@/utils/imageCache';
import { imageDownloadUrlToBase64 } from '@/utils/fileUtils';
import { cardHeight } from '@/components/layout/AsideSection';
import { ImageData, Asset } from '@/types';
import { ASSET_COLOR, ASSET_TEXTURE, ASSET_ITEM } from '@/constants/constants';

// Normalized Asset Interface for display purposes
interface DisplayAsset {
  renderType: 'backgroundColor' | 'image';
  id: string;
  name: string;
  description?: string;
  hex?: string; // Only for color
  url?: string; // Only for image-like assets
  mimeType?: string;
}

interface SelectedAssetsProps {
  title?: string;
  customCardHeight?: number;
  assets?: (Asset | ImageData)[];
}

const SelectedAssets: React.FC<SelectedAssetsProps> = ({
  title,
  customCardHeight,
  assets = [],
}) => {
  // Get the first asset to display
  const effectiveRawAsset = assets[0] || null;

  // Normalize input into DisplayAsset
  const displayAsset: DisplayAsset | null = useMemo(() => {
    if (!effectiveRawAsset) return null;

    if (effectiveRawAsset.assetType === ASSET_COLOR) {
      return {
        renderType: 'backgroundColor',
        id: effectiveRawAsset.id,
        name: effectiveRawAsset.name,
        hex: effectiveRawAsset.hex,
        description: effectiveRawAsset.description,
      };
    }

    if ('imageDownloadUrl' in effectiveRawAsset) {
      return {
        renderType: 'image',
        id: effectiveRawAsset.id,
        name: effectiveRawAsset.name,
        description: effectiveRawAsset.description,
        url: effectiveRawAsset.imageDownloadUrl,
        mimeType: effectiveRawAsset.mimeType,
      };
    }

    if (effectiveRawAsset.assetType === ASSET_TEXTURE) {
      return {
        renderType: 'image',
        id: effectiveRawAsset.id,
        name: effectiveRawAsset.name,
        url: effectiveRawAsset.textureImageDownloadUrl,
        mimeType: effectiveRawAsset.mimeType,
        description: effectiveRawAsset.description,
      };
    }

    if (effectiveRawAsset.assetType === ASSET_ITEM) {
      return {
        renderType: 'image',
        id: effectiveRawAsset.id,
        name: effectiveRawAsset.name,
        url: effectiveRawAsset.itemImageDownloadUrl,
        mimeType: effectiveRawAsset.mimeType,
        description: effectiveRawAsset.description,
      };
    }

    return null;
  }, [effectiveRawAsset]);

  // Check for multiple selections
  const multipleSelectionWarning = useMemo(() => {
    if (assets.length > 1) {
      // Determine if they are images or other assets
      const firstAsset = assets[0];
      if ('imageDownloadUrl' in firstAsset) {
        return `${assets.length} images selected. Please select only 1 image.`;
      } else {
        return `${assets.length} assets selected. Please select only 1 asset.`;
      }
    }
    return null;
  }, [assets]);

  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const height = customCardHeight ? `${customCardHeight}px` : cardHeight;

  // Load preview if it's an image renderType
  useEffect(() => {
    const loadPreview = async () => {
      if (!displayAsset || displayAsset.renderType !== 'image' || !displayAsset.url) {
        setPreviewBase64(null);
        return;
      }

      try {
        let base64 = await imageCache.get(displayAsset.url);
        if (!base64) {
          // If not cached, try to fetch/convert only if logic demands it.
          // For consistency with previous code, we often try to get base64 for smoother rendering,
          // but relying on URL is also fine if cache fails.
          // Using strict fetch here:
          base64 = await imageDownloadUrlToBase64(displayAsset.url);
        }
        if (base64) setPreviewBase64(base64);
        else setPreviewBase64(null); // Fallback to URL in render
      } catch (error) {
        devWarn('Failed to load asset preview:', error);
        setPreviewBase64(null);
      }
    };

    loadPreview();
  }, [displayAsset]);

  const renderContent = useMemo(() => {
    // Show warning if multiple selections exist
    if (multipleSelectionWarning) {
      return (
        <div
          className="flex justify-center items-center p-3 bg-gray-100 rounded border border-dashed border-gray-200 text-gray-500 text-sm"
          style={{ height }}
        >
          {multipleSelectionWarning}
        </div>
      );
    }

    if (!displayAsset) {
      return (
        <div
          className="flex justify-center items-center p-3 bg-gray-100 rounded border border-dashed border-gray-200 text-gray-500 text-sm"
          style={{ height }}
        >
          No asset selected
        </div>
      );
    }

    if (displayAsset.renderType === 'backgroundColor') {
      return (
        <div className="relative border border-gray-200 rounded overflow-hidden" style={{ height }}>
          <div className="w-full h-full" style={{ backgroundColor: displayAsset.hex }} />
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2">
            <div className="text-sm font-medium">{displayAsset.name}</div>
            <div className="text-xs opacity-90">{displayAsset.hex}</div>
          </div>
        </div>
      );
    }

    // Image-like render (Image, Texture, Item)
    const imgSrc = previewBase64
      ? `data:${displayAsset.mimeType || 'image/jpeg'};base64,${previewBase64}`
      : displayAsset.url;

    return (
      <div className="relative border border-gray-200 rounded overflow-hidden" style={{ height }}>
        {imgSrc ? (
          <img src={imgSrc} alt={displayAsset.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <span className="text-xs text-gray-400">Loading...</span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2">
          <div className="text-sm font-medium truncate">{displayAsset.name}</div>
          {displayAsset.description && (
            <div className="text-xs opacity-90 truncate">{displayAsset.description}</div>
          )}
        </div>
      </div>
    );
  }, [displayAsset, previewBase64, height, multipleSelectionWarning]);

  return (
    <div>
      <Typography.Title level={5} className="!m-0 !mb-2">
        {title || 'Selected Asset'}
      </Typography.Title>
      {renderContent}
    </div>
  );
};

export default SelectedAssets;
