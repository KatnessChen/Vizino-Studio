import React, { useState, useMemo } from 'react';
import { Modal, Button, Input, Typography, Collapse, Flex } from 'antd';
import { CloseOutlined, DownOutlined } from '@ant-design/icons';
import { getRecolorTaskDefaultPrompt, getAddTextureDefaultPrompt } from '@/services/gemini/prompts';
import { GeminiTask, GEMINI_TASKS } from '@/services/gemini/geminiTasks';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

interface CustomPromptModalProps {
  isOpen: boolean;
  onConfirm: (customPrompt: string | undefined) => void | Promise<void>;
  onCancel: () => void;
  task: GeminiTask;
  colorName?: string;
  colorHex?: string;
  textureName?: string;
}

const CustomPromptModal: React.FC<CustomPromptModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  task,
  colorName = '',
  colorHex = '',
  textureName = '',
}) => {
  const [prompt, setPrompt] = useState<string>('');

  const taskName = task.task_name;

  const isRecolorTask = taskName === GEMINI_TASKS.RECOLOR_WALL.task_name;
  const isTextureTask = taskName === GEMINI_TASKS.ADD_TEXTURE.task_name;

  // Memoize default prompt based on task
  const defaultPrompt = useMemo(() => {
    if (isRecolorTask) {
      return getRecolorTaskDefaultPrompt(colorName, colorHex, undefined);
    } else if (isTextureTask) {
      return getAddTextureDefaultPrompt(textureName, undefined);
    }
    return '';
  }, [isRecolorTask, isTextureTask, colorName, colorHex, textureName]);

  const handleConfirm = () => {
    onConfirm(prompt);
    setPrompt('');
  };

  const handleCancel = () => {
    setPrompt('');
    onCancel();
  };

  return (
    <Modal
      open={isOpen}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleConfirm}
          disabled={task.customPromptRequired && !prompt.trim()}
        >
          {prompt.trim() ? 'Use Custom Prompt' : 'Use Default Prompt'}
        </Button>
      ]}
      title={
        <Title level={4} className="m-0">
          {isRecolorTask
            ? `Customize Recolor Prompt - ${colorName}`
            : `Customize Texture Prompt - ${textureName}`}
        </Title>
      }
      width={700}
      centered
      closeIcon={<CloseOutlined />}
    >
      <div className="py-4">
        <Paragraph className="text-gray-600 mb-6">
          {isRecolorTask
            ? `Fine-tune the recoloring to control exactly how your walls appear in ${colorName}. Leave blank to use the default settings.`
            : `Fine-tune the texture application to control exactly how the ${textureName} texture is applied to your walls. Leave blank to use the default settings.`}
        </Paragraph>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Prompt {task.customPromptRequired ? `(Required)` : `(Optional)`}
          </label>
          <TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your custom prompt here..."
            autoSize={{ minRows: 4, maxRows: 8 }}
            className="font-mono text-sm"
          />
        </div>

        <Collapse 
          ghost 
          expandIcon={({ isActive }) => <DownOutlined rotate={isActive ? 180 : 0} />}
          className="bg-gray-50 rounded-lg border border-gray-200"
        >
          <Panel 
            header={
              <Text className="text-xs font-semibold text-gray-700">
                {isRecolorTask ? 'Default Recolor Prompt' : 'Default Texture Prompt'}
              </Text>
            } 
            key="1"
          >
            <div className="p-4 bg-white rounded border border-gray-200">
              <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap break-words font-mono m-0">
                {defaultPrompt}
              </pre>
            </div>
          </Panel>
        </Collapse>
      </div>
    </Modal>
  );
};

export default CustomPromptModal;
