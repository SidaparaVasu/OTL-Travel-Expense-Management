from django.contrib import admin
from .models import company, geography, grades, travel, workflow, approval, accommodation
from apps.authentication.models.user import User

# Register your models here.
@admin.register(company.CompanyInformation)
class CompanyInformationAdmin(admin.ModelAdmin):
    list_display = ('name', 'email_address', 'phone_number', 'website', 'pincode')

@admin.register(company.DepartmentMaster)
class DepartmentMasterAdmin(admin.ModelAdmin):
    list_display = ('dept_name', 'dept_code', 'company')
    list_filter = ('company',)
    search_fields = ('dept_name', 'dept_code')

@admin.register(geography.LocationMaster)
class LocationMasterAdmin(admin.ModelAdmin):
    list_display = ('location_name', 'location_code', 'city', 'company', 'is_active')
    list_filter = ('company', 'is_active', 'city__state__country')
    search_fields = ('location_name', 'location_code')


admin.site.register(company.DesignationMaster)
admin.site.register(company.EmployeeTypeMaster)

admin.site.register(geography.CityCategoriesMaster)
admin.site.register(geography.CityCategoryAssignment)

@admin.register(geography.CountryMaster)
class CountryMasterAdmin(admin.ModelAdmin):
    list_display = ('country_name', 'country_code')
    search_fields = ('country_name', 'country_code')

@admin.register(geography.StateMaster)
class StateMasterAdmin(admin.ModelAdmin):
    list_display = ('state_name', 'state_code', 'get_country')
    search_fields = ('state_name', 'state_code', 'country__country_name')
    list_filter = ('country',)

    def get_country(self, obj):
        return obj.country.country_name
    get_country.short_description = 'Country'

@admin.register(geography.CityMaster)
class CityMasterAdmin(admin.ModelAdmin):
    list_display = ('city_name', 'state', 'get_country', 'category')
    search_fields = ('city_name', 'state__state_name', 'state__country__country_name')
    list_filter = ('category', 'state__country', 'state')

    def get_country(self, obj):
        return obj.state.country.country_name
    get_country.short_description = 'Country'


admin.site.register(travel.GLCodeMaster)
@admin.register(grades.GradeMaster)
class GradeMasterAdmin(admin.ModelAdmin):
    list_display = ('name', 'sorting_no', 'glcode', 'is_active')
    search_fields = ('name', 'glcode__gl_code')

admin.site.register(travel.TravelModeMaster)
admin.site.register(travel.TravelSubOptionMaster)

@admin.register(travel.GradeEntitlementMaster)
class GradeEntitlementMasterAdmin(admin.ModelAdmin):
    list_display = ("grade","sub_option","city_category","is_allowed","max_amount",)
    list_filter = ("grade","sub_option__mode","sub_option","city_category","is_allowed",)
    search_fields = ("grade__name",)
    autocomplete_fields = ("grade",)
    ordering = ("grade__sorting_no","grade__name","sub_option__mode__name","sub_option__name","city_category__name",)
    readonly_fields = ()
    list_per_page = 50

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related("grade","sub_option","sub_option__mode","city_category",)

admin.site.register(workflow.ApprovalWorkflowMaster)
admin.site.register(workflow.PermissionTypeMaster)


@admin.register(accommodation.GuestHouseMaster)
class GuestHouseAdmin(admin.ModelAdmin):
    list_display = ('name', 'property_type', 'ownership_type', 'contact_person', 'is_active')
    list_filter = ('is_active', 'city')
    search_fields = ('name', 'contact_person')

@admin.register(accommodation.ARCHotelMaster)
class ARCHotelAdmin(admin.ModelAdmin):
    list_display = ('name', 'city', 'hotel_type', 'star_rating', 'rate_per_night', 'is_contract_valid', 'is_active')
    list_filter = ('star_rating', 'is_active', 'city')
    search_fields = ('name',)
    date_hierarchy = 'contract_start_date'

# @admin.register(accommodation.LocationSPOC)
# class LocationSPOCAdmin(admin.ModelAdmin):
#     list_display = ('location', 'spoc_user', 'spoc_type', 'phone_number', 'is_active')
#     list_filter = ('spoc_type', 'is_active')
#     search_fields = ('location__location_name', 'spoc_user__username')

@admin.register(accommodation.LocationSPOC)
class LocationSPOCAdmin(admin.ModelAdmin):
    list_display = ('location', 'spoc_user', 'spoc_type', 'phone_number', 'is_active')
    list_filter = ('spoc_type', 'is_active')
    search_fields = ('location__location_name', 'spoc_user__username')

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name in ['spoc_user', 'backup_spoc'] and 'location' in request.GET:
            location_id = request.GET.get('location')
            kwargs["queryset"] = User.objects.filter(location_id=location_id)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

@admin.register(approval.ApprovalMatrix)
class ApprovalMatrixAdmin(admin.ModelAdmin):
    list_display = ('travel_mode', 'employee_grade', 'min_amount', 'max_amount', 'requires_manager', 'requires_chro', 'requires_ceo')
    list_filter = ('travel_mode', 'employee_grade', 'requires_manager', 'requires_chro', 'requires_ceo')
    
@admin.register(approval.DAIncidentalMaster)
class DAIncidentalAdmin(admin.ModelAdmin):
    list_display = ('grade', 'city_category', 'da_full_day', 'incidental_full_day', 'is_currently_effective')
    list_filter = ('grade', 'city_category', 'is_active')
    date_hierarchy = 'effective_from'

@admin.register(approval.ConveyanceRateMaster)
class ConveyanceRateAdmin(admin.ModelAdmin):
    list_display = ('conveyance_type', 'rate_per_km', 'requires_receipt', 'effective_from', 'is_active')
    list_filter = ('conveyance_type', 'requires_receipt', 'is_active')