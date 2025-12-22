import React, { useMemo } from "react";
import { Wallet } from "lucide-react";

interface AdvanceSectionProps {
  ticketing: { estimated_cost: string | number }[];
  accommodation: { estimated_cost: string | number }[];
  conveyance: { estimated_cost: string | number }[];
  otherExpenses?: number;
}

export const AdvanceSection: React.FC<AdvanceSectionProps> = ({
  ticketing,
  accommodation,
  conveyance,
  otherExpenses = 0,
}) => {
  const sums = useMemo(() => {
    const ticketSum = ticketing.reduce((s, t) => s + Number(t.estimated_cost || 0), 0);
    const accSum = accommodation.reduce((s, a) => s + Number(a.estimated_cost || 0), 0);
    const convSum = conveyance.reduce((s, c) => s + Number(c.estimated_cost || 0), 0);
    return { ticketSum, accSum, convSum };
  }, [ticketing, accommodation, conveyance]);

  const totalAdvance = useMemo(() => {
    return sums.ticketSum + sums.accSum + sums.convSum + Number(otherExpenses || 0);
  }, [sums, otherExpenses]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Travel Estimated Summary</h2>
          <p className="text-sm text-muted-foreground">Review and finalize your travel advance request</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Expense Breakdown</h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-primary/20">
              <span className="text-muted-foreground">Flight & Train Tickets</span>
              <span className="font-semibold text-foreground">₹{sums.ticketSum.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-primary/20">
              <span className="text-muted-foreground">Accommodation</span>
              <span className="font-semibold text-foreground">₹{sums.accSum.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-primary/20">
              <span className="text-muted-foreground">Local Conveyance</span>
              <span className="font-semibold text-foreground">₹{sums.convSum.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-primary/20">
              <span className="text-muted-foreground">Other Expenses</span>
              <span className="font-semibold text-foreground">₹{Number(otherExpenses || 0).toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between items-center pt-4 mt-2">
              <span className="text-lg font-bold text-foreground">Total Estimated Amount</span>
              <span className="text-2xl font-bold text-primary">₹{totalAdvance.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Important Notes</h3>

          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <p>This advance will be adjusted against actual expenses after trip completion</p>
            </div>

            <div className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <p>Submit all original bills and receipts within 30 days of return</p>
            </div>

            <div className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <p>Excess advance must be refunded within 10 days</p>
            </div>

            <div className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <p>Additional approvals may be required based on amount and travel policy</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/30 dark:border-amber-900">
            <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
              <strong>Note:</strong> Ensure all bookings comply with company travel policy before submission.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
