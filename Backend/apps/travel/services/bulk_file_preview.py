import os
from typing import Any, Dict, List, Optional

from rest_framework.exceptions import ValidationError

from apps.bulk_service.parsers import get_parser

MAX_PREVIEW_ROWS = 500
UNSUPPORTED_XLS_MESSAGE = (
    "Preview is not supported for .xls files. Please download the file "
    "and open it in Excel."
)


def _serialize_cell(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (int, float, bool)):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        return stripped if stripped else None
    return str(value).strip() if str(value).strip() else None


def _row_is_empty(row: Dict[str, Any]) -> bool:
    return all(v is None or (isinstance(v, str) and not v.strip()) for v in row.values())


def preview_uploaded_file(
    file_field,
    *,
    source: str,
    booking_id: Optional[int] = None,
    application_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Parse first row as columns and remaining rows as data.
    Returns JSON-serializable preview payload.
    """
    if not file_field:
        raise ValidationError("No bulk file attached.")

    file_name = os.path.basename(file_field.name)
    ext = os.path.splitext(file_name)[1].lower()

    if ext == ".xls":
        raise ValidationError(UNSUPPORTED_XLS_MESSAGE)

    if ext not in {".xlsx", ".csv"}:
        raise ValidationError(
            f"Preview is not supported for '{ext}' files. "
            "Allowed formats for preview: .xlsx, .csv"
        )

    with file_field.open("rb") as stored:
        parser = get_parser(stored, ext)
        columns: List[str] = [h for h in parser.get_headers() if h]
        rows: List[Dict[str, Any]] = []
        total_rows = 0

        for raw_row in parser.parse():
            aligned = {
                col: _serialize_cell(raw_row.get(col))
                for col in columns
            }
            if _row_is_empty(aligned):
                continue

            total_rows += 1
            if len(rows) < MAX_PREVIEW_ROWS:
                rows.append(aligned)

    return {
        "source": source,
        "booking_id": booking_id,
        "application_id": application_id,
        "file_name": file_name,
        "columns": columns,
        "rows": rows,
        "total_rows": total_rows,
        "truncated": total_rows > MAX_PREVIEW_ROWS,
        "max_preview_rows": MAX_PREVIEW_ROWS,
    }
