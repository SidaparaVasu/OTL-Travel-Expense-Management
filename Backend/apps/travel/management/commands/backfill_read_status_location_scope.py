"""
Backfill location-scope read status rows for existing user-scope rows.

Background
----------
The original read status model only tracked per-user read state (scope='user').
When dual-scope support was added (scope='user' + scope='location'), existing
rows were left without:
  - marked_by populated (should mirror the user who marked it)
  - a corresponding location-scope sibling row

This command fixes both gaps for every existing user-scope row:
  1. Sets marked_by = user on the user-scope row (if blank).
  2. Creates or updates a location-scope row keyed on the application's
     employee base_location, using the same is_read value and the user as
     marked_by.

Rows where the employee has no base_location are skipped and reported.

Usage
-----
Dry run (safe, no writes):
    python manage.py backfill_read_status_location_scope --dry-run

Apply:
    python manage.py backfill_read_status_location_scope
"""

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Backfill location-scope read status rows from existing user-scope rows."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would change without writing to the database.",
        )

    def handle(self, *args, **options):
        from apps.travel.models.read_status import TravelApplicationReadStatus

        dry_run = options["dry_run"]
        prefix = "[DRY RUN] " if dry_run else ""

        user_rows = (
            TravelApplicationReadStatus.objects
            .filter(scope="user")
            .select_related(
                "user",
                "travel_application__employee__organizational_profile__base_location",
            )
        )

        total = user_rows.count()
        self.stdout.write(f"{prefix}Found {total} user-scope row(s) to process.\n")

        updated_marked_by = 0
        created_location = 0
        updated_location = 0
        skipped_no_location = 0

        for row in user_rows:
            app = row.travel_application
            user = row.user

            # Resolve the application's home location via the employee's profile
            location = None
            try:
                profile = app.employee.get_profile()
                if profile:
                    location = profile.base_location
            except Exception:
                pass

            if not location:
                self.stdout.write(
                    self.style.WARNING(
                        f"  SKIP  App {app.id} (TR {app.get_travel_request_id()}) "
                        f"— employee has no base_location."
                    )
                )
                skipped_no_location += 1
                continue

            # 1. Backfill marked_by on the user-scope row if blank
            if not row.marked_by_id:
                self.stdout.write(
                    f"  {prefix}UPDATE user-scope row id={row.id}: "
                    f"set marked_by={user.username}"
                )
                if not dry_run:
                    row.marked_by = user
                    row.save(update_fields=["marked_by"])
                updated_marked_by += 1

            # 2. Create or update the location-scope sibling row
            existing = TravelApplicationReadStatus.objects.filter(
                travel_application=app,
                scope="location",
                location=location,
            ).first()

            if existing is None:
                self.stdout.write(
                    f"  {prefix}CREATE location-scope row: "
                    f"App {app.id}, location={location.location_name}, "
                    f"is_read={row.is_read}, marked_by={user.username}"
                )
                if not dry_run:
                    TravelApplicationReadStatus.objects.create(
                        travel_application=app,
                        scope="location",
                        location=location,
                        is_read=row.is_read,
                        read_at=row.read_at,
                        marked_by=user,
                    )
                created_location += 1
            else:
                # Only update if the existing location row has stale data
                needs_update = (
                    existing.is_read != row.is_read
                    or existing.marked_by_id is None
                )
                if needs_update:
                    self.stdout.write(
                        f"  {prefix}UPDATE location-scope row id={existing.id}: "
                        f"App {app.id}, location={location.location_name}, "
                        f"is_read={row.is_read}, marked_by={user.username}"
                    )
                    if not dry_run:
                        existing.is_read = row.is_read
                        existing.read_at = row.read_at
                        existing.marked_by = user
                        existing.save(update_fields=["is_read", "read_at", "marked_by"])
                    updated_location += 1
                else:
                    self.stdout.write(
                        f"  OK    location-scope row already up to date: "
                        f"App {app.id}, location={location.location_name}"
                    )

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(f"{prefix}Summary:")
        self.stdout.write(f"  User-scope rows processed : {total}")
        self.stdout.write(f"  marked_by backfilled      : {updated_marked_by}")
        self.stdout.write(f"  Location rows created     : {created_location}")
        self.stdout.write(f"  Location rows updated     : {updated_location}")
        self.stdout.write(f"  Skipped (no base_location): {skipped_no_location}")
        if dry_run:
            self.stdout.write(
                self.style.WARNING("\nDry run complete — no changes were written.")
            )
        else:
            self.stdout.write(self.style.SUCCESS("\nBackfill complete."))
