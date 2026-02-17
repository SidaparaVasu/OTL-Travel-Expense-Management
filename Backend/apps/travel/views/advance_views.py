from rest_framework import viewsets, mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone

from apps.travel.models import TravelApplication, AdvanceProcessing
from apps.travel.serializers.advance_serializers import (
    AdvanceWorkspaceListSerializer, 
    AdvanceRequisitionDetailSerializer,
    AdvanceProcessingSerializer
)

from apps.authentication.mixins import BranchFilterMixin

class AdvanceWorkspaceViewSet(BranchFilterMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Finance Advance Workspace.
    Allows viewing applications with advance requests and processing them.
    """
    permission_classes = [IsAuthenticated]
    # Filter queryset base: apps with bookings having estimated cost > 0
    queryset = TravelApplication.objects.filter(
        trip_details__bookings__estimated_cost__gt=0
    ).distinct().exclude(status__in=['draft', 'submitted', 'cancelled', 'rejected_manager', 'rejected_chro', 'rejected_ceo'])
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return AdvanceRequisitionDetailSerializer
        if self.action == 'process_advance':
            return AdvanceProcessingSerializer
        return AdvanceWorkspaceListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        
        # Apply branch/SPOC filtering
        qs = self.apply_branch_filter(qs, self.request.user)

        # Filter by processing status
        # status = request.query_params.get('status', 'pending')
        # 'pending' = AdvanceProcessing does NOT exist OR status='pending'
        # 'processed' = AdvanceProcessing exists AND status='processed'
        
        if self.action == 'retrieve':
            return qs

        proc_status = self.request.query_params.get('status', 'pending')
        
        if proc_status == 'processed':
            qs = qs.filter(advance_processing__status='processed')
        elif proc_status == 'pending':
            qs = qs.exclude(advance_processing__status='processed')
            
        return qs.order_by('-created_at')

    @action(detail=True, methods=['post'], url_path='process')
    def process_advance(self, request, pk=None):
        """
        Mark advance as processed.
        Create or Update AdvanceProcessing record.
        """
        app = self.get_object()
        
        # Validate if processing allowed logic? 
        # e.g. check permissions (Finance Role) - skipping for now
        
        data = request.data.copy()
        data['application'] = app.id
        data['processed_by'] = request.user.id
        data['status'] = 'processed' # Force status to processed
        
        # Check if exists
        try:
            instance = app.advance_processing
            serializer = AdvanceProcessingSerializer(instance, data=data, partial=True)
        except AdvanceProcessing.DoesNotExist:
            serializer = AdvanceProcessingSerializer(data=data)
            
        if serializer.is_valid():

            processing = serializer.save(
                application=app, # Ensure link
                processed_by=request.user,
                processed_at=timezone.now(),
                status='processed'
            )
            
            # Send Notification (TODO)
             
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
