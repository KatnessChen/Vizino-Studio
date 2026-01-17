import { createSlugId } from '@/utils/stringUtils';

/**
 * Application route constants
 */
export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  ADMIN_SETTING: '/admin-setting',
  PROJECT: '/project/:projectSlugId',
  SPACE: '/project/:projectSlugId/space/:spaceSlugId',
} as const;

/**
 * Helper functions to generate routes with slug-id parameters
 *
 * Generates URLs in the format:
 * - /project/{name-slug}-{shortId}
 * - /project/{project-slug}-{shortId}/space/{space-slug}-{shortId}
 *
 * Examples:
 * - generateRoute.project("My Kitchen", "abc123def456")
 *   → "/project/my-kitchen-abc123de"
 * - generateRoute.space("我的項目", "abc123", "客廳", "xyz789")
 *   → "/project/abc123/space/xyz789" (Chinese removed from slug)
 */
export const generateRoute = {
  project: (projectName: string, projectId: string) =>
    `/project/${createSlugId(projectName, projectId)}`,

  space: (projectName: string, projectId: string, spaceName: string, spaceId: string) =>
    `/project/${createSlugId(projectName, projectId)}/space/${createSlugId(spaceName, spaceId)}`,
} as const;
