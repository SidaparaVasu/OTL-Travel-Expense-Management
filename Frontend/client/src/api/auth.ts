import { apiClient } from './client';
import { LoginRequest, LoginResponse, UserProfile } from '@/src/types/auth.types';

export const authAPI = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/auth/login/', credentials);

    if (data.success) {
      // Store tokens
      localStorage.setItem('access_token', data.data.tokens.access);
      localStorage.setItem('refresh_token', data.data.tokens.refresh);
      
      // Store user
      localStorage.setItem('user', JSON.stringify(data.data.user));
      
      // Store profile
      localStorage.setItem('profile', JSON.stringify(data.data.profile));
      
      // Store roles
      localStorage.setItem('roles', JSON.stringify(data.data.roles));
      
      // Store permissions
      localStorage.setItem('permissions', JSON.stringify(data.data.permissions));
      
      // Determine primary dashboard from roles
      const primaryRole = data.data.roles.find(r => r.is_primary);
      const dashboard = primaryRole?.role_type || 'employee';
      localStorage.setItem('primary_dashboard', `/${dashboard}/dashboard`);
    }

    return data;
  },

  logout: async (): Promise<void> => {
    const refreshToken = localStorage.getItem('refresh_token');
    try {
      await apiClient.post('/auth/logout/', { refresh_token: refreshToken });
    } finally {
      localStorage.clear();
    }
  },

  getProfile: async (): Promise<UserProfile> => {
    const { data } = await apiClient.get('/auth/profile/');
    if (data.success && data.data) { return data.data; }
    return data.data; // Fallback for backward compatibility
  },

  switchRole: async (roleName: string) => {
    const { data } = await apiClient.post('/auth/switch-role/', { role_name: roleName });
    
    // Update roles in localStorage
    if (data.success && data.data.role) {
      const roles = JSON.parse(localStorage.getItem('roles') || '[]');
      const updatedRoles = roles.map((r: any) => ({
        ...r,
        is_primary: r.name === roleName
      }));
      localStorage.setItem('roles', JSON.stringify(updatedRoles));
      
      // Update permissions
      if (data.data.permissions) {
        localStorage.setItem('permissions', JSON.stringify(data.data.permissions));
      }
      
      // Return redirect based on role_type
      const newPrimaryRole = updatedRoles.find((r: any) => r.is_primary);
      return `/${newPrimaryRole.role_type}/dashboard`;
    }
    
    return undefined;
  },
};