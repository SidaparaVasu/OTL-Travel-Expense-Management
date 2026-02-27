from django.urls import path, include
from .views.agent_views import *
from .views.master_views import *
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r"profile-types", ProfileTypeMasterViewSet, basename="profile-types")
router.register(r"service-categories", ServiceCategoryMasterViewSet, basename="service-categories")
router.register(r"profile-type-service-maps", ProfileTypeServiceMapViewSet, basename="profile-type-service-maps")
router.register(r"booking-agent-services", BookingAgentServiceViewSet, basename="booking-agent-services")
router.register(r"booking-agent-service-categories", BookingAgentServiceCategoryViewSet, basename="booking-agent-service-categories")
router.register(r"booking-agent-contacts", BookingAgentContactViewSet, basename="booking-agent-contacts")
router.register(r"booking-agent-vehicle-type-maps", BookingAgentVehicleTypeMapViewSet, basename="booking-agent-vehicle-type-maps")
router.register(r"booking-agent-assignment-rules", BookingAgentAssignmentRuleViewSet, basename="booking-agent-assignment-rules")

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
    path("booking-agent/bookings/<int:pk>/reject/", BookingAgentRejectBookingView.as_view(), name="agent-booking-reject"),
    path("booking-agent/bookings/<int:pk>/complete/", BookingAgentCompleteBookingView.as_view(), name="agent-booking-complete"),

    # Master Data
    path("api/masters/", include(router.urls)),
]
