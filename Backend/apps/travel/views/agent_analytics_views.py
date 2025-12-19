from django.db.models import Count, Avg, Q, F, ExpressionWrapper, DurationField
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.authentication.permissions import IsTravelDesk, IsAdminUser
from apps.authentication.models import User
from apps.travel.models import Booking, BookingAssignment
from utils.response_formatter import success_response, error_response
from .travel_desk_views import StandardResultsSetPagination
from apps.travel.serializers.agent_analytics_serializers import (
    AgentAnalyticsListSerializer, 
    AgentAnalyticsDetailSerializer,
    AgentRecentBookingSerializer
)

class AgentAnalyticsListView(APIView):
    """
    GET /travel/desk/analytics/agents/
    List of all booking agents with performance stats.
    """
    permission_classes = [IsAuthenticated, IsTravelDesk | IsAdminUser]

    def get(self, request):
        # Base query for booking agents
        agents = User.objects.filter(
            external_profile__profile_type='booking_agent',
            is_active=True
        ).select_related('external_profile')
        
        # Filters
        search = request.query_params.get('search')
        if search:
            agents = agents.filter(
                Q(username__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(external_profile__organization_name__icontains=search)
            )

        city_id = request.query_params.get('city')
        if city_id:
            agents = agents.filter(
                Q(external_profile__serves_all_cities=True) |
                Q(external_profile__service_cities__id=city_id)
            ).distinct()

        # Annotate with stats
        # Note: This might need optimization for large datasets, 
        # but for typical number of agents (~10-50) it's fine.
        
        agent_data = []
        for agent in agents:
            # Active: Bookings assigned to this agent that are NOT completed/cancelled
            active_count = Booking.objects.filter(
                assignment__assigned_to=agent,
                status__in=['pending', 'requested', 'in_progress', 'confirmed']
            ).count()
            
            # Completed: Bookings fully completed
            completed_count = Booking.objects.filter(
                assignment__assigned_to=agent,
                status='completed'
            ).count()
            
            # Response Time (Avg time from assigned -> accepted)
            avg_response = BookingAssignment.objects.filter(
                assigned_to=agent,
                accepted_at__isnull=False
            ).annotate(
                duration=ExpressionWrapper(
                    F('accepted_at') - F('assigned_at'),
                    output_field=DurationField()
                )
            ).aggregate(avg=Avg('duration'))['avg']
            
            avg_hours = round(avg_response.total_seconds() / 3600, 2) if avg_response else 0
            
            # Serialize
            data = AgentAnalyticsListSerializer(agent).data
            data['active_bookings'] = active_count
            data['completed_bookings'] = completed_count
            data['avg_response_time'] = avg_hours
            agent_data.append(data)
            
        return success_response(data=agent_data)

class AgentAnalyticsDetailView(APIView):
    """
    GET /travel/desk/analytics/agents/<id>/
    Detailed stats for a specific agent.
    """
    permission_classes = [IsAuthenticated, IsTravelDesk | IsAdminUser]
    
    def get(self, request, pk):
        try:
            agent = User.objects.select_related('external_profile').get(
                id=pk, 
                external_profile__profile_type='booking_agent'
            )
        except User.DoesNotExist:
            return error_response(message="Agent not found")
            
        # 1. Basic Stats
        active_count = Booking.objects.filter(
            assignment__assigned_to=agent,
            status__in=['pending', 'requested', 'in_progress', 'confirmed']
        ).count()
        
        completed_count = Booking.objects.filter(
            assignment__assigned_to=agent,
            status='completed'
        ).count()
        
        # Response Time
        avg_response = BookingAssignment.objects.filter(
            assigned_to=agent,
            accepted_at__isnull=False
        ).annotate(
            duration=ExpressionWrapper(
                F('accepted_at') - F('assigned_at'),
                output_field=DurationField()
            )
        ).aggregate(avg=Avg('duration'))['avg']
        avg_hours = round(avg_response.total_seconds() / 3600, 2) if avg_response else 0

        # 2. Today's Activity
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_assignments = BookingAssignment.objects.filter(
            assigned_to=agent,
            assigned_at__gte=today_start
        ).count()
        
        pending_req = Booking.objects.filter(
            assignment__assigned_to=agent,
            status='requested'
        ).count()

        # 3. Recent Bookings (last 5)
        recent_bookings = Booking.objects.filter(
            assignment__assigned_to=agent
        ).select_related(
            'trip_details__travel_application__employee',
            'trip_details__from_location',
            'trip_details__to_location'
        ).order_by('-updated_at')[:5]
        
        booking_data = AgentRecentBookingSerializer(recent_bookings, many=True).data
        
        # Serialize Agent
        agent_data = AgentAnalyticsDetailSerializer(agent).data
        agent_data['active_bookings'] = active_count
        agent_data['completed_bookings'] = completed_count
        agent_data['avg_response_time'] = avg_hours
        agent_data['today_assignments'] = today_assignments
        agent_data['pending_requests'] = pending_req
        
        return success_response(data={
            "agent": agent_data,
            "recent_bookings": booking_data
        })
