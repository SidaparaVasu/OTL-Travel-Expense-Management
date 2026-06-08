export interface ExpenseType {
  id: number;
  name: string;
  code: string;
  requires_receipt: boolean;
  is_active: boolean;
}

export interface ClaimStatus {
  id: number;
  name: string;
  code: string;
}

export interface ClaimableApp {
  id: number;
  request_id: string;
  departure_date: string;
  return_date: string;
  from_location: string;
  to_location: string;
  total_days: number;
  bookings?: {
    id: number;
    booking_type: string;
    description: string;
    estimated_cost: number;
    booking_date?: string;
    from_location?: string;
    to_location?: string;
  }[];
}

export interface ExpenseItem {
  id?: number;
  expense_type: number | string;
  booking_id?: number;
  is_booking_expense?: boolean;
  estimated_cost: number;
  actual_cost: number;
  has_receipt: boolean;
  receipt_file?: File | string;
  remarks: string;
  expense_date?: string;
  distance_km?: number;
}

export interface ExpenseClaim {
  id: number;
  claim_number: string;
  travel_application: number;
  travel_request_id?: string;
}

export interface ExpenseClaim {
  id: number;
  claim_number: string;
  travel_application: number;
  travel_request_id?: string;
  items: ExpenseItem[];
  status: string;
  total_amount: number;
  created_at: string;
  submitted_at?: string;
  one_way_distance_km?: number | null;
}

export interface ExpenseClaimCreate {
  travel_application: number;
  items: ExpenseItem[];
}

export interface DABreakdown {
  date: string;
  duration_hours: number;
  eligible: boolean;
  da: number;
  incidental: number;
}

export interface ExpenseClaimValidateResponse {
  success: boolean;
  message: string;
  data: {
    errors: Record<string, any>;
    warnings: Record<string, any>;
    computed: {
      da_breakdown: DABreakdown[];
      total_da: number;
      total_incidental: number;
      total_expenses: number;
      advance_received: number;
      gross_total: number;
      final_amount: number;
      policy_summary: {
        da_rates_source: string;
        per_km_rate_no_receipt: string;
      };
    };
  };
  errors: any;
}

export interface ExpenseClaimValidateRequest {
  travel_application_id: number;
  claim_id?: number;
  one_way_distance_km?: number | null;
  items: ExpenseItem[];
}

export interface ExpenseClaimActionRequest {
  action: "submit" | "approve" | "reject";
  remarks?: string;
}

export interface ClaimListParams {
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

// Finance Dashboard Types
export interface FinanceDashboardStatistics {
  pending: number;
  paid: number;
  closed: number;
  disclosed: number;
}

export interface FinanceDashboardClaim {
  travel_application: number | null;
  travel_request_id: string | null;
  claim_application_id: number;
  employee_name: string;
  status_code: string | null;
  status_label: string | null;
  total_da: number;
  total_incidental: number;
  total_expenses: number;
  advance_received: number;
  final_amount_payable: number;
}

export interface FinanceDashboardResponse {
  success: boolean;
  message: string;
  data: {
    statistics: FinanceDashboardStatistics;
    results: FinanceDashboardClaim[];
  };
}

// Finance Action Types
export interface FinanceActionRequest {
  action: "mark_paid" | "mark_closed" | "return_to_applicant";
  remarks?: string;
}

export interface FinanceActionResponse {
  success: boolean;
  message: string;
  data: {
    claim_id: number;
    new_status: string;
    status_label: string;
  };
}
