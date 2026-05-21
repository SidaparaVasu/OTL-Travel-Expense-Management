"""
Clear travel_desk_user / handling_travel_desk_user when they point to non–travel-desk
users (e.g. approvers set by auto-forward), then re-apply branch SPOC where possible.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.travel.models import Booking, TravelApplication
from apps.travel.services.travel_desk_display import (
    initialize_travel_desk_ownership,
    user_is_travel_desk,
)


class Command(BaseCommand):
    help = (
        "Repair travel_desk_user and handling_travel_desk_user polluted by "
        "non–travel-desk users (approvers, applicants)."
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
            help="Limit repair to a single TravelApplication primary key",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        app_id = options.get("application_id")

        apps = TravelApplication.objects.all()
        if app_id:
            apps = apps.filter(pk=app_id)

        app_cleared = 0
        booking_cleared = 0
        apps_reinitialized = 0

        for application in apps.iterator():
            changed = False

            if application.travel_desk_user_id and not user_is_travel_desk(
                application.travel_desk_user
            ):
                self.stdout.write(
                    f"App {application.id} ({application.get_travel_request_id()}): "
                    f"clear travel_desk_user={application.travel_desk_user_id}"
                )
                if not dry_run:
                    application.travel_desk_user = None
                    application.save(update_fields=["travel_desk_user"])
                app_cleared += 1
                changed = True

            bookings = Booking.objects.filter(
                trip_details__travel_application=application
            )
            for booking in bookings:
                if (
                    booking.handling_travel_desk_user_id
                    and not user_is_travel_desk(booking.handling_travel_desk_user)
                ):
                    self.stdout.write(
                        f"  Booking {booking.id}: clear handling_travel_desk_user="
                        f"{booking.handling_travel_desk_user_id}"
                    )
                    if not dry_run:
                        booking.handling_travel_desk_user = None
                        booking.save(update_fields=["handling_travel_desk_user"])
                    booking_cleared += 1
                    changed = True

            if changed and not dry_run:
                with transaction.atomic():
                    initialize_travel_desk_ownership(application)
                apps_reinitialized += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. app fields cleared={app_cleared}, "
                f"booking fields cleared={booking_cleared}, "
                f"reinitialized={apps_reinitialized}"
                + (" (dry-run)" if dry_run else "")
            )
        )
