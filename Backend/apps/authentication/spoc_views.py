from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import models   
from django.db.utils import IntegrityError
from .models.spoc import LocationSPOCAssignment
from .models.roles import Role
from apps.master_data.models.geography import LocationMaster
from .spoc_serializers import LocationSPOCAssignmentSerializer

class LocationSPOCAssignmentViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows Location SPOC Assignments to be viewed or edited.
    """
    queryset = LocationSPOCAssignment.objects.all().order_by('-updated_at')
    serializer_class = LocationSPOCAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtering
        user_id = self.request.query_params.get('user_id')
        role_id = self.request.query_params.get('role_id')
        location_id = self.request.query_params.get('location_id')
        role_name = self.request.query_params.get('role_name')
        
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        if role_id:
            queryset = queryset.filter(role_id=role_id)
            
        if role_name:
            queryset = queryset.filter(role__name__iexact=role_name)

        if location_id:
            # Filter assignments that cover this specific location OR are Global
            queryset = queryset.filter(
                models.Q(locations__location_id=location_id) | models.Q(is_global=True)
            ).distinct()
            
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            active_bool = is_active.lower() == 'true'
            queryset = queryset.filter(is_active=active_bool)

        return queryset

    def perform_create(self, serializer):
        serializer.save(assigned_by=self.request.user)

    def create(self, request, *args, **kwargs):
        """
        Custom create to handle unique constraint errors gracefully.
        """
        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"detail": "This user is already assigned to this role. Please update the existing assignment."},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'], url_path='resolve-spoc')
    def resolve_spoc(self, request):
        """
        Utility endpoint to resolve SPOCs for a given location and role.
        Query Params: location_id, role_name
        """
        location_id = request.query_params.get('location_id')
        role_name = request.query_params.get('role_name')
        
        if not location_id or not role_name:
            return Response(
                {"detail": "Both location_id and role_name are required."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Logic:
        # 1. Match Role
        # 2. Match Location (Exact match OR Global/Empty)
        # 3. Active only
        
        assignments = LocationSPOCAssignment.objects.filter(
            role__name__iexact=role_name,
            is_active=True
        ).filter(
            models.Q(locations__location_id=location_id) |
            models.Q(is_global=True)
        ).distinct()
        
        serializer = self.get_serializer(assignments, many=True)
        return Response(serializer.data)
