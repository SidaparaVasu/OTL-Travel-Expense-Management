# Hotfix: stabilise HRMSLeaveRecord index names.
#
# Background
# ----------
# Migration 0040 created HRMSLeaveRecord with auto-generated index names
# (travel_hrms_travel__c657be_idx / travel_hrms_leave_a_1a7b8e_idx).
# After 0040 was committed, the model's Meta.indexes lost the explicit name=
# arguments, causing Django's autodetector to detect a rename on each
# makemigrations run.  On production this auto-generated a 0042 that tried to
# RENAME those indexes in MySQL — which failed with error 1176 because the
# index names on the production DB did not match what Django expected.
#
# Fix
# ---
# hrms_leave.py now pins the index names back to the exact names 0040 created,
# so the autodetector sees no drift going forward.  This migration is a pure
# no-op (no database DDL) that simply advances the migration chain on both dev
# and prod past the problematic rename attempt.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('travel', '0041_add_travel_application_read_status'),
    ]

    operations = [
        # Intentionally empty — the fix is in hrms_leave.py (explicit index
        # names) and does not require any database schema change.
    ]
