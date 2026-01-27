import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Modal, Button, Dropdown, Input, Alert, Checkbox } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { Category as CategoryIcon } from '@mui/icons-material';
import type { MenuProps } from 'antd';
import {
  selectActiveProject,
  selectProjects,
  selectActiveProjectId,
  selectActiveSpaceId,
} from '@/stores/projectStore';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectSpaceMenuItems } from '@/hooks/useProjectSpaceMenuItems';

interface MoveImageModalProps {
  isOpen: boolean;
  numberOfImages: number;
  onConfirm: (targetSpaceId: string, newSpaceName?: string, copyAsOriginal?: boolean) => void;
  onCancel: () => void;
  isLoading?: boolean;
  allowCopyAsOriginal?: boolean;
}

const MoveImageModal: React.FC<MoveImageModalProps> = ({
  isOpen,
  numberOfImages,
  onConfirm,
  onCancel,
  isLoading = false,
  allowCopyAsOriginal = false,
}) => {
  const { adminSettings } = useAuth();
  const projects = useSelector(selectProjects);
  const activeProject = useSelector(selectActiveProject);
  const activeProjectId = useSelector(selectActiveProjectId);

  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [isCreatingNewSpace, setIsCreatingNewSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [nameError, setNameError] = useState<string>('');
  const [copyAsOriginal, setCopyAsOriginal] = useState<boolean>(false);

  const activeSpaceId = useSelector(selectActiveSpaceId);

  const { spaceMenuItems } = useProjectSpaceMenuItems({
    projects,
    activeProject: activeProject || null,
    activeProjectId,
    adminSettings,
    // Allow selecting current space when copying generated images as original
    isDisableCurrentSpace: !(allowCopyAsOriginal && copyAsOriginal),
    onSelectSpace: (spaceId: string) => {
      setSelectedSpaceId(spaceId);
      setIsCreatingNewSpace(false);
      setNewSpaceName('');
      setNameError('');
    },
    onAddSpace: () => {
      setIsCreatingNewSpace(true);
      setSelectedSpaceId('');
    },
  });

  const availableSpaces = activeProject?.spaces || [];

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSpaceId('');
      setIsCreatingNewSpace(false);
      setNewSpaceName('');
      setNameError('');
      setCopyAsOriginal(false);
    }
  }, [isOpen]);

  // Handle checkbox change deterministically: only set/clear selection on user action
  const handleCopyAsOriginalChange = (checked: boolean) => {
    setCopyAsOriginal(checked);

    // if (checked && allowCopyAsOriginal && activeSpaceId) {
    //   // When enabling, pre-select current space
    //   setSelectedSpaceId(activeSpaceId);
    // }

    if (!checked && selectedSpaceId && activeSpaceId && selectedSpaceId === activeSpaceId) {
      // When disabling and the selected destination equals current space, clear selection
      setSelectedSpaceId('');
    }
  };

  const handleNewSpaceNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewSpaceName(value);

    // Validate name
    if (!value.trim()) {
      setNameError('Space name cannot be empty');
    } else if (availableSpaces.some((space) => space.name.toLowerCase() === value.toLowerCase())) {
      setNameError('A space with this name already exists');
    } else {
      setNameError('');
    }
  };

  const handleConfirm = () => {
    if (isCreatingNewSpace) {
      if (!newSpaceName.trim()) {
        setNameError('Space name cannot be empty');
        return;
      }
      if (nameError) {
        return;
      }
      onConfirm('', newSpaceName.trim(), copyAsOriginal);
    } else {
      onConfirm(selectedSpaceId, undefined, copyAsOriginal);
    }
  };

  const isConfirmDisabled = isCreatingNewSpace
    ? !newSpaceName.trim() || !!nameError
    : !selectedSpaceId;

  if (!isOpen) return null;

  return (
    <Modal
      title={`Move Image${numberOfImages > 1 ? 's' : ''}`}
      open={isOpen}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>,
        <Button
          key="move"
          type="primary"
          onClick={handleConfirm}
          loading={isLoading}
          disabled={isConfirmDisabled}
        >
          Move
        </Button>,
      ]}
      width={540}
    >
      {/* Info box */}
      <p style={{ marginBottom: 16 }}>
        <strong>{numberOfImages}</strong> image{numberOfImages > 1 ? 's' : ''} will be moved to the
        destination space.
      </p>

      {/* Space selector */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: 'block',
            marginBottom: 8,
            fontSize: '14px',
            fontWeight: 500,
            color: '#374151',
          }}
        >
          Select Destination Space
        </label>
        <Dropdown
          menu={{
            items: (spaceMenuItems as MenuProps['items']) || [],
          }}
          disabled={isLoading}
          trigger={['click']}
          placement="bottomLeft"
        >
          <button
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              background: '#fff',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '14px',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CategoryIcon style={{ fontSize: '20px' }} />
              {selectedSpaceId
                ? activeProject?.spaces.find((s) => s.id === selectedSpaceId)?.name ||
                  'Select a Space'
                : isCreatingNewSpace
                  ? 'Create New Space'
                  : 'Select a space'}
            </span>
            <DownOutlined style={{ fontSize: '12px' }} />
          </button>
        </Dropdown>
      </div>

      {/* New space name input */}
      {isCreatingNewSpace && (
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: 'block',
              marginBottom: 8,
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
            }}
          >
            New Space Name
          </label>
          <Input
            placeholder="Enter space name"
            value={newSpaceName}
            onChange={handleNewSpaceNameChange}
            disabled={isLoading}
            status={nameError ? 'error' : ''}
            autoFocus
          />
          {nameError && (
            <Alert
              title={nameError}
              type="error"
              showIcon
              style={{ marginTop: 8, fontSize: '13px' }}
            />
          )}
        </div>
      )}

      {/* Option: Convert generated images to originals when moving */}
      {allowCopyAsOriginal && (
        <div style={{ marginBottom: 16 }}>
          <Checkbox
            checked={copyAsOriginal}
            onChange={(e) => handleCopyAsOriginalChange(e.target.checked)}
            disabled={isLoading}
          >
            Convert to Original
          </Checkbox>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            If selected, generated images will be copied as originals in the destination space
            (generation history will be removed).
          </div>
        </div>
      )}
    </Modal>
  );
};

export default MoveImageModal;
