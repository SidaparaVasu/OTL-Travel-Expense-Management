from django.urls import path
from .views import *

urlpatterns = [
    # Authentication
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', LoginView.as_view(), name='auth_login'),
    path('auth/logout/', LogoutView.as_view(), name='auth_logout'),
    path('auth/profile/', UserProfileView.as_view(), name='user_profile'),
    path('auth/switch-role/', SwitchRoleView.as_view(), name='switch_role'),

    # Users
    # path('users/', UserCreateView.as_view(), name='user_list_create'),
    path('users/', UserListCreateView.as_view(), name='user-list-create'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('employees/search/', EmployeeSearchView.as_view(), name='employee_search'),

    # Bulk Export
    path("users/export/", UserExportCSV.as_view(), name='user-bulk-export'),
    
    # Role Management (Admin)
    path('roles/', RoleListCreateView.as_view(), name='role_list_create'),
    path('roles/<int:pk>/', RoleDetailView.as_view(), name='role_detail'),
    path('user-roles/assign/', UserRoleAssignmentView.as_view(), name='assign_user_role'),

    # Permission Management (Admin)
    path('permissions/', PermissionListCreateView.as_view(), name='permission_list_create'),
    path('permissions/<int:pk>/', PermissionDetailView.as_view(), name='permission_detail'),
    
    # System Initialization
    path('system/initialize/', InitializeSystemView.as_view(), name='initialize_system'),

    # Notification Preferences
    path('preferences/notifications/', NotificationPreferencesView.as_view()),
]   