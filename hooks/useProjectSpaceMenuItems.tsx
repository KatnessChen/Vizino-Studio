import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { MenuProps } from 'antd';
import { Space, Tooltip } from 'antd';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { Project } from '@/types';
import {
  checkProjectLimit,
  checkSpaceLimit,
  formatLimitMessage,
  getLimitExceededMessage,
} from '@/utils/limitationUtils';
import type { AdminSettings } from '@/utils/storageUtils';
import { selectActiveSpaceId } from '@/stores/projectStore';

interface UseProjectSpaceMenuItemsProps {
  projects: Project[];
  activeProject: Project | null;
  activeProjectId: string | null;
  adminSettings: AdminSettings;
  isMenuItemEditable?: boolean;
  isDisableCurrentProject?: boolean;
  isDisableCurrentSpace?: boolean;
  onSelectProject?: (projectId: string) => void;
  onSelectSpace?: (spaceId: string) => void;
  onDeleteProject?: (projectId: string, projectName: string) => void;
  onDeleteSpace?: (projectId: string, spaceId: string, spaceName: string) => void;
  onEditProject?: (projectId: string, projectName: string) => void;
  onEditSpace?: (projectId: string, spaceId: string, spaceName: string) => void;
  onAddProject?: () => void;
  onAddSpace?: () => void;
}

interface MenuItemsResult {
  projectMenuItems: MenuProps['items'];
  spaceMenuItems: MenuProps['items'];
  projectLimitCheck: ReturnType<typeof checkProjectLimit>;
  spaceLimitCheck: ReturnType<typeof checkSpaceLimit>;
}

export const useProjectSpaceMenuItems = ({
  projects,
  activeProject,
  activeProjectId,
  adminSettings,
  isMenuItemEditable = false,
  isDisableCurrentProject = true,
  isDisableCurrentSpace = true,
  onSelectProject,
  onSelectSpace,
  onDeleteProject,
  onDeleteSpace,
  onEditProject,
  onEditSpace,
  onAddProject,
  onAddSpace,
}: UseProjectSpaceMenuItemsProps): MenuItemsResult => {
  const activeSpaceId = useSelector(selectActiveSpaceId);
  const projectLimitCheck = useMemo(
    () => checkProjectLimit(projects, adminSettings.mock_limit_reached),
    [projects, adminSettings.mock_limit_reached]
  );

  const spaceLimitCheck = useMemo(
    () => checkSpaceLimit(activeProject, adminSettings.mock_limit_reached),
    [activeProject, adminSettings.mock_limit_reached]
  );

  const projectMenuItems: MenuProps['items'] = useMemo(() => {
    const projectItems = projects.map((project) => {
      const isCurrentProject = isDisableCurrentProject && project.id === activeProjectId;
      return {
        key: project.id,
        label: (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              minWidth: 200,
            }}
          >
            <span>
              {project.name}
              {isCurrentProject ? ' (Current)' : ''}
            </span>
            {isMenuItemEditable && (
              <Space size={4} onClick={(e) => e.stopPropagation()}>
                <Tooltip title="Edit Project Name">
                  <EditIcon
                    style={{ fontSize: 14, cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditProject?.(project.id, project.name);
                    }}
                  />
                </Tooltip>
                <Tooltip
                  title={
                    project.spaces.length > 0
                      ? 'Cannot delete project with spaces.'
                      : 'Delete Project'
                  }
                >
                  <DeleteIcon
                    style={{
                      fontSize: 14,
                      cursor: project.spaces.length > 0 ? 'not-allowed' : 'pointer',
                      opacity: project.spaces.length > 0 ? 0.4 : 1,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (project.spaces.length === 0) {
                        onDeleteProject?.(project.id, project.name);
                      }
                    }}
                  />
                </Tooltip>
              </Space>
            )}
          </div>
        ),
        onClick: isCurrentProject ? undefined : () => onSelectProject?.(project.id),
        disabled: isCurrentProject,
      };
    });

    const addProjectItem = {
      key: 'add-project',
      label: (
        <Tooltip title={projectLimitCheck.canAdd ? '' : getLimitExceededMessage('projects', 10)}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: projectLimitCheck.canAdd ? 1 : 0.5,
            }}
          >
            <AddIcon style={{ fontSize: 16 }} />
            <span>Add New Project</span>
            <span style={{ fontSize: 12, color: '#999', marginLeft: 4 }}>
              {formatLimitMessage('Projects', projects.length, 10)}
            </span>
          </div>
        </Tooltip>
      ),
      onClick: () => onAddProject?.(),
      disabled: !projectLimitCheck.canAdd,
    };

    return projectItems.length > 0
      ? [...projectItems, { type: 'divider' }, addProjectItem]
      : [addProjectItem];
  }, [
    projects,
    projectLimitCheck,
    isMenuItemEditable,
    isDisableCurrentProject,
    activeProjectId,
    onSelectProject,
    onDeleteProject,
    onEditProject,
    onAddProject,
  ]);

  const spaceMenuItems: MenuProps['items'] = useMemo(() => {
    if (!activeProject) return [];

    const spaceItems = activeProject.spaces.map((space) => {
      const isCurrentSpace = isDisableCurrentSpace && space.id === activeSpaceId;
      return {
        key: space.id,
        label: (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              minWidth: 200,
            }}
          >
            <span>
              {space.name}
              {isCurrentSpace ? ' (Current)' : ''}
            </span>
            {isMenuItemEditable && (
              <Space size={4} onClick={(e) => e.stopPropagation()}>
                <Tooltip title="Edit Space Name">
                  <EditIcon
                    style={{ fontSize: 14, cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!activeProject) return;
                      onEditSpace?.(activeProject.id, space.id, space.name);
                    }}
                  />
                </Tooltip>
                <Tooltip title="Delete Space">
                  <DeleteIcon
                    style={{ fontSize: 14, cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!activeProject) return;
                      onDeleteSpace?.(activeProject.id, space.id, space.name);
                    }}
                  />
                </Tooltip>
              </Space>
            )}
          </div>
        ),
        onClick: isCurrentSpace ? undefined : () => onSelectSpace?.(space.id),
        disabled: isCurrentSpace,
      };
    });

    const addSpaceItem = {
      key: 'add-space',
      label: (
        <Tooltip title={spaceLimitCheck.canAdd ? '' : getLimitExceededMessage('spaces', 10)}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: spaceLimitCheck.canAdd ? 1 : 0.5,
            }}
          >
            <AddIcon style={{ fontSize: 16 }} />
            <span>Add New Space</span>
            <span style={{ fontSize: 12, color: '#999', marginLeft: 4 }}>
              {activeProject ? formatLimitMessage('Spaces', activeProject.spaces.length, 10) : ''}
            </span>
          </div>
        </Tooltip>
      ),
      onClick: () => onAddSpace?.(),
      disabled: !activeProjectId || !spaceLimitCheck.canAdd,
    };

    return spaceItems.length > 0
      ? [...spaceItems, { type: 'divider' }, addSpaceItem]
      : [addSpaceItem];
  }, [
    activeProject,
    spaceLimitCheck,
    activeProjectId,
    isMenuItemEditable,
    activeSpaceId,
    isDisableCurrentSpace,
    onSelectSpace,
    onDeleteSpace,
    onEditSpace,
    onAddSpace,
  ]);

  return {
    projectMenuItems,
    spaceMenuItems,
    projectLimitCheck,
    spaceLimitCheck,
  };
};
