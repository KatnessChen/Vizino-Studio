import React, { useState, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Modal, message } from 'antd';
import { Color, ImageData } from '@/types';
import { PRESET_COLOR } from '@/constants/constants';
import { useCustomColors } from '@/hooks/useCustomColors';
import { RootState } from '@/stores/store';
import { setSelectedAssets, selectSelectedAssets } from '@/stores/taskStore';
import { setSelectedOriginalImageIds, setSelectedUpdatedImageIds } from '@/stores/imageStore';
import { sortColorsBySpectrum, getTextColor } from '@/utils/colorUtils';
import { useGuest } from '@/contexts/GuestContext';
import { setShowLoginRequiredModal } from '@/stores/guestStore';
import Gallery from '@/components/Gallery';
import AddColorModal from '../modal/AddColorModal';
import AssetRenameModal from '../modal/AssetRenameModal';
import { Timestamp } from 'firebase/firestore';

interface ColorGalleryProps {
  title?: string;
  onSelect?: (color: Color | null) => void;
}

const ColorGallery: React.FC<ColorGalleryProps> = ({ title = 'Colors', onSelect }) => {
  const dispatch = useDispatch();
  const { isGuestMode } = useGuest();
  const activeProjectId = useSelector((state: RootState) => state.project.activeProjectId);
  const selectedAssets = useSelector(selectSelectedAssets);
  const selectedColor =
    selectedAssets[0] && 'hex' in selectedAssets[0] ? (selectedAssets[0] as Color) : null;

  const { customColors, isLoadingColors, addColor, updateColor, deleteColor } =
    useCustomColors(activeProjectId);

  const [isAddColorModalOpen, setIsAddColorModalOpen] = useState(false);
  const [colorToRename, setColorToRename] = useState<Color | null>(null);

  // Derive selectedIds from selectedAssets for Gallery UI
  const selectedIds = useMemo(() => {
    return new Set(selectedAssets.filter((a) => 'hex' in a).map((a) => a.id));
  }, [selectedAssets]);

  // Merge and sort colors
  const availableColors = useMemo(() => {
    const combined = [...customColors, ...PRESET_COLOR];
    return sortColorsBySpectrum(combined);
  }, [customColors]);

  // Map to ImageData for Gallery compatibility
  const mappedColors = useMemo(() => {
    return availableColors.map(
      (color) =>
        ({
          ...color,
          imageDownloadUrl: '', // Colors don't have images
          mimeType: 'color/hex',
          spaceId: '',
          evolutionChain: color.evolutionChain || [],
          parentImageId: null,
          storageFilePath: '',
          order: null,
          isDeleted: false,
          deletedAt: null,
          createdAt: color.createdAt || Timestamp.now(),
          updatedAt: color.updatedAt || Timestamp.now(),
        }) as unknown as ImageData
    );
  }, [availableColors]);

  const handleSelectColor = useCallback(
    (id: string | null, event?: React.MouseEvent) => {
      if (!id) {
        dispatch(setSelectedAssets([]));
        if (onSelect) onSelect(null);
        return;
      }

      const color = availableColors.find((c) => c.id === id);
      if (!color) return;

      const currentColors = selectedAssets.filter((a) => 'hex' in a) as Color[];
      const isSelected = currentColors.some((c) => c.id === color.id);

      // If no event (drag selection) or Shift key pressed: multi-select toggle mode
      if (!event || event.shiftKey) {
        if (isSelected) {
          dispatch(setSelectedAssets(currentColors.filter((c) => c.id !== color.id)));
          if (onSelect) onSelect(null);
        } else {
          dispatch(setSelectedAssets([...currentColors, color]));
          if (onSelect) onSelect(color);
        }
      } else {
        // Single-select mode without Shift
        if (isSelected && currentColors.length === 1) {
          // If clicking the only selected item, deselect it
          dispatch(setSelectedAssets([]));
          if (onSelect) onSelect(null);
        } else {
          // Clear all and select only this one
          dispatch(setSelectedAssets([color]));
          if (onSelect) onSelect(color);
        }
      }
    },
    [activeProjectId, availableColors, selectedAssets, dispatch, onSelect]
  );

  const existingNames = useMemo(
    () => new Set(availableColors.map((c) => c.name.toLowerCase())),
    [availableColors]
  );

  const renderColorPreview = (item: ImageData) => {
    const color = item as unknown as Color;
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: color.hex,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            color: getTextColor(color.hex),
            fontSize: '0.9rem',
            fontWeight: 600,
            textShadow: '0 1px 2px rgba(0,0,0,0.1)',
            zIndex: 1,
          }}
        >
          {color.hex.toUpperCase()}
        </div>
        {color.description && (
          <div
            style={{
              color: getTextColor(color.hex),
              fontSize: '0.75rem',
              opacity: 0.8,
              fontStyle: 'italic',
              textAlign: 'center',
              padding: '0 8px',
              marginTop: '4px',
              zIndex: 1,
            }}
          >
            {color.description}
          </div>
        )}
      </div>
    );
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const customSelected = customColors.filter((c) => selectedIds.has(c.id));
    if (customSelected.length === 0) {
      message.warning('Preset colors cannot be deleted');
      return;
    }

    Modal.confirm({
      title: `Delete ${customSelected.length} Colors`,
      content:
        'Are you sure you want to delete these custom colors? Preset colors will be ignored.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          for (const color of customSelected) {
            await deleteColor(color.id);
          }
          message.success(`Deleted ${customSelected.length} colors`);
          // Remove deleted colors from selectedAssets
          const deletedIds = new Set(customSelected.map((c) => c.id));
          dispatch(setSelectedAssets(selectedAssets.filter((a) => !deletedIds.has(a.id))));
        } catch (error) {
          message.error('Failed to delete some colors');
        }
      },
    });
  };

  const handleBulkDuplicate = () => {
    const colors = availableColors.filter((c) => selectedIds.has(c.id));
    if (colors.length === 0) return;

    Modal.confirm({
      title: `Duplicate ${colors.length} Color${colors.length > 1 ? 's' : ''}`,
      content:
        colors.length > 1
          ? `${colors.length} colors will be duplicated.`
          : `The selected color will be duplicated.`,
      okText: 'Duplicate',
      onOk: async () => {
        try {
          for (const color of colors) {
            const newColor: Color = {
              id: crypto.randomUUID(),
              name: color.name,
              hex: color.hex,
              description: color.description || '',
            };
            await addColor(newColor);
          }
          message.success(`Duplicated ${colors.length} color${colors.length > 1 ? 's' : ''}`);
          // Clear selection after duplication
          dispatch(setSelectedAssets([]));
        } catch (err) {
          message.error('Failed to duplicate colors');
        }
      },
    });
  };

  return (
    <>
      <Gallery
        title={title}
        images={mappedColors}
        selectedImageId={selectedColor?.id}
        selectedImageIds={selectedIds}
        onSelectImage={(id, event) => {
          handleSelectColor(id, event);
        }}
        onSelectMultiple={(id, event) => {
          handleSelectColor(id, event);
        }}
        onClearSelection={() => dispatch(setSelectedAssets([]))}
        onBulkDelete={handleBatchDelete}
        onBulkCopy={handleBulkDuplicate}
        onUploadImage={() => {
          if (isGuestMode) {
            dispatch(setShowLoginRequiredModal(true));
          } else {
            setIsAddColorModalOpen(true);
          }
        }}
        uploadButtonText="Color"
        uploadModalTitle="Add Custom Color"
        isLoading={isLoadingColors}
        emptyMessage="No colors found"
        renderItemPreview={renderColorPreview}
        showViewButton={true}
        detailModalTitle="Color Information"
        viewMoreModalTitle="Color Information"
        editLabel="Edit"
        showCompare={false}
        onSingleRename={(id) => {
          const color = customColors.find((c) => c.id === id);
          if (color) {
            setColorToRename(color);
          } else if (PRESET_COLOR.some((c) => c.id === id)) {
            message.info('Preset colors cannot be renamed');
          }
        }}
        onSingleDelete={(id) => {
          const color = customColors.find((c) => c.id === id);
          if (color) {
            Modal.confirm({
              title: 'Delete Color',
              content: `Are you sure you want to delete "${color.name}"?`,
              okType: 'danger',
              onOk: async () => {
                await deleteColor(color.id);
                if (selectedColor?.id === color.id) dispatch(setSelectedAssets([]));
                message.success('Color deleted');
              },
            });
          } else if (PRESET_COLOR.some((c) => c.id === id)) {
            message.info('Preset colors cannot be deleted');
          }
        }}
        onSingleCopy={(id) => {
          const color = availableColors.find((c) => c.id === id);
          if (!color) return;

          Modal.confirm({
            title: `Duplicate Color`,
            content: `Are you sure you want to duplicate "${color.name}"?`,
            okText: 'Duplicate',
            onOk: async () => {
              try {
                const newColor: Color = {
                  id: crypto.randomUUID(),
                  name: color.name,
                  hex: color.hex,
                  description: color.description || '',
                };
                await addColor(newColor);
                message.success('Color duplicated');
              } catch (err) {
                message.error('Failed to duplicate color');
              }
            },
          });
        }}
      />

      {isAddColorModalOpen && (
        <AddColorModal
          open={isAddColorModalOpen}
          onClose={() => setIsAddColorModalOpen(false)}
          onAdd={async (color) => {
            await addColor(color);
            dispatch(setSelectedAssets([color]));
          }}
          existingColors={availableColors}
        />
      )}

      {colorToRename && (
        <AssetRenameModal
          isOpen={!!colorToRename}
          asset={colorToRename as any}
          type="color"
          onCancel={() => setColorToRename(null)}
          onConfirm={async (id, updates) => {
            await updateColor(id, updates);
            setColorToRename(null);
          }}
          existingNames={existingNames}
        />
      )}
    </>
  );
};

export default ColorGallery;
