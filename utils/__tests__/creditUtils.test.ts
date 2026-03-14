import { describe, it, expect } from 'vitest';
import {
  calculateTotalCredits,
  getCreditCost,
  getUsagePercentage,
  hasExceededLimit,
  getRemainingCredits,
} from '../creditUtils';

describe('creditUtils', () => {
  describe('calculateTotalCredits', () => {
    it('should return 0 for undefined usage', () => {
      expect(calculateTotalCredits(undefined)).toBe(0);
    });

    it('should return 0 for empty usage object', () => {
      expect(calculateTotalCredits({})).toBe(0);
    });

    it('should calculate credits with standard multipliers', () => {
      const usage = {
        recolor_wall: { onVPoints: 10, onOwnKey: 0 },
        add_texture: { onVPoints: 5, onOwnKey: 0 },
        custom_prompt: { onVPoints: 3, onOwnKey: 0 },
      };
      // 10*1 + 5*1 + 3*1 = 18
      expect(calculateTotalCredits(usage)).toBe(18);
    });

    it('should apply 3x multiplier for thinking_mode', () => {
      const usage = {
        recolor_wall: { onVPoints: 10, onOwnKey: 0 },
        thinking_mode: { onVPoints: 3, onOwnKey: 0 },
      };
      // 10*1 + 3*3 = 19
      expect(calculateTotalCredits(usage)).toBe(19);
    });

    it('should apply 4x multiplier for optimize_prompt', () => {
      const usage = {
        custom_prompt: { onVPoints: 5, onOwnKey: 0 },
        optimize_prompt: { onVPoints: 4, onOwnKey: 0 },
      };
      // 5*1 + 4*4 = 21
      expect(calculateTotalCredits(usage)).toBe(21);
    });

    it('should handle the example from requirements', () => {
      const usage = {
        add_home_item: { onVPoints: 40, onOwnKey: 0 },
        add_texture: { onVPoints: 34, onOwnKey: 0 },
        brighten_space: { onVPoints: 1, onOwnKey: 0 },
        custom_prompt: { onVPoints: 103, onOwnKey: 0 },
        optimize_prompt: { onVPoints: 4, onOwnKey: 0 },
        recolor_wall: { onVPoints: 65, onOwnKey: 0 },
        remove_clutter: { onVPoints: 9, onOwnKey: 0 },
        thinking_mode: { onVPoints: 3, onOwnKey: 0 },
      };
      // Standard: 40 + 34 + 1 + 103 + 65 + 9 = 252
      // High cost: 4*4 + 3*3 = 16 + 9 = 25
      // Total: 252 + 25 = 277
      expect(calculateTotalCredits(usage)).toBe(277);
    });
  });

  describe('getCreditCost', () => {
    it('should return 1 for null task', () => {
      expect(getCreditCost(null)).toBe(1);
    });

    it('should return 1 for standard tasks', () => {
      expect(getCreditCost('recolor_wall')).toBe(1);
      expect(getCreditCost('add_texture')).toBe(1);
      expect(getCreditCost('custom_prompt')).toBe(1);
    });

    it('should return 4 for optimize_prompt', () => {
      expect(getCreditCost('optimize_prompt')).toBe(4);
    });

    it('should add thinking mode cost when enabled', () => {
      // Standard task (1) + thinking_mode (3) = 4
      expect(getCreditCost('recolor_wall', true)).toBe(4);
    });

    it('should not double count thinking_mode cost', () => {
      // thinking_mode already costs 3, don't add extra
      expect(getCreditCost('thinking_mode', true)).toBe(3);
    });
  });

  describe('getUsagePercentage', () => {
    it('should return 0 for undefined usage', () => {
      expect(getUsagePercentage(undefined)).toBe(0);
    });

    it('should calculate correct percentage', () => {
      const usage = { recolor_wall: { onVPoints: 50, onOwnKey: 0 } };
      expect(getUsagePercentage(usage, 100)).toBe(50);
    });

    it('should handle exceeding limit', () => {
      const usage = { recolor_wall: { onVPoints: 150, onOwnKey: 0 } };
      expect(getUsagePercentage(usage, 100)).toBe(150);
    });
  });

  describe('hasExceededLimit', () => {
    it('should return false for undefined usage', () => {
      expect(hasExceededLimit(undefined)).toBe(false);
    });

    it('should return false when under limit', () => {
      const usage = { recolor_wall: { onVPoints: 50, onOwnKey: 0 } };
      expect(hasExceededLimit(usage, 100)).toBe(false);
    });

    it('should return true when at limit', () => {
      const usage = { recolor_wall: { onVPoints: 100, onOwnKey: 0 } };
      expect(hasExceededLimit(usage, 100)).toBe(true);
    });

    it('should return true when over limit', () => {
      const usage = { recolor_wall: { onVPoints: 150, onOwnKey: 0 } };
      expect(hasExceededLimit(usage, 100)).toBe(true);
    });
  });

  describe('getRemainingCredits', () => {
    it('should return full limit for undefined usage', () => {
      expect(getRemainingCredits(undefined, 100)).toBe(100);
    });

    it('should calculate remaining correctly', () => {
      const usage = { recolor_wall: { onVPoints: 30, onOwnKey: 0 } };
      expect(getRemainingCredits(usage, 100)).toBe(70);
    });

    it('should return negative when over limit', () => {
      const usage = { recolor_wall: { onVPoints: 120, onOwnKey: 0 } };
      expect(getRemainingCredits(usage, 100)).toBe(-20);
    });
  });
});
