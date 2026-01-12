from django.core.management.base import BaseCommand
from django.utils import timezone
from decimal import Decimal

from apps.master_data.models.travel import (
    TravelModeMaster,
    TravelSubOptionMaster,
    GradeEntitlementMaster
)
from apps.master_data.models.grades import GradeMaster
from apps.master_data.models.approval import ApprovalMatrix, DAIncidentalMaster, ConveyanceRateMaster
from apps.master_data.models.geography import CityCategoriesMaster

# Authentication models
try:
    from authentication.models import User, Role, UserRole
except Exception:
    from django.contrib.auth import get_user_model
    User = get_user_model()
    Role = None
    UserRole = None


class Command(BaseCommand):
    help = "Populate master tables (travel modes, grade entitlements, DA, conveyance, approval matrix)."

    # ---------------------------
    # POLICY CONSTANTS (from client's document)
    # ---------------------------
    # Accommodation entitlement per day (Category A / B)
    POLICY_ACCOMMODATION = {
        "B-2A": {"A": 7000, "B": 5000},
        "B-2B": {"A": 7000, "B": 5000},
        "B-3": {"A": 6500, "B": 4000},
        "B-4A": {"A": 6500, "B": 4000},
        "B-4B": {"A": 6500, "B": 4000},
    }

    # Stay-with-friends/relatives allowances (Category A / B)
    POLICY_STAY_WITH_FRIENDS = {
        "B-2A": {"A": 1800, "B": 1000},
        "B-2B": {"A": 1200, "B": 800},
        "B-3": {"A": 1000, "B": 600},
        "B-4A": {"A": 1000, "B": 600},
        "B-4B": {"A": 1000, "B": 600},
    }

    # DA/Incidentals table is handled in DAIncidentalMaster population (separate method)
    # Conveyance rates (policy)
    POLICY_CONVEYANCE = [
        {"conveyance_type": "taxi_with_receipt", "rate_per_km": Decimal("0"), "requires_receipt": True},
        {"conveyance_type": "taxi_without_receipt", "rate_per_km": Decimal("15"), "requires_receipt": False},
        {"conveyance_type": "own_vehicle", "rate_per_km": Decimal("15"), "requires_receipt": False},
        {"conveyance_type": "auto_rickshaw", "rate_per_km": Decimal("0"), "requires_receipt": False},
        {"conveyance_type": "public_transport", "rate_per_km": Decimal("0"), "requires_receipt": True},
    ]

    # Travel modes and their sub-options (from client doc)
    TRAVEL_MODES_AND_SUBS = {
        "Flight": ["Economy Class"],
        "Train": ["1st AC", "2nd AC", "Executive Chair Car", "Chair Car"],
        "Pick-up and Drop": ["Pick-up/Drop Only"],
        "Radio Taxi": ["Radio Taxi"],
        "Car at Disposal": ["Company Arranged Car", "Self-Arranged Car"],
        "Own Car": ["Own Car"],
        "Accommodation": ["Guest House", "Company-tied Hotel", "Stay with Friends & Family"],
    }

    # Allowed mapping from policy: which sub-options are allowed per grade (visibility)
    # We'll generate entitlements for these; ApprovalMatrix will control approvals
    POLICY_ALLOWED_SUBS_BY_GRADE = {
        "B-2A": {
            "Flight": ["Economy Class"],
            "Train": ["1st AC"],
            "Pick-up and Drop": ["Pick-up/Drop Only"],
            "Radio Taxi": ["Radio Taxi"],
            "Car at Disposal": ["Company Arranged Car", "Self-Arranged Car"],
            "Own Car": ["Own Car"],
            "Accommodation": ["Guest House", "Company-tied Hotel", "Stay with Friends & Family"],
        },
        "B-2B": {
            "Flight": ["Economy Class"],
            "Train": ["2nd AC"],
            "Pick-up and Drop": ["Pick-up/Drop Only"],
            "Radio Taxi": ["Radio Taxi"],
            "Car at Disposal": ["Company Arranged Car", "Self-Arranged Car"],
            "Own Car": ["Own Car"],
            "Accommodation": ["Guest House", "Company-tied Hotel", "Stay with Friends & Family"],
        },
        "B-3": {
            "Flight": ["Economy Class"],
            "Train": ["2nd AC"],
            "Pick-up and Drop": ["Pick-up/Drop Only"],
            "Radio Taxi": ["Radio Taxi"],
            "Car at Disposal": ["Company Arranged Car", "Self-Arranged Car"],
            "Own Car": ["Own Car"],
            "Accommodation": ["Guest House", "Company-tied Hotel", "Stay with Friends & Family"],
        },
        "B-4A": {
            "Flight": ["Economy Class"],
            "Train": ["2nd AC"],
            "Pick-up and Drop": ["Pick-up/Drop Only"],
            "Radio Taxi": ["Radio Taxi"],
            "Car at Disposal": ["Company Arranged Car", "Self-Arranged Car"],
            "Own Car": ["Own Car"],
            "Accommodation": ["Guest House", "Company-tied Hotel", "Stay with Friends & Family"],
        },
        "B-4B": {
            "Flight": ["Economy Class"],
            "Train": ["2nd AC"],
            "Pick-up and Drop": ["Pick-up/Drop Only"],
            "Radio Taxi": ["Radio Taxi"],
            "Car at Disposal": ["Company Arranged Car", "Self-Arranged Car"],
            "Own Car": ["Own Car"],
            "Accommodation": ["Guest House", "Company-tied Hotel", "Stay with Friends & Family"],
        },
    }

    def add_arguments(self, parser):
        parser.add_argument(
            "--only",
            nargs="+",
            type=str,
            help="Modules to run. Options: travel_modes, grades, grade_entitlement, da, conveyance, approval_matrix, all",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Do not write to DB, only show what would be created.",
        )
        parser.add_argument(
            "--strict",
            action="store_true",
            help="Strict mode: do not auto-create missing travel modes or sub-options. Skip and warn instead.",
        )
        parser.add_argument(
            "--no-reset",
            action="store_true",
            help="Do not delete existing GradeEntitlement rows before creating. Default is to reset.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=500,
            help="Batch size for bulk_create (default: 500).",
        )
        parser.add_argument(
            "--create-missing-suboptions",
            type=str,
            default="true",
            choices=["true", "false"],
            help="Whether to auto-create missing travel suboptions (default: true).",
        )

    def handle(self, *args, **options):
        modules = options.get("only") or []
        dry_run = options.get("dry_run", False)
        strict = options.get("strict", False)
        reset = not options.get("no_reset", False)
        batch_size = options.get("batch_size", 500)
        create_missing_suboptions = options.get("create_missing_suboptions", "true").lower() == "true"

        # If create_missing_suboptions conflicts with strict, strict takes precedence
        if strict and create_missing_suboptions:
            create_missing_suboptions = False

        if "all" in modules:
            modules = ["travel_modes", "grades", "grade_entitlement", "da", "conveyance", "approval_matrix"]

        if not modules:
            self.stdout.write(self.style.WARNING("No modules selected. Use --only to pick modules (e.g. --only grade_entitlement)."))
            return

        self.stdout.write(self.style.SUCCESS(f"Running modules: {modules}"))
        self.stdout.write(self.style.NOTICE(f"Flags -> dry_run={dry_run}, strict={strict}, reset={reset}, batch_size={batch_size}, create_missing_suboptions={create_missing_suboptions}"))

        if "travel_modes" in modules:
            self._populate_travel_modes(dry_run=dry_run, create_missing_suboptions=create_missing_suboptions)

        if "grades" in modules:
            self._populate_grades(dry_run=dry_run)

        if "grade_entitlement" in modules:
            self._populate_grade_entitlements(
                dry_run=dry_run,
                strict=strict,
                reset=reset,
                batch_size=batch_size,
                create_missing_suboptions=create_missing_suboptions,
            )

        if "da" in modules:
            self._populate_da(dry_run=dry_run)

        if "conveyance" in modules:
            self._populate_conveyance(dry_run=dry_run)

        if "approval_matrix" in modules:
            self._populate_approval_matrix(dry_run=dry_run)

        if "travel_policy" in modules:
            self._populate_travel_policy(dry_run=dry_run, reset=reset)

        self.stdout.write(self.style.SUCCESS("Finished selected modules."))

    # ---------------------------
    # Helper lookups
    # ---------------------------
    def _get_user_by_role(self, role_type):
        """Try UserRole -> Role -> heuristics to find a user with given role_type"""
        # Try UserRole relation if available
        if "UserRole" in globals() and UserRole is not None:
            try:
                ur = UserRole.objects.filter(role__role_type=role_type).first()
                if ur:
                    return ur.user
            except Exception:
                pass
        # Try Role model mapping if available
        if Role is not None:
            try:
                role_obj = Role.objects.filter(role_type=role_type).first()
                if role_obj:
                    # attempt user relation
                    # many projects have user.role or role.user_set; best-effort
                    users = User.objects.filter(role__pk=role_obj.pk) if hasattr(User, "role") else None
                    if users and users.exists():
                        return users.first()
            except Exception:
                pass
        # Heuristics (common usernames)
        try:
            if role_type == "chro":
                u = User.objects.filter(username__iexact="ramakant").first()
                if u:
                    return u
            if role_type == "ceo":
                u = User.objects.filter(username__iexact="CEO").first()
                if u:
                    return u
            if role_type == "manager":
                u = User.objects.filter(username__iexact="Ramesh").first()
                if u:
                    return u
        except Exception:
            pass
        return None

    def _get_city_category(self, name):
        try:
            return CityCategoriesMaster.objects.filter(name__iexact=name).first()
        except Exception:
            return None

    # ---------------------------
    # Populate travel modes & sub-options
    # ---------------------------
    def _populate_travel_modes(self, dry_run=False, create_missing_suboptions=True):
        self.stdout.write(self.style.NOTICE("Populating TravelModeMaster & TravelSubOptionMaster..."))
        created_modes = []
        for m_name, subs in self.TRAVEL_MODES_AND_SUBS.items():
            if dry_run:
                self.stdout.write(f"[DRY] Ensure TravelMode: {m_name} -> Subs: {subs}")
                continue
            tm, created = TravelModeMaster.objects.update_or_create(
                name=m_name,
                defaults={"description": f"{m_name}", "is_active": True},
            )
            created_modes.append(tm)
            self.stdout.write(self.style.SUCCESS(f"{'Created' if created else 'Updated'} TravelMode: {m_name}"))
            # suboptions
            for s in subs:
                sub_defaults = {"description": f"{s} for {m_name}", "is_active": True}
                if create_missing_suboptions:
                    sub_obj, sub_created = TravelSubOptionMaster.objects.update_or_create(
                        mode=tm, name=s, defaults=sub_defaults
                    )
                    if sub_created:
                        self.stdout.write(self.style.SUCCESS(f"Created SubOption: {m_name} :: {s}"))
                else:
                    sub_obj = TravelSubOptionMaster.objects.filter(mode=tm, name=s).first()
                    if not sub_obj:
                        self.stdout.write(self.style.WARNING(f"SubOption missing (not created due to settings): {m_name} :: {s}"))

        self.stdout.write(self.style.SUCCESS("Travel modes & suboptions processed."))

    # ---------------------------
    # Populate grades
    # ---------------------------
    def _populate_grades(self, dry_run=False):
        self.stdout.write(self.style.NOTICE("Populating GradeMaster..."))
        grades = ["B-2A", "B-2B", "B-3", "B-4A", "B-4B"]
        if dry_run:
            for i, g in enumerate(grades, start=1):
                self.stdout.write(f"[DRY] Grade: {g} (sorting_no={i})")
            return
        for i, g in enumerate(grades, start=1):
            gm, created = GradeMaster.objects.update_or_create(
                name=g, defaults={"sorting_no": i, "is_active": True}
            )
            self.stdout.write(self.style.SUCCESS(f"{'Created' if created else 'Updated'} Grade: {g}"))
        self.stdout.write(self.style.SUCCESS("Grades populated."))

    # ---------------------------
    # Populate grade entitlements (main)
    # ---------------------------
    def _populate_grade_entitlements(self, dry_run=False, strict=False, reset=True, batch_size=500, create_missing_suboptions=True):
        """
        The main function to create exhaustive GradeEntitlementMaster rows
        for all (grade x suboption x city_category) as per policy values.
        """
        self.stdout.write(self.style.NOTICE("Populating GradeEntitlementMaster (policy-driven expansion)..."))
        # Preload FKs
        grades_qs = list(GradeMaster.objects.all())
        grades_map = {g.name: g for g in grades_qs}
        modes_qs = list(TravelModeMaster.objects.all())
        modes_map = {m.name: m for m in modes_qs}
        subs_qs = list(TravelSubOptionMaster.objects.select_related("mode").all())
        subs_map = {(s.mode.name, s.name): s for s in subs_qs}
        # City categories
        catA = self._get_city_category("A")
        catB = self._get_city_category("B")
        catC = self._get_city_category("C")
        available_city_cats = {c.name: c for c in CityCategoriesMaster.objects.all()}

        missing_suboptions = []
        missing_modes = []

        # Reset table if requested
        if reset and not dry_run:
            GradeEntitlementMaster.objects.all().delete()
            self.stdout.write(self.style.WARNING("Cleared existing GradeEntitlementMaster rows."))

        # Build list of GradeEntitlementMaster instances to create
        to_create = []

        # Helper to ensure suboption exists or create (depending on flags)
        def ensure_suboption(mode_name, sub_name):
            key = (mode_name, sub_name)
            sub = subs_map.get(key)
            if sub:
                return sub
            # mode existence
            mode = modes_map.get(mode_name)
            if not mode:
                if strict:
                    missing_modes.append(mode_name)
                    return None
                # create mode if missing
                if not dry_run:
                    mode = TravelModeMaster.objects.create(name=mode_name, description="Auto-created mode")
                    modes_map[mode_name] = mode
                    self.stdout.write(self.style.SUCCESS(f"Auto-created TravelMode: {mode_name}"))
                else:
                    missing_modes.append(mode_name)
                    return None
            # now create or get suboption
            if strict and not create_missing_suboptions:
                missing_suboptions.append(f"{mode_name}::{sub_name}")
                return None
            if dry_run:
                # just report
                self.stdout.write(f"[DRY] Would ensure suboption: {mode_name} :: {sub_name}")
                return None
            # create
            sub, created = TravelSubOptionMaster.objects.get_or_create(mode=mode, name=sub_name, defaults={"description": f"Auto-created {sub_name}", "is_active": True})
            if created:
                self.stdout.write(self.style.SUCCESS(f"Auto-created TravelSubOption: {mode_name} :: {sub_name}"))
            # update subs_map
            subs_map[(mode_name, sub_name)] = sub
            return sub

        # For every grade and policy-allowed suboption, create rows for each available city category (A,B,C)
        for grade_name, allowed in self.POLICY_ALLOWED_SUBS_BY_GRADE.items():
            grade_obj = grades_map.get(grade_name)
            if not grade_obj:
                self.stdout.write(self.style.WARNING(f"Grade {grade_name} not found in DB, skipping."))
                continue

            # Iterate over modes allowed for this grade per policy mapping
            for mode_name, sublist in allowed.items():
                for sub_name in sublist:
                    sub_obj = subs_map.get((mode_name, sub_name))
                    if not sub_obj:
                        # ensure or log missing
                        sub_obj = ensure_suboption(mode_name, sub_name)
                        if not sub_obj and (strict or dry_run):
                            # skip creating entitlement if strict or dry-run without actual creation
                            self.stdout.write(self.style.WARNING(f"Skipping entitlement for {grade_name} - {mode_name}::{sub_name} (suboption missing)."))
                            continue

                    # Decide max_amount based on policy mapping & mode
                    # Accommodation: max_amount depends on city category (A/B)
                    if mode_name == "Accommodation":
                        # For Accommodation, create entries for Guest House and Company-tied Hotel; use POLICY_ACCOMMODATION
                        # If sub_name is 'Self-arranged Stay' then use POLICY_STAY_WITH_FRIENDS
                        if sub_name in ["Guest House", "Company-tied Hotel"]:
                            policy_vals = self.POLICY_ACCOMMODATION.get(grade_name)
                            if not policy_vals:
                                self.stdout.write(self.style.WARNING(f"No accommodation policy for {grade_name}; skipping."))
                                continue
                            # Create for Category A and B (and C if available, but policy doesn't give explicit accommodation for C)
                            for cat_key in ("A", "B"):
                                city_cat = available_city_cats.get(cat_key)
                                if not city_cat:
                                    self.stdout.write(self.style.WARNING(f"CityCategory {cat_key} missing; skipping accommodation {grade_name} {cat_key}"))
                                    continue
                                max_amt = policy_vals.get(cat_key)
                                if not dry_run:
                                    ent = GradeEntitlementMaster(
                                        grade=grade_obj,
                                        sub_option=subs_map.get((mode_name, sub_name)),
                                        city_category=city_cat,
                                        max_amount=Decimal(str(max_amt)) if max_amt is not None else None,
                                        is_allowed=True,
                                    )
                                    to_create.append(ent)
                                else:
                                    self.stdout.write(f"[DRY] Would create entitlement: {grade_name} - {mode_name}::{sub_name} - Cat {cat_key} max {max_amt}")
                        elif sub_name == "Self-arranged Stay":
                            policy_vals = self.POLICY_STAY_WITH_FRIENDS.get(grade_name)
                            if not policy_vals:
                                self.stdout.write(self.style.WARNING(f"No stay-with-friends policy for {grade_name}; skipping."))
                                continue
                            for cat_key in ("A", "B"):
                                city_cat = available_city_cats.get(cat_key)
                                if not city_cat:
                                    self.stdout.write(self.style.WARNING(f"CityCategory {cat_key} missing; skipping stay-with-friends {grade_name} {cat_key}"))
                                    continue
                                max_amt = policy_vals.get(cat_key)
                                if not dry_run:
                                    ent = GradeEntitlementMaster(
                                        grade=grade_obj,
                                        sub_option=subs_map.get((mode_name, sub_name)),
                                        city_category=city_cat,
                                        max_amount=Decimal(str(max_amt)) if max_amt is not None else None,
                                        is_allowed=True,
                                    )
                                    to_create.append(ent)
                                else:
                                    self.stdout.write(f"[DRY] Would create stay-with-friends entitlement: {grade_name} - {mode_name}::{sub_name} - Cat {cat_key} max {max_amt}")
                        else:
                            # fallback: create entries for A/B/C with no max_amount
                            for cat_key, city_cat in available_city_cats.items():
                                if not dry_run:
                                    ent = GradeEntitlementMaster(
                                        grade=grade_obj,
                                        sub_option=subs_map.get((mode_name, sub_name)),
                                        city_category=city_cat,
                                        max_amount=None,
                                        is_allowed=True,
                                    )
                                    to_create.append(ent)
                                else:
                                    self.stdout.write(f"[DRY] Would create generic accommodation entitlement: {grade_name} - {mode_name}::{sub_name} - Cat {cat_key}")
                    else:
                        # For non-accommodation modes (Flight, Train, Car, Radio Taxi, Own Car, Pick-up/drop),
                        # create entries across available city categories (A/B/C) with max_amount=None unless policy indicates.
                        # For Train and Flight some grades have specific preferences:
                        # Train: B-2A -> 1st AC, others -> 2nd AC (already driven by POLICY_ALLOWED_SUBS_BY_GRADE)
                        for cat_key, city_cat in available_city_cats.items():
                            if not dry_run:
                                ent = GradeEntitlementMaster(
                                    grade=grade_obj,
                                    sub_option=subs_map.get((mode_name, sub_name)),
                                    city_category=city_cat,
                                    max_amount=None,
                                    is_allowed=True,
                                )
                                to_create.append(ent)
                            else:
                                self.stdout.write(f"[DRY] Would create entitlement: {grade_name} - {mode_name}::{sub_name} - Cat {cat_key}")

        # Now bulk create in batches unless dry_run
        created_count = 0
        if dry_run:
            self.stdout.write(self.style.NOTICE("Dry run finished — no DB writes performed."))
        else:
            # Bulk create in batches
            total = len(to_create)
            self.stdout.write(self.style.NOTICE(f"Creating {total} GradeEntitlementMaster rows in batches of {batch_size}"))
            for i in range(0, total, batch_size):
                batch = to_create[i : i + batch_size]
                GradeEntitlementMaster.objects.bulk_create(batch)
                created_count += len(batch)
                self.stdout.write(self.style.SUCCESS(f"Inserted batch {i//batch_size + 1}: {len(batch)} rows"))

        # Summary
        self.stdout.write(self.style.SQL_TABLE("GRADE ENTITLEMENT SUMMARY"))
        if dry_run:
            self.stdout.write("Dry-run mode: preview only.")
        else:
            self.stdout.write(self.style.SUCCESS(f"Total entitlements created: {created_count}"))

        # additional per-grade breakdown
        try:
            breakdown = GradeEntitlementMaster.objects.values("grade__name").annotate(count_total=__import__("django.db.models").db.models.Count("pk"))
            self.stdout.write("Per-grade counts:")
            for row in breakdown:
                self.stdout.write(f" - {row['grade__name']}: {row['count_total']}")
        except Exception:
            # fallback: compute from local list
            local_counts = {}
            for ent in to_create:
                g = ent.grade.name
                local_counts[g] = local_counts.get(g, 0) + 1
            self.stdout.write("Per-grade counts (local):")
            for k, v in local_counts.items():
                self.stdout.write(f" - {k}: {v}")

        if missing_modes:
            self.stdout.write(self.style.WARNING(f"Missing travel modes encountered (created if allowed): {set(missing_modes)}"))
        if missing_suboptions:
            self.stdout.write(self.style.WARNING(f"Missing suboptions encountered (skipped in strict/dry-run): {set(missing_suboptions)}"))

        self.stdout.write(self.style.SUCCESS("Grade entitlements processing complete."))

    # ---------------------------
    # Populate DA / Incidentals
    # ---------------------------
    def _populate_da(self, dry_run=False):
        """
        Populate DAIncidentalMaster using policy table values.
        """
        self.stdout.write(self.style.NOTICE("Populating DAIncidentalMaster (DA & Incidentals)..."))
        # Use the DA table from policy (as earlier)
        # values per grade & category:
        DA_TABLE = {
            "B-2A": {"A": (810, 243), "B": (648, 243), "C": (680, 255)},
            "B-2B": {"A": (810, 243), "B": (648, 243), "C": (680, 255)},
            "B-3": {"A": (810, 243), "B": (648, 243), "C": (680, 255)},
            "B-4A": {"A": (810, 243), "B": (648, 243), "C": (680, 255)},
            "B-4B": {"A": (729, 162), "B": (648, 162), "C": (680, 170)},
        }

        if dry_run:
            self.stdout.write("[DRY] Would delete existing DAIncidentalMaster rows and recreate per policy.")
            for grade_name, cats in DA_TABLE.items():
                for cat_key, (da_full, inc_full) in cats.items():
                    self.stdout.write(f"[DRY] {grade_name} - Cat {cat_key}: DA full {da_full}, Inc full {inc_full}")
            return

        DAIncidentalMaster.objects.all().delete()
        created = 0
        # get grade objects
        grade_map = {g.name: g for g in GradeMaster.objects.all()}
        cat_map = {c.name: c for c in CityCategoriesMaster.objects.all()}
        for grade_name, cats in DA_TABLE.items():
            g = grade_map.get(grade_name)
            if not g:
                self.stdout.write(self.style.WARNING(f"Grade {grade_name} missing; skipping DA entries."))
                continue
            for cat_key, (da_full, inc_full) in cats.items():
                city_cat = cat_map.get(cat_key)
                if not city_cat:
                    self.stdout.write(self.style.WARNING(f"City category {cat_key} missing; skipping DA for {grade_name} {cat_key}."))
                    continue
                da_half = Decimal(str(da_full)) / 2
                inc_half = Decimal(str(inc_full)) / 2
                DAIncidentalMaster.objects.create(
                    grade=g,
                    city_category=city_cat,
                    da_full_day=Decimal(str(da_full)),
                    da_half_day=da_half,
                    incidental_full_day=Decimal(str(inc_full)),
                    incidental_half_day=inc_half,
                    stay_allowance_category_a=Decimal(str(self.POLICY_STAY_WITH_FRIENDS.get(grade_name, {}).get("A", 0))),
                    stay_allowance_category_b=Decimal(str(self.POLICY_STAY_WITH_FRIENDS.get(grade_name, {}).get("B", 0))),
                    effective_from=timezone.now().date(),
                    is_active=True,
                )
                created += 1
        self.stdout.write(self.style.SUCCESS(f"DA/Incidentals populated: {created} rows."))

    # ---------------------------
    # Populate conveyance rates
    # ---------------------------
    def _populate_conveyance(self, dry_run=False):
        self.stdout.write(self.style.NOTICE("Populating ConveyanceRateMaster..."))
        if dry_run:
            for e in self.POLICY_CONVEYANCE:
                self.stdout.write(f"[DRY] Conveyance: {e['conveyance_type']} -> rate {e['rate_per_km']} requires_receipt={e['requires_receipt']}")
            return
        ConveyanceRateMaster.objects.all().delete()
        for e in self.POLICY_CONVEYANCE:
            ConveyanceRateMaster.objects.create(
                conveyance_type=e["conveyance_type"],
                rate_per_km=e["rate_per_km"],
                max_distance_per_day=None,
                requires_receipt=e["requires_receipt"],
                max_claim_amount=None,
                effective_from=timezone.now().date(),
                is_active=True,
            )
            self.stdout.write(self.style.SUCCESS(f"Created conveyance rate: {e['conveyance_type']}"))
        self.stdout.write(self.style.SUCCESS("Conveyance rates populated."))

    # ---------------------------
    # Populate approval matrix
    # ---------------------------
    def _populate_approval_matrix(self, dry_run=False):
        """
        Populate ApprovalMatrix according to policy summary:
        - Flight: B-2A/B-2B self-approve; B-3/B-4 require manager; above 10k requires CHRO
        - Train: B-2A/B-2B/B-3 self-approve; B-4 require manager
        - Pick-up/Drop + Radio Taxi: self-approve
        - Car at Disposal: >5 days CHRO; B-3/B-4 manager
        - Own Car: limit 150 km → CHRO if exceeded
        """
        self.stdout.write(self.style.NOTICE("Populating ApprovalMatrix..."))
        # Build maps
        grade_map = {g.name: g for g in GradeMaster.objects.all()}
        mode_map = {m.name: m for m in TravelModeMaster.objects.all()}

        # Helpers
        def create_or_report(tm_name, grade_name, kwargs):
            tm = mode_map.get(tm_name)
            grade_obj = grade_map.get(grade_name)
            if not tm or not grade_obj:
                self.stdout.write(self.style.WARNING(f"Skipping ApprovalMatrix for {tm_name} / {grade_name} (missing)"))
                return
            if dry_run:
                self.stdout.write(f"[DRY] Would create ApprovalMatrix: {tm_name} - {grade_name} -> {kwargs}")
                return
            ApprovalMatrix.objects.create(
                travel_mode=tm,
                employee_grade=grade_obj,
                min_amount=Decimal(str(kwargs.get("min_amount", 0))),
                max_amount=Decimal(str(kwargs.get("max_amount"))) if kwargs.get("max_amount") is not None else None,
                requires_manager=kwargs.get("requires_manager", True),
                requires_chro=kwargs.get("requires_chro", False),
                requires_ceo=kwargs.get("requires_ceo", False),
                flight_above_10k_ceo=kwargs.get("flight_above_10k_ceo", False),
                manager_can_view=kwargs.get("manager_can_view", True),
                manager_can_approve=kwargs.get("manager_can_approve", True),
                advance_booking_required_days=kwargs.get("advance_booking_required_days", 0),
                distance_limit_km=kwargs.get("distance_limit_km"),
                requires_chro_for_distance=kwargs.get("requires_chro_for_distance", False),
                disposal_days_limit=kwargs.get("disposal_days_limit"),
                requires_chro_for_disposal=kwargs.get("requires_chro_for_disposal", False),
                is_active=True,
            )
            self.stdout.write(self.style.SUCCESS(f"Created ApprovalMatrix: {tm_name} - {grade_name}"))

        if not dry_run:
            ApprovalMatrix.objects.all().delete()
            self.stdout.write(self.style.WARNING("Cleared existing ApprovalMatrix rows."))

        # Flight
        for g in ["B-2A", "B-2B"]:
            create_or_report("Flight", g, {"requires_manager": False, "advance_booking_required_days": 7, "manager_can_approve": False})
        for g in ["B-3", "B-4A", "B-4B"]:
            create_or_report("Flight", g, {"requires_manager": True, "advance_booking_required_days": 7})

        # Flight above 10k -> CHRO required
        for g in ["B-2A", "B-2B", "B-3", "B-4A", "B-4B"]:
            create_or_report("Flight", g, {"min_amount": 10000, "requires_manager": False, "requires_chro": True, "flight_above_10k_ceo": True})

        # Train
        for g in ["B-2A", "B-2B", "B-3"]:
            create_or_report("Train", g, {"requires_manager": False, "advance_booking_required_days": 3})
        for g in ["B-4A", "B-4B"]:
            create_or_report("Train", g, {"requires_manager": True, "advance_booking_required_days": 3})

        # Pickup & Radio Taxi
        for m in ["Pick-up and Drop", "Radio Taxi"]:
            for g in ["B-2A", "B-2B", "B-3", "B-4A", "B-4B"]:
                create_or_report(m, g, {"requires_manager": False})

        # Car at Disposal
        for g in ["B-2A", "B-2B"]:
            create_or_report("Car at Disposal", g, {"requires_manager": False, "disposal_days_limit": 5, "requires_chro_for_disposal": True})
        for g in ["B-3", "B-4A", "B-4B"]:
            create_or_report("Car at Disposal", g, {"requires_manager": True, "disposal_days_limit": 5, "requires_chro_for_disposal": True})

        # Own Car
        for g in ["B-2A", "B-2B", "B-3", "B-4A", "B-4B"]:
            create_or_report("Own Car", g, {"distance_limit_km": Decimal("150"), "requires_chro_for_distance": True})

        self.stdout.write(self.style.SUCCESS("Approval matrix populated."))

    # ---------------------------
    # Populate Travel Policy Master
    # ---------------------------
    def _populate_travel_policy(self, dry_run=False, reset=True):
        self.stdout.write(self.style.NOTICE("Populating TravelPolicyMaster..."))

        from apps.master_data.models.travel import TravelPolicyMaster, TravelModeMaster, TravelSubOptionMaster
        from apps.master_data.models.grades import GradeMaster
        from django.utils import timezone

        today = timezone.now().date()

        # Load modes and grades
        modes = {m.name: m for m in TravelModeMaster.objects.all()}
        grades = {g.name: g for g in GradeMaster.objects.all()}

        RULES = [

            # --------------------------
            # ADVANCE BOOKING RULES
            # --------------------------
            {
                "policy_type": "advance_booking",
                "title": "Minimum 7-day advance booking for flights",
                "description": "Employees must book flight tickets at least 7 days in advance.",
                "mode": "Flight",
                "grade": None,
                "params": {"days": 7},
            },
            {
                "policy_type": "advance_booking",
                "title": "Minimum 3-day advance booking for trains",
                "description": "Train tickets must be booked at least 3 days in advance.",
                "mode": "Train",
                "grade": None,
                "params": {"days": 3},
            },

            # --------------------------
            # DISTANCE LIMIT RULE
            # --------------------------
            {
                "policy_type": "distance_limit",
                "title": "Own car usage allowed up to 150 km/day",
                "description": "Beyond 150 km/day, CHRO approval is required.",
                "mode": "Own Car",
                "grade": None,
                "params": {"max_distance": 150},
            },

            # --------------------------
            # DURATION LIMIT RULE
            # --------------------------
            {
                "policy_type": "duration_limit",
                "title": "Car at disposal allowed up to 5 days",
                "description": "Using a car at disposal for more than 5 days requires CHRO approval.",
                "mode": "Car at Disposal",
                "grade": None,
                "params": {"max_days": 5},
            },

            # --------------------------
            # GRADE-BASED MODE RESTRICTIONS
            # --------------------------
            {
                "policy_type": "mode_restriction",
                "title": "Train class eligibility for B-2A",
                "description": "B-2A employees are eligible only for 1st AC train travel.",
                "mode": "Train",
                "grade": "B-2A",
                "params": {"allowed_suboptions": ["1st AC"]},
            },
            {
                "policy_type": "mode_restriction",
                "title": "Train class eligibility for B-2B / B-3 / B-4A / B-4B",
                "description": "Employees of these grades are eligible for 2nd AC.",
                "mode": "Train",
                "grade": None,  # Applies to multiple grades — generic rule
                "params": {"allowed_suboptions": ["2nd AC"]},
            },
        ]

        if dry_run:
            for r in RULES:
                self.stdout.write(
                    f"[DRY] {r['policy_type']} -> {r['title']} (mode={r['mode']} grade={r['grade']}) params={r['params']}"
                )
            return

        if reset:
            TravelPolicyMaster.objects.all().delete()
            self.stdout.write(self.style.WARNING("Existing TravelPolicyMaster rows cleared."))

        created = 0

        for rule in RULES:
            mode_obj = modes.get(rule["mode"])
            grade_obj = grades.get(rule["grade"]) if rule["grade"] else None

            obj = TravelPolicyMaster.objects.create(
                policy_type=rule["policy_type"],
                title=rule["title"],
                description=rule["description"],
                travel_mode=mode_obj,
                employee_grade=grade_obj,
                rule_parameters=rule["params"],
                is_active=True,
                effective_from=today,
                effective_to=None,
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(f"TravelPolicyMaster populated ({created} rules)."))
