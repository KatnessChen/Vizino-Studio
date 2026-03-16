import React, { useState, useMemo, useCallback } from 'react';
import { Input, Modal, Skeleton, List, Tooltip, Button, Flex, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { message } from '@/utils/antd';
import { devError } from '@/utils/devLogger';
import MyEmpty from '@/components/ui/MyEmpty';
import { CustomPrompt } from '@/types';

const { Text } = Typography;

interface SavedPromptListProps {
  prompts: CustomPrompt[];
  isLoading: boolean;
  searchKeyword: string;
  onSearchChange: (keyword: string) => void;
  onSelectPrompt: (content: string) => void;
  onDeletePrompt: (promptId: string) => Promise<void>;
}

const SavedPromptList: React.FC<SavedPromptListProps> = ({
  prompts,
  isLoading,
  searchKeyword,
  onSearchChange,
  onSelectPrompt,
  onDeletePrompt,
}) => {
  const [isDeletingPrompt, setIsDeletingPrompt] = useState(false);

  // Filter prompts by search keyword
  const filteredPrompts = useMemo(() => {
    let result = prompts;

    // Filter by search keyword
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      result = result.filter(
        (prompt) =>
          prompt.task_name.toLowerCase().includes(keyword) ||
          prompt.content.toLowerCase().includes(keyword)
      );
    }

    return result;
  }, [prompts, searchKeyword]);

  // Handle delete single prompt with confirmation
  const handleDeletePrompt = useCallback(
    async (e: React.MouseEvent, promptId: string) => {
      e.stopPropagation();

      Modal.confirm({
        title: 'Delete Prompt',
        content: 'Are you sure you want to delete this prompt?',
        okText: 'Delete',
        okType: 'danger',
        onOk: async () => {
          setIsDeletingPrompt(true);
          try {
            await onDeletePrompt(promptId);
            message.success('Prompt deleted successfully');
          } catch (error) {
            devError('Failed to delete prompt:', error);
            message.error('Failed to delete prompt');
          } finally {
            setIsDeletingPrompt(false);
          }
        },
      });
    },
    [onDeletePrompt]
  );

  // Handle clicking on prompt text to select it
  const handleClickPrompt = useCallback(
    (e: React.MouseEvent, content: string) => {
      e.stopPropagation();
      onSelectPrompt(content);
    },
    [onSelectPrompt]
  );

  return (
    <>
      {/* Search Input */}
      <div className="mt-2 mb-2 px-3">
        <Input
          placeholder="Filter prompts..."
          value={searchKeyword}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
          className="w-full rounded-none border-l-0 border-r-0 border-t-0"
        />
      </div>

      {/* Prompts List */}
      <div className="overflow-auto flex-1">
        {isLoading ? (
          <div className="p-2">
            <Skeleton active paragraph={{ rows: 2 }} />
            <Skeleton active paragraph={{ rows: 2 }} className="mt-2" />
            <Skeleton active paragraph={{ rows: 2 }} className="mt-2" />
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div className="p-4 flex items-center justify-center h-full">
            <MyEmpty description="No historical prompts found." />
          </div>
        ) : (
          <List
            className="w-full bg-white h-[334px] overflow-auto"
            dataSource={filteredPrompts}
            renderItem={(prompt: CustomPrompt, index) => (
              <List.Item
                key={prompt.id || index}
                className="px-3 py-2 border-b border-[#f0f0f0] cursor-pointer transition-colors hover:bg-[#f5f5f5]"
                onClick={(e) => handleClickPrompt(e, prompt.content)}
              >
                <Flex justify="space-between" align="flex-start" gap={8} className="w-full">
                  {/* Prompt Content */}
                  <div className="flex-1 min-w-0">
                    <Text
                      className="block overflow-hidden text-ellipsis whitespace-normal break-words"
                    >
                      {prompt.content}
                    </Text>
                  </div>

                  {/* Action Buttons */}
                  <Flex gap={4} shrink={0}>
                    <Tooltip title="Use this prompt">
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined style={{ fontSize: '1rem' }} />}
                        onClick={(e) => handleClickPrompt(e, prompt.content)}
                        className="flex-none"
                      />
                    </Tooltip>
                    <Tooltip title="Delete prompt">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined style={{ fontSize: '1rem' }} />}
                        onClick={(e) => handleDeletePrompt(e, prompt.id!)}
                        disabled={isDeletingPrompt}
                        className="flex-none"
                      />
                    </Tooltip>
                  </Flex>
                </Flex>
              </List.Item>
            )}
          />
        )}
      </div>
    </>
  );
};

export default SavedPromptList;
