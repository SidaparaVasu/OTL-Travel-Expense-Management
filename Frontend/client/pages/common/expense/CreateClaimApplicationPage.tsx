import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, PlusCircle, Trash2, CheckCircle2, AlertTriangle, ArrowLeft, X, FileText } from "lucide-react";
import { expenseAPI } from "@/src/api/expense";
import { ROUTES } from "@/routes/routes";

const formatDate = (dateString: string) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function CreateClaimApplicationPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [expenseTypes, setExpenseTypes] = useState([]);

  const [bookingRows, setBookingRows] = useState<any[]>([]);
  const [otherExpenses, setOtherExpenses] = useState<any[]>([]);

  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // File upload modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [currentUploadItem, setCurrentUploadItem] = useState<any>(null);
  const [errors, setErrors] = useState<any>({});

  // Load applications + expenses
  useEffect(() => {
    expenseAPI.claimableApps.getAll().then(res => {
      if (res?.data) setApplications(res.data);
    });

    expenseAPI.expenseTypes.getAll().then(res => {
      if (res?.data) setExpenseTypes(res.data);
    });
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // When user selects Travel App
  const handleSelectApplication = (appId: string) => {
    const app = applications.find((a: any) => a.id === Number(appId));
    console.log(app);
    setSelectedApp(app);
    setErrors({});

    // Auto-fill booking rows from confirmed bookings
    if (app?.trip_details) {
      const rows = [];
      app.trip_details.forEach((trip: any) => {
        trip.bookings
          .filter((b: any) => b.status === "completed")
          .forEach((b: any) => {
            rows.push({
              bookingId: b.id,
              expense_type: b.booking_type_id || "",
              expense_date: trip.departure_date || "",
              typeName: b.booking_type_name,
              subType: b.sub_option_name || "",
              estimated: Number(b.estimated_cost || 0),
              amount: Number(b.estimated_cost || 0),
              booking_file: b.booking_file,
              has_receipt: Boolean(b.booking_file),
              receipt_file: null,
              distance_km: "",
              remarks: ""
            });
          });
      });
      console.log(rows);
      setBookingRows(rows);
    }

    setOtherExpenses([]);
  };

  // Add Other Expense Row
  const addOtherExpense = () => {
    setOtherExpenses(prev => [
      ...prev,
      {
        id: Date.now(),
        expense_type: "",
        expense_date: "",
        amount: "",
        has_receipt: false,
        receipt_file: null,
        distance_km: "",
        remarks: ""
      }
    ]);
  };

  // Delete Other Expense Row
  const deleteOtherExpense = (id: number) => {
    setOtherExpenses(prev => prev.filter(row => row.id !== id));
  };

  // Open upload modal
  const openUploadModal = (item: any, type: 'booking' | 'other', index: number) => {
    setCurrentUploadItem({ item, type, index });
    setUploadModalOpen(true);
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUploadItem) return;

    const { type, index } = currentUploadItem;

    if (type === 'booking') {
      setBookingRows(prev => {
        const updated = [...prev];
        updated[index].receipt_file = file;
        updated[index].has_receipt = true;
        return updated;
      });
    } else {
      setOtherExpenses(prev => {
        const updated = [...prev];
        updated[index].receipt_file = file;
        updated[index].has_receipt = true;
        return updated;
      });
    }

    setUploadModalOpen(false);
    setCurrentUploadItem(null);
  };

  const formatFieldName = (field: string) => {
    if (field.startsWith("items[")) {
      const match = field.match(/items\[(\d+)\]\.(.+)/);
      if (match) {
        const index = Number(match[1]) + 1;
        const subField = match[2].replace(/_/g, " ");
        return `Expense Item #${index} – ${subField}`;
      }
    }
    return field.replace(/_/g, " ");
  };

  const normalizeErrors = (apiErrors: any) => {
    if (!apiErrors) return [];

    const list: { field: string; message: string }[] = [];

    Object.entries(apiErrors).forEach(([field, messages]) => {
      const formattedField = formatFieldName(field);

      if (Array.isArray(messages)) {
        messages.forEach((msg) => {
          list.push({
            field: formattedField,
            message: msg,
          });
        });
      } else {
        list.push({
          field: formattedField,
          message: String(messages),
        });
      }
    });

    return list;
  };

  const buildJsonPayload = () => {
    return {
      travel_application_id: selectedApp.id,
      items: [
        ...bookingRows.map(b => ({
          expense_type: Number(b.expense_type),
          expense_date: b.expense_date,
          amount: Number(b.amount),
          booking_id: b.bookingId,
          has_receipt: Boolean(b.has_receipt),
          distance_km: Number(b.distance_km) || 0,
          remarks: b.remarks || ""
        })),
        ...otherExpenses.map(o => ({
          expense_type: Number(o.expense_type),
          expense_date: o.expense_date,
          amount: Number(o.amount),
          has_receipt: true,
          distance_km: Number(o.distance_km) || 0,
          remarks: o.remarks || ""
        }))
      ],
      acknowledged_warnings: Array.isArray(validationResult?.data?.warnings) ? validationResult.data.warnings : [],
      exception_reasons: []
    };
  };

  const submitClaimJson = async () => {
    const payload = buildJsonPayload();
    console.log("payload: ", payload);
    return await expenseAPI.claims.submit(payload); // JSON POST
  };

  const fetchCreatedItems = async (claimId: number) => {
    const res = await expenseAPI.claims.get(claimId);
    console.log('expense data: ', res);
    return res?.items || [];
  };

  const uploadReceipts = async (claimId: number, createdItems: any[]) => {
    const formData = new FormData();

    const itemList = createdItems;
    const allItems = [...bookingRows, ...otherExpenses];

    allItems.forEach((row, index) => {
      if (row.receipt_file) {

        const itemId = itemList[index]?.id;

        if (!itemId) {
          console.error("❌ No item ID for index:", index);
          return;
        }

        formData.append("files", row.receipt_file);
        formData.append("items", itemId);
      }
    });

    if ([...formData.values()].length === 0) {
      return { success: true, message: "No receipts to upload" };
    }

    return await expenseAPI.claims.uploadReceipts(claimId, formData);
  };

  // VALIDATE CLAIM
  const handleValidate = async () => {
    setErrors({});
    setLoading(true);

    // Additional expenses MUST have receipt
    const additionalExpensesWithoutReceipts = otherExpenses.filter(e => !e.receipt_file);
    if (additionalExpensesWithoutReceipts.length > 0) {
      setErrors({
        general: "All additional expenses must have a receipt / bill uploaded.",
      });
      setLoading(false);
      return;
    }

    const payload = {
      travel_application_id: selectedApp?.id,
      items: [
        ...bookingRows.map((b) => ({
          expense_type: parseInt(b.expense_type),
          expense_date: b.expense_date,
          amount: parseFloat(b.amount) || 0,
          booking_id: b.bookingId,
          has_receipt: b.has_receipt,
          distance_km: parseFloat(b.distance_km) || 0,
          remarks: b.remarks || "",
        })),
        ...otherExpenses.map((o) => ({
          expense_type: parseInt(o.expense_type),
          expense_date: o.expense_date,
          amount: parseFloat(o.amount) || 0,
          has_receipt: o.has_receipt,
          distance_km: parseFloat(o.distance_km) || 0,
          remarks: o.remarks || "",
        })),
      ],
    };

    try {
      const result = await expenseAPI.claims.validate(payload);

      if (result?.success) {
        setValidationResult(result);
        setValidationModalOpen(true);
      } else {
        const friendly = normalizeErrors(result?.data || result?.errors);

        setErrors({
          general: "Please fix the highlighted issues before proceeding.",
          list: friendly,
        });
      }
    } catch (error: any) {
      const message = extractErrorMessage(error);
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  // SUBMIT CLAIM
  const handleSubmit = async () => {
    if (!selectedApp) return;
    setLoading(true);

    try {
      const submitResult = await submitClaimJson();
      console.log("SUBMIT RESULT: ", submitResult);
      console.log("SUBMIT RESULT: ", submitResult?.success);

      // SUCCESS FLOW
      if (submitResult?.success === true) {
        const claimId = submitResult.data.claim_id;
        console.log("claimID: ", claimId);

        const createdItems = await fetchCreatedItems(claimId);
        console.log("createdItems: ", createdItems);
        const uploadRecieptRes = await uploadReceipts(claimId, createdItems);
        console.log("Upload Res: ", uploadRecieptRes);

        toast({
          title: "Success",
          description: submitResult.message || "Claim submitted successfully",
        });

        navigate(ROUTES.indexClaimPage);
        return;
      }

      // BACKEND SENT success = false → VALIDATION ERRORS
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: submitResult?.message || "Validation failed."
      });

    } catch (error) {
      // NETWORK/UNEXPECTED ERRORS ONLY
      toast({
        variant: "destructive",
        title: "Request Failed",
        description: "Unable to submit claim. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const getExpenseTypeName = (id: string | number) => {
    const type = expenseTypes.find((t: any) => t.id === Number(id));
    return type?.name || "";
  };

  const extractErrorMessage = (error: any) => {
    const api = error?.response?.data;
    return (
      api?.message ||
      api?.detail ||
      "Something went wrong. Please try again."
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="bg-slate-50 text-black text-muted-foreground hover:text-foreground hover:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Create Expense Claim</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Submit eligible expenses for your completed travel
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {/* SELECT TRAVEL APPLICATION */}
        <Card className="p-6 mb-6 bg-white shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
          <div className="flex items-start gap-3 mb-4">
            <FileText className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h3 className="text-base font-medium text-foreground mb-1">
                Select Completed Travel Application
              </h3>
              <p className="text-sm text-muted-foreground">
                Choose an approved travel request to create expense claims
              </p>
            </div>
          </div>

          <Select onValueChange={handleSelectApplication}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select completed travel application" />
            </SelectTrigger>
            <SelectContent>
              {applications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No claimable applications found</p>
                </div>
              ) : (
                applications.map((app: any) => (
                  <SelectItem key={app.id} value={String(app.id)}>
                    {app.travel_request_id} — {app.purpose}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Card>

        {selectedApp && (
          <>
            {/* TRAVEL APPLICATION SUMMARY */}
            <Card className="p-6 mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4">
                Travel Application Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Request ID</span>
                    <p className="font-medium text-foreground">{selectedApp.travel_request_id}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Travel Period</span>
                    <p className="font-medium text-foreground">
                      {selectedApp.trip_details[0].departure_date} → {selectedApp.trip_details[0].return_date}
                      <span className="font-xs text-slate-500 ml-2">({selectedApp.total_duration_days || 0} days)</span>
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Trip Location</span>
                    <p className="font-medium text-foreground">{selectedApp.trip_details[0].from_location_name} → {selectedApp.trip_details[0].to_location_name}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* BOOKING EXPENSES TABLE */}
            <Card className="p-6 mb-6">
              <h3 className="text-base font-medium text-foreground mb-4">Claim Items — Bookings</h3>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead className="min-w-[180px]">Expense Type *</TableHead>
                      <TableHead className="min-w-[150px]">Travel Mode</TableHead>
                      <TableHead className="min-w-[140px]">Expense Date *</TableHead>
                      <TableHead className="min-w-[100px]">Distance (km)</TableHead>
                      <TableHead className="min-w-[120px]">Advance Taken</TableHead>
                      <TableHead className="min-w-[140px]">Actual Amount *</TableHead>
                      <TableHead className="min-w-[140px]">Receipt</TableHead>
                      <TableHead className="min-w-[200px]">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {bookingRows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-center font-medium text-muted-foreground">
                          {index + 1}
                        </TableCell>

                        <TableCell>
                          <Select
                            value={String(row.expense_type)}
                            onValueChange={(value) => {
                              setBookingRows(prev => {
                                const updated = [...prev];
                                updated[index].expense_type = value;
                                return updated;
                              });
                            }}
                          >
                            <SelectTrigger className={errors[`items.${index}.expense_type`] ? 'border-destructive' : ''}>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {expenseTypes.map((e: any) => (
                                <SelectItem key={e.id} value={String(e.id)}>
                                  {e.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell>
                          <div className="text-sm">
                            {row.typeName}
                            {row.subType && (
                              <span className="text-muted-foreground"> ({row.subType})</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Input
                            type="date"
                            value={row.expense_date}
                            onChange={(e) => {
                              setBookingRows(prev => {
                                const updated = [...prev];
                                updated[index].expense_date = e.target.value;
                                return updated;
                              });
                            }}
                            className={`bg-muted ${errors[`items.${index}.expense_date`] ? 'border-destructive' : ''}`}
                          />
                        </TableCell>

                        <TableCell>
                          <Input
                            type="number"
                            value={row.distance_km}
                            onChange={(e) => {
                              setBookingRows(prev => {
                                const updated = [...prev];
                                updated[index].distance_km = e.target.value;
                                return updated;
                              });
                            }}
                            placeholder="0"
                            className={errors[`items.${index}.distance_km`] ? 'border-destructive' : ''}
                          />
                        </TableCell>

                        <TableCell>
                          <Input
                            value={`₹${row.estimated}`}
                            disabled
                            className="bg-muted"
                          />
                        </TableCell>

                        <TableCell>
                          <Input
                            type="number"
                            value={row.amount}
                            onChange={(e) => {
                              setBookingRows(prev => {
                                const updated = [...prev];
                                updated[index].amount = e.target.value;
                                return updated;
                              });
                            }}
                            placeholder="0"
                            className={errors[`items.${index}.amount`] ? 'border-destructive' : ''}
                          />
                        </TableCell>

                        <TableCell>
                          {row.receipt_file ? (
                            // Claim receipt exists
                            <a href={row.receipt_file} target="_blank" className="text-blue-600 underline">
                              View Receipt
                            </a>
                          ) : row.booking_file ? (
                            // Booking file exists from Travel Application
                            <a href={row.booking_file} target="_blank" className="text-blue-600 underline">
                              View Booking File
                            </a>
                          ) : (
                            // No existing file → allow upload
                            <Checkbox
                              checked={row.has_receipt}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  openUploadModal(row, 'booking', index);
                                } else {
                                  setBookingRows(prev => {
                                    const updated = [...prev];
                                    updated[index].has_receipt = false;
                                    updated[index].receipt_file = null;
                                    return updated;
                                  });
                                }
                              }}
                            />
                          )}
                        </TableCell>
                        {/* <TableCell>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={row.has_receipt}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  openUploadModal(row, 'booking', index);
                                } else {
                                  setBookingRows(prev => {
                                    const updated = [...prev];
                                    updated[index].has_receipt = false;
                                    updated[index].receipt_file = null;
                                    return updated;
                                  });
                                }
                              }}
                            />
                            {row.receipt_file ? (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {row.receipt_file.name || row.receipt_file}
                              </span>
                            ) : (
                              <span className="text-xs text-red-500">Receipt required</span>
                            )}
                          </div>
                        </TableCell> */}

                        <TableCell>
                          <Input
                            value={row.remarks}
                            onChange={(e) => {
                              setBookingRows(prev => {
                                const updated = [...prev];
                                updated[index].remarks = e.target.value;
                                return updated;
                              });
                            }}
                            placeholder="Optional"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* OTHER EXPENSES */}
            <Card className="p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-medium text-foreground">Additional Expenses</h3>
                <Button onClick={addOtherExpense} variant="outline" size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Expense
                </Button>
              </div>

              {otherExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No additional expenses added
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead className="min-w-[180px]">Expense Type *</TableHead>
                        <TableHead className="min-w-[140px]">Expense Date *</TableHead>
                        <TableHead className="min-w-[100px]">Distance (km)</TableHead>
                        <TableHead className="min-w-[140px]">Amount Spent*</TableHead>
                        <TableHead className="min-w-[180px]">Receipt * (Mandatory)</TableHead>
                        <TableHead className="min-w-[200px]">Remarks</TableHead>
                        <TableHead className="w-[80px]">Remove</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {otherExpenses.map((row, index) => {
                        const itemIndex = bookingRows.length + index;
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="text-center font-medium text-muted-foreground">
                              {bookingRows.length + index + 1}
                            </TableCell>

                            <TableCell>
                              <Select
                                value={String(row.expense_type)}
                                onValueChange={(value) => {
                                  setOtherExpenses(prev =>
                                    prev.map(r =>
                                      r.id === row.id ? { ...r, expense_type: value } : r
                                    )
                                  );
                                }}
                              >
                                <SelectTrigger className={errors[`items.${itemIndex}.expense_type`] ? 'border-destructive' : ''}>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseTypes.map((e: any) => (
                                    <SelectItem key={e.id} value={String(e.id)}>
                                      {e.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>

                            <TableCell>
                              <Input
                                type="date"
                                value={row.expense_date}
                                onChange={(e) =>
                                  setOtherExpenses(prev =>
                                    prev.map(r =>
                                      r.id === row.id ? { ...r, expense_date: e.target.value } : r
                                    )
                                  )
                                }
                                className={errors[`items.${itemIndex}.expense_date`] ? 'border-destructive' : ''}
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                type="number"
                                value={row.distance_km}
                                onChange={(e) =>
                                  setOtherExpenses(prev =>
                                    prev.map(r =>
                                      r.id === row.id ? { ...r, distance_km: e.target.value } : r
                                    )
                                  )
                                }
                                placeholder="0"
                                className={errors[`items.${itemIndex}.distance_km`] ? 'border-destructive' : ''}
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                type="number"
                                value={row.amount}
                                onChange={(e) =>
                                  setOtherExpenses(prev =>
                                    prev.map(r =>
                                      r.id === row.id ? { ...r, amount: e.target.value } : r
                                    )
                                  )
                                }
                                placeholder="0"
                                className={errors[`items.${itemIndex}.amount`] ? 'border-destructive' : ''}
                              />
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openUploadModal(row, 'other', index)}
                                  className={!row.receipt_file ? 'border-destructive' : 'border-green-500'}
                                >
                                  <Upload className="h-3 w-3 mr-1" />
                                  {row.receipt_file ? 'Change' : 'Upload'}
                                </Button>
                                {row.receipt_file && (
                                  <span className="text-xs text-green-600 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {row.receipt_file.name}
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <Input
                                value={row.remarks}
                                onChange={(e) =>
                                  setOtherExpenses(prev =>
                                    prev.map(r =>
                                      r.id === row.id ? { ...r, remarks: e.target.value } : r
                                    )
                                  )
                                }
                                placeholder="Optional"
                              />
                            </TableCell>

                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteOtherExpense(row.id)}
                                className="text-destructive hover:text-destructive hover:bg-red-50 rounded"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>

            {/* ACTION BUTTONS */}
            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={handleValidate}
                disabled={loading}
              >
                {loading ? 'Validating...' : 'Validate Claim'}
              </Button>
            </div>
          </>
        )}
      </main>

      {/* FILE UPLOAD MODAL */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Receipt/Bill
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-primary hover:text-primary/80 font-medium">
                  Click to upload
                </span>
                <span className="text-muted-foreground"> or drag and drop</span>
              </label>
              <Input
                id="file-upload"
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
              />
              <p className="text-xs text-muted-foreground mt-2">
                PDF, JPG, PNG up to 10MB
              </p>
            </div>

            {currentUploadItem?.type === 'other' && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Receipt is mandatory for additional expenses
                </AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* VALIDATION MODAL */}
      <Dialog open={validationModalOpen} onOpenChange={setValidationModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {validationResult?.success ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-green-600">Validation Successful</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="text-red-600">Validation Failed</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {validationResult?.errors && Object.keys(validationResult.errors).length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <pre className="whitespace-pre-wrap text-xs">
                    {JSON.stringify(validationResult.errors, null, 2)}
                  </pre>
                </AlertDescription>
              </Alert>
            )}

            {validationResult?.data?.warnings && Object.keys(validationResult.data.warnings).length > 0 && (
              <Alert className="border-yellow-500 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <strong>Warnings:</strong>
                  <ul className="mt-2 list-disc list-inside text-sm">
                    {Object.values(validationResult.data.warnings).flat().map((w: any, idx: number) => (
                      <li key={idx}>{w.message || w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validationResult?.success && (
              <div className="space-y-6">
                {/* DA Breakdown */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">Daily Allowance Breakdown</h3>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Date</th>
                          <th className="text-center px-4 py-2 font-medium">Duration (hrs)</th>
                          <th className="text-center px-4 py-2 font-medium">DA</th>
                          <th className="text-right px-4 py-2 font-medium">Incidental</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {validationResult.data.computed.da_breakdown.map((day, index: number) => (
                          <tr key={index}>
                            <td className="px-4 py-2">{formatDate(day.date)}</td>
                            <td className="px-4 py-2 text-center">{day.duration_hours}</td>
                            <td className="px-4 py-2 text-center font-medium">{formatCurrency(day.da)}</td>
                            <td className="px-4 py-2 text-right font-medium">{formatCurrency(day.incidental)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">Claim Summary</h3>
                  <div className="border border-border rounded-lg divide-y divide-border">
                    <div className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-foreground">Total DA</span>
                      <span className="font-medium">{formatCurrency(validationResult.data.computed.total_da)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-foreground">Total Incidental</span>
                      <span className="font-medium">{formatCurrency(validationResult.data.computed.total_incidental)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-foreground">Total Expenses</span>
                      <span className="font-medium">{formatCurrency(validationResult.data.computed.total_expenses)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 text-sm bg-muted">
                      <span className="text-foreground">Gross Total</span>
                      <span className="font-semibold">{formatCurrency(validationResult.data.computed.gross_total)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-foreground">Advance Received</span>
                      <span className="font-medium text-warning text-red-600">-{formatCurrency(validationResult.data.computed.advance_received)}</span>
                    </div>
                    <div className="px-4 py-3 bg-primary/5">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-foreground">Final Amount</span>

                        <span
                          className={`text-lg font-bold ${Number(validationResult.data.computed.final_amount) < 0
                            ? "text-red-600"
                            : "text-green-600"
                            }`}
                        >
                          {formatCurrency(validationResult.data.computed.final_amount)}
                        </span>
                      </div>

                      {/* User-friendly info message */}
                      <p
                        className={`text-xs mt-1 text-right ${Number(validationResult.data.computed.final_amount) < 0
                          ? "text-red-600"
                          : "text-green-600"
                          }`}
                      >
                        {Number(validationResult.data.computed.final_amount) < 0
                          ? "The amount will be recovered from you."
                          : "The amount is payable to you."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <Button variant="outline" className="hover:bg-slate-50 hover:text-foreground uppercase" onClick={() => setValidationModalOpen(false)}>
                    Review & Edit
                  </Button>
                  <Button onClick={handleSubmit} className="uppercase" disabled={loading}>
                    {loading ? 'Submitting...' : 'Submit Claim'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}