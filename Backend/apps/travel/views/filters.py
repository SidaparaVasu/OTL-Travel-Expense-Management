import django_filters
from apps.travel.models import TravelApplication, TravelApprovalFlow
from django.db.models import Q

class TravelApplicationFilter(django_filters.FilterSet):
    """Advanced filtering for travel applications"""
    
    # Date range filters
    created_after = django_filters.DateFilter(field_name='created_at', lookup_expr='gte')
    created_before = django_filters.DateFilter(field_name='created_at', lookup_expr='lte')
    departure_after = django_filters.DateFilter(field_name='trip_details__departure_date', lookup_expr='gte')
    departure_before = django_filters.DateFilter(field_name='trip_details__departure_date', lookup_expr='lte')
    return_after = django_filters.DateFilter(field_name='trip_details__return_date', lookup_expr='gte')
    return_before = django_filters.DateFilter(field_name='trip_details__return_date', lookup_expr='lte')
    
    # Status filters
    status = django_filters.MultipleChoiceFilter(choices=TravelApplication.STATUS_CHOICES)
    
    # Amount filters
    min_cost = django_filters.NumberFilter(field_name='estimated_total_cost', lookup_expr='gte')
    max_cost = django_filters.NumberFilter(field_name='estimated_total_cost', lookup_expr='lte')
    
    # Location filters
    from_location = django_filters.NumberFilter(field_name='trip_details__from_location')
    to_location = django_filters.NumberFilter(field_name='trip_details__to_location')
    from_city = django_filters.CharFilter(field_name='trip_details__from_location__city_name', lookup_expr='icontains')
    to_city = django_filters.CharFilter(field_name='trip_details__to_location__city_name', lookup_expr='icontains')
    
    # Search
    search = django_filters.CharFilter(method='search_filter')
    
    class Meta:
        model = TravelApplication
        fields = ['status', 'is_settled']
    
    def search_filter(self, queryset, name, value):
        """Search across multiple fields"""
        queries = Q(purpose__icontains=value) | \
                 Q(internal_order__icontains=value) | \
                 Q(sanction_number__icontains=value) | \
                 Q(employee__username__icontains=value) | \
                 Q(employee__first_name__icontains=value) | \
                 Q(employee__last_name__icontains=value)

        # Handle ID search (exact ID or TR format)
        if value.isdigit():
            queries |= Q(id=int(value))
        elif 'TR/TSF/' in value:
             try:
                 # Extract ID from TR string "TR/TSF/2024/0000123"
                 app_id = int(value.split('/')[-1])
                 queries |= Q(id=app_id)
             except (ValueError, IndexError):
                 pass
        
        return queryset.filter(queries)


class ApprovalFlowFilter(django_filters.FilterSet):
    """Filter for approval flows"""
    
    status = django_filters.MultipleChoiceFilter(choices=TravelApprovalFlow.STATUS_CHOICES)
    approval_level = django_filters.MultipleChoiceFilter(choices=TravelApprovalFlow.APPROVAL_LEVELS)
    
    approved_after = django_filters.DateFilter(field_name='approved_at', lookup_expr='gte')
    approved_before = django_filters.DateFilter(field_name='approved_at', lookup_expr='lte')
    
    class Meta:
        model = TravelApprovalFlow
        fields = ['status', 'approval_level', 'approver', 'can_approve']