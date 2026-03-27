from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from apps.travel.models.permission import BackdatedTRAllowance
from rest_framework import serializers

class BackdatedTRAllowanceSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    granted_by_name = serializers.CharField(source='granted_by.get_full_name', read_only=True)
    is_valid = serializers.BooleanField(source='is_currently_valid', read_only=True)

    class Meta:
        model = BackdatedTRAllowance
        fields = [
            'id', 'user', 'user_name', 'allowed_from', 'allowed_until', 
            'granted_by', 'granted_by_name', 'reason', 'is_active', 
            'is_valid', 'created_at'
        ]
        read_only_fields = ['granted_by', 'created_at']

    def validate(self, data):
        if data.get('allowed_from') and data.get('allowed_until'):
            if data['allowed_from'] >= data['allowed_until']:
                raise serializers.ValidationError("Window end time must be after start time.")
        return data

class IsAdminUser(permissions.BasePermission):
    """
    Custom permission to only allow administrators to manage allowances.
    """
    def has_permission(self, request, view):
        user = request.user
        return user.is_authenticated and (
            user.has_role('admin') or 
            user.has_role('Admin') or 
            user.has_role('ceo') or 
            user.has_role('chro')
        )

class BackdatedTRAllowanceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Administrators to manage back-dated TR permissions for users.
    """
    queryset = BackdatedTRAllowance.objects.all().select_related('user', 'granted_by').order_by('-created_at')
    serializer_class = BackdatedTRAllowanceSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save(granted_by=self.request.user)
