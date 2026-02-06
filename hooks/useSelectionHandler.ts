import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import type { UnknownAction } from '@reduxjs/toolkit';

/**
 * Generic selection handler hook that provides unified selection logic
 * Supports both single-select (default) and multi-select (with Shift key or drag)
 */
interface UseSelectionHandlerSetOptions {
  // Current selection state
  currentSelection: Set<string>;
  // Redux action creator or setter to update selection; may return an action or void
  setSelection: (selection: Set<string>) => unknown;
  // Type of selection storage
  type: 'set';
}

interface UseSelectionHandlerArrayOptions<T> {
  // Current selection state
  currentSelection: T[];
  // Redux action creator or setter to update selection; may return an action or void
  setSelection: (selection: T[]) => unknown;
  // Type of selection storage
  type: 'array';
  // Filter function for array-based selections
  filterFn: (item: T) => boolean;
  // Find function to get item by id
  findItemById: (id: string) => T | undefined;
}

type UseSelectionHandlerOptions<T extends { id: string } = { id: string }> =
  | UseSelectionHandlerSetOptions
  | UseSelectionHandlerArrayOptions<T>;

export function useSelectionHandler<T extends { id: string } = { id: string }>(
  options: UseSelectionHandlerOptions<T>
) {
  const dispatch = useDispatch();

  const tryDispatch = useCallback(
    (maybeAction: unknown) => {
      if (
        maybeAction &&
        typeof maybeAction === 'object' &&
        'type' in (maybeAction as Record<string, unknown>)
      ) {
        dispatch(maybeAction as UnknownAction);
      }
    },
    [dispatch]
  );

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

        const maybeAction = options.setSelection(newSet);
        tryDispatch(maybeAction);
      } else {
        // Handle array-based selections (assets)
        const currentArray = options.currentSelection;
        const currentFiltered = currentArray.filter(options.filterFn);
        const isSelected = currentFiltered.some((item: T) => item.id === id);

        // If no event (drag selection) or Shift key pressed: multi-select toggle mode
        if (!event || event.shiftKey) {
          if (isSelected) {
            // Remove this item
            const maybeAction = options.setSelection(
              currentFiltered.filter((item: T) => item.id !== id)
            );
            tryDispatch(maybeAction);
          } else {
            // Add this item
            const newItem = options.findItemById(id);
            if (newItem) {
              const maybeAction = options.setSelection([...currentFiltered, newItem]);
              tryDispatch(maybeAction);
            }
          }
        } else {
          // Single-select mode
          if (isSelected && currentFiltered.length === 1) {
            // If clicking the only selected item, deselect it
            const maybeAction = options.setSelection([]);
            tryDispatch(maybeAction);
          } else {
            // Clear all and select only this one
            const newItem = options.findItemById(id);
            if (newItem) {
              const maybeAction = options.setSelection([newItem]);
              tryDispatch(maybeAction);
            }
          }
        }
      }
    },
    [options, tryDispatch]
  );

  return handleSelect;
}
