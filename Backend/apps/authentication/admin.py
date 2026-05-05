from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib import admin
from django import forms
from .models import *
from apps.booking_agent.models import BookingAgentProfile


# Inline for UserRole
class UserRoleInline(admin.TabularInline):
    model = UserRole
    fk_name = "user"
    extra = 1
    fields = ('role', 'is_primary', 'is_active', 'assigned_at')
    readonly_fields = ('assigned_at',)


# Inline for OrganizationalProfile
class OrganizationalProfileInline(admin.StackedInline):
    model = OrganizationalProfile
    can_delete = False
    verbose_name = 'Organizational Profile'
    verbose_name_plural = 'Organizational Profile'
    fk_name = 'user'
    fields = (
        'employee_id',
        'employee_code',
        'company',
        'department',
        'designation',
        'employee_type',
        'grade',
        'base_location',
        'reporting_manager',
    )


# Inline for BookingAgentProfile
class BookingAgentProfileInline(admin.StackedInline):
    model = BookingAgentProfile
    can_delete = False
    verbose_name = 'External Profile'
    verbose_name_plural = 'External Profile'
    fk_name = 'user'
    fields = (
        'organization_name',
        'address',
        'gst_number',
        'pan_number',
        'license_number',
        'is_verified',
        'is_active',
    )


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('id', 'username', 'email', 'first_name', 'last_name', 'gender', 'date_of_birth', 'user_type', 'hrms_id', 'is_active')
    list_filter = ('user_type', 'organizational_profile__grade', 'is_staff', 'is_superuser', 'is_active')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('username',)
    
    # Dynamic inlines based on user_type
    def get_inlines(self, request, obj=None):
        if obj is None:
            return [UserRoleInline]
        
        if obj.user_type == 'organizational':
            return [OrganizationalProfileInline, UserRoleInline]
        elif obj.user_type == 'external':
            return [BookingAgentProfileInline, UserRoleInline]
        
        return [UserRoleInline]

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {
            'fields': ('first_name', 'last_name', 'email', 'gender', 'date_of_birth', 'user_type', 'hrms_id', 'mobile_no')
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'password1', 'password2', 'user_type', 'gender', 'date_of_birth'),
        }),
    )

    def get_roles(self, obj):
        return ", ".join([ur.role.name for ur in obj.userrole_set.filter(is_active=True)])
    get_roles.short_description = 'Roles'

    def get_reporting_manager(self, obj):
        profile = getattr(obj, "organizational_profile", None)
        if profile and profile.reporting_manager:
            return profile.reporting_manager.get_full_name()
        return "-"
    get_reporting_manager.short_description = "Reporting Manager"



@admin.register(OrganizationalProfile)
class OrganizationalProfileAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'employee_code', 'get_user_name', 'company', 'department', 'designation')
    list_filter = ('company', 'department', 'designation')
    search_fields = ('employee_id', 'user__username', 'user__first_name', 'user__last_name')
    raw_id_fields = ('user', 'reporting_manager')
    
    def get_user_name(self, obj):
        return obj.user.get_full_name()
    get_user_name.short_description = 'User Name'


@admin.register(BookingAgentProfile)
class BookingAgentProfileAdmin(admin.ModelAdmin):
    list_display = ('organization_name', 'get_user_name', 'gst_number', 'is_verified', 'is_active')
    list_filter = ('is_verified', 'is_active')
    search_fields = ('organization_name', 'user__username', 'user__first_name', 'user__last_name', 'gst_number')
    raw_id_fields = ('user',)

    def get_user_name(self, obj):
        return obj.user.get_full_name()
    get_user_name.short_description = 'User Name'



@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'role_type', 'is_active', 'get_permission_count')
    list_filter = ('role_type', 'is_active')
    search_fields = ('name', 'role_type', 'description')
    
    def get_permission_count(self, obj):
        return obj.rolepermission_set.count()
    get_permission_count.short_description = 'Permissions'


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('name', 'codename', 'category', 'is_active')
    list_filter = ('category', 'is_active')
    search_fields = ('name', 'codename')


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'is_primary', 'is_active', 'assigned_at')
    list_filter = ('is_primary', 'is_active', 'role')
    search_fields = ('user__username', 'role__name')
    raw_id_fields = ('user', 'assigned_by')


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ('role', 'permission', 'granted_at')
    list_filter = ('role',)
    search_fields = ('role__name', 'permission__name')

@admin.register(LocationSPOCAssignment)
class LocationSPOCAssignmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'is_global', 'is_active', 'created_at')
    list_filter = ('is_global', 'is_active', 'role')
    search_fields = ('user__username', 'role__name')
    raw_id_fields = ('user', 'assigned_by')
    filter_horizontal = ('locations',)


@admin.register(TemporaryApproverAuthorization)
class TemporaryApproverAuthorizationAdmin(admin.ModelAdmin):
    list_display = (
        'user', 'get_user_grade', 'valid_from', 'valid_until',
        'is_active', 'is_currently_valid', 'authorized_by', 'created_at'
    )
    list_filter = ('is_active', 'valid_from', 'valid_until')
    search_fields = (
        'user__username', 'user__first_name', 'user__last_name',
        'reason', 'authorized_by__username'
    )
    raw_id_fields = ('user', 'authorized_by')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)

    fieldsets = (
        (None, {
            'fields': ('user', 'authorized_by', 'reason')
        }),
        ('Validity', {
            'fields': ('valid_from', 'valid_until', 'is_active')
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def get_user_grade(self, obj):
        profile = getattr(obj.user, 'organizational_profile', None)
        if profile and profile.grade:
            return profile.grade.name
        return '—'
    get_user_grade.short_description = 'Current Grade'

    def is_currently_valid(self, obj):
        return obj.is_currently_valid()
    is_currently_valid.boolean = True
    is_currently_valid.short_description = 'Valid Now?'