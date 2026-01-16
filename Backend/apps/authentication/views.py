from rest_framework.generics import CreateAPIView, RetrieveAPIView, ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.decorators import action
from rest_framework import viewsets
from .models import *
from .serializers import *
from .permissions import IsAdminUser, HasCustomPermission
from .utils import RoleManager
from utils.rate_limiters import api_ratelimit
from utils.response_formatter import success_response, error_response
from django.contrib.auth import get_user_model
import csv
from django.http import HttpResponse

User = get_user_model()


class RegisterView(CreateAPIView):
    """
    Register a new user with automatic Employee role assignment
    """
    queryset = User.objects.all()
    serializer_class = RegisterUserSerializer
    permission_classes = []

    def perform_create(self, serializer):
        user = serializer.save()
        # Automatically assign Employee role as primary
        try:
            RoleManager.assign_role_to_user(
                user=user,
                role_name='Employee',
                is_primary=True,
                assigned_by=self.request.user if self.request.user.is_authenticated else None
            )
        except ValueError as e:
            # If Employee role doesn't exist, log the error but don't fail registration
            print(f"Warning: {str(e)}")
        return user

class LoginView(APIView):
    """
    Enhanced login with role information for frontend routing
    NO MORE dashboard_access or redirect_path - frontend handles routing
    """
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        
        # Get user's roles and permissions
        primary_role = user.get_primary_role()
        all_roles = user.get_all_roles()
        
        # Get profile data based on user_type
        profile_data = None
        if user.user_type == 'organizational':
            profile = getattr(user, 'organizational_profile', None)
            if profile:
                profile_data = {
                    'type': 'organizational',
                    'employee_id': profile.employee_id,
                    'company': {
                        'id': profile.company.id,
                        'name': profile.company.name
                    } if profile.company else None,
                    'department': {
                        'id': profile.department.department_id,
                        'name': profile.department.dept_name
                    } if profile.department else None,
                    'designation': {
                        'id': profile.designation.designation_id,
                        'name': profile.designation.designation_name
                    } if profile.designation else None,
                    'grade': {
                        'id': profile.grade.id,
                        'name': profile.grade.name
                    } if profile.grade else None,
                    'base_location': {
                        'id': profile.base_location.location_id,
                        'name': profile.base_location.location_name,
                        'city_id': profile.base_location.city_id,
                        'city_name': profile.base_location.city.city_name,
                        'state_id': profile.base_location.state_id,
                        'state_name': profile.base_location.state.state_name
                    } if profile.base_location else None,
                    'reporting_manager': {
                        'id': profile.reporting_manager.id,
                        'name': profile.reporting_manager.get_full_name(),
                        'username': profile.reporting_manager.username
                    } if profile.reporting_manager else None
                }
        elif user.user_type == 'external':
            profile = getattr(user, 'booking_agent_profile', None)
            if profile:
                profile_data = {
                    'type': 'external',
                    'profile_type': profile.profile_type,
                    'profile_type_display': profile.get_profile_type_display(),
                    'organization_name': profile.organization_name,
                    'contact_person': profile.contact_person,
                    'service_categories': profile.service_categories,
                    'is_verified': profile.is_verified
                }
        
        response_data = {
            'success': True,
            'message': 'Login successful',
            'data': {
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh)
                },
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'full_name': user.get_full_name(),
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'gender': user.gender,
                    'user_type': user.user_type
                },
                'profile': profile_data,
                'roles': [
                    {
                        'id': role.id,
                        'name': role.name,
                        'role_type': role.role_type,
                        'description': role.description,
                        'is_primary': primary_role and role.id == primary_role.id
                    } for role in all_roles
                ],
                'permissions': user.get_user_permissions_list()
            }
        }
        
        return Response(response_data, status=status.HTTP_200_OK)

class LogoutView(APIView):
    """
    Logout with token blacklisting
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh_token")
            if not refresh_token:
                return Response(
                    {"error": "Refresh token is required"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            token = RefreshToken(refresh_token)
            token.blacklist()

            return Response(
                {"message": "Successfully logged out"}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    @action(detail=False, methods=['get'], url_path='by-location')
    def by_location(self, request):
        location_id = request.query_params.get('location')
        if not location_id:
            return Response({"error": "location parameter is required"}, status=400)
        
        users = User.objects.filter(base_location_id=location_id, is_active=True)
        serializer = self.get_serializer(users, many=True)
        return Response(serializer.data)
    
class UserCreateView(ListCreateAPIView):
    """
    List and create users (Admin only)
    Supports filtering by base_location
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['base_location']  # 👈 this enables ?base_location=<id> filtering
    search_fields = ['username', 'first_name', 'last_name', 'email']


# User views
class UserListCreateView(ListCreateAPIView):
    serializer_class = UserListSerializer
    queryset = User.objects.filter(is_superuser=False).select_related(
        "organizational_profile",
        "booking_agent_profile",
        "company",
        "department",
        "designation",
        "employee_type",
        "grade",
        "base_location",
    ).prefetch_related("userrole_set__role")

    filter_backends = [
        DjangoFilterBackend,
        SearchFilter,
        OrderingFilter,
    ]

    # Filtering
    filterset_fields = {
        "user_type": ["exact"],
        "is_active": ["exact"],
        "department": ["exact"],
        "designation": ["exact"],
        "company": ["exact"],
        "grade": ["exact"],
        "base_location": ["exact"],
    }

    # Search across ALL major fields
    search_fields = [
        "username",
        "email",
        "first_name",
        "last_name",
        "organizational_profile__employee_id",
        "organizational_profile__company__name",
        "organizational_profile__department__name",
        "designation__name",
        "booking_agent_profile__organization_name",
    ]

    # Ordering
    ordering_fields = [
        "id", "first_name", "last_name",
        "date_joined", "company", "department",
    ]


class UserExportCSV(APIView):
    def get(self, request):
        users = User.objects.all()
        serializer = UserListSerializer(users, many=True)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = "attachment; filename=users_export.csv"

        writer = csv.writer(response)
        writer.writerow(serializer.data[0].keys())  # headers

        for row in serializer.data:
            writer.writerow(row.values())

        return response

class UserDetailView(RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, or delete a user (Admin only)
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        return User.objects.prefetch_related(
            'organizational_profile',
            'booking_agent_profile',
            'userrole_set__role'
        ).all()
    
    def get_serializer_class(self):
        if self.request.method == 'GET':
            return UserDetailSerializer
        elif self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserDetailSerializer
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete by setting is_active to False"""
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response(
            {'success': True, 'message': 'User deactivated successfully'},
            status=status.HTTP_200_OK
        )


class UserProfileView(RetrieveAPIView):
    serializer_class = UserProfileResponseSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)

        return Response({
            "success": True,
            "message": "Profile retrieved successfully",
            "data": serializer.data
        })


class SwitchRoleView(APIView):
    """
    Allow users to switch between their assigned roles
    Frontend will handle routing based on new role
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = SwitchRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        role_name = serializer.validated_data['role_name']
        
        try:
            RoleManager.switch_primary_role(request.user, role_name)
            
            new_role = Role.objects.get(name=role_name)
            return Response({
                'success': True,
                'message': 'Role switched successfully',
                'data': {
                    'role': {
                        'id': new_role.id,
                        'name': new_role.name,
                        'role_type': new_role.role_type,
                        'description': new_role.description
                    },
                    'permissions': request.user.get_user_permissions_list()
                }
            })
        except ValueError as e:
            return Response({
                'success': False,
                'message': str(e),
                'data': None,
                'errors': {'detail': str(e)}
            }, status=status.HTTP_403_FORBIDDEN)
        

# Enhanced Role Management Views
class RoleListCreateView(ListCreateAPIView):
    """
    List and create roles (Admin only)
    """
    queryset = Role.objects.filter(is_active=True).prefetch_related('rolepermission_set__permission')
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

class RoleDetailView(RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, delete role (Admin only)
    """
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

class PermissionListCreateView(ListCreateAPIView):
    """
    List and create permissions (Admin only)
    """
    queryset = Permission.objects.filter(is_active=True)
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

class PermissionDetailView(RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, delete permission (Admin only)
    """
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

class UserRoleAssignmentView(APIView):
    """
    Assign/remove roles from users (Admin only)
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def post(self, request):
        serializer = UserRoleAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user_id = serializer.validated_data['user_id']
        role_name = serializer.validated_data['role_name']
        is_primary = serializer.validated_data.get('is_primary', False)
        action = serializer.validated_data['action']  # 'assign' or 'remove'
        
        try:
            user = User.objects.get(id=user_id)
            
            if action == 'assign':
                user_role, created = RoleManager.assign_role_to_user(
                    user=user,
                    role_name=role_name,
                    is_primary=is_primary,
                    assigned_by=request.user
                )
                message = f"Role '{role_name}' assigned to user '{user.username}'"
                if created:
                    message += " (new assignment)"
                else:
                    message += " (already assigned)"
                    
            elif action == 'remove':
                success = RoleManager.remove_role_from_user(user, role_name)
                if success:
                    message = f"Role '{role_name}' removed from user '{user.username}'"
                else:
                    message = f"Role '{role_name}' was not assigned to user '{user.username}'"
            
            else:
                return Response(
                    {'error': 'Action must be either "assign" or "remove"'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            return Response({'message': message})
            
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

class InitializeSystemView(APIView):
    """
    Initialize system with default roles and permissions (Admin only)
    """
    permission_classes = []  # Allow during initial setup
    
    def post(self, request):
        try:
            from .utils import setup_initial_data
            setup_initial_data()
            return Response({
                'message': 'System initialized with default roles and permissions'
            })
        except Exception as e:
            return Response(
                {'error': f'Initialization failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        

class NotificationPreferencesView(APIView):
    """Get/Update notification preferences"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from apps.notifications.models import NotificationPreference
        
        prefs, created = NotificationPreference.objects.get_or_create(user=request.user)
        
        return success_response(
            data={
                'travel_submitted': prefs.travel_submitted,
                'travel_approved': prefs.travel_approved,
                'travel_rejected': prefs.travel_rejected,
                'booking_confirmed': prefs.booking_confirmed,
                'approval_required': prefs.approval_required,
                'approval_reminder': prefs.approval_reminder,
                'settlement_due': prefs.settlement_due,
                'settlement_overdue': prefs.settlement_overdue,
                'preferred_channels': prefs.preferred_channels,
                'quiet_hours_start': prefs.quiet_hours_start,
                'quiet_hours_end': prefs.quiet_hours_end
            },
            message='Preferences retrieved successfully'
        )
    
    def put(self, request):
        from apps.notifications.models import NotificationPreference
        
        prefs, created = NotificationPreference.objects.get_or_create(user=request.user)
        
        # Update preferences
        for field in ['travel_submitted', 'travel_approved', 'travel_rejected', 
                     'booking_confirmed', 'approval_required', 'approval_reminder',
                     'settlement_due', 'settlement_overdue']:
            if field in request.data:
                setattr(prefs, field, request.data[field])
        
        if 'preferred_channels' in request.data:
            prefs.preferred_channels = request.data['preferred_channels']
        
        if 'quiet_hours_start' in request.data:
            prefs.quiet_hours_start = request.data['quiet_hours_start']
        
        if 'quiet_hours_end' in request.data:
            prefs.quiet_hours_end = request.data['quiet_hours_end']
        
        prefs.save()
        
        return success_response(
            message='Preferences updated successfully'
        )


class EmployeeSearchView(APIView):
    """
    GET /auth/employees/search/?q=<query>
    Search for employees by name (for colleague selection in travel forms)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Q
        
        query = request.query_params.get('q', '').strip()
        if len(query) < 3:
            return success_response(data=[], message="Query too short")
        
        # Search for internal users by name
        employees = User.objects.filter(
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(username__icontains=query),
            is_active=True,
            user_type='organizational'
        ).exclude(id=request.user.id).select_related(
            'organizational_profile__department'
        )[:20]

        data = []
        for emp in employees:
            dept_name = None
            if hasattr(emp, 'organizational_profile') and emp.organizational_profile:
                if emp.organizational_profile.department:
                    dept_name = emp.organizational_profile.department.dept_name
            
            data.append({
                'id': emp.id,
                'employee_id': emp.username,
                'full_name': emp.get_full_name() or emp.username,
                'department': dept_name,
            })
        
        return success_response(data=data)