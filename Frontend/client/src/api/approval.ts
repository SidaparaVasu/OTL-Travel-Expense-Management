import { apiClient } from "./client";

export interface ApprovalApplication {
  id: number;
  travel_request_id: string;
  employee_name: string;
  employee_grade: string;
  department: string;
  purpose: string;
  estimated_total_cost: string;
  status: string;
  submitted_at: string;
  current_approval: {
    approval_level: string;
    sequence: number;
    can_approve: boolean;
    triggered_by_rule: string;
  };
  trip_summary: Array<{
    from: string;
    to: string;
    departure: string;
    return: string;
    duration: number;
  }>;
}

export interface ApprovalStats {
  pending_approval: number;
  approved_today: number;
  total_budget: number;
  rejected: number;
}

export const approvalAPI = {
  // Get pending approvals
  getPendingApprovals: async (): Promise<ApprovalApplication[]> => {
    const { data } = await apiClient.get("/travel/approvals/pending/");
    return data;
  },

  getApprovals: async (
    status: string = "pending",
    page: number,
    search: string = "",
    startDate: string = "",
    endDate: string = "",
  ): Promise<ApprovalApplication[]> => {
    let url = `/travel/manager-approvals/?status=${status}&page=${page}&search=${encodeURIComponent(search)}`;
    if (startDate) url += `&departure_after=${startDate}`;
    if (endDate) url += `&departure_before=${endDate}`;
    const { data } = await apiClient.get(url);
    return data;
  },

  // Get statistics
  getStats: async (): Promise<ApprovalStats> => {
    const { data } = await apiClient.get("/travel/approvals/stats/");
    return data;
  },

  // Approve application
  approve: async (id: number, notes?: string) => {
    const { data } = await apiClient.post(`/travel/approvals/${id}/action/`, {
      action: "approve",
      notes: notes || "",
    });
    return data;
  },

  // Reject application
  reject: async (id: number, notes?: string) => {
    const { data } = await apiClient.post(`/travel/approvals/${id}/action/`, {
      action: "reject",
      notes: notes || "",
    });
    return data;
  },

  // Get approval history
  getHistory: async (id: number) => {
    const { data } = await apiClient.get(`/travel/approvals/${id}/history/`);
    return data;
  },

  // Get approval dashboard
  getDashboard: async () => {
    const { data } = await apiClient.get("/travel/approvals/dashboard/");
    return data;
  },
};
