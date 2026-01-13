import { createSlug, createShortId, createSlugId, extractShortId } from '../stringUtils';

describe('stringUtils - Slug Functions', () => {
  describe('createSlug', () => {
    it('should convert English text to slug', () => {
      expect(createSlug('My Kitchen Project')).toBe('my-kitchen-project');
      expect(createSlug('Living Room')).toBe('living-room');
    });

    it('should convert French accented characters to English', () => {
      expect(createSlug('Café Résumé')).toBe('cafe-resume');
      expect(createSlug('Façade Naïve')).toBe('facade-naive');
    });

    it('should remove Chinese characters completely', () => {
      expect(createSlug('我的項目')).toBe('');
      expect(createSlug('My 廚房 Kitchen')).toBe('my-kitchen');
      expect(createSlug('項目 Project 001')).toBe('project-001');
    });

    it('should handle mixed languages', () => {
      expect(createSlug('Café 咖啡廳 Room')).toBe('cafe-room');
      expect(createSlug('Résumé 簡歷 2024')).toBe('resume-2024');
    });

    it('should handle special characters', () => {
      expect(createSlug('Project @#$% 123')).toBe('project-123');
      expect(createSlug('Room___Test')).toBe('room-test');
      expect(createSlug('My--Project')).toBe('my-project');
    });

    it('should limit length', () => {
      const longText = 'a'.repeat(100);
      expect(createSlug(longText).length).toBeLessThanOrEqual(50);
      expect(createSlug(longText, 20).length).toBeLessThanOrEqual(20);
    });

    it('should trim leading/trailing hyphens', () => {
      expect(createSlug('---test---')).toBe('test');
      expect(createSlug('   project   ')).toBe('project');
    });
  });

  describe('createShortId', () => {
    it('should return first 8 characters', () => {
      expect(createShortId('abc123def456ghi789')).toBe('abc123de');
      expect(createShortId('xyz789')).toBe('xyz789');
    });
  });

  describe('createSlugId', () => {
    it('should combine slug and shortId for English names', () => {
      expect(createSlugId('My Kitchen', 'abc123def456')).toBe('my-kitchen-abc123de');
      expect(createSlugId('Living Room', 'xyz789abc123')).toBe('living-room-xyz789ab');
    });

    it('should combine slug and shortId for French names', () => {
      expect(createSlugId('Café Résumé', 'abc123def456')).toBe('cafe-resume-abc123de');
    });

    it('should only use shortId when Chinese characters result in empty slug', () => {
      expect(createSlugId('我的項目', 'abc123def456')).toBe('abc123de');
      expect(createSlugId('客廳', 'xyz789abc123')).toBe('xyz789ab');
    });

    it('should handle mixed language names', () => {
      expect(createSlugId('My 廚房 Kitchen', 'abc123def456')).toBe('my-kitchen-abc123de');
      expect(createSlugId('項目 Project', 'xyz789abc123')).toBe('project-xyz789ab');
    });
  });

  describe('extractShortId', () => {
    it('should extract shortId from slug-id format', () => {
      expect(extractShortId('my-kitchen-project-abc123de')).toBe('abc123de');
      expect(extractShortId('living-room-xyz789ab')).toBe('xyz789ab');
    });

    it('should extract shortId from shortId-only format', () => {
      expect(extractShortId('abc123de')).toBe('abc123de');
      expect(extractShortId('xyz789ab')).toBe('xyz789ab');
    });

    it('should handle multi-hyphen slugs correctly', () => {
      expect(extractShortId('my-very-long-project-name-abc123de')).toBe('abc123de');
      expect(extractShortId('cafe-resume-xyz789ab')).toBe('xyz789ab');
    });
  });
});
