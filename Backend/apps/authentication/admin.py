from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib import admin
from django import forms
from .models import *


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
        'company',
        'department',
        'designation',
        'employee_type',
        'grade',
        'base_location',
        'reporting_manager',
    )


# Inline for ExternalProfile
class ExternalProfileInline(admin.StackedInline):
    model = ExternalProfile
    can_delete = False
    verbose_name = 'External Profile'
    verbose_name_plural = 'External Profile'
    fk_name = 'user'
    fields = (
        'profile_type',
        'organization_name',
        'contact_person',
        'phone',
        'email',
        'address',
        'service_categories',
        'gst_number',
        'pan_number',
        'license_number',
        'is_verified',
        'is_active',
    )


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('id', 'username', 'email', 'first_name', 'last_name', 'user_type', 'grade', 'get_reporting_manager', 'get_roles', 'is_active')
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
            return [ExternalProfileInline, UserRoleInline]
        
        return [UserRoleInline]

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {
            'fields': ('first_name', 'last_name', 'email', 'gender', 'user_type')
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'password1', 'password2', 'user_type', 'gender'),
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
    list_display = ('employee_id', 'get_user_name', 'company', 'department', 'designation')
    list_filter = ('company', 'department', 'designation')
    search_fields = ('employee_id', 'user__username', 'user__first_name', 'user__last_name')
    raw_id_fields = ('user', 'reporting_manager')
    
    def get_user_name(self, obj):
        return obj.user.get_full_name()
    get_user_name.short_description = 'User Name'


class ExternalProfileAdminForm(forms.ModelForm):
    class Meta:
        model = ExternalProfile
        fields = "__all__"

    def clean(self):
        cleaned_data = super().clean()
        serves_all = cleaned_data.get("serves_all_cities")
        cities = cleaned_data.get("service_cities")

        if not serves_all and (not cities or not cities.exists()):
            raise forms.ValidationError(
                "Select at least one service city OR enable 'Serves all cities'."
            )

        return cleaned_data
    
@admin.register(ExternalProfile)
class ExternalProfileAdmin(admin.ModelAdmin):
    list_display = ('organization_name', 'profile_type', 'contact_person', 'is_verified', 'is_active')
    list_filter = ('profile_type', 'is_verified', 'is_active')
    search_fields = ('organization_name', 'contact_person', 'user__username')
    raw_id_fields = ('user',)
    filter_horizontal = ('service_cities',)
    fieldsets = (
        ('Basic Information', {
            'fields': (
                'user',
                'profile_type',
                'organization_name',
                'contact_person',
                'phone',
                'email',
                'address',
            )
        }),
        ('Service Coverage', {
            'fields': (
                'service_categories',
                'serves_all_cities',
                'service_cities',
            ),
            'description': (
                "Enable <b>Serves all cities</b> OR select specific cities below."
            )
        }),
        ('Status & Verification', {
            'fields': (
                'is_verified',
                'is_active',
            )
        }),
    )


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