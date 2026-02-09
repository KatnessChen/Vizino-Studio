import posthog from 'posthog-js';

/**
 * Analytics Service using PostHog
 * Provides initialization and tracking utilities
 */

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

export const initPostHog = () => {
  if (!POSTHOG_KEY) {
    console.warn('PostHog API Key not found. Analytics will be disabled.');
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_performance: true, // Tracks page load speed, etc.
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: {
        password: true, // Always mask passwords
      },
      // TODO: Gate `captureNetworkPayloads` behind an environment flag (e.g. VITE_CAPTURE_NETWORK_PAYLOADS)
      // and add masking of sensitive fields before enabling in production. For now it is enabled.
      captureNetworkPayloads: true,
    },

    autocapture: true, // Autocapture clicks, pageviews, etc.
    capture_exceptions: true, // Automatically capture unhandled exceptions
    persistence: 'localStorage', // Persist user identity across sessions
  });

  console.log('[Analytics] PostHog initialized');
};

/**
 * Identify user when they log in
 */
export const identifyUser = (userId: string, properties?: Record<string, unknown>) => {
  if (posthog.get_distinct_id() !== userId) {
    posthog.identify(userId, properties);
  }
};

/**
 * Reset identity on logout
 */
export const resetAnalytics = () => {
  posthog.reset();
};

/**
 * Scheme C: Wrapper for tracking specific tasks with success/fail metrics
 */
export async function withTracking<T>(
  taskName: string,
  fn: () => Promise<T>,
  properties?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    posthog.capture(`${taskName}_success`, {
      duration_ms: duration,
      ...properties,
    });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    posthog.capture(`${taskName}_failed`, {
      error: error instanceof Error ? error.message : String(error),
      duration_ms: duration,
      ...properties,
    });
    throw error;
  }
}

/**
 * Capture a custom event
 */
export const trackEvent = (eventName: string, properties?: Record<string, unknown>) => {
  posthog.capture(eventName, properties);
};

export default posthog;
