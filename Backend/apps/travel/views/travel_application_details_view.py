from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, NotFound
from django.db.models import Prefetch
from apps.travel.models import TravelApplication, Booking, BookingAssignment, BookingNote
from apps.travel.serializers.travel_application_details_serializer import TravelApplicationDetailsSerializer
from apps.authentication.mixins import BranchFilterMixin


class TravelApplicationDetailsView(BranchFilterMixin, generics.RetrieveAPIView):
    """
    API endpoint to retrieve comprehensive travel application details.
    
    Permissions:
    - Employee who created the application
    - Approvers in the approval workflow
    - Travel Desk or Finance users (based on branch/SPOC assignment)
    - Admin users
    """
    serializer_class = TravelApplicationDetailsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Optimize query with select_related and prefetch_related"""
        return TravelApplication.objects.select_related(
            'employee',
            'employee__grade',
            'employee__department',
            'employee__designation',
            'general_ledger',
            'cancelled_by',
            'travel_desk_user'
        ).prefetch_related(
            # Trip details
            'trip_details__from_location',
            'trip_details__to_location',
            
            # Bookings with assignments and notes
            Prefetch(
                'trip_details__bookings',
                queryset=Booking.objects.select_related(
                    'booking_type',
                    'sub_option',  # For travel class
                    'trip_details__from_location',
                    'trip_details__to_location',
                    'trip_details__travel_application',
                    'trip_details__travel_application__employee',
                    'trip_details__travel_application__travel_desk_user',
                    'handling_travel_desk_user',
                    'assignment__assigned_to',
                    'assignment__assigned_by',
                    'assignment__requested_vehicle_type',
                ).prefetch_related(
                    Prefetch(
                        'notes',
                        queryset=BookingNote.objects.select_related('author')
                    )
                )
            ),
            
            # Accommodation bookings
            'trip_details__accommodation_bookings__arc_hotel',
            'trip_details__accommodation_bookings__guest_house',
            'trip_details__accommodation_bookings__trip_details__to_location',
            
            # Vehicle bookings
            'trip_details__vehicle_bookings__vehicle_category',
            
            # Approval workflow
            'approval_flows__approver',
        )

    def get_object(self):
        """Get object with permission checks"""
        pk = self.kwargs.get('pk')
        
        try:
            obj = self.get_queryset().get(pk=pk)
        except TravelApplication.DoesNotExist:
            raise NotFound("Travel application not found")
        
        # Check permissions
        user = self.request.user
        
        # Check if user has permission to view
        # 1. Staff roles that might have branch-based access
        has_staff_role = (
            user.has_role('Admin') or 
            user.has_role('admin') or
            user.has_role('Travel Desk') or
            user.has_role('Finance')
        )

        has_permission = (
            # Employee who created the application
            obj.employee == user or
            
            # Approvers in the workflow
            obj.approval_flows.filter(approver=user).exists() or
            
            # Travel desk user assigned to this application
            obj.travel_desk_user == user or

            # Branch-based access for staff roles
            (has_staff_role and self.check_branch_access(user, obj.employee)) or

            # Booking Agent assigned to any booking in this application
            # As per client requirement EasternTravel whose profile type is flight_train_booking agent is allowed to view travel report from 27-05-2026.
            # In case other booking agent will allow to access report modify profile type or add more profile types in query.
            BookingAssignment.objects.filter(
                assigned_to=user,
                booking__trip_details__travel_application=obj,
                assigned_to__booking_agent_profile__services__profile_type__code='flight_train_agent',
                assigned_to__booking_agent_profile__services__is_active=True
            ).exists()
        )
        
        if not has_permission:
            raise PermissionDenied("You don't have permission to view this travel application")
        
        return obj

    def retrieve(self, request, *args, **kwargs):
        """Retrieve and serialize travel application details"""
        instance = self.get_object()
        serializer = self.get_serializer(instance, context={'request': request})
        return Response(serializer.data)
