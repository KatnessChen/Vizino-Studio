import React, { useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Checkbox, Typography } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { GEMINI_TASKS, GeminiTaskName } from '@/services/gemini/geminiTasks';
import { selectSelectedTaskNames, setSelectedTaskNames } from '@/stores/taskStore';

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

  useEffect(() => {
    dispatch(setSelectedTaskNames([GEMINI_TASKS.RECOLOR_WALL.task_name]));
  }, [dispatch]);

  // Reset related state when tasks change
  const resetRelatedState = useCallback(() => {
    onModalStateChange?.(false); // Close any open confirmation modal
    onError?.(null); // Clear any error messages
  }, [onModalStateChange, onError]);

  const tasks = [
    {
      value: GEMINI_TASKS.RECOLOR_WALL.task_name,
      label: GEMINI_TASKS.RECOLOR_WALL.label_name,
      icon: '🎨',
    },
    {
      value: GEMINI_TASKS.ADD_TEXTURE.task_name,
      label: GEMINI_TASKS.ADD_TEXTURE.label_name,
      icon: '🧱',
    },
    {
      value: GEMINI_TASKS.ADD_HOME_ITEM.task_name,
      label: GEMINI_TASKS.ADD_HOME_ITEM.label_name,
      icon: '🛋️',
    },
    {
      value: GEMINI_TASKS.CUSTOM_PROMPT.task_name,
      label: GEMINI_TASKS.CUSTOM_PROMPT.label_name,
      icon: '💬',
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
      <Typography.Title level={5} style={{ margin: 0, marginBottom: '8px' }}>
        Design Goal
      </Typography.Title>

      <div className="flex flex-col justify-center gap-2 max-w-2xl mx-auto">
        {tasks.map((task) => (
          <div
            key={task.value}
            className={`
              relative flex items-center gap-3 px-4 py-2 rounded-xl border-2 transition-all duration-200 cursor-pointer
              ${
                selectedTaskNames.includes(task.value as GeminiTaskName)
                  ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg'
                  : 'border-gray-200 bg-white hover:border-gray-200 hover:shadow-md'
              }
            `}
            onClick={() =>
              handleTaskChange(task.value as GeminiTaskName)({
                target: { checked: !selectedTaskNames.includes(task.value as GeminiTaskName) },
              } as CheckboxChangeEvent)
            }
          >
            <Checkbox
              checked={selectedTaskNames.includes(task.value as GeminiTaskName)}
              onChange={handleTaskChange(task.value as GeminiTaskName)}
              className="pointer-events-none"
            />
            <div className="flex items-center gap-2 flex-1">
              <span className="text-2xl">{task.icon}</span>
              <span
                className={`font-medium ${
                  selectedTaskNames.includes(task.value as GeminiTaskName)
                    ? 'text-blue-700'
                    : 'text-gray-700'
                }`}
              >
                {task.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskSelect;
