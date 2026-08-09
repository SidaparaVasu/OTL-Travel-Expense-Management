from rest_framework.views import APIView
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView, ListAPIView
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Q
import csv
import io
from django.db import transaction

from .models import *
from .serializers import *
from apps.authentication.permissions import IsAdminUser
from utils.pagination import *
from utils.response_formatter import *

# Company Views
class CompanyListCreateView(ListCreateAPIView):
    queryset = CompanyInformation.objects.all()
    serializer_class = CompanyInformationSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated, IsAdminUser]

class CompanyDetailView(RetrieveUpdateDestroyAPIView):
    queryset = CompanyInformation.objects.all()
    serializer_class = CompanyInformationSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated, IsAdminUser]
    

class EmployeeCompanyDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = CompanyInformationSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_object(self):
        user = self.request.user
        employee = getattr(user, 'user', None)
        return employee.company

class DepartmentListCreateView(ListCreateAPIView):
    queryset = DepartmentMaster.objects.select_related('company').all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['company']
    search_fields = ['dept_name']

class DepartmentDetailView(RetrieveUpdateDestroyAPIView):
    queryset = DepartmentMaster.objects.select_related('company').all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]


class DesignationListCreateView(ListCreateAPIView):
    queryset = DesignationMaster.objects.all()
    serializer_class = DesignationSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

class DesignationDetailView(RetrieveUpdateDestroyAPIView):
    queryset = DesignationMaster.objects.select_related('department').all()
    serializer_class = DesignationSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

class EmployeeTypeListCreateView(ListCreateAPIView):
    queryset = EmployeeTypeMaster.objects.all()
    serializer_class = EmployeeTypeSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

class EmployeeTypeDetailView(RetrieveUpdateDestroyAPIView):
    queryset = EmployeeTypeMaster.objects.all()
    serializer_class = EmployeeTypeSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]


# Geography Views
# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class CityCategoryAssignmentViewSet(viewsets.ModelViewSet):
    queryset = CityCategoryAssignment.objects.all()
    serializer_class = CityCategoryAssignmentSerializer
    lookup_field = "id"

    # optional: allow simple filtering by query params (country/state/city)
    def get_queryset(self):
        qs = super().get_queryset()
        country = self.request.query_params.get("country")
        state = self.request.query_params.get("state")
        city = self.request.query_params.get("city")
        if country:
            qs = qs.filter(country_name__iexact=country)
        if state:
            qs = qs.filter(state_name__iexact=state)
        if city:
            qs = qs.filter(city_name__iexact=city)
        return qs

    @action(detail=False, methods=["delete"])
    def bulk_delete(self, request):
        ids = request.data.get("ids", [])
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "Provide a non-empty list of ids in request body."}, status=status.HTTP_400_BAD_REQUEST)
        CityCategoryAssignment.objects.filter(id__in=ids).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class CountryListCreateView(ListCreateAPIView):
    queryset = CountryMaster.objects.all()
    serializer_class = CountrySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = FlexiblePagination
    pagination_class = None

class CountryDetailView(RetrieveUpdateDestroyAPIView):
    queryset = CountryMaster.objects.all()
    serializer_class = CountrySerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

class StateListCreateView(ListCreateAPIView):
    queryset = StateMaster.objects.select_related('country').all()
    serializer_class = StateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['country']
    pagination_class = FlexiblePagination
    pagination_class = None

class StateDetailView(RetrieveUpdateDestroyAPIView):
    queryset = StateMaster.objects.select_related('country').all()
    serializer_class = StateSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

class CityListCreateView(ListCreateAPIView):
    queryset = CityMaster.objects.select_related('state__country', 'category').all()
    serializer_class = CitySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['state', 'category']
    search_fields = ['city_name', 'city_code']
    pagination_class = None

class CityDetailView(RetrieveUpdateDestroyAPIView):
    queryset = CityMaster.objects.select_related('state__country', 'category').all()
    serializer_class = CitySerializer
    permission_classes = [IsAuthenticated, IsAdminUser]


class CityCategoriesListCreateView(ListCreateAPIView):
    queryset = CityCategoriesMaster.objects.all()
    serializer_class = CityCategoriesSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['name']         
    search_fields = ['name', 'description']
    pagination_class = FlexiblePagination

class CityCategoriesDetailView(RetrieveUpdateDestroyAPIView):
    queryset = CityCategoriesMaster.objects.all()
    serializer_class = CityCategoriesSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

class LocationListCreateView(ListCreateAPIView):
    queryset = LocationMaster.objects.select_related(
        'company', 'city', 'state', 'country'
    ).all()
    serializer_class = LocationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['company', 'city', 'state']
    search_fields = ['location_name', 'location_code']
    pagination_class = LargePagination

class LocationDetailView(RetrieveUpdateDestroyAPIView):
    queryset = LocationMaster.objects.select_related(
        'company', 'city', 'state', 'country'
    ).all()
    serializer_class = LocationSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]


# Other Master Data
class GLCodeListCreateView(ListCreateAPIView):
    queryset = GLCodeMaster.objects.filter(is_active=True).order_by('sorting_no')
    serializer_class = GLCodeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['gl_code', 'vertical_name', 'description', 'short_description']

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return paginated_response(serializer.data, self.paginator, message="GL Codes fetched successfully")

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

class GLCodeDetailView(RetrieveUpdateDestroyAPIView):
    queryset = GLCodeMaster.objects.all()
    serializer_class = GLCodeSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    pagination_class = LargePagination

class ActiveGLCodeListView(ListAPIView):
    """
    Returns only active GL codes (for user dropdown) without pagination
    """
    serializer_class = GLCodeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return GLCodeMaster.objects.filter(is_active=True).order_by('sorting_no')

from apps.bulk_service.views import BaseBulkImportView

class GLCodeBulkImportView(BaseBulkImportView):
    """
    Bulk import/export for GL Codes.
    """
    model_class = GLCodeMaster
    field_mapping = {
        "Vertical": "vertical_name",
        "G/L Account": "gl_code",
        "G/L Acct Long Text": "description",
        "Short Text": "short_description"
    }
    unique_fields = ["gl_code"]



class GradeListCreateView(ListCreateAPIView):
    queryset = GradeMaster.objects.filter(is_active=True)
    serializer_class = GradeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = LargePagination

class GradeDetailView(RetrieveUpdateDestroyAPIView):
    queryset = GradeMaster.objects.all()
    serializer_class = GradeSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    pagination_class = LargePagination

class TravelModeListCreateView(ListCreateAPIView):
    # queryset = TravelModeMaster.objects.filter(is_active=True)
    queryset = TravelModeMaster.objects.all()
    serializer_class = TravelModeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

class MealPreferenceMasterViewSet(viewsets.ModelViewSet):
    queryset = MealPreferenceMaster.objects.filter(is_active=True)
    serializer_class = MealPreferenceMasterSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

class TravelModeDetailView(RetrieveUpdateDestroyAPIView):
    queryset = TravelModeMaster.objects.all()
    serializer_class = TravelModeSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    pagination_class = NoPagination

class ActiveTravelModeListView(ListAPIView):
    """
    Returns only active travel modes (for user dropdown)
    """
    serializer_class = TravelModeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NoPagination

    def get_queryset(self):
        return TravelModeMaster.objects.filter(is_active=True)

class TravelSubOptionListCreateView(ListCreateAPIView):
    queryset = TravelSubOptionMaster.objects.select_related('mode').all()
    serializer_class = TravelSubOptionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['mode']
    pagination_class = NoPagination

class TravelSubOptionDetailView(RetrieveUpdateDestroyAPIView):
    queryset = TravelSubOptionMaster.objects.select_related('mode').all()
    serializer_class = TravelSubOptionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    pagination_class = NoPagination

class ActiveTravelSubOptionListView(ListAPIView):
    """
    Returns only active travel sub-options (for user dropdown)
    """
    serializer_class = TravelSubOptionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['mode']
    pagination_class = NoPagination

    def get_queryset(self):
        return TravelSubOptionMaster.objects.select_related("mode").filter(is_active=True)

class GradeEntitlementListCreateView(ListCreateAPIView):
    # queryset = GradeEntitlementMaster.objects.select_related(
    #     'grade', 'sub_option__mode', 'city_category'
    # ).filter(is_allowed=True)
    queryset = GradeEntitlementMaster.objects.select_related(
        'grade', 'sub_option__mode', 'city_category'
    ).all()
    serializer_class = GradeEntitlementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['grade', 'sub_option__mode', 'city_category']
    pagination_class = NoPagination

class GradeEntitlementDetailView(RetrieveUpdateDestroyAPIView):
    queryset = GradeEntitlementMaster.objects.select_related(
        'grade', 'sub_option__mode', 'city_category'
    ).all()
    serializer_class = GradeEntitlementSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

class GradeEntitlementBulkCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        records = request.data.get('records', [])
        serializer = GradeEntitlementBulkSerializer(data=records, many=True)

        serializer.is_valid(raise_exception=True)

        created_ids = []

        for record in serializer.validated_data:
            obj, created = GradeEntitlementMaster.objects.get_or_create(
                grade_id=record['grade'],
                sub_option_id=record.get('sub_option'),
                city_category_id=record.get('city_category'),
                defaults={
                    'max_amount': record.get('max_amount'),
                    'is_allowed': True,
                },
            )
            if created:
                created_ids.append(obj.id)

        return Response(
            {
                "created_count": len(created_ids),
                "created_ids": created_ids
            },
            status=status.HTTP_201_CREATED
        )

class AllowedTravelModesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = getattr(user, "organizational_profile", None)

        if not profile or not profile.grade:
            return Response({
                "success": False,
                "message": "User grade not found.",
                "data": []
            }, status=400)

        grade = profile.grade

        entitlements = GradeEntitlementMaster.objects.filter(
            grade=grade,
            is_allowed=True
        ).select_related(
            "sub_option",
            "sub_option__mode",
            "city_category"
        )

        response = {}

        for ent in entitlements:
            mode = ent.sub_option.mode
            sub = ent.sub_option
            is_accommodation = (mode.booking_category == "accommodation")

            if mode.id not in response:
                response[mode.id] = {
                    "id": mode.id,
                    "name": mode.name,
                    "booking_category": mode.booking_category,
                    "sub_options": {} if is_accommodation else []
                }

            sub_name = f"{sub.name} - {sub.description}" if sub.description else sub.name

            if is_accommodation:
                if sub.id not in response[mode.id]["sub_options"]:
                    response[mode.id]["sub_options"][sub.id] = {
                        "id": sub.id,
                        "name": sub_name,
                        "limits": []
                    }

                response[mode.id]["sub_options"][sub.id]["limits"].append({
                    "city_category": ent.city_category.name if ent.city_category else None,
                    "max_amount": ent.max_amount
                })
            else:
                response[mode.id]["sub_options"].append({
                    "id": sub.id,
                    "name": sub_name,
                    "max_amount": ent.max_amount
                })

        # Normalize accommodation sub_options dict → list
        for mode_data in response.values():
            if isinstance(mode_data["sub_options"], dict):
                mode_data["sub_options"] = list(mode_data["sub_options"].values())

        return Response({
            "success": True,
            "message": "Allowed travel modes loaded successfully.",
            "data": list(response.values())
        }, status=200)
    
# Accommodation Views
class GuestHouseMasterViewSet(viewsets.ModelViewSet):
    queryset = GuestHouseMaster.objects.select_related('city', 'state', 'country', 'gl_code', 'manager').all()
    serializer_class = GuestHouseMasterSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['city', 'state', 'country', 'property_type', 'ownership_type', 'is_active']
    search_fields = ['name', 'address', 'contact_person', 'phone_number', 'email']
    ordering_fields = ['name', 'city', 'created_at', 'updated_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search', None)
        
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(address__icontains=search) |
                Q(contact_person__icontains=search) |
                Q(phone_number__icontains=search) |
                Q(email__icontains=search) |
                Q(gstin__icontains=search) |
                Q(vendor_code__icontains=search) |
                Q(registration_number__icontains=search) |
                Q(district__icontains=search) |
                Q(pin_code__icontains=search) |
                Q(city__city_name__icontains=search) |
                Q(state__state_name__icontains=search) |
                Q(country__country_name__icontains=search)
            )
    
        return queryset
    
    from rest_framework.decorators import action

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # Check if hard delete is requested
        if request.query_params.get('hard_delete') == 'true':
            instance.delete()  # Permanent delete
            return Response({'message': 'Guest house deleted permanently'}, status=status.HTTP_204_NO_CONTENT)
        else:
            # Soft delete (deactivate)
            instance.is_active = False
            instance.save()
            return Response({'message': 'Guest house deactivated successfully'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        instance = self.get_object()
        instance.is_active = not instance.is_active
        instance.save()
        status_text = 'activated' if instance.is_active else 'deactivated'
        return Response(
            {'message': f'Guest house {status_text} successfully', 'is_active': instance.is_active},
            status=status.HTTP_200_OK
        )

class ARCHotelListCreateView(ListCreateAPIView):
    """
    List all active ARC hotels or create a new hotel.
    
    Supports filtering by:
    - city: Filter by city ID
    - state: Filter by state ID
    - category: Filter by hotel category
    - hotel_type: Filter by hotel type (resort, business, boutique)
    - star_rating: Filter by star rating
    
    Supports searching by:
    - name, group_name, address, email, phone_number, gstin, pan
    """
    queryset = ARCHotelMaster.objects.select_related(
        'city', 'state', 'country', 'created_by', 'updated_by'
    ).all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['city', 'state', 'category', 'hotel_type', 'star_rating', 'is_active']
    search_fields = ['name', 'group_name', 'address', 'email', 'phone_number', 'gstin', 'pan']
    ordering_fields = ['name', 'rate_per_night', 'star_rating', 'created_at']
    ordering = ['name']
    pagination_class = StandardResultsSetPagination
    
    def get_serializer_class(self):
        """Use lightweight serializer for list view"""
        if self.request.method == 'GET':
            return ARCHotelListSerializer
        return ARCHotelSerializer
    
    def get_queryset(self):
        """Enhanced queryset with comprehensive search"""
        queryset = super().get_queryset()
        search = self.request.query_params.get('search', None)
        
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(group_name__icontains=search) |
                Q(address__icontains=search) |
                Q(phone_number__icontains=search) |
                Q(email__icontains=search) |
                Q(gstin__icontains=search) |
                Q(pan__icontains=search) |
                Q(city__city_name__icontains=search) |
                Q(state__state_name__icontains=search) |
                Q(country__country_name__icontains=search)
            )
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        """Return paginated response with metadata"""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return paginated_response(
                serializer.data, 
                self.paginator, 
                message="ARC Hotels fetched successfully"
            )
        
        serializer = self.get_serializer(queryset, many=True)
        return success_response(data=serializer.data, message="ARC Hotels fetched successfully")


class ARCHotelDetailView(RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, or delete an ARC hotel.
    
    Requires admin permissions for update and delete operations.
    """
    queryset = ARCHotelMaster.objects.select_related(
        'city', 'state', 'country', 'created_by', 'updated_by'
    ).all()
    serializer_class = ARCHotelSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Allow read for authenticated users, write for admin only"""
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsAuthenticated(), IsAdminUser()]
        return [IsAuthenticated()]
    
    def retrieve(self, request, *args, **kwargs):
        """Return hotel details with success_response format"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return success_response(
            data=serializer.data,
            message="ARC Hotel details fetched successfully"
        )
    
    def perform_destroy(self, instance):
        """Soft delete by setting is_active to False"""
        instance.is_active = False
        instance.updated_by = self.request.user
        instance.save()

class ARCHotelDropdownView(ListAPIView):
    serializer_class = ARCHotelDropdownSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        queryset = ARCHotelMaster.objects.filter(is_active=True)
        city_ids = self.request.query_params.get('city_ids')
        
        if city_ids:
            try:
                ids = [int(id.strip()) for id in city_ids.split(',') if id.strip().isdigit()]
                if ids:
                    queryset = queryset.filter(city__id__in=ids)
            except ValueError:
                pass
                
        return queryset

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class LocationSPOCListCreateView(ListCreateAPIView):
    queryset = LocationSPOC.objects.select_related('location', 'spoc_user').all()
    serializer_class = LocationSPOCSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]     
    filterset_fields = ['location', 'spoc_type']

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class LocationSPOCDetailView(RetrieveUpdateDestroyAPIView):
    queryset = LocationSPOC.objects.select_related('location', 'spoc_user').all()
    serializer_class = LocationSPOCSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]


# Approval and Policy Views
class ApprovalMatrixListCreateView(ListCreateAPIView):
    queryset = ApprovalMatrix.objects.select_related('travel_mode', 'employee_grade').all()
    serializer_class = ApprovalMatrixSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['travel_mode', 'employee_grade']
    pagination_class = NoPagination

class ApprovalMatrixDetailView(RetrieveUpdateDestroyAPIView):
    queryset = ApprovalMatrix.objects.select_related('travel_mode', 'employee_grade').all()
    serializer_class = ApprovalMatrixSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    pagination_class = NoPagination

class DAIncidentalListCreateView(ListCreateAPIView):
    queryset = DAIncidentalMaster.objects.select_related('grade', 'city_category').all()
    serializer_class = DAIncidentalSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['grade', 'city_category']
    pagination_class = None

class DAIncidentalDetailView(RetrieveUpdateDestroyAPIView):
    queryset = DAIncidentalMaster.objects.select_related('grade', 'city_category').all()
    serializer_class = DAIncidentalSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

class ConveyanceRateListCreateView(ListCreateAPIView):
    queryset = ConveyanceRateMaster.objects.filter(is_active=True)
    serializer_class = ConveyanceRateSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['conveyance_type']

class ConveyanceRateDetailView(RetrieveUpdateDestroyAPIView):
    queryset = ConveyanceRateMaster.objects.all()
    serializer_class = ConveyanceRateSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

class VehicleCategoryListCreateView(ListCreateAPIView):
    queryset = VehicleCategoryMaster.objects.all()
    serializer_class = VehicleCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['code', 'is_active']
    search_fields = ['name', 'code']

class VehicleCategoryDetailView(RetrieveUpdateDestroyAPIView):
    queryset = VehicleCategoryMaster.objects.all()
    serializer_class = VehicleCategorySerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()

class VehicleCategoryDropdownView(ListAPIView):
    queryset = VehicleCategoryMaster.objects.filter(is_active=True)
    serializer_class = VehicleCategoryDropdownSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

class VehicleTypeListCreateView(ListCreateAPIView):
    queryset = VehicleTypeMaster.objects.all().select_related('category')
    serializer_class = VehicleTypeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category', 'category__code', 'is_active']
    search_fields = ['name', 'category__name']

class VehicleTypeDetailView(RetrieveUpdateDestroyAPIView):
    queryset = VehicleTypeMaster.objects.select_related('category').all()
    serializer_class = VehicleTypeSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()

class VehicleTypeDropdownView(ListAPIView):
    queryset = VehicleTypeMaster.objects.filter(is_active=True).select_related('category')
    serializer_class = VehicleTypeDropdownSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

class TravelPolicyListCreateView(ListCreateAPIView):
    queryset = TravelPolicyMaster.objects.select_related('travel_mode', 'employee_grade').filter(is_active=True)
    serializer_class = TravelPolicySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['policy_type', 'travel_mode', 'employee_grade']

class TravelPolicyDetailView(RetrieveUpdateDestroyAPIView):
    queryset = TravelPolicyMaster.objects.select_related('travel_mode', 'employee_grade').all()
    serializer_class = TravelPolicySerializer
    permission_classes = [IsAuthenticated, IsAdminUser]