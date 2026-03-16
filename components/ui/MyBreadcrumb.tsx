import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Typography, Breadcrumb, Dropdown, Button, Modal, Alert, Input, Flex, Skeleton } from 'antd';
import { 
  PlusOutlined, 
  DownOutlined, 
  ThunderboltOutlined,
  HomeOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { devError } from '@/utils/devLogger';
import GenericConfirmModal from '../modal/GenericConfirmModal';
import { useAuth } from '@/contexts/AuthContext';
import { useGuest } from '@/contexts/GuestContext';
import { useProjectSpaceMenuItems } from '@/hooks/useProjectSpaceMenuItems';
import {
  checkProjectLimit,
  checkSpaceLimit,
  getLimitExceededMessage,
} from '@/utils/limitationUtils';
import { AppDispatch } from '@/stores/store';
import {
  addProject,
  updateProject as updateProjectAction,
  removeProject,
  addSpace,
  setSpaceImages,
  updateSpace as updateSpaceAction,
  removeSpace,
  setActiveProjectId,
  setActiveSpaceId,
  selectProjects,
  selectActiveProjectId,
  selectActiveSpaceId,
  selectIsAppInitiated,
  selectActiveProject,
} from '@/stores/projectStore';
import { resetTaskState } from '@/stores/taskStore';
import {
  createProject,
  updateProject,
  deleteProject,
  createSpace,
  updateSpace,
  deleteSpace,
  fetchSpaceImages,
  fetchColors,
  fetchTextures,
} from '@/services/firestoreService';
import {
  setCustomColors,
  setCustomTextures,
  setLoadingColors,
  setLoadingTextures,
  setLoadColorsError,
  setLoadTexturesError,
} from '@/stores/customAssetsStore';
import { setSelectedAssets } from '@/stores/taskStore';
import { setSelectedOriginalImageIds, setSelectedUpdatedImageIds } from '@/stores/imageStore';
import { selectHasGeneratedImage } from '@/stores/guestStore';
import { generateRoute } from '@/constants/routes';

export const ModalMode = {
  ADD_PROJECT: 'add-project',
  ADD_SPACE: 'add-space',
  EDIT_PROJECT: 'edit-project',
  EDIT_SPACE: 'edit-space',
} as const;

export type ModalMode = (typeof ModalMode)[keyof typeof ModalMode];

interface BreadcrumbProps {
  onProjectSelected?: (projectId: string) => void;
  onSpaceSelected?: (projectId: string, spaceId: string) => void;
  onStartTour?: () => void;
}

const MyBreadcrumb: React.FC<BreadcrumbProps> = ({
  onProjectSelected,
  onSpaceSelected,
  onStartTour,
}) => {
  const { user, adminSettings } = useAuth();
  const { isGuestMode } = useGuest();
  const hasGeneratedImage = useSelector(selectHasGeneratedImage);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const projects = useSelector(selectProjects);
  const activeProjectId = useSelector(selectActiveProjectId);
  const activeProject = useSelector(selectActiveProject);
  const activeSpaceId = useSelector(selectActiveSpaceId);
  const isAppInitiated = useSelector(selectIsAppInitiated);

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [modalInput, setModalInput] = useState<string>('');
  const [modalProcessing, setModalProcessing] = useState<boolean>(false);
  const [editingEntityIds, setEditingEntityIds] = useState<{
    projectId: string | null;
    spaceId: string | null;
  }>({ projectId: null, spaceId: null });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [limitWarning, setLimitWarning] = useState<{
    type: 'project' | 'space';
    message: string;
  } | null>(null);

  useEffect(() => {
    const autoFetchSpaceImages = async () => {
      if (user && activeProjectId && activeSpaceId) {
        const images = await fetchSpaceImages(user.uid, activeProjectId, activeSpaceId);
        dispatch(setSpaceImages({ projectId: activeProjectId, spaceId: activeSpaceId, images }));
      }
    };
    autoFetchSpaceImages();
  }, [activeProjectId, activeSpaceId, user, dispatch]);

  useEffect(() => {
    // Reset image selections when space changes
    dispatch(setSelectedOriginalImageIds(new Set()));
    dispatch(setSelectedUpdatedImageIds(new Set()));
  }, [activeSpaceId, dispatch]);
  const handleSelectProject = useCallback(
    (projectId: string) => {
      if (!user || activeProjectId === projectId) return;

      dispatch(setActiveProjectId(projectId));

      const selectedProject = projects.find((p) => p.id === projectId);
      const firstSpace = selectedProject?.spaces?.[0];
      dispatch(setActiveSpaceId(firstSpace ? firstSpace.id : null));
      onProjectSelected?.(projectId);

      dispatch(setSelectedAssets([]));

      // Reset task-related state when switching projects
      dispatch(resetTaskState());

      // Navigate to the new project/space URL
      if (selectedProject && firstSpace) {
        navigate(
          generateRoute.space(selectedProject.name, projectId, firstSpace.name, firstSpace.id)
        );
      } else if (selectedProject) {
        navigate(generateRoute.project(selectedProject.name, projectId));
      }

      // Fetch custom assets for new project
      const loadCustomAssets = async () => {
        try {
          dispatch(setLoadingColors({ projectId, isLoadingColors: true }));
          dispatch(setLoadingTextures({ projectId, isLoadingTextures: true }));

          const [colors, textures] = await Promise.all([
            fetchColors(user.uid, projectId),
            fetchTextures(user.uid, projectId),
          ]);

          dispatch(setCustomColors({ projectId, colors }));
          dispatch(setCustomTextures({ projectId, textures }));
        } catch (error) {
          devError('Failed to load custom assets:', error);
          dispatch(
            setLoadColorsError({
              projectId,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          );
          dispatch(
            setLoadTexturesError({
              projectId,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          );
        }
      };

      loadCustomAssets();
    },
    [user, dispatch, projects, activeProjectId, onProjectSelected, navigate]
  );

  const handleSelectSpace = useCallback(
    (spaceId: string) => {
      if (!user || !activeProjectId || activeSpaceId === spaceId) return;
      dispatch(setActiveSpaceId(spaceId));
      onSpaceSelected?.(activeProjectId, spaceId);

      // Navigate to the new space URL
      const project = projects.find((p) => p.id === activeProjectId);
      const space = project?.spaces.find((s) => s.id === spaceId);
      if (project && space) {
        navigate(generateRoute.space(project.name, activeProjectId, space.name, spaceId));
      }
    },
    [user, activeProjectId, activeSpaceId, dispatch, onSpaceSelected, navigate, projects]
  );

  const handleDeleteProject = useCallback(
    (projectId: string, projectName: string) => {
      setConfirmModal({
        isOpen: true,
        title: 'Delete Project',
        message: `Are you sure you want to delete "${projectName}"? This action cannot be undone.`,
        onConfirm: async () => {
          if (!user) return;
          try {
            await deleteProject(user.uid, projectId);
            dispatch(removeProject(projectId));

            // Navigate to home or first available project after deletion
            const remainingProjects = projects.filter((p) => p.id !== projectId);
            if (remainingProjects.length > 0) {
              const firstProject = remainingProjects[0];
              const firstSpace = firstProject.spaces[0];
              if (firstSpace) {
                navigate(
                  generateRoute.space(
                    firstProject.name,
                    firstProject.id,
                    firstSpace.name,
                    firstSpace.id
                  )
                );
              } else {
                navigate(generateRoute.project(firstProject.name, firstProject.id));
              }
            } else {
              navigate('/');
            }
          } catch (error) {
            devError('Error deleting project:', error);
          } finally {
            setConfirmModal({ ...confirmModal, isOpen: false });
          }
        },
      });
    },
    [user, dispatch, confirmModal, projects, navigate]
  );

  const handleDeleteSpace = useCallback(
    (projectId: string, spaceId: string, spaceName: string) => {
      setConfirmModal({
        isOpen: true,
        title: 'Delete Space',
        message: `Are you sure you want to delete "${spaceName}"? This action cannot be undone.`,
        onConfirm: async () => {
          if (!user) return;
          try {
            await deleteSpace(user.uid, projectId, spaceId);
            dispatch(removeSpace({ projectId, spaceId }));

            // Navigate to first available space or project after deletion
            const project = projects.find((p) => p.id === projectId);
            if (project) {
              const remainingSpaces = project.spaces.filter((s) => s.id !== spaceId);
              if (remainingSpaces.length > 0) {
                const firstSpace = remainingSpaces[0];
                navigate(
                  generateRoute.space(project.name, projectId, firstSpace.name, firstSpace.id)
                );
              } else {
                navigate(generateRoute.project(project.name, projectId));
              }
            }
          } catch (error) {
            devError('Error deleting space:', error);
          } finally {
            setConfirmModal({ ...confirmModal, isOpen: false });
          }
        },
      });
    },
    [user, dispatch, confirmModal, projects, navigate]
  );

  const handleModalSubmit = useCallback(async () => {
    setModalProcessing(true);
    setLimitWarning(null);
    try {
      const userInputValue = modalInput.trim();
      if (!user) throw new Error('Please log in');
      if (!userInputValue) throw new Error('Please input name.');

      switch (modalMode) {
        case ModalMode.ADD_PROJECT: {
          const projectLimitCheck = checkProjectLimit(projects, adminSettings.mock_limit_reached);
          if (!projectLimitCheck.canAdd) {
            setLimitWarning({
              type: 'project',
              message: getLimitExceededMessage('projects', 10),
            });
            setModalProcessing(false);
            return;
          }
          const newProject = await createProject(user.uid, userInputValue);
          dispatch(addProject(newProject));
          dispatch(setActiveProjectId(newProject.id));
          dispatch(resetTaskState());
          // Navigate to the new project
          navigate(generateRoute.project(newProject.name, newProject.id));
          break;
        }
        case ModalMode.ADD_SPACE: {
          if (!activeProjectId) throw Error('Project Id not exist');
          const spaceLimitCheck = checkSpaceLimit(activeProject, adminSettings.mock_limit_reached);
          if (!spaceLimitCheck.canAdd) {
            setLimitWarning({
              type: 'space',
              message: getLimitExceededMessage('spaces', 10),
            });
            setModalProcessing(false);
            return;
          }
          const newSpace = await createSpace(user.uid, activeProjectId, userInputValue);
          dispatch(addSpace({ projectId: activeProjectId, space: newSpace }));
          dispatch(setActiveSpaceId(newSpace.id));
          dispatch(resetTaskState());
          // Navigate to the new space
          if (activeProject) {
            navigate(
              generateRoute.space(activeProject.name, activeProjectId, newSpace.name, newSpace.id)
            );
          }
          break;
        }
        case ModalMode.EDIT_PROJECT: {
          if (!editingEntityIds.projectId) throw Error('Project Id not exist');
          await updateProject(user.uid, editingEntityIds.projectId, userInputValue);
          dispatch(
            updateProjectAction({ projectId: editingEntityIds.projectId, name: userInputValue })
          );
          break;
        }
        case ModalMode.EDIT_SPACE: {
          if (!editingEntityIds.projectId || !editingEntityIds.spaceId)
            throw Error('Project Id or Space Id not exist');
          await updateSpace(
            user.uid,
            editingEntityIds.projectId,
            editingEntityIds.spaceId,
            userInputValue
          );
          dispatch(
            updateSpaceAction({
              projectId: editingEntityIds.projectId,
              spaceId: editingEntityIds.spaceId,
              name: userInputValue,
            })
          );
          break;
        }
      }
    } catch (error) {
      devError('Error in modal submission:', error);
    } finally {
      setModalInput('');
      setModalMode(null);
      setModalProcessing(false);
      setEditingEntityIds({ projectId: null, spaceId: null });
    }
  }, [
    user,
    modalInput,
    modalMode,
    dispatch,
    activeProjectId,
    activeProject,
    editingEntityIds,
    projects,
    adminSettings,
    navigate,
  ]);

  const handleCloseModal = useCallback(() => {
    setModalInput('');
    setModalMode(null);
    setModalProcessing(false);
    setEditingEntityIds({ projectId: null, spaceId: null });
  }, []);

  const getModalTitle = useMemo(() => {
    switch (modalMode) {
      case ModalMode.ADD_PROJECT:
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <HomeOutlined />
            Add New Project
          </span>
        );
      case ModalMode.ADD_SPACE:
        return 'Add New Space';
      case ModalMode.EDIT_PROJECT:
        return 'Edit Project Name';
      case ModalMode.EDIT_SPACE:
        return 'Edit Space Name';
      default:
        return '';
    }
  }, [modalMode]);

  const { projectMenuItems, spaceMenuItems } = useProjectSpaceMenuItems({
    projects,
    activeProject: activeProject || null,
    activeProjectId,
    adminSettings,
    isMenuItemEditable: true,
    onSelectProject: handleSelectProject,
    onSelectSpace: handleSelectSpace,
    onDeleteProject: handleDeleteProject,
    onDeleteSpace: handleDeleteSpace,
    onEditProject: (projectId: string, projectName: string) => {
      setEditingEntityIds({ projectId, spaceId: null });
      setModalMode(ModalMode.EDIT_PROJECT);
      setModalInput(projectName);
    },
    onEditSpace: (projectId: string, spaceId: string, spaceName: string) => {
      setEditingEntityIds({ projectId, spaceId });
      setModalMode(ModalMode.EDIT_SPACE);
      setModalInput(spaceName);
    },
    onAddProject: () => setModalMode(ModalMode.ADD_PROJECT),
    onAddSpace: () => setModalMode(ModalMode.ADD_SPACE),
  });

  const breadcrumbItems = useMemo(() => {
    // Guest mode: show default project and space (non-editable)
    if (isGuestMode) {
      return [
        {
          title: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <HomeOutlined />
              Default Project
            </span>
          ),
        },
        {
          title: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AppstoreOutlined />
              Default Space
            </span>
          ),
        },
      ];
    }

    // Authenticated user with no projects
    if (projects.length === 0) {
      return [
        {
          title: (
            <Button
              icon={<PlusOutlined />}
              onClick={() => setModalMode(ModalMode.ADD_PROJECT)}
              disabled={!user}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Add New Project
            </Button>
          ),
        },
      ];
    }

    const items = [
      {
        title: (
          <Dropdown
            menu={{ items: projectMenuItems }}
            disabled={!user}
            trigger={['click']}
            placement="bottomLeft"
          >
            <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <HomeOutlined />
              {activeProjectId && activeProject ? activeProject.name : 'Select Project'}
              <DownOutlined style={{ fontSize: '12px' }} />
            </span>
          </Dropdown>
        ),
      },
    ];

    if (activeProjectId && activeProject) {
      items.push({
        title:
          activeProject.spaces.length === 0 ? (
            <Button
              icon={<PlusOutlined />}
              onClick={() => setModalMode(ModalMode.ADD_SPACE)}
              disabled={!user || !activeProjectId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Add New Space
            </Button>
          ) : (
            <Dropdown
              menu={{ items: spaceMenuItems }}
              disabled={!user || !activeProjectId}
              trigger={['click']}
              placement="bottomLeft"
            >
              <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AppstoreOutlined />
                {activeSpaceId && activeProject.spaces.find((s) => s.id === activeSpaceId)
                  ? activeProject.spaces.find((s) => s.id === activeSpaceId)?.name
                  : 'Select Space'}
                <DownOutlined style={{ fontSize: '12px' }} />
              </span>
            </Dropdown>
          ),
      });
    }

    return items;
  }, [
    user,
    isGuestMode,
    activeProjectId,
    activeProject,
    activeSpaceId,
    projectMenuItems,
    spaceMenuItems,
    projects,
  ]);

  if (!isAppInitiated) {
    return (
      <Flex align="center" gap={16} p={16}>
        <Skeleton.Button active style={{ width: 200, height: 25 }} />
        <Skeleton.Button active style={{ width: 200, height: 25 }} />
      </Flex>
    );
  }

  return (
    <>
      <Flex align="center" gap={16} pt={24} px={24} pb={0}>
        <Breadcrumb
          items={breadcrumbItems}
          style={{
            fontSize: '16px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            color: 'indigo',
          }}
        />

        <div style={{ flexGrow: 1 }} />

        {/* Guest Mode Indicator and Tour - Moved from Header */}
        {isGuestMode && (
          <div className="flex items-center gap-3">
            {/* Guest Mode Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 shadow-sm">
              <span className="text-sm">💫</span>
              <span className="text-indigo-700 font-bold text-xs uppercase">Guest Mode</span>
            </div>

            {/* Take a Tour Button - Only show if guest hasn't generated any images yet */}
            {onStartTour && !hasGeneratedImage && (
              <Button
                type="primary"
                size="small"
                onClick={onStartTour}
                icon={<ThunderboltOutlined />}
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #7c3aed 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  height: '32px',
                  fontWeight: 600,
                  fontSize: '12px',
                  boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)',
                }}
              >
                Take a Tour
              </Button>
            )}
          </div>
        )}

        <Modal
          title={getModalTitle}
          open={!!modalMode}
          onCancel={handleCloseModal}
          footer={[
            <Button key="cancel" onClick={handleCloseModal}>
              Cancel
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={modalProcessing}
              disabled={!modalInput.trim()}
              onClick={handleModalSubmit}
            >
              Confirm
            </Button>,
          ]}
        >
          {limitWarning && (
            <Alert
              title="Limit Reached"
              description={limitWarning.message}
              type="warning"
              showIcon
              closable
              onClose={() => setLimitWarning(null)}
              style={{ marginBottom: 16 }}
            />
          )}
          <Input
            value={modalInput}
            placeholder={modalMode === ModalMode.ADD_PROJECT ? 'Project Name' : 'Space Name'}
            maxLength={50}
            showCount={{ formatter: ({ count }) => `${50 - count} characters remaining` }}
            onChange={(e) => setModalInput(e.target.value)}
            autoFocus
          />
          {modalMode === ModalMode.ADD_PROJECT && (
            <div
              style={{
                marginTop: 8,
                padding: 12,
                backgroundColor: '#f0f8ff',
                borderRadius: 6,
                border: '1px solid #d9d9d9',
              }}
            >
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                Examples:
              </Typography.Text>
              <Typography.Text style={{ marginBottom: 12, display: 'block' }}>
                House Renovation, Downtown Loft, Grandma's Home Upgrade
              </Typography.Text>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                Note:
              </Typography.Text>
              <Typography.Text>
                You can add up to 10 projects. Custom colors, textures, and objects are shared among
                projects.
              </Typography.Text>
            </div>
          )}
          {modalMode === ModalMode.ADD_SPACE && (
            <div
              style={{
                marginTop: 8,
                padding: 12,
                backgroundColor: '#f0f8ff',
                borderRadius: 6,
                border: '1px solid #d9d9d9',
              }}
            >
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                Examples:
              </Typography.Text>
              <Typography.Text style={{ marginBottom: 12, display: 'block' }}>
                Living Room, Master Bedroom, Kitchen
              </Typography.Text>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                Note:
              </Typography.Text>
              <Typography.Text>You can add up to 10 spaces per project.</Typography.Text>
            </div>
          )}
        </Modal>

        <GenericConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        />
      </Flex>
    </>
  );
};

export default MyBreadcrumb;
