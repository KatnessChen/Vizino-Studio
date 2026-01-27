import { useCallback } from 'react';

/**
 * Hook to manually trigger errors for testing error boundaries
 * Only use in development/testing scenarios
 */
export const useErrorHandler = () => {
  const throwError = useCallback((message: string = 'Manual error triggered') => {
    throw new Error(message);
  }, []);

  return { throwError };
};

/**
 * Hook to safely handle async errors and propagate them to error boundaries
 */
export const useAsyncErrorHandler = () => {
  const handleAsyncError = useCallback((error: unknown) => {
    // Re-throw the error so it can be caught by error boundary
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(String(error));
    }
  }, []);

  return { handleAsyncError };
};
