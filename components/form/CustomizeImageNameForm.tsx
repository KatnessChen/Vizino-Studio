import { Input, Checkbox, Typography, Tag } from 'antd';
import { GeminiTaskName, GEMINI_TASKS } from '@/services/gemini/geminiTasks';

const MAX_IMAGE_NAME_LENGTH = 50;

interface CustomizeImageNameFormProps {
  baseName: string;
  onBaseNameChange: (value: string) => void;
  prefixTimestamp: boolean;
  onPrefixTimestampChange: (value: boolean) => void;
  suffixTimestamp: boolean;
  onSuffixTimestampChange: (value: boolean) => void;
  suffixMimeType: boolean;
  onSuffixMimeTypeChange: (value: boolean) => void;
  finalName: string;
  nameError: string;
  // Optional props for ConfirmImageUpdateModal
  taskName?: GeminiTaskName;
  colorName?: string;
  textureName?: string;
  itemName?: string;
  suffixColorName?: boolean;
  onSuffixColorNameChange?: (value: boolean) => void;
  suffixTextureName?: boolean;
  onSuffixTextureNameChange?: (value: boolean) => void;
  suffixItemName?: boolean;
  onSuffixItemNameChange?: (value: boolean) => void;
  showTitle?: boolean;

  hideSuffixMimeType?: boolean;
  description?: string;
  onDescriptionChange?: (value: string) => void;
  aiSuggestedName?: string;
}

const CustomizeImageNameForm: React.FC<CustomizeImageNameFormProps> = ({
  baseName,
  onBaseNameChange,
  prefixTimestamp,
  onPrefixTimestampChange,
  suffixTimestamp,
  onSuffixTimestampChange,
  suffixMimeType,
  onSuffixMimeTypeChange,
  finalName,
  nameError,
  taskName,
  colorName,
  textureName,
  itemName,
  suffixColorName = false,
  onSuffixColorNameChange,
  suffixTextureName = false,
  onSuffixTextureNameChange,
  suffixItemName = false,
  onSuffixItemNameChange,
  showTitle = false,
  hideSuffixMimeType = false,
  description,
  onDescriptionChange,
  aiSuggestedName,
}) => {
  return (
    <div>
      {showTitle && (
        <Typography.Title level={5} style={{ marginBottom: 12 }}>
          Customize Image Name
        </Typography.Title>
      )}

      {/* Base Name Input */}
      <div style={{ marginBottom: 16 }}>
        <div className="flex gap-2 mb-2">
          <Typography.Text strong>Base Name</Typography.Text>
          {aiSuggestedName && baseName === aiSuggestedName && <Tag>AI Suggested</Tag>}
        </div>
        <Input
          value={baseName}
          onChange={(e) => onBaseNameChange(e.target.value)}
          maxLength={MAX_IMAGE_NAME_LENGTH}
          placeholder="Enter image name"
          status={nameError ? 'error' : ''}
        />
        {nameError && (
          <Typography.Text type="danger" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
            {nameError}
          </Typography.Text>
        )}
      </div>

      {/* Description Input */}
      {onDescriptionChange && (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
            Description
          </Typography.Text>
          <Input.TextArea
            value={description || ''}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Enter image description"
            rows={3}
            autoSize={{ minRows: 2, maxRows: 6 }}
          />
        </div>
      )}

      {/* Checkbox Options */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Checkbox
          checked={prefixTimestamp}
          onChange={(e) => onPrefixTimestampChange(e.target.checked)}
        >
          Prefix with timestamp
        </Checkbox>
        <Checkbox
          checked={suffixTimestamp}
          onChange={(e) => onSuffixTimestampChange(e.target.checked)}
        >
          Suffix with timestamp
        </Checkbox>
        {!hideSuffixMimeType && (
          <Checkbox
            checked={suffixMimeType}
            onChange={(e) => onSuffixMimeTypeChange(e.target.checked)}
          >
            Suffix with file extension
          </Checkbox>
        )}
        {taskName === GEMINI_TASKS.RECOLOR_WALL.task_name && colorName && (
          <Checkbox
            checked={suffixColorName}
            onChange={(e) => onSuffixColorNameChange?.(e.target.checked)}
          >
            Suffix with color name
          </Checkbox>
        )}
        {taskName === GEMINI_TASKS.ADD_TEXTURE.task_name && textureName && (
          <Checkbox
            checked={suffixTextureName}
            onChange={(e) => onSuffixTextureNameChange?.(e.target.checked)}
          >
            Suffix with texture name
          </Checkbox>
        )}
        {taskName === GEMINI_TASKS.ADD_HOME_ITEM.task_name && itemName && (
          <Checkbox
            checked={suffixItemName}
            onChange={(e) => onSuffixItemNameChange?.(e.target.checked)}
          >
            Suffix with texture name
          </Checkbox>
        )}
      </div>

      {/* Final Name Preview */}
      <div
        style={{
          backgroundColor: '#fafafa',
          borderRadius: 4,
          padding: 12,
          border: '1px solid #e8e8e8',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Typography.Text strong>Final Name Preview:</Typography.Text>
          <Typography.Text
            type={finalName.length > MAX_IMAGE_NAME_LENGTH ? 'danger' : 'secondary'}
            style={{ fontSize: 12 }}
          >
            {finalName.length} / {MAX_IMAGE_NAME_LENGTH} characters
          </Typography.Text>
        </div>
        <Typography.Text
          code
          style={{
            display: 'block',
            wordBreak: 'break-all',
            color: nameError ? '#ff4d4f' : undefined,
          }}
        >
          {finalName || '(empty)'}
        </Typography.Text>
      </div>
    </div>
  );
};

export default CustomizeImageNameForm;
