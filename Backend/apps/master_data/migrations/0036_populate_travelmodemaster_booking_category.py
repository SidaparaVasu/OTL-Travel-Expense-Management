"""
Data migration: populate booking_category for all existing TravelModeMaster rows.

Category mapping:
  ticketing     → Flight, Train
  accommodation → Accommodation (and all its sub-variants that share the same parent name)
  bulk          → Bulk Booking
  conveyance    → everything else (default — already set by the schema migration)

The mode name matching is intentionally case-insensitive and prefix-based so it
handles renamed variants (e.g. "CB - Pick-up and Drop") without extra entries.
"""
from django.db import migrations


def populate_booking_category(apps, schema_editor):
    TravelModeMaster = apps.get_model('master_data', 'TravelModeMaster')

    # Modes whose names START WITH or EQUAL these strings (case-insensitive)
    # are mapped to the given category. Order matters — first match wins.
    RULES = [
        # (startswith_prefix_lower, category)
        ('flight',        'ticketing'),
        ('train',         'ticketing'),
        ('accommodation', 'accommodation'),
        ('bulk booking',  'bulk'),
    ]

    for mode in TravelModeMaster.objects.all():
        name_lower = mode.name.strip().lower()
        assigned = 'conveyance'  # default
        for prefix, category in RULES:
            if name_lower.startswith(prefix):
                assigned = category
                break
        if mode.booking_category != assigned:
            mode.booking_category = assigned
            mode.save(update_fields=['booking_category'])


def reverse_populate(apps, schema_editor):
    # Reversal resets everything to the schema default ('conveyance')
    TravelModeMaster = apps.get_model('master_data', 'TravelModeMaster')
    TravelModeMaster.objects.all().update(booking_category='conveyance')


class Migration(migrations.Migration):

    dependencies = [
        ('master_data', '0035_travelmodemaster_booking_category'),
    ]

    operations = [
        migrations.RunPython(populate_booking_category, reverse_code=reverse_populate),
    ]
