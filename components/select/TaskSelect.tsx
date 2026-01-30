import React, { useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Checkbox, Typography, Tooltip } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { LockOutlined } from '@ant-design/icons';
import { GEMINI_TASKS, GeminiTaskName } from '@/services/gemini/geminiTasks';
import { selectSelectedTaskNames, setSelectedTaskNames } from '@/stores/taskStore';
import { setShowLoginRequiredModal } from '@/stores/guestStore';
import { useGuest } from '@/contexts/GuestContext';

interface TaskSelectProps {
  multiSelect?: boolean;
  onTaskChange?: (taskNames: GeminiTaskName[]) => void;
  onError?: (message: string | null) => void;
  onModalStateChange?: (isOpen: boolean) => void;
}

const TaskSelect: React.FC<TaskSelectProps> = ({
  multiSelect = false,
  onTaskChange,
  onError,
  onModalStateChange,
}) => {
  const dispatch = useDispatch();
  const selectedTaskNames = useSelector(selectSelectedTaskNames);
  const { isGuestMode } = useGuest();

  useEffect(() => {
    dispatch(setSelectedTaskNames([GEMINI_TASKS.RECOLOR_WALL.task_name]));
  }, [dispatch]);

  // Reset related state when tasks change
  const resetRelatedState = useCallback(() => {
    onModalStateChange?.(false);
    onError?.(null);
  }, [onModalStateChange, onError]);

  const tasks = [
    {
      value: GEMINI_TASKS.RECOLOR_WALL.task_name,
      label: GEMINI_TASKS.RECOLOR_WALL.label_name,
      icon: '🎨',
      guestAllowed: true,
      description:
        'Select an image and a color. Let AI generate a new image with the selected color.',
    },
    {
      value: GEMINI_TASKS.ADD_TEXTURE.task_name,
      label: GEMINI_TASKS.ADD_TEXTURE.label_name,
      icon: '🧱',
      guestAllowed: false,
      description:
        'Select an image and a texture. Let AI generate a new image with the selected texture.',
    },
    {
      value: GEMINI_TASKS.ADD_HOME_ITEM.task_name,
      label: GEMINI_TASKS.ADD_HOME_ITEM.label_name,
      icon: '🛋️',
      guestAllowed: false,
      description:
        'Select an image and an object. Let AI generate a new image with the selected object.',
    },
    {
      value: GEMINI_TASKS.CUSTOM_PROMPT.task_name,
      label: GEMINI_TASKS.CUSTOM_PROMPT.label_name,
      icon: '💬',
      guestAllowed: false,
      description:
        'Select an image or any design material. Describe your idea by custom prompt. Let AI bring your unique vision to life.',
    },
  ];

  const handleTaskChange = (taskValue: GeminiTaskName) => (e: CheckboxChangeEvent) => {
    const isChecked = e.target.checked;
    let newSelectedTasks: GeminiTaskName[];

    if (multiSelect) {
      // Multi-select mode: add or remove from array
      if (isChecked) {
        // Add task if not already selected
        if (!selectedTaskNames.includes(taskValue)) {
          newSelectedTasks = [...selectedTaskNames, taskValue];
        } else {
          return; // Already selected
        }
      } else {
        // Remove task
        newSelectedTasks = selectedTaskNames.filter((name) => name !== taskValue);
      }
    } else {
      // Single-select mode: replace the array with only the selected task
      if (isChecked) {
        newSelectedTasks = [taskValue];
      } else {
        // If unchecking in single-select mode, clear selection
        newSelectedTasks = [];
      }
    }

    // Update Redux store
    dispatch(setSelectedTaskNames(newSelectedTasks));

    // Reset related state when tasks change
    resetRelatedState();

    // Call optional callback
    onTaskChange?.(newSelectedTasks);
  };

  return (
    <div className="space-y-2 px-6 pt-6">
      <Typography.Title level={5} className="!m-0 !mb-2">
        Design Goal
      </Typography.Title>

      <div className="flex flex-col justify-center gap-2 max-w-2xl mx-auto">
        {tasks.map((task) => {
          const isDisabled = isGuestMode && !task.guestAllowed;
          const isSelected = selectedTaskNames.includes(task.value as GeminiTaskName);

          const taskContent = (
            <div
              className={`
                relative flex items-center gap-2 px-4 py-1 rounded-xl border-2 transition-all duration-200
                ${isDisabled ? 'cursor-pointer opacity-60' : 'cursor-pointer'}
                ${
                  isSelected
                    ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-indigo-100 shadow-lg'
                    : isDisabled
                      ? 'border-gray-200 bg-gray-50'
                      : 'border-gray-200 bg-white hover:border-gray-200 hover:shadow-md'
                }
              `}
              onClick={() => {
                if (isDisabled) {
                  // Show login modal for disabled tasks
                  dispatch(setShowLoginRequiredModal(true));
                } else if (!isSelected) {
                  handleTaskChange(task.value as GeminiTaskName)({
                    target: { checked: true },
                  } as CheckboxChangeEvent);
                }
              }}
            >
              <Checkbox
                checked={isSelected}
                onChange={handleTaskChange(task.value as GeminiTaskName)}
                className="sr-only"
              />
              <div className="flex items-center gap-2 flex-1 justify-left pr-8">
                <span className="text-2xl">{task.icon}</span>
                <span
                  className={`font-medium ${
                    isSelected ? 'text-indigo-700' : isDisabled ? 'text-gray-400' : 'text-gray-700'
                  }`}
                >
                  {task.label}
                </span>
              </div>
              {isDisabled && (
                <LockOutlined className="text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>
          );

          return (
            <Tooltip
              key={task.value}
              title={task.description}
              placement="right"
              mouseEnterDelay={0.5}
            >
              {taskContent}
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

export default TaskSelect;
