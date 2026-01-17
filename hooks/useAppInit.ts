import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppDispatch } from '@/stores/store';
import {
  setProjects,
  setActiveProjectId,
  setActiveSpaceId,
  setSpaceImages,
  setIsAppInitiated,
  setInitError,
} from '@/stores/projectStore';
import { fetchProjects, fetchSpaceImages } from '@/services/firestoreService';
import { generateRoute } from '@/constants/routes';
import { extractShortId } from '@/utils/stringUtils';

/**
 * Custom hook to handle app initialization:
 * - Fetch user projects
 * - Auto-select project and space from URL slug-id params or default to first
 * - Fetch images for the selected space
 * - Updates isAppInitiated state in Redux store
 *
 * URL format: /project/{name-slug}-{shortId}/space/{name-slug}-{shortId}
 * The hook extracts the shortId from the slug-id and matches it with project/space IDs
 */
export const useAppInit = () => {
  const { user } = useAuth();
  const dispatch = useDispatch<AppDispatch>();
  const { projectSlugId, spaceSlugId } = useParams<{
    projectSlugId?: string;
    spaceSlugId?: string;
  }>();
  const navigate = useNavigate();

  // Track if initial load has been completed to prevent re-initialization
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!user) {
      dispatch(setProjects([]));
      dispatch(setActiveProjectId(null));
      dispatch(setActiveSpaceId(null));
      dispatch(setIsAppInitiated(false));
      hasInitialized.current = false;
      return;
    }

    // Only run initialization once when user is first logged in
    if (hasInitialized.current) {
      return;
    }

    const initializeApp = async () => {
      try {
        dispatch(setIsAppInitiated(false));
        dispatch(setInitError(null));

        // Fetch all projects for the user
        const projects = await fetchProjects(user.uid);
        dispatch(setProjects(projects));

        if (projects.length === 0) {
          dispatch(setIsAppInitiated(true));
          hasInitialized.current = true;
          return;
        }

        let selectedProject = null;
        let selectedSpace = null;

        // Extract short ID from URL slug-id and find matching project
        if (projectSlugId) {
          const shortId = extractShortId(projectSlugId);
          selectedProject = projects.find((p) => p.id.startsWith(shortId));
        }

        // If URL project doesn't exist or no URL param, use first project
        if (!selectedProject) {
          selectedProject = projects[0];
        }

        dispatch(setActiveProjectId(selectedProject.id));

        // Extract short ID from URL slug-id and find matching space
        if (spaceSlugId && selectedProject) {
          const shortId = extractShortId(spaceSlugId);
          selectedSpace = selectedProject.spaces.find((s) => s.id.startsWith(shortId));
        }

        // If URL space doesn't exist or no URL param, use first space
        if (!selectedSpace && selectedProject.spaces.length > 0) {
          selectedSpace = selectedProject.spaces[0];
        }

        if (selectedSpace) {
          dispatch(setActiveSpaceId(selectedSpace.id));

          // Fetch images for the selected space
          const images = await fetchSpaceImages(user.uid, selectedProject.id, selectedSpace.id);
          dispatch(
            setSpaceImages({
              projectId: selectedProject.id,
              spaceId: selectedSpace.id,
              images,
            })
          );

          // Update URL to correct slug-id format if needed
          const expectedUrl = generateRoute.space(
            selectedProject.name,
            selectedProject.id,
            selectedSpace.name,
            selectedSpace.id
          );
          if (window.location.pathname !== expectedUrl) {
            navigate(expectedUrl, { replace: true });
          }
        } else {
          // No spaces available, navigate to project route
          const expectedUrl = generateRoute.project(selectedProject.name, selectedProject.id);
          if (window.location.pathname !== expectedUrl) {
            navigate(expectedUrl, { replace: true });
          }
        }

        dispatch(setIsAppInitiated(true));
        hasInitialized.current = true;
      } catch (error) {
        console.error('Error initializing app:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize app';
        dispatch(setInitError(errorMessage));
        dispatch(setIsAppInitiated(true));
        hasInitialized.current = true;
      }
    };

    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, projectSlugId, spaceSlugId]);
};
