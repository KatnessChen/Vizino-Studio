import apiClient from './apiClient';
import { Project, Space, ImageData, Color, CustomPrompt } from '@/types';

export const backendService = {
  // Projects
  async getProjects(): Promise<Project[]> {
    const response = await apiClient.get('/projects');
    return response.data;
  },

  async createProject(name: string): Promise<Project> {
    const response = await apiClient.post('/projects', { name });
    return response.data;
  },

  async updateProject(projectId: string, name: string): Promise<Project> {
    const response = await apiClient.patch(`/projects/${projectId}`, { name });
    return response.data;
  },

  async deleteProject(projectId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}`);
  },

  // Spaces
  async getSpaces(projectId: string): Promise<Space[]> {
    const response = await apiClient.get(`/projects/${projectId}/spaces`);
    return response.data;
  },

  async createSpace(projectId: string, name: string): Promise<Space> {
    const response = await apiClient.post(`/projects/${projectId}/spaces`, { name });
    return response.data;
  },

  async updateSpace(projectId: string, spaceId: string, name: string): Promise<Space> {
    const response = await apiClient.patch(`/projects/${projectId}/spaces/${spaceId}`, { name });
    return response.data;
  },

  async deleteSpace(projectId: string, spaceId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/spaces/${spaceId}`);
  },

  // Images
  async getImages(projectId: string, spaceId: string): Promise<ImageData[]> {
    const response = await apiClient.get(`/projects/${projectId}/spaces/${spaceId}/images`);
    return response.data;
  },

  async uploadImage(projectId: string, spaceId: string, file: File): Promise<ImageData> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(
      `/projects/${projectId}/spaces/${spaceId}/images/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  async updateImageName(projectId: string, spaceId: string, imageId: string, name: string): Promise<void> {
    await apiClient.patch(`/projects/${projectId}/spaces/${spaceId}/images/${imageId}`, { name });
  },

  async deleteImage(projectId: string, spaceId: string, imageId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/spaces/${spaceId}/images/${imageId}`);
  },

  async duplicateImage(projectId: string, spaceId: string, imageId: string, newName: string): Promise<ImageData> {
    const response = await apiClient.post(`/projects/${projectId}/spaces/${spaceId}/images/${imageId}/duplicate`, { newName });
    return response.data;
  },

  async moveImage(projectId: string, sourceSpaceId: string, imageId: string, targetSpaceId: string): Promise<ImageData> {
    const response = await apiClient.post(`/projects/${projectId}/spaces/${sourceSpaceId}/images/${imageId}/move`, { targetSpaceId });
    return response.data;
  },

  async copyImageAsOriginal(projectId: string, sourceSpaceId: string, imageId: string, targetSpaceId: string): Promise<ImageData> {
    const response = await apiClient.post(`/projects/${projectId}/spaces/${sourceSpaceId}/images/${imageId}/copy-as-original`, { targetSpaceId });
    return response.data;
  },

  async updateImageOrder(projectId: string, spaceId: string, updates: { id: string; order: number }[]): Promise<void> {
    await apiClient.post(`/projects/${projectId}/spaces/${spaceId}/images/reorder`, { updates });
  },

  // Assets
  async getColors(projectId: string): Promise<Color[]> {
    const response = await apiClient.get(`/assets/${projectId}/colors`);
    return response.data;
  },

  async createColor(projectId: string, name: string, hex: string): Promise<Color> {
    const response = await apiClient.post(`/assets/${projectId}/colors`, { name, hex });
    return response.data;
  },

  async updateColor(projectId: string, colorId: string, name: string, hex: string): Promise<Color> {
    const response = await apiClient.patch(`/assets/${projectId}/colors/${colorId}`, { name, hex });
    return response.data;
  },

  async deleteColor(projectId: string, colorId: string): Promise<void> {
    await apiClient.delete(`/assets/${projectId}/colors/${colorId}`);
  },

  async getTextures(projectId: string): Promise<any[]> {
    const response = await apiClient.get(`/assets/${projectId}/textures`);
    return response.data;
  },

  async uploadTexture(projectId: string, name: string, file: File, description?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (description) formData.append('description', description);
    const response = await apiClient.post(`/assets/${projectId}/textures`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async deleteTexture(projectId: string, textureId: string): Promise<void> {
    await apiClient.delete(`/assets/${projectId}/textures/${textureId}`);
  },

  async getItems(projectId: string): Promise<any[]> {
    const response = await apiClient.get(`/assets/${projectId}/items`);
    return response.data;
  },

  async uploadItem(projectId: string, name: string, file: File, description?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (description) formData.append('description', description);
    const response = await apiClient.post(`/assets/${projectId}/items`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async deleteItem(projectId: string, itemId: string): Promise<void> {
    await apiClient.delete(`/assets/${projectId}/items/${itemId}`);
  },

  // AI & Prompts
  async generateImage(payload: {
    imageId: string;
    projectId: string;
    spaceId: string;
    taskName: string;
    customPrompt?: string;
    options?: Record<string, unknown>;
  }): Promise<ImageData> {
    const response = await apiClient.post('/ai/generate', payload);
    return response.data;
  },

  async upscaleImage(payload: {
    imageBase64: string;
    imageMimeType: string;
    scale?: 2 | 4;
  }): Promise<{ success: boolean; outputUrl: string; id: string }> {
    const response = await apiClient.post('/ai/upscale', payload);
    return response.data;
  },

  async getPrompts(projectId: string): Promise<CustomPrompt[]> {
    const response = await apiClient.get(`/ai/prompts/${projectId}`);
    return response.data;
  },

  async savePrompt(projectId: string, taskName: string, content: string): Promise<CustomPrompt> {
    const response = await apiClient.post(`/ai/prompts/${projectId}`, { taskName, content });
    return response.data;
  },

  async deletePrompt(projectId: string, promptId: string): Promise<void> {
    await apiClient.delete(`/ai/prompts/${projectId}/${promptId}`);
  },

  // User
  async getMe(): Promise<Record<string, unknown>> {
    const response = await apiClient.get('/users/me');
    return response.data;
  },
};
