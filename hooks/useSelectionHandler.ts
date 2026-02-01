import { useCallback } from 'react';
import { useDispatch } from 'react-redux';

/**
 * Generic selection handler hook that provides unified selection logic
 * Supports both single-select (default) and multi-select (with Shift key or drag)
 */
interface UseSelectionHandlerSetOptions {
  // Current selection state
  currentSelection: Set<string>;
  // Redux action creator to update selection
  setSelection: (selection: Set<string>) => any;
  // Type of selection storage
  type: 'set';
}

interface UseSelectionHandlerArrayOptions<T> {
  // Current selection state
  currentSelection: T[];
  // Redux action creator to update selection
  setSelection: (selection: T[]) => any;
  // Type of selection storage
  type: 'array';
  // Filter function for array-based selections
  filterFn: (item: T) => boolean;
  // Find function to get item by id
  findItemById: (id: string) => T | undefined;
}

type UseSelectionHandlerOptions<T = any> =
  | UseSelectionHandlerSetOptions
  | UseSelectionHandlerArrayOptions<T>;

export function useSelectionHandler<T = any>(options: UseSelectionHandlerOptions<T>) {
  const dispatch = useDispatch();

  const handleSelect = useCallback(
    (id: string, event?: React.MouseEvent) => {
      if (options.type === 'set') {
        // Handle Set<string> based selections (images)
        const newSet = new Set(options.currentSelection);

        // If no event (drag selection) or Shift key pressed: multi-select toggle mode
        if (!event || event.shiftKey) {
          if (newSet.has(id)) {
            newSet.delete(id);
          } else {
            newSet.add(id);
          }
        } else {
          // Single-select mode: clear others and select only this one
          if (newSet.has(id) && newSet.size === 1) {
            // If clicking the only selected item, deselect it
            newSet.delete(id);
          } else {
            // Clear all and select only this one
            newSet.clear();
            newSet.add(id);
          }
        }

        dispatch(options.setSelection(newSet));
      } else {
        // Handle array-based selections (assets)
        const currentArray = options.currentSelection;
        const currentFiltered = currentArray.filter(options.filterFn);
        const isSelected = currentFiltered.some((item: any) => item.id === id);

        // If no event (drag selection) or Shift key pressed: multi-select toggle mode
        if (!event || event.shiftKey) {
          if (isSelected) {
            // Remove this item
            dispatch(options.setSelection(currentFiltered.filter((item: any) => item.id !== id)));
          } else {
            // Add this item
            const newItem = options.findItemById(id);
            if (newItem) {
              dispatch(options.setSelection([...currentFiltered, newItem]));
            }
          }
        } else {
          // Single-select mode
          if (isSelected && currentFiltered.length === 1) {
            // If clicking the only selected item, deselect it
            dispatch(options.setSelection([]));
          } else {
            // Clear all and select only this one
            const newItem = options.findItemById(id);
            if (newItem) {
              dispatch(options.setSelection([newItem]));
            }
          }
        }
      }
    },
    [options, dispatch]
  );

  return handleSelect;
}
