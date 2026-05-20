export const BOOKING_REASON_MAX_LENGTH = 200;

export interface BookingClosureLog {
  action: string;
  action_label: string;
  closure_reason: string;
  claim_decision_reason: string;
  allow_claim: boolean;
  allow_claim_label: string;
  created_by_name: string;
  created_at: string;
}
