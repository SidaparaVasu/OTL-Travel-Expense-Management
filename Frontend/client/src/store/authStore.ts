import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '@/src/api/auth';
import { UserProfile } from '@/src/types/auth.types';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  loadProfile: () => Promise<void>;
  switchRole: (roleName: string) => Promise<string | undefined>;
  initializeAuth: () => void;
}

/** ------------------ ROLE LOGIC ------------------ **/

const ADMIN_ROLES = ["admin", "manager", "ceo", "chro"];

function getPrimaryDashboard(roles: Array<{ role_type: string }>): string {
  const roleTypes = roles.map(r => r.role_type);

  const isAdminType = roleTypes.some(r => ADMIN_ROLES.includes(r));
  const isTravelDesk = roleTypes.includes("travel_desk");
  const isBookingAgent = roleTypes.includes("booking_agent");
  const isEmployee = roleTypes.includes("employee");

  if (isAdminType) return "/admin/dashboard";
  if (isTravelDesk) return "/travel_desk/dashboard";
  if (isBookingAgent) return "/booking_agent/dashboard";
  if (isEmployee) return "/employee/dashboard";

  return "/employee/dashboard";
}

/** -------------------------------------------------- **/

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      initializeAuth: () => {
        const token = localStorage.getItem("access_token");
        const userStr = localStorage.getItem("user");

        if (token && userStr) {
          try {
            const user = JSON.parse(userStr);
            set({
              user,
              isAuthenticated: true
            });
          } catch (error) {
            console.error("Failed to initialize auth:", error);
            localStorage.clear();
            set({ user: null, isAuthenticated: false });
          }
        }
      },

      login: async (username, password) => {
        set({ isLoading: true });

        try {
          const response = await authAPI.login({ username, password });

          const { user, profile, roles, permissions } = response.data;

          // Compute redirect using unified rule
          const redirectTo = getPrimaryDashboard(roles);

          // Save all relevant info
          const fullUser: UserProfile = {
            ...user,
            profile,
            roles,
            permissions
          };

          set({
            user: fullUser,
            isAuthenticated: true,
            isLoading: false
          });

          // Persist
          // localStorage.setItem("user", JSON.stringify(fullUser));
          // localStorage.setItem("roles", JSON.stringify(roles));
          // localStorage.setItem("permissions", JSON.stringify(permissions));
          localStorage.setItem("primary_dashboard", redirectTo);

          return redirectTo;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authAPI.logout();
        } catch (error) {
          console.error("Logout error:", error);
        } finally {
          localStorage.clear();
          set({ user: null, isAuthenticated: false });
        }
      },

      loadProfile: async () => {
        try {
          const profileData = await authAPI.getProfile();
          if (!profileData) return;

          const { user, profile, roles, permissions } = profileData;

          const updatedUser = {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: `${user.first_name} ${user.last_name}`,
            first_name: user.first_name,
            last_name: user.last_name,
            gender: user.gender,
            user_type: user.user_type,
            profile,
            roles,
            permissions
          };

          localStorage.setItem("user", JSON.stringify(updatedUser));
          set({ user: updatedUser });

        } catch (error) {
          console.error("Failed to load profile:", error);
        }
      },


      switchRole: async (roleName: string) => {
        try {
          const redirect_to = await authAPI.switchRole(roleName);

          const profile = await authAPI.getProfile();

          if (profile) {
            localStorage.setItem("user", JSON.stringify(profile));
            set({ user: profile });
          }

          return redirect_to;
        } catch (err) {
          console.error("Failed to switch role", err);
          throw err;
        }
      }
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
