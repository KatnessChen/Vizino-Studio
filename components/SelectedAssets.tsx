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

  // Don't render if no task is selected
  if (!activeTask) {
    return null;
  }

  // Determine what to display based on active task
  const renderContent = () => {
    if (activeTask === GEMINI_TASKS.RECOLOR_WALL.task_name) {
      if (selectedColor) {
        return (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: selectedColor.hex,
                borderRadius: '4px',
                border: '1px solid #d1d5db',
              }}
            />
            <div style={{ flex: 1, fontSize: '0.875rem' }}>
              <div style={{ fontWeight: 500 }}>{selectedColor.name}</div>
              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{selectedColor.hex}</div>
            </div>
          </div>
        );
      } else {
        return (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              border: '1px dashed #d1d5db',
              color: '#9ca3af',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}
          >
            No color selected
          </div>
        );
      }
    }

    if (activeTask === GEMINI_TASKS.ADD_TEXTURE.task_name) {
      if (selectedTexture) {
        return (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', overflow: 'hidden' }}>
            {textureBase64 ? (
              <img
                src={`data:image/jpeg;base64,${textureBase64}`}
                alt={selectedTexture.name}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>...</span>
              </div>
            )}
            <div style={{ flex: 1, fontSize: '0.875rem' }}>
              <div style={{ fontWeight: 500 }}>{selectedTexture.name}</div>
              {selectedTexture.description && (
                <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  {selectedTexture.description}
                </div>
              )}
            </div>
          </div>
        );
      } else {
        return (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              border: '1px dashed #d1d5db',
              color: '#9ca3af',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}
          >
            No texture selected
          </div>
        );
      }
    }

    if (activeTask === GEMINI_TASKS.ADD_HOME_ITEM.task_name) {
      if (selectedItem) {
        return (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', overflow: 'hidden' }}>
            {itemBase64 ? (
              <img
                src={`data:image/jpeg;base64,${itemBase64}`}
                alt={selectedItem.name}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>...</span>
              </div>
            )}
            <div style={{ flex: 1, fontSize: '0.875rem' }}>
              <div style={{ fontWeight: 500 }}>{selectedItem.name}</div>
              {selectedItem.description && (
                <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  {selectedItem.description}
                </div>
              )}
            </div>
          </div>
        );
      } else {
        return (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              border: '1px dashed #d1d5db',
              color: '#9ca3af',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}
          >
            No item selected
          </div>
        );
      }
    }

    return null;
  };

  return (
    <div>
      <Typography.Title level={5} style={{ margin: 0, marginBottom: '8px' }}>
        Design Material
      </Typography.Title>
      {renderContent()}
    </div>
  );
};

export default SelectedAssets;
