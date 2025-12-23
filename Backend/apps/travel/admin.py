from django.contrib import admin
from .models.application import *
from .models.booking import *
from .models.approval import *
from .models.booking_extended import *
from .models.audit import *

# Register your models here.
class TripDetailsInline(admin.TabularInline):
    model = TripDetails
    extra = 1

class BookingInline(admin.TabularInline):
    model = Booking
    extra = 1

class TravelApprovalFlowInline(admin.TabularInline):
    model = TravelApprovalFlow
    extra = 0
    readonly_fields = ('sequence', 'triggered_by_rule', 'created_at', 'approved_at')
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('approver').order_by('sequence')
    

@admin.register(TravelApplication)
class TravelApplicationAdmin(admin.ModelAdmin):
    list_display = (
        'get_travel_request_id', 'employee', 'purpose_short', 'status', 
        'estimated_total_cost', 'current_approver', 'created_at'
    )
    list_filter = ('status', 'created_at', 'employee__grade', 'is_settled')
    search_fields = ('employee__username', 'employee__employee_id', 'purpose', 'internal_order')
    readonly_fields = ('get_travel_request_id', 'created_at', 'updated_at', 'submitted_at')
    inlines = [TripDetailsInline, TravelApprovalFlowInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('employee', 'purpose', 'get_travel_request_id')
        }),
        ('Financial Details', {
            'fields': ('internal_order', 'general_ledger', 'sanction_number', 
                      'advance_amount', 'estimated_total_cost')
        }),
        ('Status & Approval', {
            'fields': ('status', 'current_approver', 'is_settled', 'settlement_due_date', 'self_approved')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'submitted_at'),
            'classes': ('collapse',)
        })
    )
    
    def purpose_short(self, obj):
        return obj.purpose[:50] + "..." if len(obj.purpose) > 50 else obj.purpose
    purpose_short.short_description = "Purpose"


@admin.register(TripDetails)
class TripDetailsAdmin(admin.ModelAdmin):
    list_display = ('travel_application', 'from_location', 'to_location', 'departure_date', 'return_date')
    list_filter = ('departure_date', 'from_location', 'to_location')
    inlines = [BookingInline]

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('id', 'trip_details', 'booking_type', 'sub_option', 'status', 'estimated_cost')
    list_filter = ('booking_type', 'status', 'created_at')
    search_fields = ('booking_reference', 'vendor_reference')


@admin.register(TravelApprovalFlow)
class TravelApprovalFlowAdmin(admin.ModelAdmin):
    list_display = (
        'travel_application', 'approval_level', 'approver', 'status', 
        'sequence', 'triggered_by_rule', 'approved_at'
    )
    list_filter = ('approval_level', 'status', 'is_required', 'created_at')
    search_fields = (
        'travel_application__employee__username',
        'approver__username',
        'triggered_by_rule'
    )
    readonly_fields = ('created_at', 'approved_at')
    
    fieldsets = (
        ('Approval Details', {
            'fields': ('travel_application', 'approver', 'approval_level', 'sequence')
        }),
        ('Permissions & Status', {
            'fields': ('can_view', 'can_approve', 'status', 'is_required')
        }),
        ('Business Rules', {
            'fields': ('triggered_by_rule', 'notes')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'approved_at')
        })
    )

@admin.register(BookingAssignment)
class BookingAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "booking",
        "assigned_to",
        "assigned_by",
        "assignment_scope",
        "assigned_at",
        "accepted_at",
        "completed_at",
    )
    list_filter = ("assignment_scope",)
    search_fields = (
        "booking__id",
        "assigned_to__username",
        "assigned_by__username",
    )
    ordering = ("-assigned_at",)


@admin.register(BookingNote)
class BookingNoteAdmin(admin.ModelAdmin):
    list_display = ("id", "booking", "author", "created_at")
    search_fields = ("booking__id", "author__username")
    ordering = ("-created_at",)

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "action", "timestamp")
    list_filter = ("action", "timestamp")
    search_fields = ("user__username", "action")
    ordering = ("-timestamp",)

@admin.register(AccommodationBooking)
class AccommodationBookingAdmin(admin.ModelAdmin):
    list_display = (
        'trip_details', 'accommodation_type', 'status', 'check_in_date',
        'check_out_date', 'nights', 'total_cost'
    )
    list_filter = ('accommodation_type', 'status', 'check_in_date')
    search_fields = (
        'trip_details__travel_application__employee__username',
        'hotel_name', 'confirmation_number'
    )
    readonly_fields = ('total_cost', 'confirmed_at')
    
    fieldsets = (
        ('Booking Details', {
            'fields': ('trip_details', 'accommodation_type', 'check_in_date', 
                      'check_out_date', 'nights', 'guest_count')
        }),
        ('Accommodation Options', {
            'fields': ('guest_house', 'arc_hotel', 'hotel_name', 'hotel_contact', 'hotel_address')
        }),
        ('Booking Information', {
            'fields': ('status', 'room_type', 'special_requests', 'confirmation_number',
                      'booking_reference', 'rate_per_night', 'total_cost')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'confirmed_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(VehicleBooking)
class VehicleBookingAdmin(admin.ModelAdmin):
    list_display = (
        'trip_details', 'vehicle_type', 'status', 'pickup_date',
        'assigned_spoc', 'driver_name', 'vehicle_number'
    )
    list_filter = ('vehicle_type', 'status', 'pickup_date')
    search_fields = (
        'trip_details__travel_application__employee__username',
        'driver_name', 'vehicle_number', 'duty_slip_number'
    )
    
    fieldsets = (
        ('Journey Details', {
            'fields': ('trip_details', 'vehicle_type', 'pickup_location', 
                      'drop_location', 'pickup_date', 'pickup_time',
                      'return_date', 'return_time')
        }),
        ('Requirements', {
            'fields': ('passenger_count', 'estimated_distance', 'estimated_duration',
                      'vehicle_category', 'special_requirements')
        }),
        ('Assignment', {
            'fields': ('assigned_spoc', 'status', 'duty_slip_number', 'estimated_cost')
        }),
        ('Vehicle & Driver', {
            'fields': ('vendor_name', 'driver_name', 'driver_phone', 'vehicle_number')
        }),
        ('Own Car Details', {
            'fields': ('own_car_details',),
            'classes': ('collapse',)
        })
    )

@admin.register(TravelDocument)
class TravelDocumentAdmin(admin.ModelAdmin):
    list_display = (
        'travel_application', 'document_type', 'title', 'uploaded_by',
        'file_size_kb', 'uploaded_at', 'is_active'
    )
    list_filter = ('document_type', 'uploaded_at', 'is_active')
    search_fields = (
        'travel_application__employee__username',
        'title', 'description'
    )
    readonly_fields = ('file_size', 'file_type', 'uploaded_at')
    
    def file_size_kb(self, obj):
        if obj.file_size:
            return f"{obj.file_size / 1024:.1f} KB"
        return "N/A"
    file_size_kb.short_description = "File Size"