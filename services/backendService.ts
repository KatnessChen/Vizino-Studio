import apiClient from './apiClient';
import { Project, Space, ImageData, Color } from '@/types';

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

  // Assets
  async getColors(projectId: string): Promise<Color[]> {
    const response = await apiClient.get(`/assets/${projectId}/colors`);
    return response.data;
  },

  async createColor(projectId: string, name: string, hex: string): Promise<Color> {
    const response = await apiClient.post(`/assets/${projectId}/colors`, { name, hex });
    return response.data;
  },

  // AI
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

  // User
  async getMe(): Promise<Record<string, unknown>> {
    const response = await apiClient.get('/users/me');
    return response.data;
  },
};
