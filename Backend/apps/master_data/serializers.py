from rest_framework import serializers
from .models import *
from apps.authentication.models import User
from apps.authentication.models import OrganizationalProfile

# Company serializers
class CompanyInformationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyInformation
        fields = '__all__'
        extra_kwargs = {
            'logo': {'required': False, 'allow_null': True},
            'signature': {'required': False, 'allow_null': True},
            'header': {'required': False, 'allow_blank': True},
            'footer': {'required': False, 'allow_blank': True},
        }

class DepartmentSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    
    class Meta:
        model = DepartmentMaster
        fields = ['department_id', 'dept_name', 'dept_code', 'description', 'company', 'company_name']

class DesignationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DesignationMaster
        fields = '__all__'

class EmployeeTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeTypeMaster
        fields = '__all__'

# Geography serializers

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class CityCategoryAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CityCategoryAssignment
        fields = "__all__"

    def validate(self, data):
        # Use provided values (for create) or fallback to instance values (for update)
        country = data.get("country_name", getattr(self.instance, "country_name", None))
        state = data.get("state_name", getattr(self.instance, "state_name", None))
        city = data.get("city_name", getattr(self.instance, "city_name", None))

        qs = CityCategoryAssignment.objects.filter(
            country_name=country,
            state_name=state,
            city_name=city,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This city already has a category assigned.")
        return data
    
class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = CountryMaster
        fields = '__all__'

class StateSerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source='country.country_name', read_only=True)
    
    class Meta:
        model = StateMaster
        fields = ['id', 'state_name', 'state_code', 'country', 'country_name']

class CitySerializer(serializers.ModelSerializer):
    state_name = serializers.CharField(source='state.state_name', read_only=True)
    country_name = serializers.CharField(source='state.country.country_name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = CityMaster
        fields = ['id', 'city_name', 'city_code', 'state', 'state_name', 'country_name', 'category', 'category_name']

class CityCategoriesSerializer(serializers.ModelSerializer):
    class Meta:
        model = CityCategoriesMaster
        fields = '__all__'

class LocationSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.city_name', read_only=True)
    state_name = serializers.CharField(source='state.state_name', read_only=True)
    country_name = serializers.CharField(source='country.country_name', read_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True)
    
    class Meta:
        model = LocationMaster
        fields = [
            'location_id', 'location_name', 'location_code', 'company', 'company_name',
            'city', 'city_name', 'state', 'state_name', 'country', 'country_name',
            'address', 'is_active'
        ]

# Other master data
class GradeSerializer(serializers.ModelSerializer):
    glcode_name = serializers.SerializerMethodField()

    class Meta:
        model = GradeMaster
        fields = '__all__'

    def get_glcode_name(self, obj):
        return obj.glcode.vertical_name if obj.glcode else None

class TravelModeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelModeMaster
        fields = '__all__'

class MealPreferenceMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealPreferenceMaster
        fields = '__all__'

class TravelSubOptionSerializer(serializers.ModelSerializer):
    mode_name = serializers.CharField(source='mode.name', read_only=True)
    
    class Meta:
        model = TravelSubOptionMaster
        fields = ['id', 'mode', 'mode_name', 'name', 'description', 'is_self_arranged', 'is_active']

class GradeEntitlementSerializer(serializers.ModelSerializer):
    grade_name = serializers.CharField(source='grade.name', read_only=True)
    sub_option_name = serializers.CharField(source='sub_option.name', read_only=True)
    mode_name = serializers.CharField(source='sub_option.mode.name', read_only=True)
    city_category_name = serializers.CharField(source='city_category.name', read_only=True)
    
    class Meta:
        model = GradeEntitlementMaster
        fields = [
            'id', 'grade', 'grade_name', 'sub_option', 'sub_option_name', 
            'mode_name', 'city_category', 'city_category_name', 
            'max_amount', 'is_allowed'
        ]

class GradeEntitlementBulkSerializer(serializers.Serializer):
    grade = serializers.IntegerField()
    sub_option = serializers.IntegerField(required=False, allow_null=True)
    city_category = serializers.IntegerField(required=False, allow_null=True)
    max_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )

class GLCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = GLCodeMaster
        fields = '__all__'

class GLCodeBulkUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = GLCodeMaster
        fields = (
            "vertical_name",
            "description",
            "short_description",
            "gl_code",
            "sorting_no",
            "is_active",
        )

# Accommodation serializers
class GuestHouseMasterSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.city_name', read_only=True)
    city_category = serializers.CharField(source='city.category.name', read_only=True)
    state_name = serializers.CharField(source='state.state_name', read_only=True)
    country_name = serializers.CharField(source='country.country_name', read_only=True)
    gl_code_display = serializers.CharField(source='gl_code.gl_code', read_only=True)
    manager_name = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = GuestHouseMaster
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'created_by', 'updated_by')
    
    def get_manager_name(self, obj):
        if obj.manager:
            return f"{obj.manager.first_name} {obj.manager.last_name}"
        return None
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)

# Annual Rate Contract Hotels
class ARCHotelSerializer(serializers.ModelSerializer):
    """Serializer for ARC Hotel Master with enhanced fields"""
    
    # Read-only related fields
    city_name = serializers.CharField(source='city.city_name', read_only=True)
    state_name = serializers.CharField(source='state.state_name', read_only=True)
    country_name = serializers.CharField(source='country.country_name', read_only=True)
    
    # Display fields for choice fields
    hotel_type_display = serializers.CharField(source='get_hotel_type_display', read_only=True)
    star_rating_display = serializers.CharField(source='get_star_rating_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    
    # Computed fields
    total_rate_with_tax = serializers.SerializerMethodField()
    contract_valid = serializers.SerializerMethodField()
    
    # Audit fields
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.get_full_name', read_only=True)
    
    class Meta:
        model = ARCHotelMaster
        fields = [
            'id', 'name', 'hotel_type', 'hotel_type_display', 'star_rating', 
            'star_rating_display', 'group_name', 'gstin', 'pan', 'operating_since',
            'address', 'city', 'city_name', 'state', 'state_name', 
            'country', 'country_name', 'postal_code',
            'phone_number', 'email', 'website', 'social_media',
            'total_rooms', 'room_types', 'check_in_time', 'check_out_time',
            'facilities', 'rate_per_night', 'tax_percentage', 'total_rate_with_tax',
            'contract_start_date', 'contract_end_date', 'contract_valid',
            'category', 'category_display', 'is_active',
            'created_at', 'updated_at', 'created_by', 'created_by_name',
            'updated_by', 'updated_by_name'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']
    
    def get_total_rate_with_tax(self, obj):
        """Calculate total rate including tax"""
        return float(obj.get_total_rate_with_tax())
    
    def get_contract_valid(self, obj):
        """Check if contract is currently valid"""
        return obj.is_contract_valid()
    
    def create(self, validated_data):
        """Override create to set created_by"""
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Override update to set updated_by"""
        validated_data['updated_by'] = self.context['request'].user
        return super().update(instance, validated_data)

class ARCHotelListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""
    
    city_name = serializers.CharField(source='city.city_name', read_only=True)
    state_name = serializers.CharField(source='state.state_name', read_only=True)
    hotel_type_display = serializers.CharField(source='get_hotel_type_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    total_rate_with_tax = serializers.SerializerMethodField()
    contract_valid = serializers.SerializerMethodField()
    
    class Meta:
        model = ARCHotelMaster
        fields = [
            'id', 'name', 'hotel_type', 'hotel_type_display', 'star_rating',
            'city', 'city_name', 'state_name', 'category', 'category_display',
            'phone_number', 'email', 'total_rooms',
            'rate_per_night', 'tax_percentage', 'total_rate_with_tax',
            'contract_start_date', 'contract_end_date', 'contract_valid',
            'is_active'
        ]
    
    def get_total_rate_with_tax(self, obj):
        return float(obj.get_total_rate_with_tax())
    
    def get_contract_valid(self, obj):
        return obj.is_contract_valid()

class ARCHotelDropdownSerializer(serializers.ModelSerializer):
    # Read-only related fields
    city_name = serializers.CharField(source='city.city_name', read_only=True)
    state_name = serializers.CharField(source='state.state_name', read_only=True)
    country_name = serializers.CharField(source='country.country_name', read_only=True)
    city_category = serializers.CharField(source='city.category.name', read_only=True)
    class Meta:
        model = ARCHotelMaster
        fields = ['id', 'name', 'city', 'city_name', 'state', 'state_name', 'country', 'country_name', 'city_category']

# DEPRECATED: This model/component is not in use anymore and is marked for deletion.
# Status: Deprecated since June 2, 2026 — no active usage recorded.
class LocationSPOCSerializer(serializers.ModelSerializer):
    location_name = serializers.CharField(source='location.location_name', read_only=True)
    spoc_name = serializers.CharField(source='spoc_user.get_full_name', read_only=True)
    backup_spoc_name = serializers.CharField(source='backup_spoc.get_full_name', read_only=True)
    
    class Meta:
        model = LocationSPOC
        fields = [
            'id', 'location', 'location_name', 'spoc_user', 'spoc_name',
            'spoc_type', 'phone_number', 'email', 'backup_spoc', 
            'backup_spoc_name', 'is_active'
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        request = self.context.get("request")

        # filter when creating/updating
        if request and request.method in ("POST", "PUT", "PATCH"):
            location_id = request.data.get("location")

            if location_id:
                user_ids = OrganizationalProfile.objects.filter(
                    base_location_id=location_id
                ).values_list("user_id", flat=True)

                self.fields["spoc_user"].queryset = User.objects.filter(id__in=user_ids)
                self.fields["backup_spoc"].queryset = User.objects.filter(id__in=user_ids)

            else:
                self.fields["spoc_user"].queryset = User.objects.none()
                self.fields["backup_spoc"].queryset = User.objects.none()

# Approval and policy serializers
class ApprovalMatrixSerializer(serializers.ModelSerializer):
    travel_mode_name = serializers.CharField(source='travel_mode.name', read_only=True)
    grade_name = serializers.CharField(source='employee_grade.name', read_only=True)
    
    class Meta:
        model = ApprovalMatrix
        fields = [
            'id', 'travel_mode', 'travel_mode_name', 'employee_grade', 'grade_name',
            'min_amount', 'max_amount', 'requires_manager', 'requires_chro', 
            'requires_ceo', 'flight_above_10k_ceo', 'manager_can_view',
            'manager_can_approve', 'advance_booking_required_days', 'is_active'
        ]

class DAIncidentalSerializer(serializers.ModelSerializer):
    grade_name = serializers.CharField(source='grade.name', read_only=True)
    category_name = serializers.CharField(source='city_category.name', read_only=True)
    currently_effective = serializers.SerializerMethodField()
    
    class Meta:
        model = DAIncidentalMaster
        fields = [
            'id', 'grade', 'grade_name', 'city_category', 'category_name',
            'da_full_day', 'da_half_day', 'incidental_full_day', 'incidental_half_day',
            'stay_allowance_category_a', 'stay_allowance_category_b',
            'effective_from', 'effective_to', 'is_active', 'currently_effective'
        ]
    
    def get_currently_effective(self, obj):
        return obj.is_currently_effective()

class ConveyanceRateSerializer(serializers.ModelSerializer):
    currently_effective = serializers.SerializerMethodField()
    
    class Meta:
        model = ConveyanceRateMaster
        fields = [
            'id', 'conveyance_type', 'rate_per_km', 'max_distance_per_day',
            'requires_receipt', 'max_claim_amount', 'effective_from',
            'effective_to', 'is_active', 'currently_effective'
        ]
    
    def get_currently_effective(self, obj):
        from django.utils import timezone
        today = timezone.now().date()
        
        if not obj.is_active:
            return False
            
        if today < obj.effective_from:
            return False
            
        if obj.effective_to and today > obj.effective_to:
            return False
            
        return True

# Additional travel serializers
class VehicleCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleCategoryMaster
        fields = '__all__'

class VehicleCategoryDropdownSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleCategoryMaster
        fields = ['id', 'name', 'code']

class VehicleTypeSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_code = serializers.CharField(source='category.code', read_only=True)

    class Meta:
        model = VehicleTypeMaster
        fields = '__all__'

class VehicleTypeDropdownSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    class Meta:
        model = VehicleTypeMaster
        fields = ['id', 'name', 'category_name']

class TravelPolicySerializer(serializers.ModelSerializer):
    travel_mode_name = serializers.CharField(source='travel_mode.name', read_only=True)
    grade_name = serializers.CharField(source='employee_grade.name', read_only=True)
    currently_effective = serializers.SerializerMethodField()
    
    class Meta:
        model = TravelPolicyMaster
        fields = [
            'id', 'policy_type', 'title', 'description', 'travel_mode', 
            'travel_mode_name', 'employee_grade', 'grade_name', 'rule_parameters',
            'is_active', 'effective_from', 'effective_to', 'currently_effective'
        ]
    
    def get_currently_effective(self, obj):
        return obj.is_currently_effective()