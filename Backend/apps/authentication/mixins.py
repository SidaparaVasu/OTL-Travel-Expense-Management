"""
Authentication mixins for branch-based access control.

This module provides reusable mixins to enforce branch-level data isolation
across different views and viewsets.
"""

from django.db.models import Q


ENABLE_SPOC_BASED_FILTERING = True

class BranchFilterMixin:
    """
    Mixin to apply branch-based filtering to querysets.
    
    Automatically filters data based on user's base_location to ensure
    branch-level data isolation and security.
    
    Usage:
        class MyView(BranchFilterMixin, ListAPIView):
            def get_queryset(self):
                queryset = MyModel.objects.all()
                return self.apply_branch_filter(queryset, self.request.user)
    """
    
    def apply_branch_filter(self, queryset, user, employee_field='employee', spoc_role_name=None):
        """
        Apply branch filtering based on user role and base_location.
        
        Access Rules:
        - CEO/CHRO: See all data across all branches (company-wide access)
        - Admin/Travel Desk/Finance/Manager: See only their branch data
        - Employee: See only their own data
        - Users without profile/location: No access (empty queryset)
        
        Args:
            queryset: Base queryset to filter
            user: Current authenticated user
            employee_field: Field name to join to employee (default: 'employee')
                          Can be nested like 'claim__employee' for related models
        
        Returns:
            Filtered queryset based on branch access rules
        
        Examples:
            # Simple usage
            queryset = self.apply_branch_filter(queryset, request.user)
            
            # Custom employee field
            queryset = self.apply_branch_filter(
                queryset, 
                request.user, 
                employee_field='travel_application__employee'
            )
        """
        # CEO and CHRO and Global Travel Desk have company-wide access
        if user.has_role('CEO') or user.has_role('CHRO') or user.has_role('Global Travel Desk'):
            return queryset
        
        # Get user's organizational profile and base location
        profile = user.get_profile()
        
        # If user has no profile or no base location, deny access
        if not profile or not profile.base_location:
            return queryset.none()
        
        user_location = profile.base_location
        
        # Apply branch filtering for branch-restricted roles
        # These roles can only see data from their assigned branch
        if (user.has_role('Admin') or user.has_role('admin') or 
            user.has_role('Travel Desk') or user.has_role('Finance') or 
            user.has_role('Manager') or user.has_role('Branch Admin')):

            # SPOC Based Filtering Logic
            if ENABLE_SPOC_BASED_FILTERING:
                from apps.authentication.models.spoc import LocationSPOCAssignment
                
                # Determine relevant role for SPOC check
                # We check assignments for ALL roles user has that are relevant (Travel Desk / Finance)
                # Or just check if they have ANY assignment that matches their current capabilities
                
                # Ideally, we find assignments where user=user AND is_active=True
                assignments = LocationSPOCAssignment.objects.filter(
                    user=user,
                    is_active=True,
                ).prefetch_related('locations')
                if spoc_role_name:
                    assignments = assignments.filter(role__name__iexact=spoc_role_name)

                if assignments.exists():
                    # Check for Global assignment
                    if assignments.filter(is_global=True).exists():
                        return queryset

                    # Collect all assigned location IDs
                    spoc_location_ids = set()
                    for assignment in assignments:
                        spoc_location_ids.update(assignment.locations.values_list('location_id', flat=True))
                    
                    # Also include user's own branch location
                    spoc_location_ids.add(user_location.location_id)
                    
                    filter_kwargs = {
                        f'{employee_field}__organizational_profile__base_location__location_id__in': list(spoc_location_ids)
                    }
                    branch_q = Q(**filter_kwargs)

                    # Travel Desk: also include applications where this user is the
                    # handling_travel_desk_user on any booking (delegation/forward scenario).
                    # Only applicable for TravelApplication querysets.
                    if (
                        (user.has_role('Travel Desk') or user.has_role('Global Travel Desk'))
                        and queryset.model.__name__ == 'TravelApplication'
                    ):
                        delegated_q = Q(
                            trip_details__bookings__handling_travel_desk_user=user
                        )
                        return queryset.filter(branch_q | delegated_q).distinct()

                    return queryset.filter(branch_q)

            
            # Default / Fallback: Build filter to match employee's base_location with user's base_location
            filter_kwargs = {
                f'{employee_field}__organizational_profile__base_location': user_location
            }
            branch_q = Q(**filter_kwargs)

            # Travel Desk: also include delegated/forwarded applications
            if (
                (user.has_role('Travel Desk') or user.has_role('Global Travel Desk'))
                and queryset.model.__name__ == 'TravelApplication'
            ):
                delegated_q = Q(
                    trip_details__bookings__handling_travel_desk_user=user
                )
                return queryset.filter(branch_q | delegated_q).distinct()

            return queryset.filter(branch_q)
        
        # Default: Regular employees see only their own data
        return queryset.filter(**{employee_field: user})
    
    def get_user_branch_location(self, user):
        """
        Get user's branch location.
        
        Helper method to retrieve user's base_location from their profile.
        Returns None if user has no profile or location.
        
        Args:
            user: User instance
            
        Returns:
            LocationMaster instance or None
        """
        profile = user.get_profile()
        if profile and profile.base_location:
            return profile.base_location
        return None
    
    def check_branch_access(self, user, target_user):
        """
        Check if user can access target_user's data based on branch and SPOC assignments.
        
        Args:
            user: Current user requesting access
            target_user: User whose data is being accessed
            
        Returns:
            Boolean indicating if access is allowed
        """
        # CEO and CHRO have company-wide access
        if user.has_role('CEO') or user.has_role('CHRO'):
            return True
            
        # Get both users' locations
        user_location = self.get_user_branch_location(user)
        target_location = self.get_user_branch_location(target_user)
        
        # If either has no location, deny access
        if not user_location or not target_location:
            return False
            
        # Simple Case: Same branch
        if user_location == target_location:
            return True
            
        # Advanced Case: Check SPOC assignments for cross-branch access
        if ENABLE_SPOC_BASED_FILTERING:
            from apps.authentication.models.spoc import LocationSPOCAssignment
            
            # Check if user has ANY active assignment for the target location
            has_assignment = LocationSPOCAssignment.objects.filter(
                user=user,
                is_active=True
            ).filter(
                Q(is_global=True) | Q(locations__location_id=target_location.location_id)
            ).exists()
            
            if has_assignment:
                return True
                
        return False
