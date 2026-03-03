from django.core.management.base import BaseCommand, CommandError

"""
Booking Agent Feed Command

Usage:
1) Copy this file to:
   <your_app>/management/commands/feed_booking_agents.py

2) Run dry-run:
   python manage.py feed_booking_agents --file /path/to/booking_agents_vehicle_prepared.xlsx --dry-run

3) Run live:
   python manage.py feed_booking_agents --file /path/to/booking_agents_vehicle_prepared.xlsx

Input file (prepared feed) required columns:
- vendor_name
- profile_type                  -> ProfileTypeMaster.code
- serves_all_cities             -> 0/1
- cities                        -> comma separated city names
- emails                        -> comma separated emails
- phones                        -> comma separated phones
- vehicle_types                 -> comma separated vehicle type names
"""

import re
import random
from typing import List, Tuple

import pandas as pd

from django.db import transaction
from django.utils.text import slugify

from apps.authentication.models import User, BookingAgentProfile, Role, UserRole
from apps.booking_agent.models import (
    ProfileTypeMaster,
    ProfileTypeServiceMap,
    BookingAgentService,
    BookingAgentServiceCategory,
    BookingAgentContact,
    BookingAgentVehicleTypeMap,
)
from apps.master_data.models import (
    CityMaster, CityCategoriesMaster,
    StateMaster, CountryMaster,
    VehicleTypeMaster, VehicleCategoryMaster
)


DEFAULT_PASSWORD = "agent@2026"
USER_TYPE = "external"


# ----------------------------
# Helpers
# ----------------------------
def normalize_bool(value) -> bool:
    v = str(value).strip().lower()
    return v in ("1", "true", "yes", "y", "t")


def split_csv_field(value: str) -> List[str]:
    """
    Split by comma, trim, and de-duplicate case-insensitively.
    """
    if value is None:
        return []
    s = str(value).strip()
    if not s:
        return []
    # Split by comma or pipe
    parts = [p.strip() for p in re.split(r"\s*[|,]\s*", s) if p.strip()]

    seen = set()
    out = []
    for p in parts:
        key = p.lower()
        if key not in seen:
            seen.add(key)
            out.append(p)
    return out


def normalize_phone(phone: str) -> str:
    p = str(phone or "").strip()
    if not p:
        return ""
    
    # If longer than 15 and has dashes, remove dashes only
    if len(p) > 15 and '-' in p:
        p = p.replace('-', '')
        
    # Standard normalization: keep only digits and +
    p = re.sub(r"[^\d+]", "", p)
    
    if p.startswith("+91"):
        p = p[3:]
    if p.startswith("91") and len(p) > 10:
        p = p[2:]
    if p.startswith("0") and len(p) > 10:
        p = p[1:]
    return p


def normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def generate_username(name: str) -> str:
    """
    format: agent@<random 5 digit number> it should be unique.
    """
    base = "agent@"
    for _ in range(100):
        suffix = f"{random.randint(10000, 99999)}"
        username = base + suffix
        if not User.objects.filter(username=username).exists():
            return username

    # fallback
    slug = slugify(name)[:12] or "agent"
    for _ in range(100):
        suffix = f"{random.randint(1000, 9999)}"
        username = f"{slug}_{suffix}"
        if not User.objects.filter(username=username).exists():
            return username

    raise CommandError("Unable to generate unique username.")


# ----------------------------
# DB operations
# ----------------------------
def get_profile_type(profile_type_code: str) -> ProfileTypeMaster:
    pt = ProfileTypeMaster.objects.filter(code__iexact=str(profile_type_code).strip()).first()
    if not pt:
        raise CommandError(f"ProfileTypeMaster not found for code='{profile_type_code}'")
    return pt


def get_or_create_user(vendor_name: str, emails: List[str], phones: List[str], default_password: str) -> Tuple[User, bool]:
    email = normalize_email(emails[0]) if emails else ""
    phone = normalize_phone(phones[0]) if phones else ""

    user = None
    if email:
        user = User.objects.filter(email__iexact=email).first()
    if not user and phone:
        user = User.objects.filter(mobile_no=phone).first()

    if user:
        updated = False
        if email and not user.email:
            user.email = email
            updated = True
        if phone and not getattr(user, "mobile_no", None):
            user.mobile_no = phone
            updated = True
        if updated:
            user.save()
        return user, False

    username = generate_username(vendor_name)
    user = User(
        username=username,
        email=email or "",
        mobile_no=phone or None,
        user_type=USER_TYPE,
        is_active=True,
    )
    user.set_password(default_password)
    user.save()

    # Assign 'booking_agent' role
    role_agent, _ = Role.objects.get_or_create(
        role_type="booking_agent",
        defaults={"role_type": "booking_agent", "description": "Booking Agent Role"}
    )
    
    # Assign if not present
    if not UserRole.objects.filter(user=user, role=role_agent).exists():
        UserRole.objects.create(user=user, role=role_agent, is_primary=True)

    return user, True


def get_or_create_booking_agent_profile(user: User, vendor_name: str) -> Tuple[BookingAgentProfile, bool]:
    profile = BookingAgentProfile.objects.filter(user=user).first()
    if profile:
        if profile.organization_name != vendor_name:
            profile.organization_name = vendor_name
            profile.save()
        return profile, False

    profile = BookingAgentProfile.objects.create(
        user=user,
        organization_name=vendor_name,
        is_active=True,
        is_verified=False,
    )
    return profile, True


def get_or_create_booking_agent_service(profile: BookingAgentProfile, profile_type: ProfileTypeMaster, serves_all_cities: bool) -> Tuple[BookingAgentService, bool]:
    obj = BookingAgentService.objects.filter(booking_agent_profile=profile, profile_type=profile_type).first()
    if obj:
        if obj.serves_all_cities != serves_all_cities:
            obj.serves_all_cities = serves_all_cities
            obj.save()
        return obj, False

    obj = BookingAgentService.objects.create(
        booking_agent_profile=profile,
        profile_type=profile_type,
        serves_all_cities=serves_all_cities,
        is_active=True,
    )
    return obj, True


def attach_cities(service: BookingAgentService, cities: List[str]):
    """
    Attach cities to BookingAgentService.service_cities M2M.

    Fixes existing invalid CityMaster rows that have category_id = NULL.
    """

    # Default Category = B
    category_b, _ = CityCategoriesMaster.objects.get_or_create(
        name="B",
        defaults={"description": "Default Category B"},
    )

    # Default Country + State
    default_country, _ = CountryMaster.objects.get_or_create(
        country_name="India",
        defaults={"country_code": "IND"},
    )
    default_state, _ = StateMaster.objects.get_or_create(
        state_name="State",
        country=default_country,
        defaults={"state_code": ""},
    )

    for city_name in cities:
        city_name = str(city_name or "").strip()
        if not city_name:
            continue

        # Find city WITHOUT category in filter (important)
        city_obj = CityMaster.objects.filter(
            city_name=city_name,
            state=default_state,
        ).first()

        # If exists but category missing -> REPAIR IT
        if city_obj:
            if city_obj.category_id is None:
                city_obj.category = category_b
                city_obj.save(update_fields=["category"])
        else:
            # Create new valid city (category + state mandatory)
            city_obj = CityMaster.objects.create(
                city_name=city_name,
                city_code="",
                state=default_state,
                category=category_b,
            )

        service.service_cities.add(city_obj)


def create_service_categories(service: BookingAgentService, profile_type: ProfileTypeMaster) -> int:
    """
    Creates service categories from ProfileTypeServiceMap.
    Returns number of new rows created.
    """
    created = 0
    maps = ProfileTypeServiceMap.objects.filter(profile_type=profile_type, is_active=True).select_related("service_category")
    for m in maps:
        _, is_created = BookingAgentServiceCategory.objects.get_or_create(
            booking_agent_service=service,
            service_category=m.service_category,
            defaults={"is_active": True},
        )
        created += int(is_created)
    return created


def create_primary_contact(service: BookingAgentService, vendor_name: str, emails: List[str], phones: List[str]) -> int:
    email = normalize_email(emails[0]) if emails else ""
    phone = normalize_phone(phones[0]) if phones else ""
    if not email and not phone:
        return 0

    # Dedup logic:
    qs = BookingAgentContact.objects.filter(booking_agent_service=service, role="PRIMARY")
    if email and qs.filter(email__iexact=email).exists():
        return 0
    if phone and qs.filter(phone=phone).exists():
        return 0

    BookingAgentContact.objects.create(
        booking_agent_service=service,
        name=vendor_name,
        email=email or None,
        phone=phone or None,
        role="PRIMARY",
        is_active=True,
    )
    return 1


def create_vehicle_maps(service: BookingAgentService, vehicle_types: List[str]) -> int:
    created = 0
    # Ensure default category exists
    default_cat, _ = VehicleCategoryMaster.objects.get_or_create(
        code="DEFAULT",
        defaults={"name": "Default Category"}
    )

    for name in vehicle_types:
        vt_name = str(name).strip()
        if not vt_name:
            continue

        vt = VehicleTypeMaster.objects.filter(name__iexact=vt_name).first()
        if not vt:
            # Must provide category
            vt = VehicleTypeMaster.objects.create(
                name=vt_name,
                category=default_cat,
                capacity=4, # Default capacity
                minimum_charge=0
            )

        _, is_created = BookingAgentVehicleTypeMap.objects.get_or_create(
            booking_agent_service=service,
            vehicle_type=vt,
            defaults={"is_active": True},
        )
        created += int(is_created)
    return created


# ----------------------------
# Command
# ----------------------------
class Command(BaseCommand):
    help = "Feed Booking Agents from prepared excel file."

    def add_arguments(self, parser):
        parser.add_argument("--file", type=str, required=True, help="Path to prepared .xlsx file")
        parser.add_argument("--dry-run", action="store_true", help="If set, DB changes will be rolled back")
        parser.add_argument("--default-password", type=str, default=DEFAULT_PASSWORD)

    def handle(self, *args, **options):
        file_path = options["file"]
        dry_run = options["dry_run"]
        default_password = options["default_password"]

        if not file_path.lower().endswith(".xlsx"):
            raise CommandError("Only .xlsx file supported.")

        if not pd.io.common.file_exists(file_path):
            raise CommandError(f"File not found: {file_path}")

        df = pd.read_excel(file_path, dtype=str).fillna("")
        required_cols = ["vendor_name", "profile_type", "serves_all_cities", "cities", "emails", "phones", "vehicle_types"]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise CommandError(f"Missing required columns in feed file: {missing}")

        self.stdout.write(self.style.WARNING("DRY RUN: No DB changes will be committed.") if dry_run else self.style.SUCCESS("LIVE RUN: DB will be updated."))

        stats = {
            "processed": 0,
            "created_users": 0,
            "created_profiles": 0,
            "created_services": 0,
            "created_categories": 0,
            "created_contacts": 0,
            "created_vehicle_maps": 0,
            "skipped": 0,
        }

        with transaction.atomic():
            for idx, row in df.iterrows():
                stats["processed"] += 1

                vendor_name = str(row["vendor_name"]).strip()
                profile_code = str(row["profile_type"]).strip()
                serves_all = normalize_bool(row["serves_all_cities"])

                cities = split_csv_field(row["cities"])
                emails = [normalize_email(e) for e in split_csv_field(row["emails"])]
                phones = [normalize_phone(p) for p in split_csv_field(row["phones"])]
                vehicle_types = split_csv_field(row["vehicle_types"])

                if not vendor_name or not profile_code:
                    stats["skipped"] += 1
                    self.stdout.write(self.style.ERROR(f"[Row {idx+2}] Missing vendor_name/profile_type. Skipped."))
                    continue

                try:
                    profile_type = get_profile_type(profile_code)
                except Exception as e:
                    stats["skipped"] += 1
                    self.stdout.write(self.style.ERROR(f"[Row {idx+2}] {e}. Skipped vendor='{vendor_name}'"))
                    continue

                user, user_created = get_or_create_user(vendor_name, emails, phones, default_password)
                stats["created_users"] += int(user_created)

                profile, profile_created = get_or_create_booking_agent_profile(user, vendor_name)
                stats["created_profiles"] += int(profile_created)

                service, service_created = get_or_create_booking_agent_service(profile, profile_type, serves_all)
                stats["created_services"] += int(service_created)

                if not serves_all:
                    attach_cities(service, cities)

                stats["created_categories"] += create_service_categories(service, profile_type)
                stats["created_contacts"] += create_primary_contact(service, vendor_name, emails, phones)
                stats["created_vehicle_maps"] += create_vehicle_maps(service, vehicle_types)

                self.stdout.write(self.style.SUCCESS(f"[OK] {vendor_name} ({profile_code})"))

            self.stdout.write(self.style.SUCCESS(
                "\nSummary:\n" +
                "\n".join([f"{k}: {v}" for k, v in stats.items()])
            ))

            if dry_run:
                transaction.set_rollback(True)
                self.stdout.write(self.style.WARNING("Dry run complete. Changes rolled back."))
