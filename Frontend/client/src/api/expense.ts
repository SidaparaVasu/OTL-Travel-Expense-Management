import { apiClient } from "./client";
import type {
  ExpenseClaim,
  ExpenseClaimCreate,
  ExpenseClaimValidateRequest,
  ExpenseClaimValidateResponse,
  ExpenseClaimActionRequest,
  ExpenseType,
  ClaimStatus,
  ClaimListParams,
  FinanceDashboardResponse,
  FinanceActionRequest,
  FinanceActionResponse,
} from "@/src/types/expense-2.types";

export const expenseAPI = {
  claimableApps: {
    getAll: async () => {
      const { data } = await apiClient.get(
        "/expense/claimable-travel-applications/",
      );
      return data;
    },
  },
  claims: {
    getAll: async (params?: ClaimListParams) => {
      const { data } = await apiClient.get("/expense/claims/", { params });
      return data;
    },
    getMyClaims: async (params?: ClaimListParams) => {
      const { data } = await apiClient.get("/expense/my-claims/", { params });
      return data;
    },
    get: async (id: number) => {
      const { data } = await apiClient.get(`/expense/claims/${id}/`);
      return data.data;
    },
    create: async (payload: FormData) => {
      const { data } = await apiClient.post("/expense/claims/", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },

    submit: async (payload: any) => {
      const { data } = await apiClient.post("/expense/claims/", payload, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      return data;
    },

    validate: async (payload: ExpenseClaimValidateRequest) => {
      const { data } = await apiClient.post<ExpenseClaimValidateResponse>(
        "/expense/claims/validate/",
        payload,
      );
      return data;
    },
    action: async (id: number, payload: ExpenseClaimActionRequest) => {
      const { data } = await apiClient.post(
        `/expense/claims/${id}/action/`,
        payload,
      );
      return data;
    },
    uploadReceipts: async (id: number, formData: FormData) => {
      const { data } = await apiClient.post(
        `/expense/claims/${id}/upload-receipts/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      console.log("from expense.ts, uploadReciepts: ", data);
      return data;
    },
    getPendingApprovals: async (params?: any) => {
      const { data } = await apiClient.get(
        "/expense/claims/pending-approvals/",
        {
          params,
        },
      );
      console.log(data);
      return data;
    },
    financeAction: async (
      id: number,
      payload: FinanceActionRequest,
    ): Promise<FinanceActionResponse> => {
      const { data } = await apiClient.post(
        `/expense/claims/${id}/finance-action/`,
        payload,
      );
      return data;
    },
    edit: async (id: number, payload: any) => {
      const { data } = await apiClient.put(
        `/expense/claims/${id}/edit/`,
        payload,
      );
      return data;
    },
    resubmit: async (id: number) => {
      const { data } = await apiClient.post(`/expense/claims/${id}/resubmit/`);
      return data;
    },
    downloadReport: async (id: number) => {
      const { data } = await apiClient.get(`/expense/claims/${id}/`, {
        params: { download_report: "true" },
        responseType: "blob",
      });
      return data;
    },
  },
  expenseTypes: {
    getAll: async () => {
      const { data } = await apiClient.get<ExpenseType[]>(
        "/expense/expense-types/",
      );
      return data;
    },
    get: async (id) => {
      const { data } = await apiClient.get<ClaimStatus[]>(
        `/expense/expense-types/${id}/`,
      );
      return data;
    },
    create: async (payload) => {
      const { data } = await apiClient.post<ExpenseType[]>(
        "/expense/expense-types/",
        payload,
      );
      return data;
    },
    update: async (id, payload) => {
      const { data } = await apiClient.post<ExpenseType[]>(
        `/expense/expense-types/${id}/`,
        payload,
      );
      return data;
    },
    delete: async (id: number, hard: boolean = false) => {
      const url = hard
        ? `/expense/expense-types/${id}/?hard=true`
        : `/expense/expense-types/${id}/`;

      const { data } = await apiClient.delete(url);
      return data;
    },
  },
  claimStatus: {
    getAll: async () => {
      const { data } = await apiClient.get<ClaimStatus[]>(
        "/expense/claim-status/",
      );
      return data;
    },
    get: async (id) => {
      const { data } = await apiClient.get<ClaimStatus[]>(
        `/expense/claim-status/${id}/`,
      );
      return data;
    },
    create: async (payload) => {
      const { data } = await apiClient.post<ExpenseType[]>(
        "/expense/claim-status/",
        payload,
      );
      return data;
    },
    update: async (id, payload) => {
      const { data } = await apiClient.post<ExpenseType[]>(
        `/expense/claim-status/${id}/`,
        payload,
      );
      return data;
    },
    delete: async (id) => {
      const { data } = await apiClient.delete<ExpenseType[]>(
        `/expense/claim-status/${id}/`,
      );
      return data;
    },
  },
  finance: {
    getDashboard: async (params?: {
      status?: string;
      search?: string;
      location_id?: number | string;
      page?: number;
      page_size?: number;
    }): Promise<FinanceDashboardResponse> => {
      const { data } = await apiClient.get("/travel/dashboard/finance/", {
        params,
      });
      return data;
    },
    getAssignedLocations: async (): Promise<{
      success: boolean;
      data: { id: number; name: string }[];
    }> => {
      const { data } = await apiClient.get("/travel/finance/assigned-locations/");
      return data;
    },
  },
};
