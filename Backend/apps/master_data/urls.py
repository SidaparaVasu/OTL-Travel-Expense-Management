from django.urls import path
from .views import *
from .views_locations import CountryListView, StateListView, CityListView

from rest_framework.routers import DefaultRouter
router = DefaultRouter()
# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
router.register(r"city-categories", CityCategoryAssignmentViewSet, basename="city-categories")

# In use
router.register(r'guest-houses', GuestHouseMasterViewSet, basename='guesthouse')
router.register(r'meal-preferences', MealPreferenceMasterViewSet, basename='meal-preferences')

urlpatterns = [
    # Company
    path('companies/', CompanyListCreateView.as_view(), name='company-list'),
    path('companies/<int:pk>/', CompanyDetailView.as_view(), name='company-detail'),
    path('company/my/', EmployeeCompanyDetailView.as_view(), name='employee-company-detail'),
    path('departments/', DepartmentListCreateView.as_view(), name='department-list'),
    path('departments/<int:pk>/', DepartmentDetailView.as_view(), name='department-detail'),
    path('designations/', DesignationListCreateView.as_view(), name='designation-list'),
    path('designations/<int:pk>/', DesignationDetailView.as_view(), name='designation-detail'),
    path('employee-type/', EmployeeTypeListCreateView.as_view(), name='employee-type-list'),
    path('employee-type/<int:pk>/', EmployeeTypeDetailView.as_view(), name='employee-type-detail'),
    
    # Geography
    path("locations/countries/", CountryListView.as_view()),
    path("locations/states/", StateListView.as_view()),
    path("locations/cities/", CityListView.as_view()),

    path('countries/', CountryListCreateView.as_view(), name='country-list'),
    path('countries/<int:pk>/', CountryDetailView.as_view(), name='country-detail'),
    path('states/', StateListCreateView.as_view(), name='state-list'),
    path('states/<int:pk>/', StateDetailView.as_view(), name='state-detail'),
    path('cities/', CityListCreateView.as_view(), name='city-list'),
    path('cities/<int:pk>/', CityDetailView.as_view(), name='city-detail'),
    path('city-categories/', CityCategoriesListCreateView.as_view(), name='city-categories-list'),
    path('city-categories/<int:pk>/', CityCategoriesDetailView.as_view(), name='city-categories-detail'),
    path('locations/', LocationListCreateView.as_view(), name='location-list'),
    path('locations/<int:pk>/', LocationDetailView.as_view(), name='location-detail'),
    
    # Other Master Data
    path('grades/', GradeListCreateView.as_view(), name='grade-list'),
    path('grades/<int:pk>/', GradeDetailView.as_view(), name='grade-detail'),
    path('travel-modes/', TravelModeListCreateView.as_view(), name='travelmode-list'),
    path('travel-modes/<int:pk>/', TravelModeDetailView.as_view(), name='travelmode-detail'),
    path('travel-sub-options/', TravelSubOptionListCreateView.as_view(), name='travelsuboption-list'),
    path('travel-sub-options/<int:pk>/', TravelSubOptionDetailView.as_view(), name='travelsuboption-detail'),
    path("travel-modes-active/", ActiveTravelModeListView.as_view(), name="active_travel_modes"),
    path("travel-sub-options-active/", ActiveTravelSubOptionListView.as_view(), name="active_travel_suboptions"),
    path('grade-entitlements/', GradeEntitlementListCreateView.as_view(), name='gradeentitlement-list'),
    path('grade-entitlements/<int:pk>/', GradeEntitlementDetailView.as_view(), name='gradeentitlement-detail'),
    path('grade-entitlements/bulk-create/', GradeEntitlementBulkCreateView.as_view(), name='bulk-create-entitlements'),
    path('allowed-travel-modes/', AllowedTravelModesView.as_view(), name='entitlement-based-allowed-mode'),
    path('gl-codes/', GLCodeListCreateView.as_view(), name='gl-code-list'),
    path('gl-codes/<int:pk>/', GLCodeDetailView.as_view(), name='gl-code-detail'),
    path('active-gl-codes/', ActiveGLCodeListView.as_view(), name='active-gl-code-list'),
    path("gl-code/bulk-upload/", GLCodeBulkImportView.as_view()),

    # Accommodation URLs
    path('arc-hotels/', ARCHotelListCreateView.as_view(), name='arc-hotel-list-create'),
    path('arc-hotels/<int:pk>/', ARCHotelDetailView.as_view(), name='arc-hotel-detail'),
    path('arc-hotels/dropdown/', ARCHotelDropdownView.as_view(), name='arc-hotel-dropdown'),
    
    # DEPRECATED: This model/component is not in use anymore and is marked for deletion.
    # Status: Deprecated since June 2, 2026 — no active usage recorded.
    path('location-spoc/', LocationSPOCListCreateView.as_view(), name='locationspoc-list'),
    path('location-spoc/<int:pk>/', LocationSPOCDetailView.as_view(), name='locationspoc-detail'),
    
    # Approval and Policy URLs
    path('approval-matrix/', ApprovalMatrixListCreateView.as_view(), name='approvalmatrix-list'),
    path('approval-matrix/<int:pk>/', ApprovalMatrixDetailView.as_view(), name='approvalmatrix-detail'),
    path('da-incidental/', DAIncidentalListCreateView.as_view(), name='daincidental-list'),
    path('da-incidental/<int:pk>/', DAIncidentalDetailView.as_view(), name='daincidental-detail'),
    path('conveyance-rates/', ConveyanceRateListCreateView.as_view(), name='conveyancerate-list'),
    path('conveyance-rates/<int:pk>/', ConveyanceRateDetailView.as_view(), name='conveyancerate-detail'),
    
    # Additional Travel URLs
    path('vehicle-categories/', VehicleCategoryListCreateView.as_view(), name='vehiclecategory-list'),
    path('vehicle-categories/dropdown/', VehicleCategoryDropdownView.as_view(), name='vehiclecategory-dropdown'),
    path('vehicle-categories/<int:pk>/', VehicleCategoryDetailView.as_view(), name='vehiclecategory-detail'),
    path('vehicle-types/', VehicleTypeListCreateView.as_view(), name='vehicletype-list'),
    path('vehicle-types/dropdown/', VehicleTypeDropdownView.as_view(), name='vehicletype-dropdown'),
    path('vehicle-types/<int:pk>/', VehicleTypeDetailView.as_view(), name='vehicletype-detail'),
    path('travel-policies/', TravelPolicyListCreateView.as_view(), name='travelpolicy-list'),
    path('travel-policies/<int:pk>/', TravelPolicyDetailView.as_view(), name='travelpolicy-detail'),
]

urlpatterns += router.urls