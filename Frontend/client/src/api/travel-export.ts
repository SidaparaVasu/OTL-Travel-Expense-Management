import { apiClient } from "./client";

export interface TravelExportPreviewRecord {
  travel_request_id: string;
  employee_name: string;
  purpose: string;
  status: string;
  origin: string;
  destination: string;
  trip_start_date: string;
  trip_start_time: string;
  trip_end_date: string;
  trip_end_time: string;
}

export interface TravelExportPreviewResponse {
  total: number;
  start_date: string;
  end_date: string;
  status_summary: Record<string, number>;
  records: TravelExportPreviewRecord[];
}

/**
 * Fetch a JSON preview of travel applications in the given date range.
 * Used to show a summary table before the user downloads the Excel file.
 */
export const fetchTravelExportPreview = async (
  startDate: string,
  endDate: string,
): Promise<TravelExportPreviewResponse> => {
  const { data } = await apiClient.get("/travel/admin/export/preview/", {
    params: { start_date: startDate, end_date: endDate },
  });
  return data.data as TravelExportPreviewResponse;
};

/**
 * Download the Excel file for travel applications in the given date range.
 * Triggers a browser file download automatically.
 */
export const downloadTravelExport = async (
  startDate: string,
  endDate: string,
): Promise<void> => {
  const response = await apiClient.get("/travel/admin/export/", {
    params: { start_date: startDate, end_date: endDate },
    responseType: "blob",
  });

  // Extract filename from Content-Disposition header if available
  const disposition = response.headers["content-disposition"] as string | undefined;
  let filename = `Travel_Applications_${startDate}_to_${endDate}.xlsx`;
  if (disposition) {
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    if (match?.[1]) filename = match[1];
  }

  // Create a temporary anchor and trigger download
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
