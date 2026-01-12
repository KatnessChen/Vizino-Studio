import React, { useState } from 'react';
import { Modal, Input, Button } from 'antd';
import { Color } from '@/types';
import {
  MAX_CUSTOM_ASSET_NAME_LENGTH,
  MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH,
} from '@/constants/constants';

interface AddColorModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (color: Color) => void;
  existingColors: Color[];
}

// Convert RGB/RGBA format to HEX format
const rgbaToHex = (rgba: string): string | null => {
  const match = rgba.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/i);
  if (!match) return null;

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  // Validate RGB values are in range 0-255
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    return null;
  }

  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

// Validate and normalize color input (accepts HEX or RGB/RGBA format)
const normalizeColorInput = (input: string): string | null => {
  const trimmed = input.trim();

  // Check if it's HEX format
  if (/^#[0-9A-Fa-f]{6}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Check if it's RGB/RGBA format
  const hexFromRgba = rgbaToHex(trimmed);
  if (hexFromRgba) {
    return hexFromRgba;
  }

  return null;
};

const DEFAULT_COLOR_PICKER_VALUE = '#FFFFF0';

const AddColorModal: React.FC<AddColorModalProps> = ({ open, onClose, onAdd, existingColors }) => {
  const [colorName, setColorName] = useState('');
  const [colorHex, setColorHex] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    hex?: string;
    description?: string;
  }>({});

  const handleClose = () => {
    setColorName('');
    setColorHex('');
    setDescription('');
    setErrors({});
    onClose();
  };

  const handleReset = () => {
    setColorName('');
    setColorHex('');
    setDescription('');
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: { name?: string; hex?: string; description?: string } = {};

    // Validate Color Name (required, max 15 characters)
    if (!colorName.trim()) {
      newErrors.name = 'Color name is required';
    } else if (colorName.trim().length > MAX_CUSTOM_ASSET_NAME_LENGTH) {
      newErrors.name = `Color name must be ${MAX_CUSTOM_ASSET_NAME_LENGTH} characters or less`;
    } else if (
      existingColors.some((c) => c.name.toLowerCase() === colorName.trim().toLowerCase())
    ) {
      newErrors.name = 'A color with this name already exists';
    }

    // Validate HEX (required)
    if (!colorHex.trim()) {
      newErrors.hex = 'Color value is required';
    } else {
      const normalizedHex = normalizeColorInput(colorHex.trim());
      if (!normalizedHex) {
        newErrors.hex =
          'Color must be in HEX (#RRGGBB) or RGB/RGBA (rgb(r,g,b) or rgba(r,g,b,a)) format';
      }
    }

    // Validate Description
    if (description.length > MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH) {
      newErrors.description = `Description must be ${MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH} characters or less`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdd = () => {
    if (!validateForm()) {
      return;
    }

    const normalizedHex = normalizeColorInput(colorHex.trim());
    if (!normalizedHex) return;

    const newColor: Color = {
      id: crypto.randomUUID(),
      name: colorName.trim(),
      hex: normalizedHex,
      description: description.trim() || '',
    };

    // Check for duplicates by hex
    if (existingColors.some((c) => c.hex.toLowerCase() === newColor.hex.toLowerCase())) {
      setErrors({ hex: 'A color with this HEX value already exists' });
      return;
    }

    onAdd(newColor);
    handleClose();
  };

  return (
    <Modal
      title="Add Custom Color"
      open={open}
      onCancel={handleClose}
      width={500}
      footer={[
        <Button key="reset" onClick={handleReset}>
          Reset
        </Button>,
        <Button key="cancel" onClick={handleClose}>
          Cancel
        </Button>,
        <Button key="add" type="primary" onClick={handleAdd}>
          Add Color
        </Button>,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
        {/* Color Name */}
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
            Color Name <span style={{ color: '#ff4d4f' }}>*</span>
          </label>
          <Input
            placeholder="e.g., Sky Blue"
            maxLength={MAX_CUSTOM_ASSET_NAME_LENGTH}
            value={colorName}
            onChange={(e) => setColorName(e.target.value)}
            status={errors.name ? 'error' : ''}
          />
          <div
            style={{
              marginTop: '4px',
              fontSize: '12px',
              color: errors.name ? '#ff4d4f' : '#8c8c8c',
            }}
          >
            {errors.name || `${colorName.length}/${MAX_CUSTOM_ASSET_NAME_LENGTH} characters`}
          </div>
        </div>

        {/* Color Value */}
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
            Color Value <span style={{ color: '#ff4d4f' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="color"
              value={normalizeColorInput(colorHex) || DEFAULT_COLOR_PICKER_VALUE}
              onChange={(e) => setColorHex(e.target.value)}
              style={{
                width: '50px',
                height: '40px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            />
            <Input
              placeholder="e.g., #87CEEB or rgba(135, 206, 235, 1)"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              status={errors.hex ? 'error' : ''}
              style={{ flex: 1 }}
            />
          </div>
          <div
            style={{
              marginTop: '4px',
              fontSize: '12px',
              color: errors.hex ? '#ff4d4f' : '#8c8c8c',
            }}
          >
            {errors.hex || 'Accepts HEX (#RRGGBB) or RGB/RGBA format'}
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
            Description
          </label>
          <Input.TextArea
            placeholder={`Optional description (max ${MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH} characters)`}
            maxLength={MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            status={errors.description ? 'error' : ''}
          />
          <div
            style={{
              marginTop: '4px',
              fontSize: '12px',
              color: errors.description ? '#ff4d4f' : '#8c8c8c',
            }}
          >
            {errors.description ||
              `${description.length}/${MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH} characters`}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AddColorModal;
