from rest_framework import serializers
from apps.booking_agent.models import *

# ===========================
# Common Dropdown Serializer
# ===========================
class IdNameDropdownSerializer(serializers.ModelSerializer):
    """
    Generic serializer for dropdowns (id, name).
    Use for models that have `name` field.
    """
    class Meta:
        fields = ("id", "name")


# ===========================
# 1) ProfileTypeMaster
# ===========================
class ProfileTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfileTypeMaster
        fields = "__all__"


class ProfileTypeMasterDropdownSerializer(IdNameDropdownSerializer):
    class Meta(IdNameDropdownSerializer.Meta):
        model = ProfileTypeMaster


# ===========================
# 2) ServiceCategoryMaster
# ===========================
class ServiceCategoryMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategoryMaster
        fields = "__all__"


class ServiceCategoryDropdownSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategoryMaster
        fields = ("id", "code", "name", "booking_group")


# ===========================
# 3) ProfileTypeServiceMap
# ===========================
class ProfileTypeServiceMapSerializer(serializers.ModelSerializer):
    profile_type_name = serializers.CharField(source="profile_type.name", read_only=True)
    profile_type_code = serializers.CharField(source="profile_type.code", read_only=True)

    service_category_name = serializers.CharField(source="service_category.name", read_only=True)
    service_category_code = serializers.CharField(source="service_category.code", read_only=True)
    booking_group = serializers.CharField(source="service_category.booking_group", read_only=True)

    class Meta:
        model = ProfileTypeServiceMap
        fields = "__all__"


# ===========================
# 4) BookingAgentService
# ===========================
class BookingAgentServiceSerializer(serializers.ModelSerializer):
    booking_agent_profile_name = serializers.CharField(
        source="booking_agent_profile.organization_name",
        read_only=True
    )
    profile_type_name = serializers.CharField(source="profile_type.name", read_only=True)
    profile_type_code = serializers.CharField(source="profile_type.code", read_only=True)

    service_city_ids = serializers.PrimaryKeyRelatedField(
        source="service_cities",
        many=True,
        required=False,
        queryset=CityMaster.objects.all()
    )

    class Meta:
        model = BookingAgentService
        fields = (
            "id",
            "booking_agent_profile",
            "booking_agent_profile_name",
            "profile_type",
            "profile_type_name",
            "profile_type_code",
            "serves_all_cities",
            "service_city_ids",
            "is_active",
            "created_at",
        )

    def validate(self, attrs):
        serves_all_cities = attrs.get("serves_all_cities", None)
        service_cities = attrs.get("service_cities", None)

        # If serves_all_cities=False then service_cities should be provided
        if serves_all_cities is False and service_cities is not None and len(service_cities) == 0:
            raise serializers.ValidationError({
                "service_city_ids": "If serves_all_cities=False, service_cities must not be empty."
            })

        return attrs


class BookingAgentServiceListSerializer(serializers.ModelSerializer):
    booking_agent_profile_name = serializers.CharField(
        source="booking_agent_profile.organization_name",
        read_only=True
    )
    profile_type_name = serializers.CharField(source="profile_type.name", read_only=True)
    profile_type_code = serializers.CharField(source="profile_type.code", read_only=True)

    # Show cities as objects in list view
    service_cities = serializers.SerializerMethodField()

    class Meta:
        model = BookingAgentService
        fields = (
            "id",
            "booking_agent_profile",
            "booking_agent_profile_name",
            "profile_type",
            "profile_type_name",
            "profile_type_code",
            "serves_all_cities",
            "service_cities",
            "is_active",
            "created_at",
        )

    def get_service_cities(self, obj):
        return [{"id": c.id, "name": c.city_name} for c in obj.service_cities.all()]


class BookingAgentServiceDropdownSerializer(serializers.ModelSerializer):
    booking_agent_profile_name = serializers.CharField(
        source="booking_agent_profile.organization_name",
        read_only=True
    )
    profile_type_code = serializers.CharField(source="profile_type.code", read_only=True)
    profile_type_name = serializers.CharField(source="profile_type.name", read_only=True)

    class Meta:
        model = BookingAgentService
        fields = (
            "id",
            "booking_agent_profile",
            "booking_agent_profile_name",
            "profile_type",
            "profile_type_code",
            "profile_type_name",
        )


# ===========================
# 5) BookingAgentServiceCategory
# ===========================
class BookingAgentServiceCategorySerializer(serializers.ModelSerializer):
    booking_agent_profile_name = serializers.CharField(
        source="booking_agent_service.booking_agent_profile.organization_name",
        read_only=True
    )
    profile_type_code = serializers.CharField(
        source="booking_agent_service.profile_type.code",
        read_only=True
    )
    service_category_code = serializers.CharField(source="service_category.code", read_only=True)
    service_category_name = serializers.CharField(source="service_category.name", read_only=True)

    class Meta:
        model = BookingAgentServiceCategory
        fields = "__all__"


# ===========================
# 6) BookingAgentContact
# ===========================
class BookingAgentContactSerializer(serializers.ModelSerializer):
    booking_agent_profile_name = serializers.CharField(
        source="booking_agent_service.booking_agent_profile.organization_name",
        read_only=True
    )
    profile_type_code = serializers.CharField(
        source="booking_agent_service.profile_type.code",
        read_only=True
    )

    class Meta:
        model = BookingAgentContact
        fields = "__all__"


class BookingAgentContactDropdownSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingAgentContact
        fields = ("id", "name", "email", "phone", "role")


# ===========================
# 7) BookingAgentVehicleTypeMap
# ===========================
class BookingAgentVehicleTypeMapSerializer(serializers.ModelSerializer):
    vehicle_type_name = serializers.CharField(source="vehicle_type.name", read_only=True)

    booking_agent_profile_name = serializers.CharField(
        source="booking_agent_service.booking_agent_profile.organization_name",
        read_only=True
    )
    profile_type_code = serializers.CharField(
        source="booking_agent_service.profile_type.code",
        read_only=True
    )

    class Meta:
        model = BookingAgentVehicleTypeMap
        fields = "__all__"


class BookingAgentVehicleTypeDropdownSerializer(serializers.ModelSerializer):
    vehicle_type_name = serializers.CharField(source="vehicle_type.name", read_only=True)

    class Meta:
        model = BookingAgentVehicleTypeMap
        fields = ("vehicle_type", "vehicle_type_name")


# ===========================
# 8) BookingAgentAssignmentRule
# ===========================
class BookingAgentAssignmentRuleSerializer(serializers.ModelSerializer):
    service_category_code = serializers.CharField(source="service_category.code", read_only=True)
    service_category_name = serializers.CharField(source="service_category.name", read_only=True)

    city_name = serializers.CharField(source="city.city_name", read_only=True)

    booking_agent_profile_name = serializers.CharField(
        source="booking_agent_service.booking_agent_profile.organization_name",
        read_only=True
    )
    profile_type_code = serializers.CharField(
        source="booking_agent_service.profile_type.code",
        read_only=True
    )

    class Meta:
        model = BookingAgentAssignmentRule
        fields = "__all__"
