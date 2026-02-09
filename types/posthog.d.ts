// Type augmentation for posthog-js to support `captureNetworkPayloads` in session_recording
// This keeps our code type-safe even if the installed posthog-js version does not include
// this property in its public types.

import 'posthog-js';

declare module 'posthog-js' {
  // Extend the SessionRecordingOptions interface to include captureNetworkPayloads
  interface SessionRecordingOptions {
    /**
     * Whether to capture network request/response payloads during session recording.
     * WARNING: May include sensitive information. Ensure masking/compliance and gate via env config.
     */
    captureNetworkPayloads?: boolean;
  }
}
