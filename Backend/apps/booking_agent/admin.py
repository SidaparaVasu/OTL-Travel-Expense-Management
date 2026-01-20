from django.contrib import admin
from .models import (
    ProfileTypeMaster,
    ServiceCategoryMaster,
    ProfileTypeServiceMap,
    BookingAgentService,
    BookingAgentServiceCategory,
    BookingAgentContact,
    BookingAgentVehicleTypeMap,
    BookingAgentAssignmentRule,
    VehicleCategoryMaster,
    VehicleTypeMaster
)

@admin.register(ProfileTypeMaster)
class ProfileTypeMasterAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_active', 'created_at')
    search_fields = ('name', 'code')
    list_filter = ('is_active',)

@admin.register(ServiceCategoryMaster)
class ServiceCategoryMasterAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'booking_group', 'is_active')
    search_fields = ('name', 'code')
    list_filter = ('booking_group', 'is_active')

class BookingAgentContactInline(admin.TabularInline):
    model = BookingAgentContact
    extra = 1

class BookingAgentServiceCategoryInline(admin.TabularInline):
    model = BookingAgentServiceCategory
    extra = 1

class BookingAgentVehicleTypeMapInline(admin.TabularInline):
    model = BookingAgentVehicleTypeMap
    extra = 1
    autocomplete_fields = ['vehicle_type']

@admin.register(BookingAgentService)
class BookingAgentServiceAdmin(admin.ModelAdmin):
    list_display = ('booking_agent_profile', 'profile_type', 'serves_all_cities', 'is_active')
    list_filter = ('profile_type', 'serves_all_cities', 'is_active')
    search_fields = ('booking_agent_profile__organization_name',)
    inlines = [BookingAgentServiceCategoryInline, BookingAgentContactInline, BookingAgentVehicleTypeMapInline]

@admin.register(BookingAgentAssignmentRule)
class BookingAgentAssignmentRuleAdmin(admin.ModelAdmin):
    list_display = ('service_category', 'city', 'booking_agent_service', 'priority', 'is_active')
    list_filter = ('service_category', 'is_active')
    search_fields = ('service_category__name', 'booking_agent_service__booking_agent_profile__organization_name')
    
@admin.register(VehicleCategoryMaster)
class VehicleCategoryMasterAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'is_active')
    search_fields = ('name', 'code')

@admin.register(VehicleTypeMaster)
class VehicleTypeMasterAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'capacity', 'is_active')
    list_filter = ('category', 'is_active')
    search_fields = ('name', 'category__name')