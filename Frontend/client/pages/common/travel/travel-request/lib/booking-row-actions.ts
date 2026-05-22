export type BookingRowLockFields = {
  id?: number;
  status?: string;
  is_approved?: boolean;
  is_actionable?: boolean;
  can_close?: boolean;
};

export type RowActionState = {
  canEdit: boolean;
  canDelete: boolean;
  canClose: boolean;
};

export function getBookingRowActions(
  row: BookingRowLockFields,
): RowActionState {
  const terminal = row.status === "closed" || row.status === "cancelled";

  if (terminal) {
    return { canEdit: false, canDelete: false, canClose: false };
  }

  if (row.can_close) {
    return { canEdit: false, canDelete: false, canClose: true };
  }

  const actionable = row.is_actionable !== false && !row.is_approved;

  return {
    canEdit: actionable,
    canDelete: actionable,
    canClose: false,
  };
}
