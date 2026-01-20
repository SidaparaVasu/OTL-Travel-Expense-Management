import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Upload, 
  Eye, 
  X, 
  FileText, 
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { expenseAPI } from '@/src/api/expense';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import type { ClaimableApp, ExpenseItem, ExpenseType, DABreakdown } from '@/src/types/expense-2.types';

export default function CreateExpenseClaim() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [claimableApps, setClaimableApps] = useState<ClaimableApp[]>([]);
  const [selectedApp, setSelectedApp] = useState<ClaimableApp | null>(null);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [claimItems, setClaimItems] = useState<ExpenseItem[]>([]);
  const [additionalExpenses, setAdditionalExpenses] = useState<ExpenseItem[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationData, setValidationData] = useState<any>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedApp && selectedApp.bookings) {
      const items: ExpenseItem[] = selectedApp.bookings.map((booking) => ({
        booking_id: booking.id,
        expense_type: booking.booking_type,
        estimated_cost: booking.estimated_cost,
        actual_cost: booking.estimated_cost,
        has_receipt: false,
        receipt_file: undefined,
        remarks: '',
      }));
      setClaimItems(items);
    }
  }, [selectedApp]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [appsData, typesData] = await Promise.all([
        expenseAPI.claimableApps.getAll(),
        expenseAPI.expenseTypes.getAll(),
      ]);
      setClaimableApps(appsData.data || appsData);
      setExpenseTypes(typesData || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!selectedApp) {
      toast({
        title: 'Error',
        description: 'Please select a travel application',
        variant: 'destructive',
      });
      return;
    }

    const allItems = [...claimItems, ...additionalExpenses];
    
    // Validation
    const hasEmptyActualCost = allItems.some(item => !item.actual_cost || item.actual_cost <= 0);
    if (hasEmptyActualCost) {
      toast({
        title: 'Validation Error',
        description: 'Please enter valid actual costs for all items',
        variant: 'destructive',
      });
      return;
    }

    setValidating(true);
    try {
      const payload = {
        travel_application: selectedApp.id,
        items: allItems.map(item => ({
          expense_type: item.expense_type,
          booking_id: item.booking_id,
          estimated_cost: item.estimated_cost,
          actual_cost: item.actual_cost,
          has_receipt: item.has_receipt,
          remarks: item.remarks,
          expense_date: item.expense_date,
        })),
      };

      const response = await expenseAPI.claims.validate(payload);
      
      if (response.success && Object.keys(response.data.errors).length === 0) {
        setValidationData(response.data);
        setShowValidationModal(true);
      } else {
        // Show errors
        const errorMessages = Object.entries(response.data.errors).map(([key, value]) => `${key}: ${value}`).join('\n');
        toast({
          title: 'Validation Failed',
          description: errorMessages || 'Please check your entries',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Validation Error',
        description: error.response?.data?.message || 'Failed to validate claim',
        variant: 'destructive',
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedApp) return;

    setLoading(true);
    try {
      const allItems = [...claimItems, ...additionalExpenses];
      const payload = {
        travel_application: selectedApp.id,
        items: allItems.map(item => ({
          expense_type: item.expense_type,
          booking_id: item.booking_id,
          estimated_cost: item.estimated_cost,
          actual_cost: item.actual_cost,
          has_receipt: item.has_receipt,
          remarks: item.remarks,
          expense_date: item.expense_date,
        })),
      };

      await expenseAPI.claims.create(payload);
      toast({
        title: 'Success',
        description: 'Expense claim submitted successfully',
      });
      navigate('/claims');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit claim. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setShowValidationModal(false);
    }
  };

  const addAdditionalExpense = () => {
    setAdditionalExpenses([
      ...additionalExpenses,
      {
        expense_type: '',
        estimated_cost: 0,
        actual_cost: 0,
        has_receipt: false,
        remarks: '',
        expense_date: new Date().toISOString().split('T')[0],
      },
    ]);
  };

  const removeAdditionalExpense = (index: number) => {
    setAdditionalExpenses(additionalExpenses.filter((_, i) => i !== index));
  };

  const updateClaimItem = (index: number, field: keyof ExpenseItem, value: any) => {
    const updated = [...claimItems];
    updated[index] = { ...updated[index], [field]: value };
    setClaimItems(updated);
  };

  const updateAdditionalExpense = (index: number, field: keyof ExpenseItem, value: any) => {
    const updated = [...additionalExpenses];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalExpenses(updated);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return ""; 
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
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
              className="text-muted-foreground hover:text-foreground"
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

      <main className="container mx-auto px-6 py-8 max-w-6xl">
        {/* Select Application */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <FileText className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h2 className="text-base font-medium text-foreground mb-1">
                Select Completed Travel Application
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose an approved travel request to create expense claims
              </p>
            </div>
          </div>

          <Select
            value={selectedApp?.id.toString()}
            onValueChange={(value) => {
              const app = claimableApps.find((a) => a.id.toString() === value);
              setSelectedApp(app || null);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a completed travel application" />
            </SelectTrigger>
            <SelectContent>
              {claimableApps.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No claimable applications found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Complete a travel application first
                  </p>
                </div>
              ) : (
                claimableApps.map((app) => (
                  <SelectItem key={app.id} value={app.id.toString()}>
                    {app.travel_request_id} - {app.trip_details.from_location_name} → {app.trip_details.to_location_name} ({formatDate(app.trip_details.departure_date)})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Travel Summary */}
        {selectedApp && (
          <>
            <div className="bg-card border border-border rounded-lg p-6 mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Travel Application Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Request ID:</span>
                  <p className="font-medium text-foreground">{selectedApp.travel_request_id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Travel Dates:</span>
                  <p className="font-medium text-foreground">
                    {formatDate(selectedApp.departure_date)} → {formatDate(selectedApp.return_date)} ({selectedApp.total_days} days)
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Route:</span>
                  <p className="font-medium text-foreground">
                    {selectedApp.from_location} → {selectedApp.to_location}
                  </p>
                </div>
              </div>
            </div>

            {/* Booking Items */}
            <div className="bg-card border border-border rounded-lg p-6 mb-6">
              <h3 className="text-base font-medium text-foreground mb-4">Claim Items — Bookings</h3>
              
              <div className="space-y-6">
                {claimItems.map((item, index) => {
                  const booking = selectedApp.bookings?.[index];
                  return (
                    <div key={index} className="border border-border rounded-lg p-4">
                      <div className="bg-muted px-3 py-2 rounded-md mb-4">
                        <p className="text-sm font-medium text-foreground">
                          {booking?.booking_type} | {booking?.from_location} → {booking?.to_location}
                        </p>
                        {booking?.booking_date && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(booking.booking_date)}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-12 gap-4 items-start">
                        <div className="col-span-1 flex items-center justify-center">
                          <span className="text-sm font-medium text-muted-foreground">{index + 1}</span>
                        </div>
                        
                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground block mb-1">Estimated Cost</label>
                          <Input
                            value={formatCurrency(item.estimated_cost)}
                            disabled
                            className="bg-muted"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground block mb-1">Actual Cost *</label>
                          <Input
                            type="number"
                            value={item.actual_cost}
                            onChange={(e) => updateClaimItem(index, 'actual_cost', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </div>

                        <div className="col-span-3">
                          <label className="text-xs text-muted-foreground block mb-2">Receipt</label>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={item.has_receipt}
                              onCheckedChange={(checked) => updateClaimItem(index, 'has_receipt', checked)}
                            />
                            <span className="text-sm">Have receipt?</span>
                          </div>
                          {item.has_receipt && (
                            <div className="flex gap-2 mt-2">
                              <Button variant="outline" size="sm" className="flex-1">
                                <Upload className="h-3 w-3 mr-1" />
                                Upload
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="col-span-4">
                          <label className="text-xs text-muted-foreground block mb-1">Remarks</label>
                          <Textarea
                            value={item.remarks}
                            onChange={(e) => updateClaimItem(index, 'remarks', e.target.value)}
                            placeholder="Add any notes..."
                            rows={2}
                            className="resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Additional Expenses */}
            <div className="bg-card border border-border rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-medium text-foreground">Additional Expenses</h3>
                <Button onClick={addAdditionalExpense} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Expense
                </Button>
              </div>

              {additionalExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No additional expenses added
                </p>
              ) : (
                <div className="space-y-4">
                  {additionalExpenses.map((expense, index) => (
                    <div key={index} className="border border-border rounded-lg p-4">
                      <div className="grid grid-cols-12 gap-4 items-start">
                        <div className="col-span-3">
                          <label className="text-xs text-muted-foreground block mb-1">Expense Type *</label>
                          <Select
                            value={expense.expense_type.toString()}
                            onValueChange={(value) => updateAdditionalExpense(index, 'expense_type', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {expenseTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id.toString()}>
                                  {type.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground block mb-1">Date *</label>
                          <Input
                            type="date"
                            value={expense.expense_date}
                            onChange={(e) => updateAdditionalExpense(index, 'expense_date', e.target.value)}
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground block mb-1">Amount *</label>
                          <Input
                            type="number"
                            value={expense.actual_cost}
                            onChange={(e) => updateAdditionalExpense(index, 'actual_cost', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground block mb-2">Receipt</label>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={expense.has_receipt}
                              onCheckedChange={(checked) => updateAdditionalExpense(index, 'has_receipt', checked)}
                            />
                            <span className="text-sm">Have?</span>
                          </div>
                        </div>

                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground block mb-1">Remarks</label>
                          <Input
                            value={expense.remarks}
                            onChange={(e) => updateAdditionalExpense(index, 'remarks', e.target.value)}
                            placeholder="Notes"
                          />
                        </div>

                        <div className="col-span-1 flex items-end justify-center pb-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAdditionalExpense(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end">
              <Button
                onClick={handleValidate}
                disabled={validating || loading}
                size="lg"
                className="min-w-[200px]"
              >
                {validating ? 'Validating...' : 'Validate Claim'}
              </Button>
            </div>
          </>
        )}
      </main>

      {/* Validation Modal */}
      <Dialog open={showValidationModal} onOpenChange={setShowValidationModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              Validation Successful
            </DialogTitle>
            <DialogDescription>
              Review the computed allowances and final amount before submitting
            </DialogDescription>
          </DialogHeader>

          {validationData && (
            <div className="space-y-6">
              {/* DA Breakdown */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">Daily Allowance Breakdown</h3>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Date</th>
                        <th className="text-right px-4 py-2 font-medium">Duration (hrs)</th>
                        <th className="text-right px-4 py-2 font-medium">DA</th>
                        <th className="text-right px-4 py-2 font-medium">Incidental</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {validationData.computed.da_breakdown.map((day: DABreakdown, index: number) => (
                        <tr key={index}>
                          <td className="px-4 py-2">{formatDate(day.date)}</td>
                          <td className="px-4 py-2 text-right">{day.duration_hours}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatCurrency(day.da)}</td>
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
                    <span className="text-muted-foreground">Total DA</span>
                    <span className="font-medium">{formatCurrency(validationData.computed.total_da)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Total Incidental</span>
                    <span className="font-medium">{formatCurrency(validationData.computed.total_incidental)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Booking(s) Expenses + Other Expenses</span>
                    <span className="font-medium">{formatCurrency(validationData.computed.total_expenses)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Advance Received</span>
                    <span className="font-medium text-warning">-{formatCurrency(validationData.computed.advance_received)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 text-sm bg-muted">
                    <span className="text-muted-foreground">Gross Total</span>
                    <span className="font-semibold">{formatCurrency(validationData.computed.gross_total)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 bg-primary/5">
                    <span className="font-medium text-foreground">Final Amount</span>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(validationData.computed.final_amount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button variant="outline" onClick={() => setShowValidationModal(false)}>
                  Review & Edit
                </Button>
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit Claim'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
