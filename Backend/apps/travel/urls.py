from django.urls import path
from rest_framework.routers import DefaultRouter

from .views.travel_views import *
from .views.travel_application_details_view import TravelApplicationDetailsView
from .views.guest_views import GuestProfileViewSet
from .views.permission_views import BackdatedTRAllowanceViewSet
from .views.approval_views import *
from .views.booking import *
from .views.booking_calendar import GuestHouseAvailabilityView
from .views.approval_delegation import ApprovalDelegationView
from .views.cancellation import *
from .views.dashboards import *
from .views.analytics import TravelAnalyticsView, ComplianceReportView
from .views.reports import TravelApplicationReportView, AdvanceRequestReportView
from .views.travel_desk_views import *
from .views.travel_desk_recommendation import *
from .views.agent_analytics_views import *
from .views.advance_views import AdvanceWorkspaceViewSet
from .views.export_views import TravelApplicationExportView, TravelApplicationExportPreviewView

router = DefaultRouter()
router.register(r'guest-profiles', GuestProfileViewSet, basename='guest-profiles')
router.register(r'finance/advances', AdvanceWorkspaceViewSet, basename='finance-advances')
router.register(r'admin/backdated-allowance', BackdatedTRAllowanceViewSet, basename='backdated-allowance')

urlpatterns = [
    # Travel Applications
    path('my-applications/', MyTravelApplicationsView.as_view(), name='my-travel-applications'),
    path('applications/', TravelApplicationListCreateView.as_view(), name='travel-application-list'),
    path('eligible-approvers/', EligibleApproversView.as_view(), name='eligible-approvers'),
    path('applications/<int:pk>/', TravelApplicationDetailView.as_view(), name='travel-application-detail'),
    path('applications/<int:pk>/details/', TravelApplicationDetailsView.as_view(), name='travel-application-details'),
    path('applications/<int:pk>/edit/', TravelApplicationEditView.as_view(), name='travel-application-edit'),
    path('applications/<int:pk>/submit/', TravelApplicationSubmitView.as_view(), name='travel-application-submit'),
    path('applications/<int:pk>/validate/', TravelApplicationValidationView.as_view(), name='travel-application-validate'),
    path('applications/<int:pk>/upload-bulk-file/', TravelApplicationBulkUploadView.as_view(), name='travel-application-upload-bulk-file'),
    path('applications/<int:pk>/report/', TravelApplicationReportView.as_view(), name='travel-application-report'),
    path('applications/<int:pk>/advance-report/', AdvanceRequestReportView.as_view(), name='advance-request-report'),
    path('applications/<int:application_id>/request-accommodation/', RequestAccommodationBookingView.as_view()),

    # Bulk booking per-line-item file upload (new approach)
    path('bookings/<int:booking_id>/upload-bulk-file/', BookingBulkFileUploadView.as_view(), name='booking-upload-bulk-file'),

    # Sample file downloads (one per category, no auth required)
    path('bulk-booking/sample/ticketing/', BulkBookingSampleDownloadView.as_view(), {'category': 'ticketing'}, name='bulk-sample-ticketing'),
    path('bulk-booking/sample/accommodation/', BulkBookingSampleDownloadView.as_view(), {'category': 'accommodation'}, name='bulk-sample-accommodation'),
    path('bulk-booking/sample/conveyance/', BulkBookingSampleDownloadView.as_view(), {'category': 'conveyance'}, name='bulk-sample-conveyance'),

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
    path("travel-desk/bookings/<int:booking_id>/cancel/", TravelDeskCancelBookingView.as_view(), name="travel-desk-cancel-booking"),
    path("travel-desk/bookings/<int:booking_id>/close/", TravelDeskCloseBookingView.as_view(), name="travel-desk-close-booking"),
    path("travel-desk/bookings/<int:booking_id>/update-claim-eligibility/", TravelDeskUpdateBookingClaimEligibilityView.as_view(), name="travel-desk-update-claim-eligibility"),
    path("travel-desk/applications/<int:application_id>/recommended-agents/", TravelDeskRecommendedAgentsView.as_view(), name="travel-desk-recommended-agents"),
    path("travel-desk/agents/<int:agent_id>/vehicle-types/", TravelDeskAgentVehicleTypesView.as_view(), name="travel-desk-agent-vehicle-types"),
    path("travel-desk/bookings/<int:booking_id>/duty-slip/", GenerateDutySlipAPIView.as_view(), name="generate-duty-slip"),
    path("travel-desk/bookings/<int:booking_id>/forward-to-desk/", TravelDeskForwardToDeskView.as_view(), name="travel-desk-forward-booking"),
    path("travel-desk/assigned-locations/", TravelDeskAssignedLocationsView.as_view(), name="travel-desk-assigned-locations"),
    path("travel-desk/users/", TravelDeskUsersListView.as_view(), name="travel-desk-users"),

    # Analytics
    path("travel-desk/analytics/agents/", AgentAnalyticsListView.as_view(), name="agent-analytics-list"),
    path("travel-desk/analytics/agents/cities/", AgentReferencedCitiesView.as_view(), name="agent-analytics-cities"),
    path("travel-desk/analytics/agents/<int:pk>/", AgentAnalyticsDetailView.as_view(), name="agent-analytics-detail"),

    # Booking
    path('bookings/', BookingListAPIView.as_view(), name='booking-list'),
    path('bookings/<int:pk>/', BookingDetailAPIView.as_view(), name='booking-detail'),

    # Itinerary 
    path('itinerary/<int:application_id>/', ItineraryAPIView.as_view(), name='itinerary'),

    # Delegation
    path('approvals/delegate/', ApprovalDelegationView.as_view(), name='delegate-approval'),

    # Cancellation
    path('applications/<int:pk>/cancel/', TravelCancellationRequestView.as_view()),
    path('applications/<int:pk>/cancel/approval/', TravelCancellationApprovalView.as_view()),
    path('applications/<int:pk>/cancel/withdraw/', WithdrawCancellationView.as_view()),
    path('applications/<int:pk>/partial-cancel/', PartialCancellationView.as_view()),

    # Dashboard 
    path('dashboard/employee/', EmployeeDashboardView.as_view(), name="employee-dashboard"),
    path('dashboard/manager/', ManagerDashboardView.as_view(), name="manager-dashboard"),
    path('dashboard/travel-desk/', TravelDeskDashboardView.as_view(), name="travel-desk-agent-dashboard"),
    path('dashboard/finance/', FinanceDashboardView.as_view(), name='finance-dashboard'),

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

    # Admin Export
    path('admin/export/', TravelApplicationExportView.as_view(), name='travel-application-export'),
    path('admin/export/preview/', TravelApplicationExportPreviewView.as_view(), name='travel-application-export-preview'),
] + router.urls