import React, { useState, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Modal, message } from 'antd';
import { Color, ImageData } from '@/types';
import { PRESET_COLOR } from '@/constants/constants';
import { useCustomColors } from '@/hooks/useCustomColors';
import { RootState } from '@/stores/store';
import { setSelectedColor, selectSelectedColor } from '@/stores/taskStore';
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
  const selectedColor = useSelector(selectSelectedColor);

  const { customColors, isLoadingColors, addColor, updateColor, deleteColor } =
    useCustomColors(activeProjectId);

  const [isAddColorModalOpen, setIsAddColorModalOpen] = useState(false);
  const [colorToRename, setColorToRename] = useState<Color | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
          evolutionChain: [],
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
    (id: string | null) => {
      const color = availableColors.find((c) => c.id === id) || null;
      dispatch(setSelectedColor(color));
      if (onSelect) onSelect(color);
    },
    [activeProjectId, availableColors, dispatch, onSelect]
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
          setSelectedIds(new Set());
          if (selectedColor && selectedIds.has(selectedColor.id)) {
            handleSelectColor(null);
          }
        } catch (error) {
          message.error('Failed to delete some colors');
        }
      },
    });
  };

  const handleBatchCopy = () => {
    const colors = availableColors.filter((c) => selectedIds.has(c.id));
    const hexCodes = colors.map((c) => c.hex).join(', ');
    navigator.clipboard
      .writeText(hexCodes)
      .then(() => message.success('Hex codes copied to clipboard!'))
      .catch(() => message.error('Failed to copy hex codes'));
  };

  return (
    <>
      <Gallery
        title={title}
        images={mappedColors}
        selectedImageId={selectedColor?.id}
        selectedImageIds={selectedIds}
        onSelectImage={(id) => {
          if (selectedColor?.id === id) {
            handleSelectColor(null);
            if (selectedIds.has(id) && selectedIds.size === 1) {
              setSelectedIds(new Set());
            }
          } else {
            handleSelectColor(id);
            setSelectedIds(new Set([id]));
          }
        }}
        onSelectMultiple={(id) => {
          const next = new Set(selectedIds);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          setSelectedIds(next);
        }}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkDelete={handleBatchDelete}
        onBulkCopy={handleBatchCopy}
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
        showViewButton={false}
        detailModalTitle="Color Information"
        viewMoreModalTitle="Color Information"
        editLabel="Edit"
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
                if (selectedColor?.id === color.id) handleSelectColor(null);
                message.success('Color deleted');
              },
            });
          } else if (PRESET_COLOR.some((c) => c.id === id)) {
            message.info('Preset colors cannot be deleted');
          }
        }}
      />

      {isAddColorModalOpen && (
        <AddColorModal
          open={isAddColorModalOpen}
          onClose={() => setIsAddColorModalOpen(false)}
          onAdd={async (color) => {
            await addColor(color);
            dispatch(setSelectedColor(color));
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
