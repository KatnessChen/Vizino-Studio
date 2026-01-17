import React, { useMemo, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Typography } from 'antd';
import { RootState } from '@/stores/store';
import {
  selectSelectedColor,
  selectSelectedTexture,
  selectSelectedItem,
  selectSelectedTaskNames,
} from '@/stores/taskStore';
import { GEMINI_TASKS } from '@/services/gemini/geminiTasks';
import { imageCache } from '@/utils/imageCache';
import { imageDownloadUrlToBase64 } from '@/utils';
import { cardHeight } from '@/components/layout/AsideSection';

const SelectedAssets: React.FC = () => {
  const selectedTaskNames = useSelector(selectSelectedTaskNames);
  const selectedColor = useSelector((state: RootState) => selectSelectedColor(state));
  const selectedTexture = useSelector((state: RootState) => selectSelectedTexture(state));
  const selectedItem = useSelector((state: RootState) => selectSelectedItem(state));

  const [textureBase64, setTextureBase64] = useState<string | null>(null);
  const [itemBase64, setItemBase64] = useState<string | null>(null);

  // Load texture preview from cache
  useEffect(() => {
    const loadTexturePreview = async () => {
      if (!selectedTexture || !selectedTexture.textureImageDownloadUrl) {
        setTextureBase64(null);
        return;
      }

      try {
        // Try to get from cache first
        let base64 = await imageCache.get(selectedTexture.textureImageDownloadUrl);

        // If not in cache, convert and cache it
        if (!base64) {
          base64 = await imageDownloadUrlToBase64(selectedTexture.textureImageDownloadUrl);
        }

        if (base64) {
          setTextureBase64(base64);
        }
      } catch (error) {
        console.warn('Failed to load texture preview:', error);
        setTextureBase64(null);
      }
    };

    loadTexturePreview();
  }, [selectedTexture]);

  // Load item preview from cache
  useEffect(() => {
    const loadItemPreview = async () => {
      if (!selectedItem || !selectedItem.itemImageDownloadUrl) {
        setItemBase64(null);
        return;
      }

      try {
        // Try to get from cache first
        let base64 = await imageCache.get(selectedItem.itemImageDownloadUrl);

        // If not in cache, convert and cache it
        if (!base64) {
          base64 = await imageDownloadUrlToBase64(selectedItem.itemImageDownloadUrl);
        }

        if (base64) {
          setItemBase64(base64);
        }
      } catch (error) {
        console.warn('Failed to load item preview:', error);
        setItemBase64(null);
      }
    };

    loadItemPreview();
  }, [selectedItem]);

  // Determine the active task (first selected task)
  const activeTask = useMemo(() => {
    if (selectedTaskNames.length === 0) return null;
    return selectedTaskNames[0];
  }, [selectedTaskNames]);

  // Determine what to display based on active task
  const renderContent = useMemo(() => {
    if (!activeTask) {
      return null;
    }

    if (activeTask === GEMINI_TASKS.RECOLOR_WALL.task_name) {
      if (selectedColor) {
        return (
          <div className="flex flex-col gap-2">
            <div
              className={`w-full h-[${cardHeight}] rounded border border-dashed border-gray-200`}
              style={{ backgroundColor: selectedColor?.hex || 'bg-gray-100' }}
            />
            <div className="text-sm">
              <div className="font-medium">{selectedColor?.name}</div>
              <div className="text-gray-500 text-xs">{selectedColor?.hex || ''}</div>
            </div>
          </div>
        );
      } else {
        return (
          <div
            className={`flex justify-center items-center h-[${cardHeight}] p-3 bg-gray-100 rounded border border-dashed border-gray-200 text-gray-500 text-sm`}
          >
            No color selected
          </div>
        );
      }
    }

    if (activeTask === GEMINI_TASKS.ADD_TEXTURE.task_name) {
      if (selectedTexture) {
        return (
          <div className="flex flex-col gap-2">
            {textureBase64 ? (
              <img
                src={`data:image/jpeg;base64,${textureBase64}`}
                alt={selectedTexture.name}
                className={`w-full h-[${cardHeight}] rounded border border-dashed border-gray-200 object-contain`}
              />
            ) : (
              <div
                className={`w-full h-[${cardHeight}] rounded border border-gray-200 bg-gray-100 flex items-center justify-center`}
              >
                <span className="text-xs text-gray-400">...</span>
              </div>
            )}
            <div className="text-sm">
              <div className="font-medium">{selectedTexture.name}</div>
              {selectedTexture.description && (
                <div className="text-gray-500 text-xs">{selectedTexture.description}</div>
              )}
            </div>
          </div>
        );
      } else {
        return (
          <div
            className={`flex justify-center items-center h-[${cardHeight}] p-3 bg-gray-100 rounded border border-dashed border-gray-200 text-gray-500 text-sm`}
          >
            No texture selected
          </div>
        );
      }
    }

    if (activeTask === GEMINI_TASKS.ADD_HOME_ITEM.task_name) {
      if (selectedItem) {
        return (
          <div className="flex flex-col gap-2">
            {itemBase64 ? (
              <img
                src={`data:image/jpeg;base64,${itemBase64}`}
                alt={selectedItem.name}
                className={`w-full h-[${cardHeight}] rounded border border-gray-200 object-contain`}
              />
            ) : (
              <div
                className={`w-full h-[${cardHeight}] rounded border border-gray-200 bg-gray-100 flex items-center justify-center`}
              >
                <span className="text-xs text-gray-400">...</span>
              </div>
            )}
            <div className="text-sm">
              <div className="font-medium">{selectedItem.name}</div>
              {selectedItem.description && (
                <div className="text-gray-500 text-xs">{selectedItem.description}</div>
              )}
            </div>
          </div>
        );
      } else {
        return (
          <div
            className={`flex justify-center items-center h-[${cardHeight}] p-3 bg-gray-100 rounded border border-dashed border-gray-200 text-gray-500 text-sm`}
          >
            No item selected
          </div>
        );
      }
    }

    return null;
  }, [activeTask, itemBase64, selectedColor, selectedItem, selectedTexture, textureBase64]);

  return (
    <div>
      <Typography.Title level={5} style={{ margin: 0, marginBottom: '8px' }}>
        Design Material
      </Typography.Title>
      {renderContent}
    </div>
  );
};

export default SelectedAssets;
