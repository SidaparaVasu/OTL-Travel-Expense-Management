from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from ..models import *
from ..serializers.master_serializers import *
from ..filters import *

# ===========================
# Base Master ViewSet
# ===========================
class BaseMasterViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    ordering_fields = ["id", "created_at"]
    ordering = ["-id"]


# ===========================
# 1) ProfileTypeMaster
# ===========================
class ProfileTypeMasterViewSet(BaseMasterViewSet):
    queryset = ProfileTypeMaster.objects.all()
    serializer_class = ProfileTypeMasterSerializer
    filterset_class = ProfileTypeMasterFilter
    search_fields = ["code", "name", "description"]

    @action(detail=False, methods=["get"], url_path="dropdown")
    def dropdown(self, request):
        qs = self.filter_queryset(self.get_queryset().filter(is_active=True).order_by("name"))
        serializer = ProfileTypeMasterDropdownSerializer(qs, many=True)
        return Response(serializer.data)


# ===========================
# 2) ServiceCategoryMaster
# ===========================
class ServiceCategoryMasterViewSet(BaseMasterViewSet):
    queryset = ServiceCategoryMaster.objects.all()
    serializer_class = ServiceCategoryMasterSerializer
    filterset_class = ServiceCategoryMasterFilter
    search_fields = ["code", "name", "description", "booking_group"]

    @action(detail=False, methods=["get"], url_path="dropdown")
    def dropdown(self, request):
        qs = self.filter_queryset(self.get_queryset().filter(is_active=True).order_by("name"))
        serializer = ServiceCategoryDropdownSerializer(qs, many=True)
        return Response(serializer.data)


# ===========================
# 3) ProfileTypeServiceMap
# ===========================
class ProfileTypeServiceMapViewSet(BaseMasterViewSet):
    queryset = ProfileTypeServiceMap.objects.select_related("profile_type", "service_category").all()
    serializer_class = ProfileTypeServiceMapSerializer
    filterset_class = ProfileTypeServiceMapFilter
    search_fields = ["profile_type__code", "profile_type__name", "service_category__code", "service_category__name"]


# ===========================
# 4) BookingAgentService
# ===========================
class BookingAgentServiceViewSet(BaseMasterViewSet):
    queryset = (
        BookingAgentService.objects
        .select_related("booking_agent_profile", "profile_type")
        .prefetch_related("service_cities")
        .all()
    )
    serializer_class = BookingAgentServiceSerializer
    filterset_class = BookingAgentServiceFilter
    search_fields = [
        "booking_agent_profile__organization_name",
        "profile_type__code",
        "profile_type__name",
    ]

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return BookingAgentServiceListSerializer
        return BookingAgentServiceSerializer

    @action(detail=False, methods=["get"], url_path="dropdown")
    def dropdown(self, request):
        """
        Dropdown for selecting booking agent service.
        Supports filters:
          - profile_type=<id>
          - booking_agent_profile=<id>
          - city=<id> (matches M2M service_cities OR serves_all_cities=True)
        """
        qs = self.get_queryset().filter(is_active=True)

        profile_type = request.query_params.get("profile_type")
        booking_agent_profile = request.query_params.get("booking_agent_profile")
        city = request.query_params.get("city")

        if profile_type:
            qs = qs.filter(profile_type_id=profile_type)

        if booking_agent_profile:
            qs = qs.filter(booking_agent_profile_id=booking_agent_profile)

        if city:
            # PAN india OR city mapped
            qs = qs.filter(serves_all_cities=True) | qs.filter(service_cities__id=city)

        qs = qs.distinct().order_by("id")

        serializer = BookingAgentServiceDropdownSerializer(qs, many=True)
        return Response(serializer.data)


# ===========================
# 5) BookingAgentServiceCategory
# ===========================
class BookingAgentServiceCategoryViewSet(BaseMasterViewSet):
    queryset = (
        BookingAgentServiceCategory.objects
        .select_related("booking_agent_service", "service_category", "booking_agent_service__booking_agent_profile")
        .all()
    )
    serializer_class = BookingAgentServiceCategorySerializer
    filterset_class = BookingAgentServiceCategoryFilter
    search_fields = [
        "booking_agent_service__booking_agent_profile__organization_name",
        "service_category__code",
        "service_category__name",
        "booking_agent_service__profile_type__code",
    ]


# ===========================
# 6) BookingAgentContact
# ===========================
class BookingAgentContactViewSet(BaseMasterViewSet):
    queryset = (
        BookingAgentContact.objects
        .select_related("booking_agent_service", "booking_agent_service__booking_agent_profile")
        .all()
    )
    serializer_class = BookingAgentContactSerializer
    filterset_class = BookingAgentContactFilter
    search_fields = ["name", "email", "phone", "role"]

    @action(detail=False, methods=["get"], url_path="dropdown")
    def dropdown(self, request):
        qs = self.get_queryset().filter(is_active=True)

        booking_agent_service = request.query_params.get("booking_agent_service")
        if booking_agent_service:
            qs = qs.filter(booking_agent_service_id=booking_agent_service)

        qs = qs.order_by("role", "name")
        serializer = BookingAgentContactDropdownSerializer(qs, many=True)
        return Response(serializer.data)


# ===========================
# 7) BookingAgentVehicleTypeMap
# ===========================
class BookingAgentVehicleTypeMapViewSet(BaseMasterViewSet):
    queryset = (
        BookingAgentVehicleTypeMap.objects
        .select_related("booking_agent_service", "vehicle_type")
        .all()
    )
    serializer_class = BookingAgentVehicleTypeMapSerializer
    filterset_class = BookingAgentVehicleTypeMapFilter
    search_fields = [
        "vehicle_type__name",
        "booking_agent_service__booking_agent_profile__organization_name",
    ]

    @action(detail=False, methods=["get"], url_path="dropdown")
    def dropdown(self, request):
        """
        Returns dropdown: vehicle types based on booking_agent_service
        """
        booking_agent_service = request.query_params.get("booking_agent_service")
        qs = self.get_queryset().filter(is_active=True)

        if booking_agent_service:
            qs = qs.filter(booking_agent_service_id=booking_agent_service)

        qs = qs.order_by("vehicle_type__name")
        serializer = BookingAgentVehicleTypeDropdownSerializer(qs, many=True)
        return Response(serializer.data)


# ===========================
# 8) BookingAgentAssignmentRule
# ===========================
class BookingAgentAssignmentRuleViewSet(BaseMasterViewSet):
    queryset = (
        BookingAgentAssignmentRule.objects
        .select_related(
            "service_category",
            "city",
            "booking_agent_service",
            "booking_agent_service__booking_agent_profile",
            "booking_agent_service__profile_type"
        )
        .all()
    )
    serializer_class = BookingAgentAssignmentRuleSerializer
    filterset_class = BookingAgentAssignmentRuleFilter
    search_fields = [
        "service_category__code",
        "service_category__name",
        "city__city_name",
        "booking_agent_service__booking_agent_profile__organization_name",
        "booking_agent_service__profile_type__code",
    ]
