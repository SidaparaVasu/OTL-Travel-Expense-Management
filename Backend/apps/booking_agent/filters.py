import django_filters
from .models import *


class ProfileTypeMasterFilter(django_filters.FilterSet):
    class Meta:
        model = ProfileTypeMaster
        fields = {
            "is_active": ["exact"],
            "code": ["exact", "icontains"],
            "name": ["icontains"],
        }


class ServiceCategoryMasterFilter(django_filters.FilterSet):
    class Meta:
        model = ServiceCategoryMaster
        fields = {
            "is_active": ["exact"],
            "code": ["exact", "icontains"],
            "name": ["icontains"],
            "booking_group": ["exact"],
        }


class ProfileTypeServiceMapFilter(django_filters.FilterSet):
    class Meta:
        model = ProfileTypeServiceMap
        fields = {
            "is_active": ["exact"],
            "profile_type": ["exact"],
            "service_category": ["exact"],
        }


class BookingAgentServiceFilter(django_filters.FilterSet):
    service_city = django_filters.NumberFilter(field_name="service_cities", lookup_expr="exact")

    class Meta:
        model = BookingAgentService
        fields = {
            "is_active": ["exact"],
            "booking_agent_profile": ["exact"],
            "profile_type": ["exact"],
            "serves_all_cities": ["exact"],
        }


class BookingAgentServiceCategoryFilter(django_filters.FilterSet):
    class Meta:
        model = BookingAgentServiceCategory
        fields = {
            "is_active": ["exact"],
            "booking_agent_service": ["exact"],
            "service_category": ["exact"],
        }


class BookingAgentContactFilter(django_filters.FilterSet):
    class Meta:
        model = BookingAgentContact
        fields = {
            "is_active": ["exact"],
            "booking_agent_service": ["exact"],
            "role": ["exact"],
        }


class BookingAgentVehicleTypeMapFilter(django_filters.FilterSet):
    class Meta:
        model = BookingAgentVehicleTypeMap
        fields = {
            "is_active": ["exact"],
            "booking_agent_service": ["exact"],
            "vehicle_type": ["exact"],
        }


class BookingAgentAssignmentRuleFilter(django_filters.FilterSet):
    class Meta:
        model = BookingAgentAssignmentRule
        fields = {
            "is_active": ["exact"],
            "service_category": ["exact"],
            "city": ["exact"],
            "booking_agent_service": ["exact"],
            "priority": ["exact", "gte", "lte"],
        }
