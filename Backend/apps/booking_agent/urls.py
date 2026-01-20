from django.urls import path
from .views.agent_views import *

urlpatterns = [
    # Booking Agent List
    path("booking-agents/", BookingAgentsListView.as_view(), name="booking-agents"),
    
    # Booking Agent Portal
    path("dashboard/booking-agent/", BookingAgentDashboardView.as_view(), name="booking-agent-dashboard"),
    path("booking-agent/bookings/", BookingAgentBookingsListView.as_view(), name="agent-bookings-list"),
    path("booking-agent/bookings/<int:pk>/", BookingAgentBookingDetailView.as_view(), name="agent-booking-detail"),
    path("booking-agent/bookings/<int:pk>/status/", BookingAgentUpdateStatusView.as_view(), name="agent-booking-status"),
    path("booking-agent/bookings/<int:pk>/upload-file/", BookingAgentFileUploadView.as_view(), name="agent-booking-upload-file"),
    path("booking-agent/bookings/<int:pk>/notes/", BookingAgentNotesView.as_view(), name="agent-booking-notes"),
    path("booking-agent/bookings/<int:pk>/accept/", BookingAgentAcceptBookingView.as_view(), name="agent-booking-accept"),
    path("booking-agent/bookings/<int:pk>/complete/", BookingAgentCompleteBookingView.as_view(), name="agent-booking-complete"),
]
