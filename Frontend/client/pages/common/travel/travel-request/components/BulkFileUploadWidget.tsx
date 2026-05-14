import React, { useRef } from "react";
import { Download, FileSpreadsheet, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { travelAPI } from "@/src/api/travel-api";
import { API_BASE_URL } from "@/config/api.config";
import { toast } from "sonner";

type BulkCategory = "ticketing" | "accommodation" | "conveyance";

interface BulkFileUploadWidgetProps {
  category: BulkCategory;
  bookingIndex?: number;
  file: File | null;
  existingFileUrl: string | null;
  onChange: (file: File | null) => void;
  onRemoveExisting: () => void;
}

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

const getFileUrl = (url: string) => {
  if (!url) return "#";
  if (/^https?:\/\//i.test(url)) return url;
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, "");
  return `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`;
};

const getFileName = (url: string) => {
  const cleanUrl = url.split("?")[0];
  const name = cleanUrl.split("/").filter(Boolean).pop();
  return name ? decodeURIComponent(name) : "Bulk booking file";
};

export const BulkFileUploadWidget: React.FC<BulkFileUploadWidgetProps> = ({
  category,
  file,
  existingFileUrl,
  onChange,
  onRemoveExisting,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) {
      onChange(null);
      return;
    }

    const lowerName = selectedFile.name.toLowerCase();
    const isAllowed = ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

    if (!isAllowed) {
      toast.error("Please select an Excel or CSV file.");
      event.target.value = "";
      onChange(null);
      return;
    }

    onChange(selectedFile);
  };

  const clearSelectedFile = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onChange(null);
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <label className="text-sm font-medium">Bulk Guest Data File</label>
          <p className="text-xs text-muted-foreground">
            Excel or CSV file for this booking line item.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => travelAPI.downloadBulkSample(category)}
        >
          <Download className="mr-2 h-4 w-4" />
          Download Sample
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          Choose File
        </Button>

        {file && (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span className="truncate">{file.name}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSelectedFile}
              className="h-8 px-2"
              aria-label="Remove selected bulk file"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {!file && existingFileUrl && (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
            <a
              href={getFileUrl(existingFileUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-2 text-primary hover:underline"
            >
              <FileSpreadsheet className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{getFileName(existingFileUrl)}</span>
            </a>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemoveExisting}
              className="h-8 px-2 text-destructive hover:text-destructive"
              aria-label="Remove existing bulk file"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
