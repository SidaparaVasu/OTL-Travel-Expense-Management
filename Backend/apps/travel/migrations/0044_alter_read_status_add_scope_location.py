import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Prod applied the original 0041 (per-user schema: non-nullable user FK,
    unique_together, no scope/location/marked_by columns).  Our rewrite of 0041
    was skipped on prod because Django already recorded it as applied.

    This migration brings the existing prod table in line with the new model by:
      1. Making user nullable (required before we can have location-scoped rows).
      2. Adding scope, location, and marked_by columns.
      3. Back-filling scope = 'user' for every existing row.
      4. Removing the old unique_together constraint.
      5. Removing the old per-user index.
      6. Adding the new scope/is_read index.
    """

    dependencies = [
        ('master_data', '0001_initial'),
        ('travel', '0043_fix_read_status_index_name'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Make user nullable so location-scope rows can omit it
        migrations.AlterField(
            model_name='travelapplicationreadstatus',
            name='user',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='travel_application_read_statuses',
                to=settings.AUTH_USER_MODEL,
            ),
        ),

        # 2. Add scope column (default 'user' so existing rows are valid)
        migrations.AddField(
            model_name='travelapplicationreadstatus',
            name='scope',
            field=models.CharField(
                choices=[('user', 'User'), ('location', 'Location')],
                default='user',
                max_length=10,
            ),
            preserve_default=False,
        ),

        # 3. Add location FK
        migrations.AddField(
            model_name='travelapplicationreadstatus',
            name='location',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='travel_application_read_statuses',
                to='master_data.locationmaster',
            ),
        ),

        # 4. Add marked_by FK
        migrations.AddField(
            model_name='travelapplicationreadstatus',
            name='marked_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='read_status_changes',
                to=settings.AUTH_USER_MODEL,
            ),
        ),

        # 5. Remove the old unique_together (travel_application, user).
        # Same reasoning as the index below: physically exists on prod DB but
        # not in Django's migration state after the 0041 rewrite.
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.AlterUniqueTogether(
                    name='travelapplicationreadstatus',
                    unique_together=set(),
                ),
            ],
            state_operations=[],
        ),

        # 6. Remove the old per-user index.
        # The index exists physically in the prod DB (created by the original 0041
        # before that migration was rewritten) but is absent from Django's migration
        # state (the rewritten 0041 never recorded creating it).
        # SeparateDatabaseAndState lets us issue the DROP INDEX DDL without touching
        # the migration state, which avoids the "No index named ..." ValueError.
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RemoveIndex(
                    model_name='travelapplicationreadstatus',
                    name='travel_trav_user_id_2a6d21_idx',
                ),
            ],
            state_operations=[],
        ),

        # 7. Add the new scope/is_read index
        migrations.AddIndex(
            model_name='travelapplicationreadstatus',
            index=models.Index(
                fields=['scope', 'is_read'],
                name='travel_trav_scope_is_re_idx',
            ),
        ),
    ]
