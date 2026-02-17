/**
 * Development-only logger utility
 * 
 * All console calls in this module are automatically removed during production build
 * via tree-shaking and the DEV check below.
 * 
 * Usage:
 *   import { devLog, devWarn, devError } from '@/utils/devLogger';
 *   devLog('Debug message:', data);
 *   devWarn('Warning:', issue);
 *   devError('Error:', error);
 */

/**
 * Log message (dev only)
 * @param args - Arguments to log
 */
export const devLog = (...args: any[]): void => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

/**
 * Log warning (dev only)
 * @param args - Arguments to log
 */
export const devWarn = (...args: any[]): void => {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
};

/**
 * Log error (dev only)
 * @param args - Arguments to log
 */
export const devError = (...args: any[]): void => {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
};

/**
 * Log object (dev only, formats nicely)
 * @param label - Label for the object
 * @param obj - Object to log
 */
export const devLogObject = (label: string, obj: any): void => {
  if (import.meta.env.DEV) {
    console.log(label, JSON.stringify(obj, null, 2));
  }
};

/**
 * Log with context prefix
 * @param context - Context/module name (e.g., "[GenerateMoreModal]")
 * @param args - Arguments to log
 */
export const devLogContext = (context: string, ...args: any[]): void => {
  if (import.meta.env.DEV) {
    console.log(`${context}`, ...args);
  }
};
