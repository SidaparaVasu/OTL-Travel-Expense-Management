from django.db.models import F, Avg, ExpressionWrapper, DurationField, Q
from django.utils import timezone
from django.utils.timezone import now, timedelta
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from apps.travel.models import TravelApplication, TripDetails, Booking, BookingAssignment, BookingNote
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
    "cancellation_requested",
    "cancelled",
    "completed",
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
      

def annotate_booking_action_status(queryset, user):
    from django.db.models import Count, Q, F, Case, When, Value, CharField
    return queryset.annotate(
        total_bookings=Count('trip_details__bookings', distinct=True),
        pending_action_bookings=Count(
            'trip_details__bookings',
            filter=Q(
                trip_details__bookings__status='pending',
                trip_details__bookings__handling_travel_desk_user=user
            ),
            distinct=True
        ),
        general_pending_bookings=Count(
            'trip_details__bookings',
            filter=Q(trip_details__bookings__status='pending'),
            distinct=True
        ),
        requested_bookings=Count(
            'trip_details__bookings',
            filter=Q(trip_details__bookings__status='requested'),
            distinct=True
        ),
        in_progress_bookings=Count(
            'trip_details__bookings',
            filter=Q(trip_details__bookings__status='in_progress'),
            distinct=True
        ),
        confirmed_bookings=Count(
            'trip_details__bookings',
            filter=Q(trip_details__bookings__status='confirmed'),
            distinct=True
        ),
        cancelled_bookings=Count(
            'trip_details__bookings',
            filter=Q(trip_details__bookings__status='cancelled'),
            distinct=True
        ),
        completed_bookings=Count(
            'trip_details__bookings',
            filter=Q(trip_details__bookings__status='completed'),
            distinct=True
        ),
        closed_bookings=Count(
            'trip_details__bookings',
            filter=Q(trip_details__bookings__status='closed'),
            distinct=True
        ),
    ).annotate(
        booking_action_status=Case(
            When(general_pending_bookings__gt=0, then=Value('pending')),
            When(general_pending_bookings=0, requested_bookings__gt=0, then=Value('requested')),
            When(general_pending_bookings=0, requested_bookings=0, in_progress_bookings__gt=0, then=Value('in_progress')),
            When(total_bookings__gt=0, confirmed_bookings=F('total_bookings'), then=Value('confirmed')),
            When(total_bookings__gt=0, completed_bookings=F('total_bookings'), then=Value('completed')),
            # Desk-closed line items: desk work is done — show as completed in Action Status.
            # The "closed" filter still matches booking.status='closed' directly.
            When(
                general_pending_bookings=0,
                requested_bookings=0,
                in_progress_bookings=0,
                closed_bookings__gt=0,
                then=Value('completed'),
            ),
            When(cancelled_bookings__gt=0, then=Value('cancelled')),
            default=Value('none'),
            output_field=CharField()
        )
    )

class TravelDeskApplicationListView(BranchFilterMixin, APIView):
    """
    Travel Desk Application List with branch-based access control.
    Travel Desk users can only see applications from their assigned branch.
    """
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def get(self, request):
        # Base queryset: Filter by Travel Desk visible statuses
        qs = TravelApplication.objects.select_related(
            "employee",
            "employee__organizational_profile__base_location",
        ).filter(
            status__in=TRAVEL_DESK_VISIBLE_STATUSES
        )
        
        # Apply branch filtering - Travel Desk sees only their branch
        qs = self.apply_branch_filter(qs, request.user, employee_field='employee')

        # Annotate with derived booking action status
        qs = annotate_booking_action_status(qs, request.user)

        # Status and Global Search filters
        status_filter = request.query_params.get("status")
        booking_action_status = request.query_params.get("booking_action_status")
        is_global = request.query_params.get("is_global") == "true"
        search = request.query_params.get("search")

        # Tab filter: my_requests (actionable by current user) or forwarded (delegated to others)
        tab = request.query_params.get("tab")  # "my_requests" | "forwarded" | None

        # Location filter: employee base location name
        location = request.query_params.get("location")

        # Sort order
        sort_by = request.query_params.get("sort_by", "submitted_desc")

        # If it's a global search and search term is provided, we skip status and date filters
        skip_narrow_filters = is_global and search
        
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        # Build search Q objects
        q_objects = Q()
        if search:
            import re
            match = re.search(r'(\d+)$', search)
            q_objects = Q(purpose__icontains=search) | \
                        Q(employee__first_name__icontains=search) | \
                        Q(employee__last_name__icontains=search) | \
                        Q(employee__username__icontains=search)
            if match:
                try:
                    travel_id = int(match.group(1))
                    q_objects |= Q(id=travel_id)
                except ValueError:
                    pass

        def apply_common_filters(queryset):
            _qs = queryset
            if status_filter and status_filter != 'all' and not skip_narrow_filters:
                _qs = _qs.filter(status=status_filter)
            if booking_action_status and booking_action_status != 'all' and not skip_narrow_filters:
                if booking_action_status == 'pending':
                    _qs = _qs.filter(general_pending_bookings__gt=0)
                elif booking_action_status == 'requested':
                    _qs = _qs.filter(general_pending_bookings=0, requested_bookings__gt=0)
                elif booking_action_status == 'in_progress':
                    _qs = _qs.filter(general_pending_bookings=0, requested_bookings=0, in_progress_bookings__gt=0)
                elif booking_action_status == 'confirmed':
                    _qs = _qs.filter(total_bookings__gt=0, confirmed_bookings=F('total_bookings'))
                elif booking_action_status == 'completed':
                    _qs = _qs.filter(total_bookings__gt=0, completed_bookings=F('total_bookings'))
                elif booking_action_status == 'cancelled':
                    # Only cancelled when no primary actionable bookings exist as per our precedence
                    _qs = _qs.filter(
                        general_pending_bookings=0,
                        requested_bookings=0,
                        in_progress_bookings=0,
                        cancelled_bookings__gt=0
                    )
                elif booking_action_status == 'closed':
                    # Applications that have at least one desk-closed booking line item
                    _qs = _qs.filter(
                        trip_details__bookings__status='closed',
                    ).distinct()
            if search:
                _qs = _qs.filter(q_objects)
            if date_from and not skip_narrow_filters:
                _qs = _qs.filter(submitted_at__date__gte=date_from)
            if date_to and not skip_narrow_filters:
                _qs = _qs.filter(submitted_at__date__lte=date_to)
            return _qs

        # Apply common filters to main qs
        qs = apply_common_filters(qs)

        # Union with applications where bookings are forwarded to the current user
        # These might be outside the user's branch
        forwarded_app_ids = Booking.objects.filter(
            handling_travel_desk_user=request.user
        ).values_list('trip_details__travel_application_id', flat=True).distinct()
        
        if forwarded_app_ids:
            forwarded_qs = TravelApplication.objects.select_related(
                "employee",
                "employee__organizational_profile__base_location",
            ).filter(
                id__in=forwarded_app_ids,
                status__in=TRAVEL_DESK_VISIBLE_STATUSES
            )
            forwarded_qs = annotate_booking_action_status(forwarded_qs, request.user)
            forwarded_qs = apply_common_filters(forwarded_qs)
            qs = qs | forwarded_qs
            qs = qs.distinct()

        # --- Tab filter (backend) ---
        # Terminal statuses have no actionable bookings by design; skip tab filter for them.
        # Also skip when global search is active (show everything matching the search).
        terminal_statuses = {'confirmed', 'completed', 'cancelled', 'closed'}
        is_terminal = booking_action_status in terminal_statuses
        if tab and not is_terminal and not skip_narrow_filters:
            if tab == 'my_requests':
                # Applications that have at least one booking actionable by the current user
                # (handling_travel_desk_user is null OR is the current user) and in an active state
                qs = qs.filter(
                    trip_details__bookings__status__in=['pending', 'requested', 'in_progress', 'booking_in_progress'],
                ).filter(
                    Q(trip_details__bookings__handling_travel_desk_user=request.user) |
                    Q(trip_details__bookings__handling_travel_desk_user__isnull=True)
                ).distinct()
            elif tab == 'forwarded':
                # Applications that have at least one booking delegated to another travel desk user
                qs = qs.filter(
                    trip_details__bookings__handling_travel_desk_user__isnull=False,
                    trip_details__bookings__status__in=['pending', 'requested', 'in_progress', 'booking_in_progress', 'booked', 'completed'],
                ).exclude(
                    trip_details__bookings__handling_travel_desk_user=request.user,
                ).distinct()

        # --- Location filter (backend) ---
        if location and location != 'all' and not skip_narrow_filters:
            qs = qs.filter(
                employee__organizational_profile__base_location__location_name=location
            )

        # --- Sorting (backend) ---
        from django.db.models import Subquery, OuterRef, DateField

        sort_map = {
            'urgency':        ('first_departure_date', False),   # asc = most urgent first
            'date_asc':       ('first_departure_date', False),
            'date_desc':      ('first_departure_date', True),
            'submitted_asc':  ('submitted_at', False),
            'submitted_desc': ('submitted_at', True),
        }

        sort_field, descending = sort_map.get(sort_by, ('submitted_at', True))

        if sort_field == 'first_departure_date':
            # Annotate with the earliest departure date across all trip legs
            first_departure = TripDetails.objects.filter(
                travel_application=OuterRef('pk')
            ).order_by('departure_date').values('departure_date')[:1]

            qs = qs.annotate(
                first_departure_date=Subquery(first_departure, output_field=DateField())
            )
            order_expr = F('first_departure_date').desc(nulls_last=True) if descending else F('first_departure_date').asc(nulls_last=True)
        else:
            order_expr = F(sort_field).desc(nulls_last=True) if descending else F(sort_field).asc(nulls_last=True)

        qs = qs.order_by(order_expr, '-id')

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = TravelDeskApplicationListSerializer(page, many=True, context={'request': request})

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
            .select_related("employee", "travel_desk_user")
            .prefetch_related(
                "trip_details__bookings__handling_travel_desk_user"
            )
            .filter(pk=pk)
            .first()
        )
        if not app:
            return error_response(message="Application not found", data={"id": ["Invalid id"]})

        serializer = TravelDeskApplicationDetailSerializer(app, context={'request': request})
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
        # Distinguish "not provided" from "explicitly set to null/value"
        vehicle_type_explicitly_set = "requested_vehicle_type_id" in request.data
        note_text = serializer.validated_data.get("note")
        
        # Validate no self-arranged bookings
        from apps.travel.services.travel_desk_display import is_self_arranged_booking
        for b in bookings:
            if is_self_arranged_booking(b):
                return error_response(message=f"Booking {b.id} is self-arranged and cannot be assigned.")

        booking_agent = User.objects.filter(
            id=booking_agent_id,
            is_active=True,
            booking_agent_profile__is_active=True,
        ).first()
        if not booking_agent:
            return error_response(message="Invalid booking agent")

        app = TravelApplication.objects.get(id=application_id)

        with transaction.atomic():
            for b in bookings:
                from apps.travel.services.travel_desk_display import (
                    ensure_handling_travel_desk_on_action,
                )
                ensure_handling_travel_desk_on_action(b, request.user)

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
                    save_fields = [
                        "assigned_to", "assigned_by", "assignment_scope",
                        "assigned_at", "accepted_at", "completed_at",
                    ]
                    # Only overwrite vehicle type if explicitly provided in the request
                    if vehicle_type_explicitly_set:
                        assignment.requested_vehicle_type_id = requested_vehicle_type_id
                        save_fields.append("requested_vehicle_type_id")
                    assignment.save(update_fields=save_fields)

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

                # notify agent
                from apps.travel.services.notification_service import notify_booking_agent_of_assignment
                notify_booking_agent_of_assignment(b, booking_agent, request=request)

            # Refresh application level booking status using the unified service
            from apps.travel.services.refresh_application_booking_status import refresh_application_booking_status
            refresh_application_booking_status(app)
            app.refresh_from_db()


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
        if not User.objects.filter(
            id=agent_id,
            is_active=True,
            booking_agent_profile__is_active=True,
        ).exists():
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
        requested_vehicle_type_id = request.data.get("requested_vehicle_type_id")
        vehicle_type_explicitly_set = "requested_vehicle_type_id" in request.data

        if not new_agent_id:
            return error_response(message="new_agent_id is required")

        booking = Booking.objects.filter(id=booking_id).first()
        if not booking:
            return error_response(message="Invalid booking id")

        from apps.travel.services.travel_desk_display import is_self_arranged_booking
        if is_self_arranged_booking(booking):
            return error_response(message="Cannot reassign self-arranged booking")

        new_agent = User.objects.filter(
            id=new_agent_id,
            is_active=True,
            booking_agent_profile__is_active=True,
        ).first()
        if not new_agent:
            return error_response(message="Invalid booking agent")

        with transaction.atomic():
            from apps.travel.services.travel_desk_display import (
                ensure_handling_travel_desk_on_action,
            )

            ensure_handling_travel_desk_on_action(booking, request.user)

            # Find existing assignment if any
            assignment = BookingAssignment.objects.filter(booking=booking).first()
            old_agent = assignment.assigned_to if assignment else None

            # Update or create assignment — preserve vehicle type if not explicitly changed
            update_fields = {
                "assigned_to": new_agent,
                "assigned_by": request.user,
                "assignment_scope": "single_booking",
                "assigned_at": timezone.now(),
                "accepted_at": None,
                "completed_at": None,
            }
            # Only update vehicle type if explicitly provided in the request body
            if vehicle_type_explicitly_set:
                update_fields["requested_vehicle_type_id"] = requested_vehicle_type_id

            assignment, created = BookingAssignment.objects.update_or_create(
                booking=booking,
                defaults=update_fields,
            )

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

            # Refresh application level booking status using the unified service
            from apps.travel.services.refresh_application_booking_status import refresh_application_booking_status
            refresh_application_booking_status(booking.trip_details.travel_application)

            # 4. Notify new agent
            from apps.travel.services.notification_service import notify_booking_agent_of_assignment
            notify_booking_agent_of_assignment(booking, new_agent, request=request)
            
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
            agent_profile = BookingAgentProfile.objects.select_related("user").get(
                user_id=agent_id,
                is_active=True,
                user__is_active=True,
            )
        except BookingAgentProfile.DoesNotExist:
            return error_response(message="Invalid booking agent")

        # Fetch all bookings belonging to the application
        all_bookings = Booking.objects.filter(trip_details__travel_application=app)
        # Exclude self-arranged bookings
        from apps.travel.services.travel_desk_display import is_self_arranged_booking
        bookings = [b for b in all_bookings if not is_self_arranged_booking(b)]
        
        if not bookings:
             return error_response(message="No assignable bookings found in this application")

        agent_user = agent_profile.user

        with transaction.atomic():
            from apps.travel.services.travel_desk_display import (
                ensure_handling_travel_desk_on_action,
            )

            for booking in bookings:
                ensure_handling_travel_desk_on_action(booking, request.user)

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

                # Audit log for individual booking
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
                
                # Notify assigned agent
                from apps.travel.services.notification_service import notify_booking_agent_of_assignment
                notify_booking_agent_of_assignment(booking, agent_user, request=request)

            # Refresh application level booking status using the unified service
            from apps.travel.services.refresh_application_booking_status import refresh_application_booking_status
            refresh_application_booking_status(app)
            app.refresh_from_db()

            # High-level forward audit
            AuditLog.objects.create(
                user=request.user,
                action="forward_to_travel_desk",
                content_object=app,
                changes={
                    "application_id": app.id,
                    "forwarded_to": agent_user.id,
                    "total_bookings": len(bookings),
                },
            )

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

                # Refresh application level booking status using the unified service
                from apps.travel.services.refresh_application_booking_status import refresh_application_booking_status
                refresh_application_booking_status(booking.trip_details.travel_application)
                
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

                # Send Notification
                from apps.notifications.center import NotificationCenter
                application = booking.trip_details.travel_application
                
                # Map internal mode name to human readable for email
                mode_name = booking.booking_type.name
                if mode_name in ["Flight", "Train"]:
                    display_type = mode_name
                elif mode_name == "Accommodation":
                    display_type = "Accommodation"
                else:
                    display_type = "Vehicle"

                NotificationCenter.notify(
                    event_name="travel.booking.cancelled",
                    reference={"type": "Booking", "id": booking.id},
                    payload={
                        "request_id": application.get_travel_request_id(),
                        "employee_id": application.employee.id,
                        "employee_name": application.employee.get_full_name(),
                        "booking_agent_id": booking.assignment.assigned_to.id if hasattr(booking, 'assignment') and booking.assignment and booking.assignment.assigned_to else None,
                        "booking_type": display_type,
                        "cancel_reason": reason or "N/A",
                    },
                )
            
            logger.error(f"DEBUG_CANCEL: Cancellation successful")
            return success_response(message="Booking cancelled successfully")
        except Exception as e:
            logger.error(f"DEBUG_CANCEL: Exception detected: {str(e)}")
            return error_response(f"Error cancelling booking: {str(e)}")


class TravelDeskCloseBookingView(APIView):
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def post(self, request, booking_id):
        from apps.travel.services.booking_closure import close_booking, is_primary_spoc_for_application
        from django.core.exceptions import ValidationError

        booking = Booking.objects.filter(id=booking_id).select_related(
            'trip_details__travel_application',
            'handling_travel_desk_user',
        ).first()
        if not booking:
            return error_response(message="Booking not found")

        allow_claim_raw = request.data.get("allow_claim")
        if allow_claim_raw is None:
            return error_response(message="allow_claim is required")

        is_primary_spoc = request.data.get("is_primary_spoc")
        if is_primary_spoc is None:
            is_primary_spoc = is_primary_spoc_for_application(
                booking.trip_details.travel_application,
                request.user,
            )

        try:
            close_booking(
                booking,
                request.user,
                closure_reason=request.data.get("closure_reason", ""),
                claim_decision_reason=request.data.get("claim_decision_reason", ""),
                allow_claim=bool(allow_claim_raw),
                is_primary_spoc=bool(is_primary_spoc),
            )
            booking.refresh_from_db()
            return success_response(
                message="Booking closed successfully",
                data={
                    "booking_id": booking.id,
                    "status": booking.status,
                    "allow_claim": booking.allow_claim,
                },
            )
        except ValidationError as e:
            if hasattr(e, 'message_dict'):
                return error_response(message="Validation failed", data=e.message_dict)
            return error_response(message=str(e))
        except Exception as e:
            return error_response(f"Error closing booking: {str(e)}")


class TravelDeskUpdateBookingClaimEligibilityView(APIView):
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def post(self, request, booking_id):
        from apps.travel.services.booking_closure import (
            update_booking_claim_eligibility,
            is_primary_spoc_for_application,
        )
        from django.core.exceptions import ValidationError

        booking = Booking.objects.filter(id=booking_id).select_related(
            'trip_details__travel_application',
            'handling_travel_desk_user',
        ).first()
        if not booking:
            return error_response(message="Booking not found")

        allow_claim_raw = request.data.get("allow_claim")
        if allow_claim_raw is None:
            return error_response(message="allow_claim is required")

        is_primary_spoc = request.data.get("is_primary_spoc")
        if is_primary_spoc is None:
            is_primary_spoc = is_primary_spoc_for_application(
                booking.trip_details.travel_application,
                request.user,
            )

        try:
            update_booking_claim_eligibility(
                booking,
                request.user,
                allow_claim=bool(allow_claim_raw),
                claim_decision_reason=request.data.get("claim_decision_reason", ""),
                is_primary_spoc=bool(is_primary_spoc),
            )
            booking.refresh_from_db()
            return success_response(
                message="Claim eligibility updated successfully",
                data={
                    "booking_id": booking.id,
                    "status": booking.status,
                    "allow_claim": booking.allow_claim,
                },
            )
        except ValidationError as e:
            if hasattr(e, 'message_dict'):
                return error_response(message="Validation failed", data=e.message_dict)
            return error_response(message=str(e))
        except Exception as e:
            return error_response(f"Error updating claim eligibility: {str(e)}")


class GenerateDutySlipAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id):
        try:
            booking = Booking.objects.select_related(
                "booking_type", "sub_option", "trip_details__travel_application__employee"
            ).get(id=booking_id)

            # Gate: duty slips are only applicable for conveyance bookings.
            # This is driven by the booking_category field on TravelModeMaster —
            # no hardcoded mode name list needed.
            if getattr(booking.booking_type, 'booking_category', None) != 'conveyance':
                b_type = (booking.booking_type.name or "").strip()
                b_sub = (booking.sub_option.name or "").strip() if booking.sub_option else ""
                return error_response(
                    message=f"Duty slip not applicable for {b_type}" + (f" - {b_sub}" if b_sub else ""),
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


class TravelDeskForwardToDeskView(APIView):
    """
    POST: Forward a specific booking to another travel desk user.
    """
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def post(self, request, booking_id):
        target_user_id = request.data.get("target_user_id")
        remarks = request.data.get("remarks", "")

        if not target_user_id:
            return error_response(message="Target user ID is required")

        booking = Booking.objects.select_related('trip_details__travel_application').filter(id=booking_id).first()
        if not booking:
            return error_response(message="Booking not found")

        # Validate target user
        target_user = User.objects.filter(id=target_user_id, is_active=True).first()
        if not target_user:
            return error_response(message="Target user not found")

        # 1. Check if target is actually a travel desk user
        from apps.authentication.models import UserRole
        if not UserRole.objects.filter(
            user=target_user,
            role__name__in=['Travel Desk', 'Global Travel Desk'],
            is_active=True
        ).exists():
             return error_response(message="Target user is not a Travel Desk member")

        # 2. Block if already assigned to this user
        if booking.handling_travel_desk_user == target_user:
            return error_response(message="This booking is already assigned to the selected user.")

        # 3. Block based on status
        if booking.status == 'cancelled':
            return error_response(message="This booking has been cancelled and cannot be forwarded.")
        if booking.status in ['confirmed', 'completed']:
            return error_response(message=f"This booking is {booking.status} and cannot be forwarded.")
        if booking.status == 'in_progress':
            return error_response(message="This booking is currently being processed by the assigned agent and cannot be forwarded.")

        # 4. Block if actively assigned to a booking agent
        has_active_assignment = hasattr(booking, 'assignment') and booking.assignment and booking.assignment.assigned_to
        if has_active_assignment:
            return error_response(message="This booking has already been forwarded to a booking agent and cannot be reassigned to another desk user.")

        current_handler = booking.handling_travel_desk_user
        
        with transaction.atomic():
            # 1. Update Booking
            booking.handling_travel_desk_user = target_user
            # Only mark forwarded when assigning to another desk user (not self-reclaim).
            if target_user.id != request.user.id:
                booking.travel_desk_forwarded_at = timezone.now()
                update_fields = ["handling_travel_desk_user", "travel_desk_forwarded_at"]
            else:
                booking.travel_desk_forwarded_at = None
                update_fields = ["handling_travel_desk_user", "travel_desk_forwarded_at"]
            booking.save(update_fields=update_fields)

            # 2. Add System Note
            note_text = f"Forwarded to {target_user.get_full_name()} by {request.user.get_full_name()}"
            if remarks:
                note_text += f". Remarks: {remarks}"
            
            BookingNote.objects.create(
                booking=booking,
                author=request.user,
                note=f"[SYSTEM] {note_text}"
            )

            # 3. Audit Log
            AuditLog.objects.create(
                user=request.user,
                action="forward_to_travel_desk",
                content_object=booking,
                changes={
                    "booking_id": booking.id,
                    "previous_handler": current_handler.id if current_handler else None,
                    "new_handler": target_user.id,
                    "remarks": remarks
                }
            )
            
            # 4. Notification
            try:
                NotificationCenter.notify(
                    event_name="travel.booking.forwarded_to_desk",
                    reference={"type": "Booking", "id": booking.id},
                    payload={
                        "booking_id": booking.id,
                        "forwarded_by_name": request.user.get_full_name(),
                        "desk_agent_id": target_user.id,
                        "booking_type": booking.booking_type.name,
                        "travel_request_id": booking.trip_details.travel_application.get_travel_request_id()
                    }
                )
            except Exception as e:
                # Log but don't fail transaction
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to send forward notification: {str(e)}")

        return success_response(
            message="Booking forwarded successfully",
            data={
                "booking_id": booking.id,
                "new_handler": {
                    "id": target_user.id,
                    "name": target_user.get_full_name()
                }
            }
        )

class TravelDeskAssignedLocationsView(APIView):
    """
    GET: List of locations assigned to the current Travel Desk user (SPOC).
    Used for filtering the dashboard.
    """
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def get(self, request):
        user = request.user
        locations = set()

        # 1. Get user's own base location
        profile = user.get_profile()
        if profile and profile.base_location:
            locations.add(profile.base_location)

        # 2. Get assigned SPOC locations
        from apps.authentication.models.spoc import LocationSPOCAssignment
        
        assignments = LocationSPOCAssignment.objects.filter(
            user=user, 
            is_active=True
        ).prefetch_related('locations')

        for assignment in assignments:
            if assignment.is_global:
                # If global, they effectively have access to all locations.
                # However, for the filter dropdown, listing ALL cities might be too much.
                # For now, we just return the explicitly assigned ones + base.
                # Or we could return a flag "is_global": True?
                # The prompt asked to "retrieve allocated locations".
                pass
            
            locations.update(assignment.locations.all())

        data = [
            {"id": loc.pk, "name": loc.location_name}
            for loc in locations
        ]
        
        # Sort by name
        data.sort(key=lambda x: x['name'])

        return success_response(data=data)

class TravelDeskUsersListView(APIView):
    """
    GET: List all users with 'Travel Desk' role.
    """
    permission_classes = [IsAuthenticated, IsTravelDesk]

    def get(self, request):
        from apps.authentication.models import UserRole
        
        # Get users with active 'Travel Desk' role assignment
        user_roles = UserRole.objects.filter(
            role__name__in=['Travel Desk', 'Global Travel Desk'],
            is_active=True,
            user__is_active=True
        ).select_related('user')
        
        data = []
        for ur in user_roles:
            user = ur.user
            data.append({
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "full_name": user.get_full_name() or f'{user.first_name} {user.last_name}',
                "role": ur.role.name
            })
            
        return success_response(data=data)
