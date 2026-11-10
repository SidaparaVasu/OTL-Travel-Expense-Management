import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def add_columns_idempotent(apps, schema_editor):
    """
    Applies all schema changes via raw SQL with existence checks so the
    migration is safe to run regardless of how far a previous attempt got.
    """
    db = schema_editor.connection
    tbl = 'travel_travelapplicationreadstatus'

    with db.cursor() as cur:
        # --- helper: check if column exists ---
        def col_exists(col):
            cur.execute(
                "SELECT COUNT(*) FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = %s AND COLUMN_NAME = %s",
                [tbl, col],
            )
            return cur.fetchone()[0] > 0

        # --- helper: check if index exists ---
        def idx_exists(idx):
            cur.execute(
                "SELECT COUNT(*) FROM information_schema.STATISTICS "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = %s AND INDEX_NAME = %s",
                [tbl, idx],
            )
            return cur.fetchone()[0] > 0

        # --- helper: check if unique constraint exists (MySQL stores as index) ---
        def unique_exists():
            cur.execute(
                "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = %s "
                "AND CONSTRAINT_TYPE = 'UNIQUE'",
                [tbl],
            )
            return cur.fetchone()[0] > 0

        def get_unique_constraint_name():
            cur.execute(
                "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = %s "
                "AND CONSTRAINT_TYPE = 'UNIQUE' LIMIT 1",
                [tbl],
            )
            row = cur.fetchone()
            return row[0] if row else None

        # --- helper: get all FK constraint names on the table ---
        def get_all_fk_constraints():
            cur.execute(
                "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME "
                "FROM information_schema.KEY_COLUMN_USAGE "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = %s "
                "AND REFERENCED_TABLE_NAME IS NOT NULL",
                [tbl],
            )
            return cur.fetchall()  # list of (constraint_name, col, ref_table, ref_col)

        # 1. Make user nullable
        if col_exists('user_id'):
            cur.execute(
                f"ALTER TABLE `{tbl}` MODIFY COLUMN `user_id` bigint(20) NULL"
            )

        # 2. Add scope
        if not col_exists('scope'):
            cur.execute(
                f"ALTER TABLE `{tbl}` ADD COLUMN `scope` varchar(10) NOT NULL DEFAULT 'user'"
            )

        # 3. Add location_id
        if not col_exists('location_id'):
            cur.execute(
                f"ALTER TABLE `{tbl}` ADD COLUMN `location_id` bigint(20) NULL"
            )
            cur.execute(
                f"ALTER TABLE `{tbl}` ADD CONSTRAINT "
                f"`travel_trav_location_id_fk` "
                f"FOREIGN KEY (`location_id`) REFERENCES `master_data_locationmaster` (`id`)"
            )

        # 4. Add marked_by_id
        if not col_exists('marked_by_id'):
            cur.execute(
                f"ALTER TABLE `{tbl}` ADD COLUMN `marked_by_id` bigint(20) NULL"
            )
            cur.execute(
                f"ALTER TABLE `{tbl}` ADD CONSTRAINT "
                f"`travel_trav_marked_by_id_fk` "
                f"FOREIGN KEY (`marked_by_id`) REFERENCES `authentication_user` (`id`) ON DELETE SET NULL"
            )

        # 5. Drop old unique constraint.
        # MySQL error 1553: cannot drop an index that backs a FK constraint.
        # Strategy: snapshot all FKs, drop them all, drop the unique index,
        # then restore every FK that still needs to exist.
        if unique_exists():
            constraint_name = get_unique_constraint_name()
            if constraint_name:
                # Snapshot all current FKs before we touch anything
                all_fks = get_all_fk_constraints()

                # Drop every FK on the table
                dropped_fks = set()
                for fk_name, col, ref_table, ref_col in all_fks:
                    if fk_name not in dropped_fks:
                        cur.execute(f"ALTER TABLE `{tbl}` DROP FOREIGN KEY `{fk_name}`")
                        dropped_fks.add(fk_name)

                # Now drop the unique index
                cur.execute(f"ALTER TABLE `{tbl}` DROP INDEX `{constraint_name}`")

                # Restore all FKs (MySQL auto-creates a plain index for each one).
                # Skip any FKs we re-added in steps 3/4 (they may already exist
                # if those columns were added by a previous partial attempt).
                our_new_fks = {'travel_trav_location_id_fk', 'travel_trav_marked_by_id_fk'}
                for fk_name, col, ref_table, ref_col in all_fks:
                    if fk_name in our_new_fks:
                        continue
                    cur.execute(
                        f"ALTER TABLE `{tbl}` ADD CONSTRAINT `{fk_name}` "
                        f"FOREIGN KEY (`{col}`) REFERENCES `{ref_table}` (`{ref_col}`)"
                    )

        # 6. Drop old per-user index
        if idx_exists('travel_trav_user_id_2a6d21_idx'):
            cur.execute(
                f"ALTER TABLE `{tbl}` DROP INDEX `travel_trav_user_id_2a6d21_idx`"
            )

        # 7. Add new scope/is_read index
        if not idx_exists('travel_trav_scope_is_re_idx'):
            cur.execute(
                f"CREATE INDEX `travel_trav_scope_is_re_idx` "
                f"ON `{tbl}` (`scope`, `is_read`)"
            )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    """
    Brings the prod read_status table in line with the new dual-scope model.
    Uses raw SQL with existence checks so the migration is fully idempotent
    regardless of how far any previous partial attempt reached.

    State-only operations keep Django's migration state in sync with the model.
    """

    dependencies = [
        ('master_data', '0001_initial'),
        ('travel', '0043_fix_read_status_index_name'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Apply all DDL changes idempotently via raw SQL
        migrations.RunPython(add_columns_idempotent, reverse_code=noop),

        # Keep Django's migration state in sync with the resulting schema.
        # These are state-only (no DDL) because the DDL was handled above.
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
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
                migrations.AddIndex(
                    model_name='travelapplicationreadstatus',
                    index=models.Index(
                        fields=['scope', 'is_read'],
                        name='travel_trav_scope_is_re_idx',
                    ),
                ),
            ],
        ),
    ]
