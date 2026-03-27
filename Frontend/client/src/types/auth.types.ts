export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    tokens: {
      access: string;
      refresh: string;
    };
    user: {
      id: number;
      username: string;
      email: string;
      full_name: string;
      first_name: string;
      last_name: string;
      gender: string;
      user_type: string; // 'organizational' | 'external'
    };
    profile: {
      type: string;
      employee_id?: string;
      company?: { id: number; name: string };
      department?: { id: number; name: string };
      designation?: { id: number; name: string };
      grade?: { id: number; name: string };
      base_location?: { id: number; name: string; city: string; state: string };
      reporting_manager?: { id: number; name: string; username: string };
      // External profile fields
      organization_name?: string;
      profile_type?: string;
    } | null;
    roles: Array<{
      id: number;
      name: string;
      role_type: string;
      description: string;
      is_primary: boolean;
    }>;
    permissions: string[];
  };
}

export interface UserProfile {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  gender: string;
  user_type: string;
  profile: any;
  roles: Array<{
    id: number;
    name: string;
    role_type: string;
    is_primary: boolean;
    description: string;
  }>;
  permissions: string[];
  can_submit_backdated: boolean;
  backdated_expiry: string | null;
}