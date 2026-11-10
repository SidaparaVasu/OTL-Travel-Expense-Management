from django.db import migrations


class Migration(migrations.Migration):
    """
    No-op migration. Pins the read_status index name back to what 0041 created
    (travel_trav_scope_is_re_idx) so Django's autodetector stops generating a
    rename on production.

    Production deployed 0041 with that index name and then auto-generated a 0043
    rename to travel_trav_scope_4338fe_idx, which failed with MySQL error 1176
    because the old name did not exist under that hash on the prod DB.

    The fix is in read_status.py (explicit name= argument on the index). This
    migration simply advances the chain past the failed 0043 without touching
    the database schema.
    """

    dependencies = [
        ('travel', '0042_fix_hrmsleaverecord_index_names'),
    ]

    operations = []
