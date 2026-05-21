"""
Repair travel_desk_user / handling_travel_desk_user after bad auto-forward patches.

1. Clear handling on flight/train (system auto-forward — no desk contact).
2. Clear handling / app owner when the user is not Travel Desk / Global Travel Desk.
3. Re-apply branch SPOC on non–flight/train bookings only.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.travel.models import Booking, TravelApplication
from apps.travel.services.travel_desk_display import (
    initialize_travel_desk_ownership,
    is_flight_or_train_booking,
    user_is_travel_desk,
)


class Command(BaseCommand):
    help = (
        "Repair polluted travel_desk_user / handling_travel_desk_user "
        "(approvers on desk fields; desk on auto-forwarded flight/train)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report changes without saving",
        )
        parser.add_argument(
            "--application-id",
            type=int,
            help="Limit repair to one TravelApplication id",
        )
        parser.add_argument(
            "--travel-request-id",
            type=str,
            help="Limit repair to one TR id (e.g. TR/TSF/2026/0000180)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        app_id = options.get("application_id")
        tr_id = options.get("travel_request_id")

        apps = TravelApplication.objects.all().order_by("id")
        if app_id:
            apps = apps.filter(pk=app_id)
        if tr_id:
            try:
                pk = int(str(tr_id).strip().split("/")[-1])
            except (ValueError, IndexError) as exc:
                raise SystemExit(
                    f"Invalid --travel-request-id {tr_id!r}; "
                    "expected format TR/TSF/YYYY/0000180"
                ) from exc
            apps = apps.filter(pk=pk)

        flight_train_cleared = 0
        invalid_user_cleared = 0
        app_invalid_cleared = 0
        apps_reinitialized = 0

        for application in apps.iterator():
            changed = False
            tr_label = application.get_travel_request_id()

            if application.travel_desk_user_id and not user_is_travel_desk(
                application.travel_desk_user
            ):
                self.stdout.write(
                    f"App {application.id} ({tr_label}): "
                    f"clear travel_desk_user id={application.travel_desk_user_id}"
                )
                if not dry_run:
                    application.travel_desk_user = None
                    application.save(update_fields=["travel_desk_user"])
                app_invalid_cleared += 1
                changed = True

            bookings = Booking.objects.filter(
                trip_details__travel_application=application
            ).select_related("booking_type", "handling_travel_desk_user")

            for booking in bookings:
                clear_handling = False
                reason = ""

                if is_flight_or_train_booking(booking) and booking.handling_travel_desk_user_id:
                    clear_handling = True
                    reason = "flight/train auto-forward (no desk)"
                elif (
                    booking.handling_travel_desk_user_id
                    and not user_is_travel_desk(booking.handling_travel_desk_user)
                ):
                    clear_handling = True
                    reason = "non–travel-desk user"

                if clear_handling:
                    self.stdout.write(
                        f"  Booking {booking.id} ({booking.booking_type.name}): "
                        f"clear handling id={booking.handling_travel_desk_user_id} — {reason}"
                    )
                    if not dry_run:
                        booking.handling_travel_desk_user = None
                        booking.save(update_fields=["handling_travel_desk_user"])
                    if is_flight_or_train_booking(booking):
                        flight_train_cleared += 1
                    else:
                        invalid_user_cleared += 1
                    changed = True

            if changed and not dry_run:
                with transaction.atomic():
                    initialize_travel_desk_ownership(application)
                apps_reinitialized += 1

        self.stdout.write(
            self.style.SUCCESS(
                "Done. "
                f"flight/train handling cleared={flight_train_cleared}, "
                f"invalid desk user on bookings={invalid_user_cleared}, "
                f"app travel_desk_user cleared={app_invalid_cleared}, "
                f"apps reinitialized={apps_reinitialized}"
                + (" (dry-run)" if dry_run else "")
            )
        )
