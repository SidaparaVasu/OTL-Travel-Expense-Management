from django.db.models import Q, F, Avg, ExpressionWrapper, DurationField
from django.utils.timezone import now, timedelta
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.pagination import PageNumberPagination
from decimal import Decimal 

from apps.authentication.permissions import IsTravelDesk, IsAdminUser, IsBookingAgent, IsEmployee
from apps.travel.models import Booking, BookingAssignment, BookingNote, TravelApplication
from apps.booking_agent.serializers.agent_serializers import *
from apps.travel.services.refresh_application_booking_status import refresh_application_booking_status
from apps.travel.models.audit import AuditLog
from utils.response_formatter import success_response, error_response, paginated_response
from utils.pagination import StandardResultsSetPagination
from apps.notifications.center import NotificationCenter
from apps.authentication.models import User

# =========================================================
# TRAVEL DESK VIEWS (Originally here, kept for reference 
# or use by Travel Desk to see agents)
# =========================================================
class BookingAgentsListView(APIView):
    """
    GET /booking-agents/
    Returns list of all booking agent users.
    """

    permission_classes = [IsAuthenticated, IsTravelDesk | IsAdminUser]

    def get(self, request):
        try:
            # Get all users who are booking agents
            agents = (
                User.objects
                .filter(user_type="external", is_active=True)
                .select_related("booking_agent_profile")
            )

            serializer = BookingAgentSerializer(agents, many=True)

            return success_response(
                message="Booking agents fetched successfully",
                data=serializer.data
            )

        except Exception as e:
            return error_response(
                message="Failed to fetch booking agents",
                data={"detail": str(e)}
            )


# =========================================================
# BOOKING AGENT PORTAL VIEWS
# =========================================================

class BookingAgentDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsBookingAgent]

    def get(self, request):
        user = request.user

        # All bookings assigned to this agent
        assigned_qs = BookingAssignment.objects.filter(
            assigned_to=user
        ).select_related("booking")

        assigned_ids = assigned_qs.values_list("booking_id", flat=True)

        # Base queryset of bookings
        bookings = Booking.objects.filter(id__in=assigned_ids)

        # ---------------------------
        # 1. STATUS COUNTS
        # ---------------------------
        stats = {
            "total_assigned": bookings.count(),
            "pending": bookings.filter(status="requested").count(),
            "in_progress": bookings.filter(status="in_progress").count(),
            "confirmed": bookings.filter(status="confirmed").count(),
            "cancelled": bookings.filter(status="cancelled").count(),
        }

        # ---------------------------
        # 2. SLA: Overdue Bookings
        # (requested for more than 4 hours)
        # ---------------------------
        sla_hours = 4
        sla_deadline = now() - timedelta(hours=sla_hours)

        overdue = assigned_qs.filter(
            assigned_at__lt=sla_deadline,
            accepted_at__isnull=True
        ).count()

        stats["overdue_pending"] = overdue

        # ---------------------------
        # 3. Average Response Time (assignment → accepted)
        # ---------------------------
        response_time = assigned_qs.exclude(accepted_at=None).annotate(
            diff=ExpressionWrapper(
                F("accepted_at") - F("assigned_at"),
                output_field=DurationField()
            )
        ).aggregate(avg=Avg("diff"))["avg"]

        stats["avg_response_hours"] = (
            round(response_time.total_seconds() / 3600, 2)
            if response_time else None
        )

        # ---------------------------
        # 4. Average Confirmation Time (assignment → confirmed)
        # ---------------------------
        confirmed_times = bookings.filter(
            status="confirmed",
            assignment__assigned_to=user
        ).annotate(
            diff=ExpressionWrapper(
                F("booked_at") - F("assignment__assigned_at"),
                output_field=DurationField()
            )
        ).aggregate(avg=Avg("diff"))["avg"]

        stats["avg_confirmation_hours"] = (
            round(confirmed_times.total_seconds() / 3600, 2)
            if confirmed_times else None
        )

        # ---------------------------
        # 5. Average Completion Time (confirmed → completed)
        # ---------------------------
        completed_times = bookings.filter(
            status="completed",
        ).annotate(
            diff=ExpressionWrapper(
                F("assignment__completed_at") - F("booked_at"),
                output_field=DurationField()
            )
        ).aggregate(avg=Avg("diff"))["avg"]

        stats["avg_completion_hours"] = (
            round(completed_times.total_seconds() / 3600, 2)
            if completed_times else None
        )

        # ---------------------------
        # 6. Recent Bookings (last 5)
        # ---------------------------
        recent = bookings.filter(status="requested").order_by("-updated_at")[:5]

        return success_response(
            message="Dashboard data",
            data={
                "stats": stats,
                "recent": AgentBookingSerializer(recent, many=True).data
            }
        )


class BookingAgentBookingsListView(APIView):
    """
    GET /travel/agent/bookings/
    List bookings assigned to the logged-in booking agent.
    """

    permission_classes = [IsAuthenticated, IsBookingAgent | IsAdminUser]

    def get(self, request):
        user = request.user

        qs = Booking.objects.filter(
            assignment__assigned_to=user,
        ).select_related(
            "trip_details__travel_application",
            "trip_details__travel_application__employee",
            "trip_details__from_location",
            "trip_details__to_location",
            "booking_type",
            "sub_option",
        )

        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        search = request.query_params.get("search")
        if search:
            search = search.strip()
            
            # 1. Base Text Query (Name, Purpose)
            query = Q(trip_details__travel_application__employee__first_name__icontains=search) | \
                    Q(trip_details__travel_application__employee__last_name__icontains=search) | \
                    Q(trip_details__travel_application__purpose__icontains=search)

            # 2. Smart ID Parsing
            # Check for direct numeric ID or TR Format (e.g. TR/TSF/2026/0000048)
            # We extract the last sequence of digits
            import re
            id_match = re.search(r'(\d+)$', search)
            
            if id_match:
                # If parsed successfully, allow searching by Application ID
                try:
                    app_id = int(id_match.group(1))
                    query |= Q(trip_details__travel_application__id=app_id)
                except ValueError:
                    pass
            
            qs = qs.filter(query)

        qs = qs.order_by("status", "created_at")

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(qs, request)

        serializer = AgentBookingListSerializer(page, many=True)

        return paginated_response(
            serializer_data=serializer.data,
            paginator=paginator,
            message="Success",
        )


class BookingAgentBookingDetailView(APIView):
    """
    GET /travel/agent/bookings/<id>/
    Detailed view of a booking for the assigned agent.
    """

    permission_classes = [IsAuthenticated, IsBookingAgent]

    def get(self, request, pk):
        user = request.user
        booking = (
            Booking.objects
            .select_related(
                "trip_details__travel_application__employee",
                "trip_details__from_location",
                "trip_details__to_location",
                "booking_type",
                "sub_option",
            )
            .filter(id=pk, assignment__assigned_to=user)
            .first()
        )

        if not booking:
            return error_response(message="Booking not found", data={"id": ["Invalid booking id"]})

        serializer = AgentBookingDetailSerializer(booking)
        return success_response(data=serializer.data)


ALLOWED_AGENT_STATUSES = ["confirmed", "cancelled"]
class BookingAgentUpdateStatusView(APIView):
    permission_classes = [IsAuthenticated, IsBookingAgent]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        user = request.user

        booking = (
            Booking.objects
            .select_related("assignment", "trip_details__travel_application")
            .filter(id=pk, assignment__assigned_to=user)
            .first()
        )

        if not booking:
            return error_response(
                message="Booking not found or not assigned to you.",
                data={"id": ["Invalid booking id"]}
            )
        
        # Check if travel application is cancelled or cancellation requested
        application = booking.trip_details.travel_application
        if application.status in ['cancelled', 'cancellation_requested']:
            return error_response(
                message="Cannot update booking status - Travel application has been cancelled",
                data={
                    "status": [f"This travel application is {application.get_status_display()}. Booking actions are disabled."]
                },
                status_code=403
            )

        new_status = request.data.get("status", "").strip().lower()
        remarks = request.data.get("remarks", "").strip()

        if new_status not in ALLOWED_AGENT_STATUSES:
            return error_response(
                message="Invalid status",
                data={"status": ["Status must be 'confirmed' or 'cancelled'"]},
            )

        file_obj = request.FILES.get("booking_file")
        if file_obj:
            booking.booking_file = file_obj
            booking.uploaded_by = user
            booking.uploaded_at = timezone.now()

        actual_cost = request.data.get("actual_cost")
        if actual_cost:
            booking.actual_cost = Decimal(str(actual_cost))

        application = booking.trip_details.travel_application

        if new_status == "confirmed":

            # CEO rejection is a hard stop
            if application.approval_flows.filter(
                approval_level="ceo",
                status="rejected"
            ).exists():
                return error_response(
                    message="Cannot confirm booking as CEO has rejected the cost escalation.",
                    data={"status": ["CEO rejected this booking."]}
                )

            # Escalation rules apply only to Flight
            if booking.booking_type.name == "Flight":

                # if not booking.actual_cost:
                #     return error_response(
                #         message="Actual cost is required for flight confirmation",
                #         data={"actual_cost": ["Required"]}
                #     )

                # Check if CEO has already approved this escalation
                ceo_flow = application.approval_flows.filter(
                    approval_level="ceo",
                    status="approved"
                ).first()

                # If CEO has NOT approved yet, check if escalation is needed
                if not ceo_flow:
                    from apps.travel.services.cost_escalation import (
                        requires_ceo_escalation,
                        escalate_application_to_ceo,
                    )

                    needs_escalation, reason = requires_ceo_escalation(application, booking)

                    if needs_escalation:
                        escalate_application_to_ceo(
                            application=application,
                            booking=booking,
                            triggered_by=user,
                            reason=reason
                        )

                        application.status = "pending_ceo"
                        application.save(update_fields=["status"])

                        booking.status = "in_progress"
                        booking.save(update_fields=["actual_cost", "status"])

                        return success_response(
                            message="Escalated to CEO for approval due to cost limit.",
                            data={
                                "booking_id": booking.id,
                                "status": "escalated",
                                "application_status": application.status
                            }
                        )

            booking.status = "confirmed"
            booking.booked_at = timezone.now()

        else:
            booking.status = new_status

        booking.save()

        if remarks:
            BookingNote.objects.create(
                booking=booking,
                author=user,
                note=remarks
            )

        all_bookings = Booking.objects.filter(
            trip_details__travel_application=application
        )

        if (
            all_bookings.exists()
            and all_bookings.filter(status="confirmed").count() == all_bookings.count()
        ):
            application.status = "booked"
            application.save(update_fields=["status"])

        if new_status == "confirmed":
            NotificationCenter.notify(
                event_name="travel.booking.confirmed",
                reference={"type": "Booking", "id": booking.id},
                payload={
                    "request_id": application.get_travel_request_id(),
                    "employee_id": application.employee.id,
                    "employee_name": application.employee.get_full_name(),
                    "booking_agent_name": user.get_full_name(),
                    "ticket_number": booking.booking_reference or booking.vendor_reference,
                },
            )

        AuditLog.objects.create(
            user=user,
            action="update_booking_status",
            content_object=booking,
            changes={
                "booking_id": booking.id,
                "new_status": new_status,
                "remarks": remarks,
            }
        )

        return success_response(
            message="Booking updated successfully",
            data={
                "booking_id": booking.id,
                "status": booking.status,
                "file_uploaded": bool(file_obj),
                "application_status": application.status,
            }
        )


class BookingAgentFileUploadView(APIView):
    """
    POST /travel/agent/bookings/<id>/upload-file/
    Multipart: file=<file>
    """

    permission_classes = [IsAuthenticated, IsBookingAgent]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        user = request.user
        booking = Booking.objects.filter(
            id=pk,
            assignment__assined_to=user,
        ).select_related("trip_details__travel_application").first()

        if not booking:
            return error_response(message="Booking not found", data={"id": ["Invalid booking id"]})

        file_obj = request.FILES.get("file")
        if not file_obj:
            return error_response(message="No file uploaded", data={"file": ["This field is required"]})

        # overwrite is acceptable for current deadline
        booking.booking_file = file_obj
        booking.uploaded_by = user
        booking.uploaded_at = timezone.now()
        booking.save(update_fields=["booking_file", "uploaded_by", "uploaded_at"])

        AuditLog.objects.create(
            user=user,
            action="update_booking_status",
            content_object=booking,
            changes={
                "file_uploaded": file_obj.name,
            },
        )

        return success_response(
            message="File uploaded successfully",
            data={
                "id": booking.id,
                "file_url": booking.booking_file.url if booking.booking_file else None,
            },
        )


class BookingAgentNotesView(APIView):
    """
    GET /travel/agent/bookings/<id>/notes/
    POST /travel/agent/bookings/<id>/notes/
    Booking agent can add/view notes on a booking.
    """

    permission_classes = [IsAuthenticated, IsBookingAgent]

    def get(self, request, pk):
        user = request.user
        # ensure agent has access to this booking
        has_access = Booking.objects.filter(
            id=pk,
            assignment__assigned_to=user,
        ).exists()
        if not has_access:
            return error_response(message="Booking not found", data={"id": ["Invalid booking id"]})

        notes = BookingNote.objects.filter(booking_id=pk).select_related("author").order_by("-created_at")
        serializer = BookingNoteSerializer(notes, many=True)
        return success_response(data=serializer.data)

    def post(self, request, pk):
        user = request.user
        booking = Booking.objects.filter(
            id=pk,
            assignment__assigned_to=user,
        ).first()
        if not booking:
            return error_response(message="Booking not found", data={"id": ["Invalid booking id"]})

        payload = {**request.data, "booking": pk}
        serializer = BookingNoteSerializer(data=payload, context={"request": request})
        if not serializer.is_valid():
            return error_response(message="Validation error", data=serializer.errors)

        note = serializer.save()

        AuditLog.objects.create(
            user=user,
            action="update_booking_status",
            content_object=booking,
            changes={"note": note.note},
        )

        return success_response(
            message="Note added successfully",
            data=BookingNoteSerializer(note).data,
        )

class BookingAgentAcceptBookingView(APIView):
    """
    POST /travel/booking-agent/bookings/<id>/accept/
    Booking agent accepts the assigned booking.
    """

    permission_classes = [IsAuthenticated, IsBookingAgent]

    def post(self, request, pk):
        user = request.user

        # Fetch booking that is assigned to this agent
        booking = (
            Booking.objects
            .select_related("assignment", "trip_details__travel_application")
            .filter(id=pk, assignment__assigned_to=user)
            .first()
        )

        if not booking:
            return error_response(
                message="Booking not found or not assigned to you.",
                data={"id": ["Invalid booking id"]}
            )
        
        # Check if travel application is cancelled or cancellation requested
        application = booking.trip_details.travel_application
        if application.status in ['cancelled', 'cancellation_requested']:
            return error_response(
                message="Cannot accept booking - Travel application has been cancelled",
                data={
                    "status": [f"This travel application is {application.get_status_display()}. Booking actions are disabled."]
                },
                status_code=403
            )

        assignment = booking.assignment

        # Already accepted
        if assignment.accepted_at:
            return success_response(
                message="Booking already accepted.",
                data={"accepted_at": assignment.accepted_at}
            )

        # Booking must be in requested state
        if booking.status not in ["requested"]:
            return error_response(
                message="Booking cannot be accepted in current status.",
                data={"status": [f"Current status: {booking.status}"]}
            )

        # Accept it
        assignment.mark_accepted()

        # Move booking → in_progress
        booking.status = "in_progress"
        booking.save(update_fields=["status"])

        # Audit
        AuditLog.objects.create(
            user=user,
            action="update_booking_status",
            content_object=booking,
            changes={
                "booking_id": booking.id,
                "new_status": "in_progress",
                "accepted_at": assignment.accepted_at.isoformat() if assignment.accepted_at else None
            }
        )

        # Trigger Notification
        NotificationCenter.notify(
            event_name="travel.booking.accepted",
            reference={"type": "Booking", "id": booking.id},
            payload={
                "request_id": application.get_travel_request_id(),
                "employee_id": application.employee.id,
                "employee_name": application.employee.get_full_name(),
                "booking_agent_name": user.get_full_name(),
                "booking_type": booking.booking_type.name,
                "travel_desk_id": application.travel_desk_user_id,
            },
        )

        return success_response(
            message="Booking accepted successfully.",
            data={
                "booking_id": booking.id,
                "status": "in_progress",
                "accepted_at": assignment.accepted_at
            }
        )


class BookingAgentRejectBookingView(APIView):
    """
    POST /travel/booking-agent/bookings/<id>/reject/
    Booking agent rejects the assigned booking.
    This clears the assignment so travel desk can re-forward it.
    """

    permission_classes = [IsAuthenticated, IsBookingAgent]

    def post(self, request, pk):
        user = request.user
        remarks = request.data.get("remarks", "").strip()

        if not remarks:
            return error_response(
                message="Remarks are required for rejection.",
                data={"remarks": ["This field is required"]}
            )

        # Fetch booking that is assigned to this agent
        booking = (
            Booking.objects
            .select_related("assignment", "trip_details__travel_application", "trip_details__travel_application__employee")
            .filter(id=pk, assignment__assigned_to=user)
            .first()
        )

        if not booking:
            return error_response(
                message="Booking not found or not assigned to you.",
                data={"id": ["Invalid booking id"]}
            )

        application = booking.trip_details.travel_application
        
        # Check if travel application is cancelled or cancellation requested
        if application.status in ['cancelled', 'cancellation_requested']:
            return error_response(
                message="Cannot reject booking - Travel application has been cancelled",
                data={
                    "status": [f"This travel application is {application.get_status_display()}. Booking actions are disabled."]
                },
                status_code=403
            )

        assignment = booking.assignment

        # Rejection is only allowed for 'requested' bookings
        if booking.status not in ["requested"]:
            return error_response(
                message="Booking cannot be rejected in current status.",
                data={"status": [f"Current status: {booking.status}. Rejection is only allowed for new requests."]}
            )

        # Log audit BEFORE deleting assignment
        AuditLog.objects.create(
            user=user,
            action="update_booking_status",
            content_object=booking,
            changes={
                "booking_id": booking.id,
                "action": "rejected",
                "remarks": remarks,
                "rejected_by": user.get_full_name()
            }
        )

        # Add a note about rejection
        BookingNote.objects.create(
            booking=booking,
            author=user,
            note=f"REJECTED: {remarks}"
        )

        # Trigger Notification
        NotificationCenter.notify(
            event_name="travel.booking.rejected",
            reference={"type": "Booking", "id": booking.id},
            payload={
                "request_id": application.get_travel_request_id(),
                "employee_id": application.employee.id,
                "employee_name": application.employee.get_full_name(),
                "booking_agent_name": user.get_full_name(),
                "booking_type": booking.booking_type.name,
                "rejection_remarks": remarks,
                "travel_desk_id": application.travel_desk_user_id,
            },
        )

        # Clear assignment
        assignment.delete()

        return success_response(
            message="Booking rejected successfully. It has been returned to the travel desk.",
            data={
                "booking_id": pk,
                "status": "requested"
            }
        )


class BookingAgentCompleteBookingView(APIView):
    """
    POST /travel/booking-agent/bookings/<pk>/complete/

    Payload (multipart/form-data):
        - remarks: optional text
        - completion_file: optional file (ticket / final doc)

    Rules:
        - Only the assigned booking agent can complete the booking
        - Booking must currently be in 'confirmed' status
        - When ALL bookings for the application are completed,
        application status is set to 'completed'
    """

    permission_classes = [IsAuthenticated, IsBookingAgent]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        user = request.user

        # 1) Fetch booking that belongs to this agent
        booking = (
            Booking.objects
            .select_related("assignment", "trip_details__travel_application")
            .filter(id=pk, assignment__assigned_to=user)
            .first()
        )

        if not booking:
            return error_response(
                message="Booking not found or not assigned to you.",
                data={"id": ["Invalid booking id"]}
            )

        # 2) Status validation
        if booking.status != "confirmed":
            return error_response(
                message="Booking cannot be completed in current status.",
                data={"status": [f"Current status is '{booking.status}', must be 'confirmed' before completion."]}
            )

        remarks = request.data.get("remarks", "").strip()

        # Optional completion file – for now we reuse booking.booking_file
        file_obj = request.FILES.get("completion_file")
        if file_obj:
            booking.booking_file = file_obj
            booking.uploaded_by = user
            booking.uploaded_at = timezone.now()

        # 3) Mark booking as completed
        booking.status = "completed"
        booking.save()

        # 4) Add note if provided
        if remarks:
            BookingNote.objects.create(
                booking=booking,
                created_by=user,
                note=remarks,
            )

        
        from apps.travel.services.cost_escalation import (requires_ceo_escalation, escalate_application_to_ceo)

        application = booking.trip_details.travel_application

        needs_ceo, reason = requires_ceo_escalation(application, booking)

        if needs_ceo:
            escalate_application_to_ceo(
                application=application,
                booking=booking,
                triggered_by=request.user,
                reason=reason,
            )

            return error_response(
                message="CEO approval required due to booking cost escalation",
                data={
                    "application_status": application.status,
                    "reason": reason,
                    "action_required": "CEO approval",
                },
                status_code=409
            )

        # 5) If all bookings for this application are completed -> mark app as completed
        all_bookings_qs = Booking.objects.filter(
            trip_details__travel_application=application
        )

        if (
            all_bookings_qs.exists()
            and all_bookings_qs.filter(status="completed").count() == all_bookings_qs.count()
        ):
            application.status = "completed"
            application.save(update_fields=["status"])

        # 6) Audit log
        AuditLog.objects.create(
            user=user,
            action="update_booking_status",
            content_object=booking,
            changes={
                "booking_id": booking.id,
                "new_status": "completed",
                "remarks": remarks,
            },
        )

        return success_response(
            message="Booking marked as completed successfully.",
            data={
                "booking_id": booking.id,
                "status": "completed",
                "file_uploaded": bool(file_obj),
                "application_status": application.status,
            },
        )
