import React, { useState } from "react";
import { travelAPI } from "@/src/api/travel";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

const MASTER_OPTIONS = [
  { value: "gl-code", label: "GL Code Master" },
  // Future masters can be added here
];

const REQUIRED_HEADERS: Record<string, string[]> = {
  "gl-code": ["Vertical", "G/L Account", "Long Text"],
};

export default function ImportExportMaster() {
  const [selectedMaster, setSelectedMaster] = useState("gl-code");
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);

  const handleDownloadTemplate = () => {
    const headers = REQUIRED_HEADERS[selectedMaster];
    if (!headers) return;

    const csvContent = headers.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedMaster}_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setValidationResult(null); // Reset validation on new file
    }
  };

  const clearFile = () => {
    setFile(null);
    setValidationResult(null);
    const fileInput = document.getElementById(
      "file-upload",
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const handleValidate = async () => {
    if (!file) return;

    setValidating(true);
    setValidationResult(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      if (selectedMaster === "gl-code") {
        const res = await travelAPI.bulkUploadGLCodes(formData, true);
        setValidationResult(res);
        toast.success("Validation completed");
      }
    } catch (err: any) {
      console.error("Validation failed", err);
      const errorMsg = err.response?.data?.message || "Validation failed";
      const missingCols = err.response?.data?.missing_columns;

      if (missingCols) {
        toast.error(`${errorMsg}: ${missingCols.join(", ")}`);
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setValidating(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      if (selectedMaster === "gl-code") {
        const res = await travelAPI.bulkUploadGLCodes(formData, false);
        toast.success(res.message || "Upload successful");
        clearFile();
      }
    } catch (err: any) {
      console.error("Upload failed", err);
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          Import / Export Master Data
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage bulk data updates for system masters.
        </p>
      </header>

      <div className="grid gap-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>Select Master Data</CardTitle>
                <CardDescription>
                  Choose the data type you want to import or export.
                </CardDescription>
              </div>
              <div className="w-full md:w-64">
                <Select
                  value={selectedMaster}
                  onValueChange={setSelectedMaster}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Master" />
                  </SelectTrigger>
                  <SelectContent>
                    {MASTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <Tabs defaultValue="import" className="w-full">
            <div className="px-6 pt-6">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="import">Import</TabsTrigger>
                <TabsTrigger value="export" disabled>
                  export
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="import" className="p-6 space-y-8">
              {/* Step 1: Template */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                    1
                  </div>
                  <h3 className="font-medium text-slate-800">
                    Download Template
                  </h3>
                </div>
                <div className="pl-11">
                  <p className="text-sm text-slate-500 mb-4">
                    Get the standard CSV template for{" "}
                    {selectedMaster.replace("-", " ")}. Ensure your file matches
                    this format.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download CSV Template
                  </Button>
                </div>
              </div>

              <div className="border-t border-slate-100" />

              {/* Step 2: Upload */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                    2
                  </div>
                  <h3 className="font-medium text-slate-800">Upload File</h3>
                </div>
                <div className="pl-11">
                  {!file ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:bg-slate-50 transition-colors relative">
                      <input
                        id="file-upload"
                        type="file"
                        accept=".csv, .xlsx"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                          <UploadCloud className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-medium text-slate-700">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-slate-500">
                          CSV or XLSX (max 10MB)
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-green-50 flex items-center justify-center text-green-600">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {file.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={clearFile}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Validate & Process */}
              {file && (
                <>
                  <div className="border-t border-slate-100" />
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                        3
                      </div>
                      <h3 className="font-medium text-slate-800">
                        Process Data
                      </h3>
                    </div>
                    <div className="pl-11 space-y-4">
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={handleValidate}
                          disabled={validating || uploading}
                          variant="secondary"
                          className="w-full sm:w-auto"
                        >
                          {validating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Validating...
                            </>
                          ) : (
                            "Validate Data"
                          )}
                        </Button>
                        <Button
                          onClick={handleUpload}
                          disabled={
                            validating ||
                            uploading ||
                            (validationResult?.summary?.failed > 0 &&
                              !confirm(
                                "Some rows failed validation. Proceed anyway?",
                              ))
                          }
                          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            "Import Data"
                          )}
                        </Button>
                      </div>

                      {/* Validation Summary */}
                      {validationResult?.summary && (
                        <div className="mt-4 rounded-lg border border-slate-200 overflow-hidden">
                          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                            <h4 className="text-sm font-medium text-slate-800">
                              Validation Summary
                            </h4>
                          </div>

                          <div className="p-4 grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-2xl font-bold text-slate-700">
                                {validationResult.summary.total_rows ?? 0}
                              </p>
                              <p className="text-xs text-slate-500 uppercase">
                                Total Rows
                              </p>
                            </div>

                            <div>
                              <p className="text-2xl font-bold text-green-600">
                                {validationResult.summary.valid ?? 0}
                              </p>
                              <p className="text-xs text-slate-500 uppercase">
                                Valid
                              </p>
                            </div>

                            <div>
                              <p
                                className={`text-2xl font-bold ${
                                  validationResult.summary.failed > 0
                                    ? "text-red-600"
                                    : "text-slate-400"
                                }`}
                              >
                                {validationResult.summary.failed ?? 0}
                              </p>
                              <p className="text-xs text-slate-500 uppercase">
                                Failed
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {validationResult?.row_wise_result?.failed?.length >
                        0 && (
                        <div className="border-t border-slate-200 max-h-60 overflow-y-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-red-50 text-red-700 sticky top-0">
                              <tr>
                                <th className="px-4 py-2 font-medium">Row</th>
                                <th className="px-4 py-2 font-medium">Key</th>
                                <th className="px-4 py-2 font-medium">Error</th>
                              </tr>
                            </thead>
                            <tbody>
                              {validationResult.row_wise_result.failed.map(
                                (fail: any, idx: number) => (
                                  <tr
                                    key={idx}
                                    className="border-b border-slate-100 last:border-none hover:bg-slate-50"
                                  >
                                    <td className="px-4 py-2 text-slate-600">
                                      {fail.row}
                                    </td>
                                    <td className="px-4 py-2 text-slate-800 font-medium">
                                      {fail.gl_code || "-"}
                                    </td>
                                    <td className="px-4 py-2 text-red-600">
                                      {typeof fail.errors === "object"
                                        ? JSON.stringify(fail.errors)
                                        : fail.errors}
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="export" className="p-6">
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <FileText className="w-12 h-12 mb-4 opacity-20" />
                <p>Export functionality coming soon.</p>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
