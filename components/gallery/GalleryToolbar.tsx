import React from 'react';
import { Button, Tooltip, Segmented } from 'antd';
import {
  BarsOutlined,
  AppstoreOutlined,
  PlusOutlined,
  LockOutlined,
  FolderOutlined,
  DownloadOutlined as DownloadIcon,
  DeleteOutlined as DeleteIcon,
  CloseOutlined as CloseIcon,
  CopyOutlined as CopyIcon,
} from '@ant-design/icons';
import ImagesComparingButton from '../button/ImagesComparingButton';
import { ImageData } from '@/types';

interface GalleryToolbarProps {
  title: string;
  hasSelection: boolean;
  selectedCount: number;
  onClearSelection?: () => void;
  showCompare: boolean;
  totalSelectedItems: number;
  allSelectedItemsForComparison: ImageData[];
  onBulkDownload?: () => void;
  onBulkCopy?: () => void;
  onBulkMove?: () => void;
  onBulkDelete?: () => void;
  onUploadClick: () => void;
  isImageLimitReached: boolean;
  isGuestMode: boolean;
  uploadButtonText: string;
  layoutMode: 'Kanban' | 'List';
  onLayoutChange: (mode: 'Kanban' | 'List') => void;
  hasImages: boolean;
}

const GalleryToolbar: React.FC<GalleryToolbarProps> = ({
  title,
  hasSelection,
  selectedCount,
  onClearSelection,
  showCompare,
  totalSelectedItems,
  allSelectedItemsForComparison,
  onBulkDownload,
  onBulkCopy,
  onBulkMove,
  onBulkDelete,
  onUploadClick,
  isImageLimitReached,
  isGuestMode,
  uploadButtonText,
  layoutMode,
  onLayoutChange,
  hasImages,
}) => {
  const toolbarButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#ffffff',
    margin: '3px 6px 0px 6px',
  };

  const iconStyle = {
    fontSize: '18px',
    color: 'gray',
    marginTop: '2px',
    marginLeft: '2px',
  };

  return (
    <div className="flex justify-between items-center gap-5">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>

      <div className="flex items-center gap-3">
        {hasSelection && (
          <div
            style={{
              display: 'flex',
              backgroundColor: '#f3f4f6',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px 4px 16px',
              borderRadius: 8,
              height: 32,
              color: 'black',
            }}
          >
            <span style={{ fontSize: 13, color: '#4b5563', fontWeight: 500, marginRight: 4 }}>
              {selectedCount} selected
            </span>

            {onClearSelection && (
              <Tooltip title="Deselect all">
                <Button
                  type="text"
                  size="small"
                  icon={<CloseIcon style={iconStyle} />}
                  onClick={onClearSelection}
                  style={toolbarButtonStyle}
                />
              </Tooltip>
            )}

            <div style={{ width: 1, height: 18, backgroundColor: '#d1d5db', margin: '0 4px' }} />

            {showCompare && (
              <ImagesComparingButton
                totalSelectedCount={totalSelectedItems}
                selectedAssets={allSelectedItemsForComparison}
              />
            )}

            {onBulkDownload && (
              <Tooltip title="Download">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadIcon style={iconStyle} />}
                  onClick={onBulkDownload}
                  style={toolbarButtonStyle}
                />
              </Tooltip>
            )}

            {onBulkCopy && (
              <Tooltip title="Duplicate">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyIcon style={iconStyle} />}
                  onClick={onBulkCopy}
                  style={toolbarButtonStyle}
                />
              </Tooltip>
            )}
            {onBulkMove && (
              <Tooltip title="Move">
                <Button
                  type="text"
                  size="small"
                  icon={<FolderOutlined style={iconStyle} />}
                  onClick={onBulkMove}
                  style={toolbarButtonStyle}
                />
              </Tooltip>
            )}

            {onBulkDelete && (
              <Tooltip title="Delete">
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteIcon style={iconStyle} />}
                  onClick={onBulkDelete}
                  style={toolbarButtonStyle}
                />
              </Tooltip>
            )}
          </div>
        )}

        <Button
          icon={<PlusOutlined />}
          onClick={onUploadClick}
          disabled={isImageLimitReached && !isGuestMode}
          className={`!flex items-center gap-1.5 ${isGuestMode ? 'opacity-60' : ''}`}
        >
          {uploadButtonText}
          {isGuestMode && <LockOutlined />}
        </Button>

        {hasImages && (
          <Segmented
            value={layoutMode}
            onChange={(val) => onLayoutChange(val as 'Kanban' | 'List')}
            options={[
              { value: 'List', icon: <BarsOutlined /> },
              { value: 'Kanban', icon: <AppstoreOutlined /> },
            ]}
          />
        )}
      </div>
    </div>
  );
};

export default React.memo(GalleryToolbar);
