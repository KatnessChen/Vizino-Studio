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
        recolor_wall: 10,
        add_texture: 5,
        custom_prompt: 3,
      };
      // 10*1 + 5*1 + 3*1 = 18
      expect(calculateTotalCredits(usage)).toBe(18);
    });

    it('should apply 4x multiplier for thinking_mode', () => {
      const usage = {
        recolor_wall: 10,
        thinking_mode: 3,
      };
      // 10*1 + 3*4 = 22
      expect(calculateTotalCredits(usage)).toBe(22);
    });

    it('should apply 4x multiplier for optimize_prompt', () => {
      const usage = {
        custom_prompt: 5,
        optimize_prompt: 4,
      };
      // 5*1 + 4*4 = 21
      expect(calculateTotalCredits(usage)).toBe(21);
    });

    it('should handle the example from requirements', () => {
      const usage = {
        add_home_item: 40,
        add_texture: 34,
        brighten_space: 1,
        custom_prompt: 103,
        optimize_prompt: 4,
        recolor_wall: 65,
        remove_clutter: 9,
        thinking_mode: 3,
      };
      // Standard: 40 + 34 + 1 + 103 + 65 + 9 = 252
      // High cost: 4*4 + 3*4 = 16 + 12 = 28
      // Total: 252 + 28 = 280
      expect(calculateTotalCredits(usage)).toBe(280);
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
      // Standard task (1) + thinking_mode (4) = 5
      expect(getCreditCost('recolor_wall', true)).toBe(5);
    });

    it('should not double count thinking_mode cost', () => {
      // thinking_mode already costs 4, don't add extra
      expect(getCreditCost('thinking_mode', true)).toBe(4);
    });
  });

  describe('getUsagePercentage', () => {
    it('should return 0 for undefined usage', () => {
      expect(getUsagePercentage(undefined)).toBe(0);
    });

    it('should calculate correct percentage', () => {
      const usage = { recolor_wall: 50 };
      expect(getUsagePercentage(usage, 100)).toBe(50);
    });

    it('should handle exceeding limit', () => {
      const usage = { recolor_wall: 150 };
      expect(getUsagePercentage(usage, 100)).toBe(150);
    });
  });

  describe('hasExceededLimit', () => {
    it('should return false for undefined usage', () => {
      expect(hasExceededLimit(undefined)).toBe(false);
    });

    it('should return false when under limit', () => {
      const usage = { recolor_wall: 50 };
      expect(hasExceededLimit(usage, 100)).toBe(false);
    });

    it('should return true when at limit', () => {
      const usage = { recolor_wall: 100 };
      expect(hasExceededLimit(usage, 100)).toBe(true);
    });

    it('should return true when over limit', () => {
      const usage = { recolor_wall: 150 };
      expect(hasExceededLimit(usage, 100)).toBe(true);
    });
  });

  describe('getRemainingCredits', () => {
    it('should return full limit for undefined usage', () => {
      expect(getRemainingCredits(undefined, 100)).toBe(100);
    });

    it('should calculate remaining correctly', () => {
      const usage = { recolor_wall: 30 };
      expect(getRemainingCredits(usage, 100)).toBe(70);
    });

    it('should return negative when over limit', () => {
      const usage = { recolor_wall: 120 };
      expect(getRemainingCredits(usage, 100)).toBe(-20);
    });
  });
});
