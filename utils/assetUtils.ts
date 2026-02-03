import { ASSET_TEXTURE, ASSET_ITEM, ASSET_COLOR } from '@/constants/constants';

/**
 * Asset types that can be managed by the custom assets system
 */
export type AssetKind = typeof ASSET_TEXTURE | typeof ASSET_ITEM | typeof ASSET_COLOR;

/**
 * Utility functions to check asset types
 */
export const isTextureAsset = (assetType: AssetKind): assetType is typeof ASSET_TEXTURE => {
  return assetType === ASSET_TEXTURE;
};

export const isItemAsset = (assetType: AssetKind): assetType is typeof ASSET_ITEM => {
  return assetType === ASSET_ITEM;
};

export const isColorAsset = (assetType: AssetKind): assetType is typeof ASSET_COLOR => {
  return assetType === ASSET_COLOR;
};
