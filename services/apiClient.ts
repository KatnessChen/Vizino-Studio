import axios from 'axios';
import { getAuth } from 'firebase/auth';

const API_URL = import.meta.env.VITE_API_URL || 'https://vizino-studio-backend-dev-31937902243.us-central1.run.app';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add Firebase ID Token to every request
apiClient.interceptors.request.use(
  async (config) => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      try {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Failed to get Firebase ID token:', error);
      }
    } else {
      // Check for developer mode bypass in local storage or env
      const devUser = localStorage.getItem('DEV_USER_BYPASS');
      if (devUser) {
        config.headers.Authorization = `Bearer DEV_USER_${devUser}`;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
