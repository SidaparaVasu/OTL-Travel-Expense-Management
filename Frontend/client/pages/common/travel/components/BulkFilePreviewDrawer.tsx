import React, { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { travelAPI, type BulkFilePreviewData } from "@/src/api/travel-api";
import { docViewer } from "@/src/api/document_viewer";

export interface BulkFilePreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  bookingId?: number;
  applicationId?: number;
  title?: string;
}

export const BulkFilePreviewDrawer: React.FC<BulkFilePreviewDrawerProps> = ({
  open,
  onClose,
  bookingId,
  applicationId,
  title = "Bulk guest data",
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BulkFilePreviewData | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setError(null);
      setDownloadUrl(null);
      return;
    }

    if (!bookingId && !applicationId) {
      setError("No booking or application specified.");
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setPreview(null);
      try {
        const data = bookingId
          ? await travelAPI.getBookingBulkFilePreview(bookingId)
          : await travelAPI.getApplicationBulkFilePreview(applicationId!);

        if (cancelled) return;
        setPreview(data);
        setDownloadUrl(data.file_url ?? null);
      } catch (err: any) {
        if (cancelled) return;
        const resp = err?.response?.data;
        const message =
          resp?.message ||
          resp?.errors ||
          err?.message ||
          "Failed to load bulk file preview";
        setError(typeof message === "string" ? message : "Failed to load bulk file preview");
        const url = resp?.data?.file_url;
        if (url) setDownloadUrl(url);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, bookingId, applicationId]);

  const handleDownload = () => {
    if (downloadUrl) docViewer.onViewFile(downloadUrl);
  };

  const columns = preview?.columns ?? [];
  const rows = preview?.rows ?? [];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-full sm:max-w-full h-full flex flex-col p-0 gap-0"
      >
        <SheetHeader className="px-6 py-4 border-b shrink-0 text-left">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pr-8">
            <div>
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription className="text-left">
                {preview?.file_name
                  ? preview.file_name
                  : "Guest details from uploaded bulk file"}
              </SheetDescription>
            </div>
            {downloadUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4 mr-2" />
                Download file
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading bulk data…</span>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p>{error}</p>
              {downloadUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download file
                </Button>
              )}
            </div>
          )}

          {!loading && !error && preview && (
            <>
              {preview.truncated && (
                <p className="mb-4 text-sm text-muted-foreground rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  Showing first {preview.max_preview_rows} of {preview.total_rows}{" "}
                  rows. Download the file to view all records.
                </p>
              )}

              {columns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No columns found in file.</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  File has headers but no data rows.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm border-collapse min-w-max">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="py-2 px-3 font-medium whitespace-nowrap text-muted-foreground w-10">
                          #
                        </th>
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="py-2 px-3 font-medium whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b last:border-0 hover:bg-muted/20"
                        >
                          <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                          {columns.map((col) => (
                            <td
                              key={col}
                              className="py-2 px-3 whitespace-nowrap max-w-xs truncate"
                              title={
                                row[col] != null ? String(row[col]) : undefined
                              }
                            >
                              {row[col] != null && row[col] !== ""
                                ? String(row[col])
                                : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
