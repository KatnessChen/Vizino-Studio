import React, { useState, useMemo, useCallback } from 'react';
import { Input, Modal, Skeleton } from 'antd';
import { message } from '@/utils/antd';
import { devError } from '@/utils/devLogger';
import { List, ListItem, Box, Tooltip as MuiTooltip, IconButton } from '@mui/material';
import { ContentCopy as CopyIcon, Delete as DeleteIcon } from '@mui/icons-material';
import MyEmpty from '@/components/ui/MyEmpty';
import { CustomPrompt } from '@/types';

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
            sx={{
              width: '100%',
              bgcolor: 'background.paper',
              paddingBottom: 0,
              height: '334px', // hardcoded height to make both columns same height
            }}
          >
            {filteredPrompts.map((prompt: CustomPrompt, index) => (
              <ListItem
                key={prompt.id || index}
                sx={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    backgroundColor: '#f5f5f5',
                  },
                }}
                onClick={(e) => handleClickPrompt(e, prompt.content)}
              >
                <Box
                  sx={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 1,
                  }}
                >
                  {/* Prompt Content */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'block',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                      }}
                    >
                      {prompt.content}
                    </span>
                  </Box>

                  {/* Action Buttons */}
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <MuiTooltip title="Use this prompt">
                      <IconButton
                        size="small"
                        onClick={(e) => handleClickPrompt(e, prompt.content)}
                        sx={{ flexShrink: 0 }}
                      >
                        <CopyIcon sx={{ fontSize: '1rem' }} />
                      </IconButton>
                    </MuiTooltip>
                    <MuiTooltip title="Delete prompt">
                      <IconButton
                        size="small"
                        onClick={(e) => handleDeletePrompt(e, prompt.id!)}
                        disabled={isDeletingPrompt}
                        sx={{ flexShrink: 0 }}
                      >
                        <DeleteIcon sx={{ fontSize: '1rem' }} />
                      </IconButton>
                    </MuiTooltip>
                  </Box>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </div>
    </>
  );
};

export default SavedPromptList;
