import React, { useState, useEffect } from 'react';
import { Modal, Input, Alert } from 'antd';
import {
  MAX_CUSTOM_ASSET_NAME_LENGTH,
  MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH,
  ASSET_TEXTURE,
  ASSET_ITEM,
} from '@/constants/constants';

interface AssetRenameModalProps {
  isOpen: boolean;
  asset: { id: string; name: string; description?: string; hex?: string } | null;
  onConfirm: (
    id: string,
    updates: { name: string; description: string; hex?: string }
  ) => Promise<void>;
  onCancel: () => void;
  type: 'texture' | 'item' | 'color';
  existingNames: Set<string>;
}

const AssetRenameModal: React.FC<AssetRenameModalProps> = ({
  isOpen,
  asset,
  onConfirm,
  onCancel,
  type,
  existingNames,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hex, setHex] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && asset) {
      setName(asset.name);
      setDescription(asset.description || '');
      setHex(asset.hex || '');
      setError(null);
    }
  }, [isOpen, asset]);

  const handleConfirm = async () => {
    if (!asset) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(
        `${type === ASSET_TEXTURE ? 'Texture' : type === ASSET_ITEM ? 'Item' : 'Color'} name cannot be empty`
      );
      return;
    }

    if (trimmedName.length > MAX_CUSTOM_ASSET_NAME_LENGTH) {
      setError(`Name must be ${MAX_CUSTOM_ASSET_NAME_LENGTH} characters or less`);
      return;
    }

    if (
      existingNames.has(trimmedName.toLowerCase()) &&
      trimmedName.toLowerCase() !== asset.name.toLowerCase()
    ) {
      setError(`This ${type} name already exists`);
      return;
    }

    if (type === 'color') {
      const hexValue = hex.trim();
      if (!hexValue) {
        setError('Hex code cannot be empty');
        return;
      }
      if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hexValue)) {
        setError('Invalid hex code format (e.g., #FFFFFF or #FFF)');
        return;
      }
    }

    setIsLoading(true);
    try {
      await onConfirm(asset.id, {
        name: trimmedName,
        description: description.trim(),
        ...(type === 'color' ? { hex: hex.trim() } : {}),
      });
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename asset');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      title={
        type === ASSET_TEXTURE ? 'Edit Texture' : type === ASSET_ITEM ? 'Edit Item' : 'Edit Color'
      }
      open={isOpen}
      onOk={handleConfirm}
      onCancel={onCancel}
      confirmLoading={isLoading}
      okText="Save"
      cancelText="Cancel"
      zIndex={1001}
    >
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}>
          {type === ASSET_TEXTURE ? 'Texture' : type === ASSET_ITEM ? 'Item' : 'Color'} Name
          <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 8 }}>
            {name.length}/{MAX_CUSTOM_ASSET_NAME_LENGTH}
          </span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value.substring(0, MAX_CUSTOM_ASSET_NAME_LENGTH))}
          placeholder={`Enter ${type} name`}
          maxLength={MAX_CUSTOM_ASSET_NAME_LENGTH}
          autoFocus
        />
      </div>

      {type === 'color' && (
        <div style={{ marginBottom: 16 }}>
          <label
            style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}
          >
            Hex Code
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
              <input
                type="color"
                value={/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex) ? hex : '#ffffff'}
                onChange={(e) => setHex(e.target.value.toUpperCase())}
                aria-label="Pick color"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                  zIndex: 2,
                }}
              />
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 4,
                  backgroundColor: /^#([A-Fa-f0-9]{3}){1,2}$/.test(hex) ? hex : '#ffffff',
                  border: '1px solid #d9d9d9',
                  zIndex: 1,
                }}
              />
            </div>
            <Input
              value={hex}
              onChange={(e) => setHex(e.target.value.toUpperCase())}
              placeholder="#FFFFFF"
              maxLength={7}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}>
          Description (Optional)
          <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 8 }}>
            {description.length}/{MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH}
          </span>
        </label>
        <Input.TextArea
          value={description}
          onChange={(e) =>
            setDescription(e.target.value.substring(0, MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH))
          }
          placeholder="Add description"
          maxLength={MAX_CUSTOM_ASSET_DESCRIPTION_LENGTH}
          rows={2}
        />
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
    </Modal>
  );
};

export default AssetRenameModal;
