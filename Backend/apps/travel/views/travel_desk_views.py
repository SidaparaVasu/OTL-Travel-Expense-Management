from django.db.models import F, Avg, ExpressionWrapper, DurationField, Q
from django.utils import timezone
from django.utils.timezone import now, timedelta
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.travel.models import TravelApplication, Booking, BookingAssignment, BookingNote
from apps.travel.serializers.travel_desk_serializers import *
from apps.travel.models.audit import AuditLog
from apps.authentication.permissions import IsTravelDesk
from apps.authentication.mixins import BranchFilterMixin
from apps.authentication.models import User, BookingAgentProfile
from utils.response_formatter import success_response, error_response, paginated_response
from utils.pagination import StandardResultsSetPagination
from apps.notifications.notifications import *
from apps.notifications.center import NotificationCenter
from utils.get_travel_desk_users import get_travel_desk_users


TRAVEL_DESK_VISIBLE_STATUSES = [
    "approved_manager",
    "approved_chro",
    "approved_ceo",
    "pending_travel_desk",
    "booking_in_progress",
    "booked",
]

class TravelDeskDashboardView(BranchFilterMixin, APIView):
    """
    Travel Desk Dashboard with branch-based access control.
    Shows statistics only for applications from the Travel Desk user's branch.
    """
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def get(self, request):
        # Base queryset: Applications visible to travel desk
        apps = TravelApplication.objects.filter(
            status__in=[
                "pending_travel_desk",
                "booking_in_progress",
                "booked",
                "completed",
            ]
        ).select_related("employee")
        
        # Apply branch filtering - Travel Desk sees only their branch
        apps = self.apply_branch_filter(apps, request.user, employee_field='employee')

        # -------------------------------
        # 1. STATUS COUNTS
        # -------------------------------
        stats = {
            "pending_travel_desk": apps.filter(status="pending_travel_desk").count(),
            "booking_in_progress": apps.filter(status="booking_in_progress").count(),
            "booked": apps.filter(status="booked").count(),
            "completed": apps.filter(status="completed").count(),
        }

        # -------------------------------
        # 2. OVERDUE FOR TRAVEL DESK ACTION (SLA)
        # SLA = 6 hours
        # -------------------------------
        sla_hours = 6
        sla_deadline = now() - timedelta(hours=sla_hours)

        overdue = apps.filter(
            status="pending_travel_desk",
            submitted_at__lt=sla_deadline
        ).count()

        stats["overdue_pending"] = overdue

        # -------------------------------
        # 3. AVERAGE RESPONSE TIME
        # Time from submission → first TD action
        # APPROX: (updated_at - submitted_at)
        # -------------------------------
        td_apps = apps.filter(status="booking_in_progress")

        response_time = td_apps.annotate(
            diff=ExpressionWrapper(
                F("updated_at") - F("submitted_at"),
                output_field=DurationField()
            )
        ).aggregate(avg=Avg("diff"))["avg"]

        stats["avg_td_response_hours"] = (
            round(response_time.total_seconds() / 3600, 2)
            if response_time else None
        )

        # -------------------------------
        # 4. AVERAGE BOOKING COMPLETION TIME
        # Submission → final booking completion
        # -------------------------------
        completed_apps = apps.filter(status="booked", booking_completed_at__isnull=False)

        booking_time = completed_apps.annotate(
            diff=ExpressionWrapper(
                F("booking_completed_at") - F("submitted_at"),
                output_field=DurationField()
            )
        ).aggregate(avg=Avg("diff"))["avg"]

        stats["avg_booking_completion_hours"] = (
            round(booking_time.total_seconds() / 3600, 2)
            if booking_time else None
        )

        # -------------------------------
        # 5. RECENTLY UPDATED APPLICATIONS
        # -------------------------------
        recent_apps = apps.order_by("-updated_at")[:5]

        return success_response(
            message="Travel Desk Dashboard",
            data={
                "stats": stats,
                "recent_applications":
                    TravelDeskApplicationListSerializer(recent_apps, many=True).data
            }
        )
      

class TravelDeskApplicationListView(BranchFilterMixin, APIView):
    """
    Travel Desk Application List with branch-based access control.
    Travel Desk users can only see applications from their assigned branch.
    """
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def get(self, request):
        # Base queryset: Filter by Travel Desk visible statuses
        qs = TravelApplication.objects.select_related("employee").filter(
            status__in=TRAVEL_DESK_VISIBLE_STATUSES
        )
        
        # Apply branch filtering - Travel Desk sees only their branch
        qs = self.apply_branch_filter(qs, request.user, employee_field='employee')

        # Status filter
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        # Search filter
        search = request.query_params.get("search")
        if search:
            # Check if search term might be a Travel Request ID (e.g., TR/TSF/2025/0000123 or just 123)
            # Try to extract the numeric ID
            import re
            # Match strictly the numeric part at the end or just a number
            match = re.search(r'(\d+)$', search)
            
            q_objects = Q(purpose__icontains=search) | \
                        Q(employee__first_name__icontains=search) | \
                        Q(employee__last_name__icontains=search) | \
                        Q(employee__username__icontains=search)

            if match:
                try:
                    # If we found a number, try to filter by ID as well
                    # This handles "123" and "TR/TSF/2025/0000123" (extracting 123)
                    travel_id = int(match.group(1))
                    q_objects |= Q(id=travel_id)
                except ValueError:
                    pass
            
            qs = qs.filter(q_objects)

        # Date range filters
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(submitted_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(submitted_at__date__lte=date_to)

        qs = qs.order_by("-submitted_at", "-id")

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = TravelDeskApplicationListSerializer(page, many=True)

        return paginated_response(
            serializer_data=serializer.data,
            paginator=paginator,
            message="Success"
        )


class TravelDeskApplicationDetailView(APIView):
    """
    GET: Full application view for Travel Desk (trips + bookings)
    """

    permission_classes = [IsAuthenticated, IsTravelDesk]

    def get(self, request, pk):
        app = (
            TravelApplication.objects
            .select_related("employee")
            .prefetch_related("trip_details__bookings")
            .filter(pk=pk)
            .first()
        )
        if not app:
            return error_response(message="Application not found", data={"id": ["Invalid id"]})

        serializer = TravelDeskApplicationDetailSerializer(app)
        return success_response(data=serializer.data)
    

class TravelDeskBookingsForApplicationView(APIView):
    """
    GET: Flat list of bookings for a given application (used in side-panels / modals)
    """

    permission_classes = [IsAuthenticated, IsTravelDesk]

    def get(self, request, application_id):
        qs = Booking.objects.filter(trip_details__travel_application_id=application_id)
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        qs = qs.select_related("trip_details", "booking_type", "sub_option").order_by("created_at")
        serializer = TravelDeskBookingSerializer(qs, many=True)
        return success_response(data=serializer.data)


class TravelDeskAssignBookingsView(APIView):
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def post(self, request):
        serializer = BookingAssignmentSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(message="Validation error", data=serializer.errors)

        booking_ids = serializer.validated_data["booking_ids"]
        scope = serializer.validated_data["scope"]
        booking_agent_id = serializer.validated_data["booking_agent_id"]
        application_id = serializer.validated_data["_application_id"]
        bookings = serializer.validated_data["_bookings"]
        requested_vehicle_type_id = serializer.validated_data.get("requested_vehicle_type_id")
        note_text = serializer.validated_data.get("note")
        
        # Validate no self-arranged bookings
        for b in bookings:
            if b.booking_details and b.booking_details.get("accommodation_type") == "self":
                return error_response(message=f"Booking {b.id} is self-arranged and cannot be assigned.")

        booking_agent = User.objects.filter(id=booking_agent_id, is_active=True).first()
        if not booking_agent:
            return error_response(message="Invalid booking agent")

        app = TravelApplication.objects.get(id=application_id)

        with transaction.atomic():
            for b in bookings:

                assignment, created = BookingAssignment.objects.get_or_create(
                    booking=b,
                    defaults={
                        "assigned_to": booking_agent,
                        "assigned_by": request.user,
                        "assignment_scope": scope,
                        "assigned_at": timezone.now(),
                        "requested_vehicle_type_id": requested_vehicle_type_id,
                    }
                )

                if not created:
                    assignment.assigned_to = booking_agent
                    assignment.assigned_by = request.user
                    assignment.assignment_scope = scope
                    assignment.assigned_at = timezone.now()
                    assignment.accepted_at = None
                    assignment.completed_at = None
                    assignment.requested_vehicle_type_id = requested_vehicle_type_id
                    assignment.save(update_fields=[
                        "assigned_to", "assigned_by", "assignment_scope",
                        "assigned_at", "accepted_at", "completed_at",
                        "requested_vehicle_type"
                    ])

                # Update booking status
                if b.status == "pending":
                    b.status = "requested"
                    b.save(update_fields=["status"])

                # Create Note if provided
                if note_text:
                    BookingNote.objects.create(
                        booking=b,
                        author=request.user,
                        note=note_text
                    )

                # Audit
                AuditLog.objects.create(
                    user=request.user,
                    action="assign_booking",
                    content_object=b,
                    changes={
                        "booking_id": b.id,
                        "application_id": application_id,
                        "agent_id": booking_agent.id,
                        "scope": scope,
                        "requested_vehicle_type": requested_vehicle_type_id,
                    },
                )

                # Determine if duty slip should be attached
                # Logic: Not self-arranged AND Not Flight/Train/Accommodation
                attach_duty_slip = False
                if not b.booking_details.get("is_self_arranged"):
                    excluded_types = ["Flight", "Train", "Accommodation", "Bulk Booking"]
                    b_type = (b.booking_type.name or "").strip()
                    if b_type not in excluded_types:
                        attach_duty_slip = True

                NotificationCenter.notify(
                    event_name="travel.booking.assigned",
                    reference={"type": "Booking", "id": b.id},
                    payload={
                        "request_id": app.get_travel_request_id(),
                        "employee_id": app.employee.id,
                        "employee_name": app.employee.get_full_name(),
                        "booking_agent_id": booking_agent.id,
                        "booking_agent_name": booking_agent.get_full_name(),
                        "booking_id": b.id,
                        "action_required": "Booking assigned by Travel Desk",
                        "attach_duty_slip": attach_duty_slip,
                    },
                )

            # Application status bump
            if app.status in [
                "approved_manager",
                "approved_chro",
                "approved_ceo",
                "pending_travel_desk",
            ]:
                app.status = "booking_in_progress"  
                app.save(update_fields=["status"])


        return success_response(
            message="Bookings assigned successfully",
            data={
                "application_id": application_id,
                "booking_ids": booking_ids,
                "booking_agent": {
                    "id": booking_agent.id,
                    "name": booking_agent.get_full_name() or booking_agent.username,
                },
                "scope": scope,
            },
        )

class TravelDeskAgentVehicleTypesView(APIView):
    """
    GET: List vehicle types supported by a booking agent
    """
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def get(self, request, agent_id):
        # Verify agent exists
        if not User.objects.filter(id=agent_id, is_active=True).exists():
            return error_response(message="Invalid agent ID")

        # Query BookingAgentVehicleTypeMap via BookingAgentService
        # Path: Agent (User) -> BookingAgentProfile -> BookingAgentService -> BookingAgentVehicleTypeMap -> VehicleTypeMaster
        
        from apps.booking_agent.models import BookingAgentVehicleTypeMap
        
        vehicle_types = (
            BookingAgentVehicleTypeMap.objects
            .filter(
                booking_agent_service__booking_agent_profile__user_id=agent_id,
                is_active=True,
                vehicle_type__is_active=True
            )
            .select_related("vehicle_type")
            .values("vehicle_type__id", "vehicle_type__name")
            .distinct()
        )
        
        data = [
            {"id": vt["vehicle_type__id"], "name": vt["vehicle_type__name"]} 
            for vt in vehicle_types
        ]
        
        return success_response(data=data)
    

class TravelDeskReassignBookingView(APIView):
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def post(self, request, booking_id):
        new_agent_id = request.data.get("new_agent_id")
        remarks = request.data.get("remarks", "")

        if not new_agent_id:
            return error_response(message="new_agent_id is required")

        booking = Booking.objects.filter(id=booking_id).first()
        if not booking:
            return error_response(message="Invalid booking id")

        if booking.booking_details and booking.booking_details.get("accommodation_type") == "self":
            return error_response(message="Cannot reassign self-arranged booking")

        new_agent = User.objects.filter(id=new_agent_id, is_active=True).first()
        if not new_agent or not hasattr(new_agent, "booking_agent_profile"):
            return error_response(message="Invalid booking agent")

        with transaction.atomic():

            assignment = BookingAssignment.objects.filter(booking=booking).first()
            if not assignment:
                return error_response(message="Assignment does not exist for this booking")

            old_agent = assignment.assigned_to

            # Update assignment (NO new row)
            assignment.assigned_to = new_agent
            assignment.assigned_by = request.user
            assignment.assignment_scope = "single_booking"
            assignment.assigned_at = timezone.now()
            assignment.accepted_at = None
            assignment.completed_at = None
            assignment.save(update_fields=[
                "assigned_to", "assigned_by", "assignment_scope",
                "assigned_at", "accepted_at", "completed_at"
            ])

            # Add note
            if remarks:
                BookingNote.objects.create(
                    booking=booking,
                    created_by=request.user,
                    note=f"[REASSIGNMENT] {remarks}"
                )

            # Status adjustment
            if booking.status in ["pending", "in_progress"]:
                booking.status = "requested"
                booking.save(update_fields=["status"])

            # Audit logging
            AuditLog.objects.create(
                user=request.user,
                action="reassign_booking",
                content_object=booking,
                changes={
                    "booking_id": booking.id,
                    "old_agent": old_agent.id if old_agent else None,
                    "new_agent": new_agent.id,
                    "remarks": remarks,
                },
            )

        return success_response(
            message="Booking reassigned successfully",
            data={
                "booking_id": booking.id,
                "new_agent_id": new_agent.id,
            }
        )


class BookingNotesView(APIView):
    """
    GET: list notes for a booking
    POST: add a note for a booking
    """

    permission_classes = [IsAuthenticated, IsTravelDesk]

    def get(self, request, booking_id):
        notes = BookingNote.objects.filter(booking_id=booking_id).select_related("created_by").order_by("-created_at")
        serializer = BookingNoteSerializer(notes, many=True)
        return success_response(data=serializer.data)

    def post(self, request, booking_id):
        # enforce booking exists
        booking = Booking.objects.filter(id=booking_id).first()
        if not booking:
            return error_response(message="Booking not found", data={"booking": ["Invalid booking id"]})

        payload = {**request.data, "booking": booking_id}
        serializer = BookingNoteSerializer(data=payload, context={"request": request})
        if not serializer.is_valid():
            return error_response(message="Validation error", data=serializer.errors)

        note = serializer.save()

        AuditLog.objects.create(
            user=request.user,
            action="update_booking_status",
            content_object=booking,
            changes={
                "note_id": note.id,
                "note": note.note,
            },
        )

        return success_response(message="Note added", data=BookingNoteSerializer(note).data)

class ForwardApplicationView(APIView):
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def post(self, request, app_id):
        # Fetch application
        try:
            app = TravelApplication.objects.get(id=app_id)
        except TravelApplication.DoesNotExist:
            return error_response(message="Application not found")
        
        # Check if application is cancelled or cancellation requested
        if app.status in ['cancelled', 'cancellation_requested']:
            return error_response(
                message="Cannot forward application - Travel application has been cancelled",
                data={
                    "status": [f"This travel application is {app.get_status_display()}. Forwarding is disabled."]
                },
                status_code=403
            )

        # Validate agent
        agent_id = request.data.get("agent_id")
        if not agent_id:
            return error_response(message="Booking agent not provided")

        try:
            agent_profile = BookingAgentProfile.objects.select_related("user").get(user_id=agent_id)
        except BookingAgentProfile.DoesNotExist:
            return error_response(message="Invalid booking agent")

        # Fetch all bookings belonging to the application
        all_bookings = Booking.objects.filter(trip_details__travel_application=app)
        # Exclude self-arranged bookings
        bookings = [b for b in all_bookings if not (b.booking_details and b.booking_details.get("accommodation_type") == "self")]
        
        if not bookings:
             return error_response(message="No assignable bookings found in this application")

        agent_user = agent_profile.user

        with transaction.atomic():
            for booking in bookings:
                assignment, created = BookingAssignment.objects.update_or_create(
                    booking=booking,
                    defaults={
                        "assigned_to": agent_user,
                        "assigned_by": request.user,
                        "assignment_scope": "full_application",
                        "accepted_at": None,
                        "completed_at": None,
                    },
                )

                # update booking status → requested
                if booking.status == "pending":
                    booking.status = "requested"
                    booking.save(update_fields=["status"])

                # Audit log
                AuditLog.objects.create(
                    user=request.user,
                    action="assign_booking",
                    content_object=booking,
                    changes={
                        "booking_id": booking.id,
                        "application_id": app.id,
                        "agent_id": agent_user.id,
                        "scope": "full_application",
                    },
                )

            #  Bump application status
            if app.status in [
                "approved_manager",
                "approved_chro",
                "approved_ceo",
                "pending_travel_desk",
            ]:
                app.status = "booking_in_progress"
                app.save(update_fields=["status"])

            # High-level forward audit
            AuditLog.objects.create(
                user=request.user,
                action="forward_to_travel_desk",
                content_object=app,
                changes={
                    "application_id": app.id,
                    "forwarded_to": agent_user.id,
                    "total_bookings": bookings.count(),
                },
            )

        # Notify assigned agent
        # notify_booking_agent(
        #     user=agent_user,
        #     booking=None,
        #     message=f"You have been assigned a travel application (ID: {app.id})."
        # )

        return success_response(
            message="Application forwarded successfully",
            data={
                "application_id": app.id,
                "agent_id": agent_user.id,
                "total_bookings": bookings.count(),
            }
        )


class TravelDeskCancelApplicationView(APIView):
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def post(self, request, app_id):
        reason = request.data.get("reason", "")

        try:
            app = TravelApplication.objects.get(id=app_id)
        except TravelApplication.DoesNotExist:
            return error_response(message="Application not found")

        if app.status in ["completed", "cancelled"]:
            return error_response(message="Application already finalised")

        try:
            with transaction.atomic():
                # Admins/Travel Desk can hard-cancel immediately
                app.approve_cancellation(approved_by=request.user, notes=reason)
            
            return success_response(message="Application cancelled successfully")
        except ValidationError as e:
            return error_response(str(e))
        except Exception as e:
            return error_response(f"An error occurred during cancellation: {str(e)}")


class TravelDeskCancelBookingView(APIView):
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def post(self, request, booking_id):
        import logging
        logger = logging.getLogger(__name__)
        
        logger.error(f"DEBUG_CANCEL: Attempting to cancel booking {booking_id} by {request.user}")
        
        reason = request.data.get("reason", "")
        logger.error(f"DEBUG_CANCEL: Reason provided: {reason}")
        
        booking = Booking.objects.filter(id=booking_id).first()
        if not booking:
            logger.error(f"DEBUG_CANCEL: Booking {booking_id} not found")
            return error_response(message="Booking not found")

        logger.error(f"DEBUG_CANCEL: Found booking {booking.id}, status: {booking.status}")

        if booking.status in ["cancelled", "completed"]:
             logger.error(f"DEBUG_CANCEL: Booking already {booking.status}")
             return error_response(message=f"Booking is already {booking.status}")

        try:
            with transaction.atomic():
                # Update booking status
                old_status = booking.status
                booking.status = "cancelled"
                booking.save(update_fields=["status"])
                
                # Add cancellation note
                if reason:
                    BookingNote.objects.create(
                        booking=booking,
                        author=request.user,
                        note=f"[CANCELLATION] {reason}"
                    )
                
                # Audit Log
                AuditLog.objects.create(
                    user=request.user,
                    action="cancel_booking",
                    content_object=booking,
                    changes={
                        "booking_id": booking.id,
                        "old_status": old_status,
                        "new_status": "cancelled",
                        "reason": reason
                    }
                )
            
            logger.error(f"DEBUG_CANCEL: Cancellation successful")
            return success_response(message="Booking cancelled successfully")
        except Exception as e:
            logger.error(f"DEBUG_CANCEL: Exception detected: {str(e)}")
            return error_response(f"Error cancelling booking: {str(e)}")


class GenerateDutySlipAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id):
        try:
            booking = Booking.objects.select_related(
                "booking_type", "sub_option", "trip_details__travel_application__employee"
            ).get(id=booking_id)

            # Strict Validation
            VALID_DUTY_SLIP_MODES = {
                "Pick-up & Drop": ["Passenger Vehicle", "Goods Vehicle"],
                "Pick-up and Drop": ["Passenger Vehicle", "Goods Vehicle"],
                "Car at Disposal": ["Company Arranged Car", "Company-Arranged car"], # Handle both just in case
                "Goods Carriage": ["Heavy/Small"],
                "BUS/Tempo Traveller": ["Bus/Traveller"],
            }
            b_type = (booking.booking_type.name or "").strip()
            # Normalize '&' vs 'and' for type
            b_type_norm = b_type.replace(" and ", " & ")
            
            b_sub = (booking.sub_option.name or "").strip()
            
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"DEBUG_DUTY_SLIP: BookingID={booking_id} Type='{b_type}' Sub='{b_sub}' NormType='{b_type_norm}'")
            
            is_valid = False
            
            # Check against normalized keys or direct keys
            if b_type in VALID_DUTY_SLIP_MODES:
                if b_sub in VALID_DUTY_SLIP_MODES[b_type]:
                    is_valid = True
            elif b_type_norm in VALID_DUTY_SLIP_MODES:
                 if b_sub in VALID_DUTY_SLIP_MODES[b_type_norm]:
                    is_valid = True
            
            # Fallback for "Passanger" typo just in case DB has it
            if not is_valid and (b_type == "Pick-up & Drop" or b_type == "Pick-up and Drop"):
                 if b_sub in ["Passanger Goods", "Passenger Goods", "Goods Vehicle"]:
                    is_valid = True

            if not is_valid:
                return error_response(
                    message=f"Duty slip not applicable for {b_type} - {b_sub}", 
                    status_code=400
                )

            # Generate PDF
            from apps.travel.utils.pdf_generator import generate_duty_slip_pdf
            from django.http import FileResponse
            pdf_buffer = generate_duty_slip_pdf(booking)
            
            filename = f"DutySlip_{booking.id}.pdf"
            response = FileResponse(pdf_buffer, as_attachment=True, filename=filename)
            return response

        except Booking.DoesNotExist:
            return error_response(message="Booking not found", status_code=404)
        except Exception as e:
            import logging
            import traceback
            logger = logging.getLogger(__name__)
            logger.error(f"GenerateDutySlipAPIView Error: {str(e)}")
            logger.error(traceback.format_exc())
            return error_response(message=f"Error generating PDF: {str(e)}", status_code=500)
