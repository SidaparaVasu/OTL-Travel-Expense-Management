from django.db import models
from django.contrib.auth.models import AbstractUser, Group, Permission
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    """
    Enhanced User model - Base for all user types
    """
    USER_TYPE_CHOICES = [
        ('organizational', 'Organizational User'),
        ('external', 'External User'),
    ]
    
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other / Non-binary'),
        ('N', 'Prefer not to say'),
    ]
    
    # User Type - Determines which profile to use
    user_type = models.CharField(
        max_length=20,
        choices=USER_TYPE_CHOICES,
        default='organizational'
    )
    
    gender = models.CharField(
        max_length=1,
        choices=GENDER_CHOICES,
        default='N',
        blank=True,
        null=False,
    )
    
    # HRMS Integration Fields
    hrms_id = models.IntegerField(unique=True, blank=True, null=True, help_text="Physical ID from HRMS system")
    mobile_no = models.CharField(max_length=15, blank=True, null=True, help_text="Mobile number from HRMS")
    date_of_birth = models.DateField(blank=True, null=True, help_text="Date of Birth from HRMS")
    
    # Keep Django's built-in groups and permissions for compatibility
    groups = models.ManyToManyField(
        Group,
        verbose_name=_('groups'),
        blank=True,
        help_text=_(
            'The groups this user belongs to. A user will get all permissions '
            'granted to each of their groups.'
        ),
        related_name="user_set",
        related_query_name="user",
    )
    user_permissions = models.ManyToManyField(
        Permission,
        verbose_name=_('user permissions'),
        blank=True,
        help_text=_('Specific permissions for this user.'),
        related_name="user_set",
        related_query_name="user",
    )
    
    # DEPRECATED FIELDS - Will be removed after migration
    # Keeping temporarily for backward compatibility
    employee_id = models.CharField(max_length=50, unique=True, blank=True, null=True)
    reporting_manager = models.ForeignKey(
        'self', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='old_subordinates'
    )
    department = models.ForeignKey(
        'master_data.DepartmentMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users_in_department"
    )
    designation = models.ForeignKey(
        'master_data.DesignationMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users_in_designation"
    )
    employee_type = models.ForeignKey(
        'master_data.EmployeeTypeMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    company = models.ForeignKey(
        'master_data.CompanyInformation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    grade = models.ForeignKey(
        'master_data.GradeMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    base_location = models.ForeignKey(
        'master_data.LocationMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    class Meta:
        db_table = 'auth_user'  # Keep existing table name
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return f"{self.username} ({self.get_user_type_display()})"
    
    # Helper Methods
    def get_profile(self):
        """Get user's profile based on user_type"""
        if self.user_type == 'organizational':
            return getattr(self, 'organizational_profile', None)
        elif self.user_type == 'external':
            return getattr(self, 'booking_agent_profile', None)
        return None
    
    def is_organizational(self):
        """Check if user is organizational"""
        return self.user_type == 'organizational'
    
    def is_external(self):
        """Check if user is external"""
        return self.user_type == 'external'
    
    # Multi-role support methods
    def get_primary_role(self):
        """Get user's primary role (determines default dashboard)"""
        primary_role = self.userrole_set.filter(is_primary=True, is_active=True).first()
        return primary_role.role if primary_role else None
    
    def get_all_roles(self):
        """Get all active roles assigned to user"""
        return [ur.role for ur in self.userrole_set.filter(role__is_active=True, is_active=True)]
    
    def has_role(self, role_name):
        """Check if user has specific role"""
        return self.userrole_set.filter(
            role__name__iexact=role_name,
            role__is_active=True,
            is_active=True
        ).exists()
    
    def get_user_permissions_list(self):
        """Get all permissions for user across all roles"""
        permissions = set()
        for role in self.get_all_roles():
            role_perms = role.rolepermission_set.filter(
                permission__is_active=True
            ).values_list('permission__codename', flat=True)
            permissions.update(role_perms)
        return list(permissions)
    
    def get_approval_hierarchy(self):
        """Get approval chain for this user's travel requests"""
        hierarchy = []
        profile = self.get_profile()
        
        # Get reporting manager from profile if organizational user
        if self.is_organizational() and profile and profile.reporting_manager:
            hierarchy.append({
                'approver': profile.reporting_manager,
                'level': 'manager',
                'required': True
            })
        
        return hierarchy