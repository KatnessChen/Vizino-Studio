import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Space, Card, Radio } from 'antd';
import { CheckCircle as CheckmarkBadgeIcon } from '@mui/icons-material';
import { Alert as AntAlert } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Color } from '@/types';
import { PRESET_COLOR } from '@/constants/constants';
import { Snackbar, Alert } from '@mui/material';
import AddColorModal from './AddColorModal';
import { useCustomColors } from '@/hooks/useCustomColors';
import { RootState } from '@/stores/store';
import { setSelectedColor } from '@/stores/taskStore';
import { sortColorsBySpectrum, getTextColor } from '@/utils/colorUtils';

interface ColorSelectorProps {
  title?: string;
  onSelectColor?: (color: Color | null) => void;
  selectedColor: Color | null;
}

const ColorSelector: React.FC<ColorSelectorProps> = ({
  title = 'Colors',
  selectedColor,
  onSelectColor,
}) => {
  const dispatch = useDispatch();

  const activeProjectId = useSelector((state: RootState) => state.project.activeProjectId);
  const { customColors, isLoadingColors, addColor } = useCustomColors(activeProjectId);
  const [isAddColorModalOpen, setIsAddColorModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const availableColors = useMemo(() => [...customColors, ...PRESET_COLOR], [customColors]);

  // Memoize sorted colors to avoid recalculation on every render
  const sortedColors = useMemo(() => sortColorsBySpectrum(availableColors), [availableColors]);

  const handleAddColor = async (color: Color) => {
    try {
      setError(null);
      const newColor = await addColor({
        name: color.name,
        hex: color.hex,
        description: color.description,
      });

      dispatch(setSelectedColor(color));
      setIsAddColorModalOpen(false);
      setToast({
        open: true,
        message: `Color "${newColor.name}" added successfully!`,
        severity: 'success',
      });
    } catch (error) {
      console.error('Failed to save custom color:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save custom color. Please try again.';
      setError(errorMessage);
      setToast({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    }
  };

  return (
    <Card
      title={
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <span>{title}</span>
          <Button onClick={() => setIsAddColorModalOpen(true)} size="small">
            <PlusOutlined />
            <span className="hidden sm:inline ml-1">Custom Color</span>
          </Button>
        </div>
      }
    >
      {error && (
        <AntAlert
          title="Error"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {isLoadingColors ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading colors...</span>
        </div>
      ) : (
        <>
          <style>{`
            .color-selector-radio .ant-radio-inner {
              display: none !important;
            }
            .color-selector-radio .ant-radio {
              margin-right: 0 !important;
            }
          `}</style>
          <Space orientation="vertical" style={{ width: '100%' }} size="small">
            <Radio.Group
              value={selectedColor?.id || undefined}
              onChange={(e) => {
                const color = availableColors.find((c) => c.id === e.target.value);
                if (color) {
                  // Toggle logic: if clicking the same color, deselect it
                  if (selectedColor?.id === color.id) {
                    dispatch(setSelectedColor(null));
                    if (onSelectColor) onSelectColor(null);
                  } else {
                    dispatch(setSelectedColor(color));
                    if (onSelectColor) onSelectColor(color);
                  }
                }
              }}
              style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
              className="color-selector-radio"
            >
              <div
                style={{
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  paddingBottom: '8px',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`,
                    minWidth: 'min-content',
                    gap: '2px',
                  }}
                  className="sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]"
                >
                  {sortedColors.map((color) => (
                    <div
                      key={color.id}
                      style={{
                        minWidth: '160px',
                        minHeight: '160px',
                        position: 'relative',
                      }}
                    >
                      <Radio
                        value={color.id}
                        onClick={(e) => {
                          // Toggle logic: if clicking the same color, deselect it
                          if (selectedColor?.id === color.id) {
                            e.preventDefault();
                            dispatch(setSelectedColor(null));
                            if (onSelectColor) onSelectColor(null);
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          padding: '0',
                          border:
                            selectedColor?.id === color.id
                              ? '2px solid #6366f1'
                              : '1px solid transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'flex-start',
                          backgroundColor: color.hex,
                          transition: 'all 0.3s ease',
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        {/* Color name - bottom left corner */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '12px',
                            left: '12px',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            color: getTextColor(color.hex),
                            textAlign: 'left',
                            textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                            zIndex: 2,
                          }}
                        >
                          {color.name}
                        </div>

                        {/* Checkmark - top right corner when selected */}
                        {selectedColor?.id === color.id && (
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

                        {/* Hover overlay with hex and description */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.3s ease',
                            padding: '16px',
                            zIndex: 1,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.opacity = '1';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.opacity = '0';
                          }}
                        >
                          <div
                            style={{
                              color: '#e5e7eb',
                              fontSize: '0.875rem',
                              marginBottom: '4px',
                            }}
                          >
                            {color.hex}
                          </div>
                          {color.description && (
                            <div
                              style={{
                                color: '#d1d5db',
                                fontSize: '0.75rem',
                                fontStyle: 'italic',
                                textAlign: 'center',
                              }}
                            >
                              {color.description}
                            </div>
                          )}
                        </div>
                      </Radio>
                    </div>
                  ))}
                </div>
              </div>
            </Radio.Group>

            {/* Add Color Modal */}
            {isAddColorModalOpen && (
              <AddColorModal
                open={isAddColorModalOpen}
                onClose={() => setIsAddColorModalOpen(false)}
                onAdd={handleAddColor}
                existingColors={availableColors}
              />
            )}
          </Space>
        </>
      )}

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
          severity={toast.severity}
          variant="filled"
          sx={{ width: '100%' }}
          title={toast.message}
        />
      </Snackbar>
    </Card>
  );
};

export default ColorSelector;
