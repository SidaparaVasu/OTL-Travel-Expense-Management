import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/src/store/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Briefcase, Building2, MapPin, Users, Shield } from 'lucide-react';

export default function Profile() {
  const { user, loadProfile, logout, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  console.log('Profile data: ', user);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load profile</p>
          <Button onClick={() => loadProfile()}>Retry</Button>
        </div>
      </div>
    );
  }

  const genderLabels: Record<string, string> = {
    M: 'Male',
    F: 'Female',
    O: 'Other / Non-binary',
    N: 'Prefer not to say',
  };

  const profile = user.profile || {};
  const isOrganizational = user.user_type === 'organizational' || profile.type === 'organizational';
  const isExternal = user.user_type === 'external' || profile.type === 'external';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500 mt-1">View and manage your personal information</p>
        </div>
        <Button variant="destructive" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      {/* User Card with Avatar */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              {user.first_name?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">
                {user.first_name} {user.last_name}
              </h2>
              <p className="text-gray-600 mt-1">@{user.username}</p>
              <div className="flex gap-2 mt-3">
                {user.roles && user.roles.length > 0 ? (
                  user.roles.map((role: any) => (
                    <Badge 
                      key={role.name} 
                      variant={role.is_primary ? "default" : "secondary"}
                      className="text-xs"
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      {role.name}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline">No roles assigned</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={<User className="h-4 w-4" />} label="Username" value={user.username} />
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={user.email} />
            <InfoRow 
              icon={<User className="h-4 w-4" />} 
              label="Gender" 
              value={genderLabels[user.gender as keyof typeof genderLabels] || 'Not specified'} 
            />
            <InfoRow 
              icon={<Shield className="h-4 w-4" />} 
              label="User Type" 
              value={user.user_type === 'organizational' ? 'Employee' : 'External User'} 
            />
          </CardContent>
        </Card>

        {/* Organizational/External Details */}
        {isOrganizational && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                Employment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow 
                icon={<Briefcase className="h-4 w-4" />} 
                label="Employee ID" 
                value={profile.employee_id || 'Not assigned'} 
              />
              <InfoRow 
                icon={<Building2 className="h-4 w-4" />} 
                label="Company" 
                value={profile.company_name || 'Not assigned'} 
              />
              <InfoRow 
                icon={<Briefcase className="h-4 w-4" />} 
                label="Department" 
                value={profile.department_name || 'Not assigned'} 
              />
              <InfoRow 
                icon={<Briefcase className="h-4 w-4" />} 
                label="Designation" 
                value={profile.designation_name || 'Not assigned'} 
              />
            </CardContent>
          </Card>
        )}

        {isExternal && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Organization Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow 
                icon={<Building2 className="h-4 w-4" />} 
                label="Organization" 
                value={profile.organization_name || 'Not specified'} 
              />
              <InfoRow 
                icon={<Briefcase className="h-4 w-4" />} 
                label="Profile Type" 
                value={profile.profile_type_display || profile.profile_type || 'Not specified'} 
              />
              <InfoRow 
                icon={<User className="h-4 w-4" />} 
                label="Contact Person" 
                value={profile.contact_person || 'Not specified'} 
              />
              <InfoRow 
                icon={<Shield className="h-4 w-4" />} 
                label="Status" 
                value={
                  <Badge variant={profile.is_verified ? "default" : "secondary"}>
                    {profile.is_verified ? 'Verified' : 'Not Verified'}
                  </Badge>
                } 
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Additional Details for Organizational Users */}
      {isOrganizational && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                Location & Grade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow 
                icon={<MapPin className="h-4 w-4" />} 
                label="Base Location" 
                value={profile?.base_location_name || 'Not assigned'} 
              />
              {profile?.base_location_details && (
                <InfoRow 
                  icon={<MapPin className="h-4 w-4" />} 
                  label="City/State" 
                  value={`${profile?.base_location_details.city}, ${profile?.base_location_details.state}`} 
                />
              )}
              <InfoRow 
                icon={<Briefcase className="h-4 w-4" />} 
                label="Grade" 
                value={profile.grade_name || 'Not assigned'} 
              />
            </CardContent>
          </Card>

          {profile.reporting_manager_details && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Reporting Structure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow 
                  icon={<User className="h-4 w-4" />} 
                  label="Reporting Manager" 
                  value={profile.reporting_manager_details.name || 'Not assigned'} 
                />
                <InfoRow 
                  icon={<Mail className="h-4 w-4" />} 
                  label="Manager Email" 
                  value={profile.reporting_manager_details.email || 'N/A'} 
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// Helper Component for Info Rows
interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
      <div className="text-gray-400 mt-1">{icon}</div>
      <div className="flex-1">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-gray-900 mt-1">
          {typeof value === 'string' ? value : value}
        </p>
      </div>
    </div>
  );
}