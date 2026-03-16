/**
 * Test for Replicate API error handling and fallback mechanisms
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { upscaleImage, UpscalingError } from '../upscalingService';

// Mock the analytics service
vi.mock('../../analyticsService', () => ({
  withTracking: vi.fn((name, fn) => fn()),
}));

// Mock dev logger
vi.mock('@/utils/devLogger', () => ({
  devLog: vi.fn(),
  devError: vi.fn(),
  devWarn: vi.fn(),
}));

describe('Replicate API Error Handling', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw UpscalingError with service unavailable flag when Cloud Function returns 500', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('Replicate API error: service unavailable'),
    });

    await expect(upscaleImage('base64data', 'image/jpeg', { scale: 2 })).rejects.toThrow(
      UpscalingError
    );

    try {
      await upscaleImage('base64data', 'image/jpeg', { scale: 2 });
    } catch (error) {
      expect(error).toBeInstanceOf(UpscalingError);
      expect((error as UpscalingError).isServiceUnavailable).toBe(true);
    }
  });

  it('should throw UpscalingError when Replicate API fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: false,
          error: 'Replicate API failed: timeout',
        }),
    });

    await expect(upscaleImage('base64data', 'image/jpeg', { scale: 2 })).rejects.toThrow(
      UpscalingError
    );

    try {
      await upscaleImage('base64data', 'image/jpeg', { scale: 2 });
    } catch (error) {
      expect(error).toBeInstanceOf(UpscalingError);
      expect((error as UpscalingError).isServiceUnavailable).toBe(true);
    }
  });

  it('should handle successful upscaling', async () => {
    const mockResult = {
      success: true,
      base64: 'upscaled-base64-data',
      mimeType: 'image/jpeg',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const result = await upscaleImage('base64data', 'image/jpeg', { scale: 2 });

    expect(result).toMatchObject({
      base64: 'upscaled-base64-data',
      mimeType: 'image/jpeg',
    });
  });

  it('should detect service issues from various error messages', async () => {
    const serviceErrorMessages = [
      'Replicate API error: model not found',
      'service unavailable',
      'timeout occurred',
      'prediction canceled',
    ];

    for (const errorMessage of serviceErrorMessages) {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve(errorMessage),
      });

      try {
        await upscaleImage('base64data', 'image/jpeg', { scale: 2 });
      } catch (error) {
        expect(error).toBeInstanceOf(UpscalingError);
        expect((error as UpscalingError).isServiceUnavailable).toBe(true);
      }
    }
  });
});
