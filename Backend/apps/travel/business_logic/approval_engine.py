from apps.master_data.models import ApprovalMatrix
from apps.authentication.models import User
from ..models import TravelApprovalFlow
from django.db import transaction
import logging

logger = logging.getLogger(__name__)


class ApprovalEngineException(Exception):
    """Custom exception for approval engine errors"""
    pass

class ApprovalEngine:
    """
    Dynamic approval workflow engine based on TSF business rules
    """
    
    def __init__(self, travel_application):
        self.travel_application = travel_application
        self.employee = travel_application.employee

        # Validate employee has required data
        if not self.employee.grade:
            raise ApprovalEngineException(
                f"Employee {self.employee.username} does not have a grade assigned. "
                "Grade is required for approval workflow."
            )
    
    def initiate_approval_process(self):
        """
        Generate and create approval workflow based on business rules
        """
        try:
            with transaction.atomic():
                # Clear any existing approval flows
                self.travel_application.approval_flows.all().delete()
                
                # Generate approval chain
                approval_chain = self.generate_approval_chain()

                if not approval_chain:
                    raise ApprovalEngineException(
                        "No approval chain generated. Check reporting hierarchy and approval matrix configuration."
                    )
                
                # Create approval flow records
                created_flows = self.create_approval_flows(approval_chain)

                """ # Set current approver and status
                if approval_chain:
                    first_approval = approval_chain[0]

                    # 👇 Force CEO/CHRO as current approver if required by special rules
                    if any(a['approval_level'] in ['ceo', 'chro'] for a in approval_chain):
                        self.travel_application.current_approver = approval_chain[0]['approver']
                    else:
                        self.travel_application.current_approver = first_approval['approver']

                    # self.travel_application.current_approver = first_approval['approver']
                    self.travel_application.status = f'pending_{first_approval["approval_level"]}'
                    self.travel_application.save() 
                """
                if approval_chain:
                    first_approval = approval_chain[0]

                    # 👇 Force CEO/CHRO as current approver if required by special rules
                    if any(a['approval_level'] in ['ceo', 'chro'] for a in approval_chain):
                        self.travel_application.current_approver = approval_chain[0]['approver']
                    else:
                        self.travel_application.current_approver = first_approval['approver']

                    # self.travel_application.current_approver = first_approval['approver']
                    self.travel_application.status = f'pending_{first_approval["approval_level"]}'
                    self.travel_application.save() 

                # Set current approver and status
                # first_approval = approval_chain[0]
                # self.travel_application.current_approver = first_approval['approver']
                # self.travel_application.status = f'pending_{first_approval["approval_level"]}'
                # self.travel_application.save()

                logger.info(
                    f"✅ Approval workflow initiated for {self.travel_application.get_travel_request_id()} "
                    f"with {len(approval_chain)} approval levels"
                )
                
                return created_flows
        except Exception as e:
            logger.error(f"❌ Approval engine failed: {str(e)}")
            raise ApprovalEngineException(f"Failed to initiate approval process: {str(e)}")
                
    
    def generate_approval_chain(self):
        """
        Generate dynamic approval chain based on travel details and business rules
        Returns: List of approval dictionaries
        """
        total_amount = self.calculate_total_travel_amount()
        approval_chain = []
        sequence = 1
        
        # Always start with reporting manager (if exists)
        if self.employee.reporting_manager:
            approval_chain.append({
                'approver': self.employee.reporting_manager,
                'approval_level': 'manager',
                'sequence': sequence,
                'can_view': True,
                'can_approve': True,
                'is_required': True,
                'triggered_by_rule': 'reporting_hierarchy'
            })
            sequence += 1
        else:
            logger.warning(
                f"⚠️ Employee {self.employee.username} has no reporting manager. "
                "Proceeding without manager approval."
            )
        
        # Check if any booking requires special approvals
        special_approvals = self.check_special_approval_requirements()
        
        # CEO approval for flights > ₹10,000
        if special_approvals.get('requires_ceo_flight', False):
            ceo = self.get_user_by_role('CEO')
            if ceo:
                approval_chain.append({
                    'approver': ceo,
                    'approval_level': 'ceo',
                    'sequence': sequence,
                    'can_view': True,
                    'can_approve': True,
                    'is_required': True,
                    'triggered_by_rule': 'flight_above_10k'
                })
                sequence += 1
            else:
                logger.warning("⚠️ No CEO found in system. Flight >10k rule cannot be enforced.")

        # CHRO approval based on amount or special conditions
        if self.requires_chro_approval(total_amount, special_approvals):
            chro = self.get_user_by_role('CHRO')
            if chro:
                approval_chain.append({
                    'approver': chro,
                    'approval_level': 'chro',
                    'sequence': sequence,
                    'can_view': True,
                    'can_approve': True,
                    'is_required': True,
                    'triggered_by_rule': 'amount_threshold_or_policy'
                })
                sequence += 1
            else:
                logger.warning("⚠️ No CHRO found in system. High-value approval rule cannot be enforced.")
        
        # Apply approval matrix rules
        matrix_approvals = self.get_matrix_based_approvals(total_amount)
        for matrix_approval in matrix_approvals:
            matrix_approval['sequence'] = sequence
            approval_chain.append(matrix_approval)
            sequence += 1
        
        # Validate no circular approvals
        # self.handle_circular_approval(approval_chain)

        # Add parallel approval support (optional)
        approval_chain = self.add_parallel_approval_support(approval_chain)

        # If no approval chain at all, raise error
        if not approval_chain:
            raise ApprovalEngineException(
                "Cannot create approval workflow. Employee must have a reporting manager "
                "or special approval rules must apply."
            )
        return approval_chain
    
    def calculate_total_travel_amount(self):
        """Calculate total estimated cost of travel"""
        return self.travel_application.estimated_total_cost or 0
    
    def check_special_approval_requirements(self):
        """
        Check for special approval requirements (flights > 10k, car > 150km, etc.)
        """
        special_requirements = {
            'requires_ceo_flight': False,
            'requires_chro_car': False,
            'high_value_travel': False
        }
        
        try:
            for trip in self.travel_application.trip_details.all():
                for booking in trip.bookings.all():
                    # CEO approval is now triggered by advance > 0 (handled in approval_engine_v2).
                    # The old hardcoded flight > ₹10,000 rule has been removed.

                    # Own car > 150km requires CHRO approval
                    if (booking.booking_type.name.lower() == 'car' and
                        booking.booking_details.get('transport_type') == 'own_car' and
                        booking.booking_details.get('distance_km', 0) > 150):
                        special_requirements['requires_chro_car'] = True
        except Exception as e:
            logger.error(f"Error checking special approval requirements: {str(e)}")

        # High value travel (total > ₹50,000)
        if self.travel_application.estimated_total_cost > 50000:
            special_requirements['high_value_travel'] = True
        
        return special_requirements
    
    def requires_chro_approval(self, total_amount, special_approvals):
        """
        Determine if CHRO approval is required based on various conditions
        """
        # High value travel
        if special_approvals.get('high_value_travel', False):
            return True
        
        # Car distance policy
        if special_approvals.get('requires_chro_car', False):
            return True
        
        # Senior grade with international travel (future enhancement)
        # Add more CHRO approval conditions as needed
        
        return False
    
    def get_matrix_based_approvals(self, total_amount):
        """
        Get approvals based on approval matrix configuration
        """
        from django.db.models import Q

        matrix_approvals = []
        
        # Get primary travel mode for matrix lookup
        primary_mode = self.get_primary_travel_mode()
        if not primary_mode:
            logger.warning("No primary travel mode found for matrix lookup")
            return matrix_approvals
        
        try:
            
            # Find applicable matrix rule
            matrix_rule = ApprovalMatrix.objects.filter(
                travel_mode=primary_mode,
                employee_grade=self.employee.grade,
                min_amount__lte=total_amount,
                is_active=True
            ).filter(
                Q(max_amount__gte=total_amount) | Q(max_amount__isnull=True)
            ).first()
        
            if matrix_rule:
                # Additional CEO approval from matrix (different from flight rule)
                if matrix_rule.requires_ceo:
                    ceo = self.get_user_by_role('CEO')
                    if ceo:
                        matrix_approvals.append({
                            'approver': ceo,    
                            'approval_level': 'ceo',
                            'can_view': True,
                            'can_approve': True,
                            'is_required': True,
                            'triggered_by_rule': f'matrix_{matrix_rule.id}'
                        })
            
            # CHRO approval from matrix
            if matrix_rule.requires_chro:
                chro = self.get_user_by_role('CHRO')
                if chro:
                    matrix_approvals.append({
                        'approver': chro,
                        'approval_level': 'chro',
                        'can_view': True,
                        'can_approve': True,
                        'is_required': True,
                        'triggered_by_rule': f'matrix_{matrix_rule.id}'
                    })
        except Exception as e:
            logger.error(f"Error getting matrix-based approvals: {str(e)}")

        return matrix_approvals
    
    def get_primary_travel_mode(self):
        """
        Get the primary travel mode for matrix lookup
        Returns the travel mode with highest booking cost
        """
        # Get the highest cost booking's travel mode
        try:
            max_cost_booking = None
            max_cost = 0
            
            for trip in self.travel_application.trip_details.all():
                for booking in trip.bookings.all():
                    if booking.estimated_cost and booking.estimated_cost > max_cost:
                        max_cost = booking.estimated_cost
                        max_cost_booking = booking
        except Exception as e:
            logger.error(f"Error getting primary travel mode: {str(e)}")
            return None
        
        return max_cost_booking.booking_type if max_cost_booking else None
    
    def get_user_by_role(self, role_name):
        """
        Get user by role name (CEO, CHRO, etc.)
        Returns the first active user with the given role
        """
        try:
            from apps.authentication.models import UserRole
            
            user_role = UserRole.objects.filter(
                role__name=role_name,
                role__is_active=True,
                is_active=True,
                user__is_active=True
            ).select_related('user').first()
        
            if user_role:
                return user_role.user
            
            logger.warning(f"⚠️ No active user found with role '{role_name}'")
            return None
            
        except Exception as e:
            logger.error(f"Error getting user by role '{role_name}': {str(e)}")
            return None
    
    def create_approval_flows(self, approval_chain):
        """
        Create TravelApprovalFlow records from approval chain
        Returns: List of created approval flow objects
        """
        created_flows = []
        
        try:
            for approval_data in approval_chain:
                # Validate approver exists
                if not approval_data.get('approver'):
                    logger.error(f"Missing approver in approval chain: {approval_data}")
                    continue
                
                flow = TravelApprovalFlow.objects.create(
                    travel_application=self.travel_application,
                    **approval_data
                )
                created_flows.append(flow)
                
                logger.debug(
                    f"Created approval flow: {flow.approval_level} - "
                    f"{flow.approver.username} (Sequence: {flow.sequence})"
                )
        except Exception as e:
            logger.error(f"Error creating approval flows: {str(e)}")
            raise ApprovalEngineException(f"Failed to create approval flows: {str(e)}")
        
        return created_flows
    
    def get_approval_summary(self):
        """
        Get summary of approval workflow
        Useful for debugging and status display
        """
        return {
            'travel_request_id': self.travel_application.get_travel_request_id(),
            'employee': self.employee.username,
            'total_cost': float(self.travel_application.estimated_total_cost or 0),
            'current_status': self.travel_application.status,
            'approval_chain': [
                {
                    'level': flow.approval_level,
                    'approver': flow.approver.get_full_name(),
                    'sequence': flow.sequence,
                    'status': flow.status,
                    'rule': flow.triggered_by_rule
                }
                for flow in self.travel_application.approval_flows.all().order_by('sequence')
            ]
        }
    

    def handle_manager_on_leave(self):
        """Handle case when manager is on leave/unavailable"""
        if not self.employee.reporting_manager:
            return None
        
        # Check if manager has backup/delegate
        from apps.authentication.models import UserRole
        
        # Option 1: Skip to next level
        # Option 2: Find acting manager
        # For now, we'll allow proceeding without manager
        
        logger.warning(
            f"Manager {self.employee.reporting_manager.username} may be unavailable. "
            "Consider implementing delegation system."
        )
        
        return self.employee.reporting_manager

    def handle_circular_approval(self, approval_chain):
        """Prevent circular approval loops"""
        approvers = [a['approver'].id for a in approval_chain]
        
        if len(approvers) != len(set(approvers)):
            duplicates = [a for a in approvers if approvers.count(a) > 1]
            raise ApprovalEngineException(
                f"Circular approval detected. User(s) appear multiple times in chain: {duplicates}"
            )
        
        return True

    def add_parallel_approval_support(self, approval_chain):
        """Group approvals that can happen in parallel (future enhancement)"""
        # Mark CHRO and CEO at same level if both required
        # This allows parallel processing instead of sequential
        
        # Find CHRO and CEO approvals
        chro_approval = next((a for a in approval_chain if a['approval_level'] == 'chro'), None)
        ceo_approval = next((a for a in approval_chain if a['approval_level'] == 'ceo'), None)
        
        if chro_approval and ceo_approval:
            # Set same sequence for parallel approval
            min_seq = min(chro_approval['sequence'], ceo_approval['sequence'])
            chro_approval['sequence'] = min_seq
            ceo_approval['sequence'] = min_seq
            chro_approval['parallel_group'] = 'executive_approval'
            ceo_approval['parallel_group'] = 'executive_approval'
        
        return approval_chain