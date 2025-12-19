from django.urls import path

from .views.travel_views import *
from .views.approval_views import *
from .views.booking import *
from .views.booking_calendar import GuestHouseAvailabilityView
from .views.approval_delegation import ApprovalDelegationView
from .views.cancellation import *
from .views.dashboards import *
from .views.analytics import TravelAnalyticsView, ComplianceReportView
from .views.travel_desk_views import *
from .views.booking_agent_views import *
from .views.travel_desk_recommendation import *
from .views.agent_analytics_views import *

urlpatterns = [
    # Travel Applications
    path('my-applications/', MyTravelApplicationsView.as_view(), name='my-travel-applications'),
    path('applications/', TravelApplicationListCreateView.as_view(), name='travel-application-list'),
    path('applications/<int:pk>/', TravelApplicationDetailView.as_view(), name='travel-application-detail'),
    path('applications/<int:pk>/submit/', TravelApplicationSubmitView.as_view(), name='travel-application-submit'),
    path('applications/<int:pk>/validate/', TravelApplicationValidationView.as_view(), name='travel-application-validate'),
    path('applications/<int:application_id>/request-accommodation/', RequestAccommodationBookingView.as_view()),

    # Approval Workflow
    path('manager-approvals/', ManagerApprovalsView.as_view(), name='manager-approvals'),
    path('approvals/pending/', ManagerPendingApprovalsView.as_view(), name='pending-approvals'),
    path('approvals/chro/', CHROPendingApprovalsView.as_view(), name='chro-pending-approvals'),
    path('approvals/ceo/', CEOPendingApprovalsView.as_view(), name='ceo-pending-approvals'),
    path('approvals/<int:pk>/action/', ApprovalActionView.as_view(), name='approval-action'),
    path('approvals/<int:pk>/history/', ApprovalHistoryView.as_view(), name='approval-history'),
    path('approvals/dashboard/', ApprovalDashboardView.as_view(), name='approval-dashboard'),

    # Travel Desk
    path("travel-desk/applications/", TravelDeskApplicationListView.as_view(), name="travel-desk-applications"),
    path("travel-desk/applications/<int:pk>/", TravelDeskApplicationDetailView.as_view(), name="travel-desk-application-detail"),
    path("travel-desk/applications/<int:application_id>/bookings/", TravelDeskBookingsForApplicationView.as_view(), name="travel-desk-application-bookings"),
    path("travel-desk/assign-bookings/", TravelDeskAssignBookingsView.as_view(), name="travel-desk-assign-bookings"),
    path("travel-desk/bookings/<int:booking_id>/reassign/", TravelDeskReassignBookingView.as_view(), name="travel-desk-reassign-booking"),
    path("travel-desk/bookings/<int:booking_id>/notes/", BookingNotesView.as_view(), name="travel-desk-booking-notes"),
    path("travel-desk/applications/<int:app_id>/forward/", ForwardApplicationView.as_view(), name="travel-desk-forward-application"),
    path("travel-desk/applications/<int:app_id>/cancel/", TravelDeskCancelApplicationView.as_view(), name="travel-desk-cancel-application"),
    path("travel-desk/applications/<int:application_id>/recommended-agents/", TravelDeskRecommendedAgentsView.as_view(), name="travel-desk-recommended-agents"),
    
    # Analytics
    path("travel-desk/analytics/agents/", AgentAnalyticsListView.as_view(), name="agent-analytics-list"),
    path("travel-desk/analytics/agents/<int:pk>/", AgentAnalyticsDetailView.as_view(), name="agent-analytics-detail"),

    # Booking Agent
    path("booking-agents/", BookingAgentsListView.as_view(), name="booking-agents"),
    path("booking-agent/bookings/", BookingAgentBookingsListView.as_view(), name="agent-bookings-list"),
    path("booking-agent/bookings/<int:pk>/", BookingAgentBookingDetailView.as_view(), name="agent-booking-detail"),
    path("booking-agent/bookings/<int:pk>/status/", BookingAgentUpdateStatusView.as_view(), name="agent-booking-status"),
    path("booking-agent/bookings/<int:pk>/upload-file/", BookingAgentFileUploadView.as_view(), name="agent-booking-upload-file"),
    path("booking-agent/bookings/<int:pk>/notes/", BookingAgentNotesView.as_view(), name="agent-booking-notes"),
    path("booking-agent/bookings/<int:pk>/accept/", BookingAgentAcceptBookingView.as_view(), name="agent-booking-accept"),
    path("booking-agent/bookings/<int:pk>/complete/", BookingAgentCompleteBookingView.as_view(), name="agent-booking-complete"),

    # Booking
    path('bookings/', BookingListAPIView.as_view(), name='booking-list'),
    path('bookings/<int:pk>/', BookingDetailAPIView.as_view(), name='booking-detail'),

    # Itinerary 
    path('itinerary/<int:application_id>/', ItineraryAPIView.as_view(), name='itinerary'),

    # Delegation
    path('approvals/delegate/', ApprovalDelegationView.as_view(), name='delegate-approval'),

    # Cancellation
    path('applications/<int:pk>/cancel/', TravelCancellationRequestView.as_view()),
    path('applications/<int:pk>/partial-cancel/', PartialCancellationView.as_view()),

    # Dashboard 
    path('dashboard/employee/', EmployeeDashboardView.as_view(), name="employee-dashboard"),
    path('dashboard/manager/', ManagerDashboardView.as_view(), name="manager-dashboard"),
    path('dashboard/travel-desk/', TravelDeskDashboardView.as_view(), name="travel-desk-agent-dashboard"),
    path("dashboard/booking-agent/", BookingAgentDashboardView.as_view(), name="booking-agent-dashboard"),

    # Analytics
    path('analytics/', TravelAnalyticsView.as_view()),
    path('reports/compliance/', ComplianceReportView.as_view()),

    # Statistics
    path('applications/stats/', TravelApplicationDashboardStatsView.as_view(), name='travel-stats'),
    path('approvals/stats/', ApprovalStatsView.as_view(), name='approval-stats'),

    # List views with filters
    path('applications/my-drafts/', MyDraftApplicationsView.as_view(), name='my-drafts'),
    path('applications/my-pending/', MyPendingApplicationsView.as_view(), name='my-pending'),

    # Booking Management
    path('bookings/check-entitlement/', CheckBookingEntitlementView.as_view(), name='check-entitlement'),
    path('bookings/accommodation/request/', AccommodationBookingRequestView.as_view(), name='accommodation-request'),
    path('bookings/vehicle/request/', VehicleBookingRequestView.as_view(), name='vehicle-request'),
    path('bookings/accommodation/', AccommodationBookingListView.as_view(), name='accommodation-list'),
    path('bookings/accommodation/<int:pk>/', AccommodationBookingDetailView.as_view(), name='accommodation-detail'),
    path('bookings/vehicle/', VehicleBookingListView.as_view(), name='vehicle-list'),
    path('bookings/vehicle/<int:pk>/', VehicleBookingDetailView.as_view(), name='vehicle-detail'),
    path('bookings/vehicle/<int:pk>/confirm/', VehicleBookingConfirmView.as_view(), name='vehicle-confirm'),
    path('bookings/status/update/', BookingStatusUpdateView.as_view(), name='booking-status-update'),
    path('bookings/check-availability/', GuestHouseAvailabilityView.as_view()),
    
    # Document Management
    path('documents/upload/', TravelDocumentUploadView.as_view(), name='document-upload'),
    path('documents/', TravelDocumentListView.as_view(), name='document-list'),
    path('documents/<int:document_id>/new-version/', DocumentVersionView.as_view()),
    
    # Travel Desk
    path('travel-desk/dashboard/', TravelDeskDashboardView.as_view(), name='travel-desk-dashboard'),
]