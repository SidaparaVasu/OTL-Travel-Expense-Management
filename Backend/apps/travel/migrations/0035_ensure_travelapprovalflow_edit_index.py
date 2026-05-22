"""
Ensure travel_trav_travel_edit_idx exists.

Fixes DBs where 0034 was partially applied or removed migrations 0035/0036
tried to rename a missing index. Safe to run multiple times.
"""
from django.db import migrations


def ensure_edit_count_index(apps, schema_editor):
    index_name = "travel_trav_travel_edit_idx"
    table = "travel_travelapprovalflow"
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        if connection.vendor == "mysql":
            cursor.execute(
                """
                SELECT COUNT(*) FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name = %s
                  AND index_name = %s
                """,
                [table, index_name],
            )
            if cursor.fetchone()[0] == 0:
                cursor.execute(
                    f"CREATE INDEX `{index_name}` "
                    f"ON `{table}` (`travel_application_id`, `edit_count`)"
                )
            return

        # PostgreSQL
        if connection.vendor == "postgresql":
            cursor.execute(
                """
                SELECT COUNT(*) FROM pg_indexes
                WHERE tablename = %s AND indexname = %s
                """,
                [table, index_name],
            )
            if cursor.fetchone()[0] == 0:
                cursor.execute(
                    f'CREATE INDEX "{index_name}" '
                    f'ON "{table}" ("travel_application_id", "edit_count")'
                )
            return

        # SQLite and others: use schema editor if index missing
        constraints = connection.introspection.get_constraints(cursor, table)
        if index_name not in constraints:
            from django.db import models

            schema_editor.add_index(
                apps.get_model("travel", "TravelApprovalFlow"),
                models.Index(
                    fields=["travel_application", "edit_count"],
                    name=index_name,
                ),
            )


class Migration(migrations.Migration):

    dependencies = [
        ("travel", "0034_approval_cycle_edit_count"),
    ]

    operations = [
        migrations.RunPython(ensure_edit_count_index, migrations.RunPython.noop),
    ]
