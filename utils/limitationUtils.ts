import { Project, Space, ImageData, Color, Texture, Item } from '@/types';
import {
  MAX_PROJECTS_PER_USER,
  MAX_SPACES_PER_PROJECT,
  MAX_IMAGES_PER_SPACE,
  MAX_OPERATIONS_PER_IMAGE,
} from '@/constants/constants';

/**
 * Checks if a user can add a new project and returns remaining quota.
 * Excludes soft-deleted projects.
 *
 * @param projects Array of user's projects
 * @param mockLimitReached If true, simulates limit reached scenario
 * @returns Object with canAdd boolean and remaining count
 */
export const checkProjectLimit = (
  projects: Project[],
  mockLimitReached: boolean = false
): { canAdd: boolean; remaining: number } => {
  if (mockLimitReached) {
    return {
      canAdd: false,
      remaining: 0,
    };
  }
  const activeProjects = projects.length; // All projects in Redux are active
  const remaining = MAX_PROJECTS_PER_USER - activeProjects;
  return {
    canAdd: remaining > 0,
    remaining: Math.max(0, remaining),
  };
};

/**
 * Checks if a user can add a new space to a project and returns remaining quota.
 * Excludes soft-deleted spaces.
 *
 * @param activeProject The current active project
 * @param mockLimitReached If true, simulates limit reached scenario
 * @returns Object with canAdd boolean and remaining count
 */
export const checkSpaceLimit = (
  activeProject: Project | null | undefined,
  mockLimitReached: boolean = false
): { canAdd: boolean; remaining: number } => {
  if (mockLimitReached) {
    return { canAdd: false, remaining: 0 };
  }
  if (!activeProject) {
    return { canAdd: false, remaining: 0 };
  }

  const activeSpaces = activeProject.spaces.length; // All spaces in Redux are active
  const remaining = MAX_SPACES_PER_PROJECT - activeSpaces;
  return {
    canAdd: remaining > 0,
    remaining: Math.max(0, remaining),
  };
};

/**
 * Checks if a user can add new images to a space and returns remaining quota.
 * Excludes soft-deleted images.
 *
 * @param space The space to check
 * @param mockLimitReached If true, simulates limit reached scenario
 * @returns Object with canAdd boolean, remaining count, and max count
 */
export const checkImageLimit = (
  space: Space | null,
  mockLimitReached: boolean = false
): { canAdd: boolean; remaining: number; max: number; current: number } => {
  if (mockLimitReached) {
    return {
      canAdd: false,
      remaining: 0,
      max: MAX_IMAGES_PER_SPACE,
      current: MAX_IMAGES_PER_SPACE,
    };
  }
  if (!space || !space.images) {
    return { canAdd: true, remaining: MAX_IMAGES_PER_SPACE, max: MAX_IMAGES_PER_SPACE, current: 0 };
  }

  // Count only non-deleted images
  const activeImages = space.images.filter((img) => !img.isDeleted).length;
  const remaining = MAX_IMAGES_PER_SPACE - activeImages;

  return {
    canAdd: remaining > 0,
    remaining: Math.max(0, remaining),
    max: MAX_IMAGES_PER_SPACE,
    current: activeImages,
  };
};

/**
 * Checks if an image or asset can have more operations added to its evolution chain.
 * Excludes soft-deleted images.
 *
 * @param source The source image or asset to check
 * @param mockLimitReached If true, simulates limit reached scenario
 * @returns Object with canAdd boolean, remaining count, and max count
 */
export const checkOperationLimit = (
  source: ImageData | Color | Texture | Item | null,
  mockLimitReached: boolean = false
): { canAdd: boolean; remaining: number; max: number; current: number } => {
  // If mock_limit_reached is true, simulate limit reached
  if (mockLimitReached) {
    return {
      canAdd: false,
      remaining: 0,
      max: MAX_OPERATIONS_PER_IMAGE,
      current: MAX_OPERATIONS_PER_IMAGE,
    };
  }

  if (!source) {
    return {
      canAdd: true,
      remaining: MAX_OPERATIONS_PER_IMAGE,
      max: MAX_OPERATIONS_PER_IMAGE,
      current: 0,
    };
  }

  const currentOps = source.evolutionChain ? source.evolutionChain.length : 0;
  const remaining = MAX_OPERATIONS_PER_IMAGE - currentOps;

  return {
    canAdd: remaining > 0,
    remaining: Math.max(0, remaining),
    max: MAX_OPERATIONS_PER_IMAGE,
    current: currentOps,
  };
};

/**
 * Formats a limit message showing current and remaining quota.
 *
 * @param name The name of the resource (e.g., "Projects", "Spaces")
 * @param current Current count
 * @param max Maximum count
 * @param remaining Remaining slots
 * @returns Formatted message string
 */
export const formatLimitMessage = (name: string, current: number, max: number): string => {
  const remaining = max - current;
  return `${current}/${max} ${name} (${remaining} remaining)`;
};

/**
 * Generates a user-friendly error message for limit exceeded scenarios.
 *
 * @param resourceType Type of resource (e.g., "projects", "spaces", "images", "operations")
 * @param limit The limit value
 * @returns Error message string
 */
export const getLimitExceededMessage = (
  resourceType: 'projects' | 'spaces' | 'images' | 'operations',
  limit: number
): string => {
  const messages: Record<string, string> = {
    projects: `You have reached the maximum of ${limit} projects.`,
    spaces: `You have reached the maximum of ${limit} spaces per project.`,
    images: `You have reached the maximum of ${limit} images in this space.`,
    operations: `This image has reached the maximum of ${limit} operations.`,
  };
  return messages[resourceType] || 'You have reached the limit for this resource.';
};
