import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User as UserIcon,
  MapPin,
  CreditCard,
  Check,
  Loader,
  Clock,
  CheckCircle,
} from "lucide-react";
import { financeAdvanceAPI } from "@/src/api/finance-advance";
import { ROUTES } from "@/routes/routes";
import { toast } from "sonner";

const AdvanceRequisitionPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [app, setApp] = useState<any>(null);

  // Processing Form State
  const [processedAmount, setProcessedAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("bank_transfer");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (id) fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await financeAdvanceAPI.getAdvanceRequest(id!);
      setApp(data);

      // If already processed, populate form
      if (data.advance_processing) {
        setProcessedAmount(data.advance_processing.processed_amount);
        setPaymentMode(data.advance_processing.payment_mode);
        setReferenceNumber(data.advance_processing.reference_number);
        setRemarks(data.advance_processing.remarks);
      } else {
        // If pending, pre-fill amount
        setProcessedAmount(data.advance_amount);
      }
    } catch (error) {
      console.error("Failed to load request:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!processedAmount || parseFloat(processedAmount) <= 0) {
      toast.success("Please enter a valid processed amount");
      return;
    }

    setSubmitting(true);
    try {
      await financeAdvanceAPI.processAdvance(id!, {
        processed_amount: processedAmount,
        payment_mode: paymentMode,
        reference_number: referenceNumber,
        remarks: remarks,
      });

      toast.success("Advance marked as processed successfully!");
      navigate(ROUTES.advanceWorkspacePage);
    } catch (error) {
      console.error("Failed to process:", error);
      toast.success("Failed to process advance request");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!app)
    return (
      <div className="p-8 text-center text-red-500">Request not found.</div>
    );

  const isReadOnly = !!app.advance_processing;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header / Nav */}
      <div className="bg-white border-b py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(ROUTES.advanceWorkspacePage)}
            className="text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Advance Requisition
            </h1>
            <p className="text-xs text-gray-500">{app.travel_request_id}</p>
          </div>
        </div>
        <div>
          {app.advance_processing ? (
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
              <Check size={14} /> Processed
            </span>
          ) : (
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
              <Clock size={14} /> Pending Action
            </span>
          )}
        </div>
      </div>

      <div className="max-w-full mx-auto p-8 grid grid-cols-1 md:grid-cols-3 gap-6 border rounded-b-lg border-gray-200 bg-neutral-50">
        {/* Left Column: Details (Printable Section) */}
        <div className="md:col-span-2 space-y-6">
          {/* Applicant Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UserIcon size={18} className="text-blue-700" /> Applicant Details
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Name</p>
                <p className="font-medium">
                  {app.employee?.first_name} {app.employee?.last_name}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Employee ID</p>
                <p className="font-medium">{app.employee?.username}</p>{" "}
                {/* Assuming username is ID */}
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="font-medium">
                  {app.employee?.phone_number || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-medium">{app.employee?.email}</p>
              </div>
            </div>
          </div>

          {/* Trip Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-blue-700" /> Trip Summary
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500 block mb-1">Purpose</span>
                <p className="rounded text-gray-800 font-medium">
                  {app.purpose}
                </p>
              </div>
              <div className="flex justify-between border-t pt-3 mt-2">
                <div>
                  <p className="text-gray-500">Applied Date</p>
                  <p className="font-medium">
                    {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500">Status</p>
                  <p className="font-medium capitalize">
                    {app.status.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
              {/* Billing Info */}
              <div className="flex gap-4 border-t pt-3">
                {app.internal_order && (
                  <div>
                    <p className="text-gray-500 text-xs">IO Number</p>
                    <p className="font-medium">{app.internal_order}</p>
                  </div>
                )}
                {app.general_ledger && (
                  <div>
                    <p className="text-gray-500 text-xs">GL Code</p>
                    <p className="font-medium">{app.general_ledger}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Advance Breakdown Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 pb-0 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard size={18} className="text-blue-700" /> Advance
                Breakdown
              </h2>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Booking Category
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Amount Requested
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {app.bookings_breakdown && app.bookings_breakdown.length > 0 ? (
                  app.bookings_breakdown.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {item.type}{" "}
                        {item.sub_option ? `- (${item.sub_option})` : ""}
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        {parseFloat(item.estimated_cost || 0).toLocaleString(
                          "en-IN",
                          {
                            style: "currency",
                            currency: "INR",
                          },
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-6 py-4 text-sm text-center text-gray-400"
                    >
                      No explicit booking advance details found.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50 font-bold">
                <tr>
                  <td className="px-6 py-3 text-left text-sm">
                    Total Requested Advance
                  </td>
                  <td className="px-6 py-3 text-right text-sm text-blue-700">
                    {parseFloat(app.advance_amount).toLocaleString("en-IN", {
                      style: "currency",
                      currency: "INR",
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
            <div className="p-4 text-xs text-gray-400 text-center bg-gray-50 border-t">
              {/* Generated by Travel Expense Pro System */}
            </div>
          </div>
        </div>

        {/* Right Column: Action Panel */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-24">
            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">
              Finance Action
            </h3>

            <form onSubmit={handleProcess} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Processed Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">₹</span>
                  </div>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    disabled={isReadOnly}
                    value={processedAmount}
                    onChange={(e) => setProcessedAmount(e.target.value)}
                    className="pl-7 w-full p-2 border rounded focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Mode
                </label>
                <select
                  className="w-full p-2 border rounded focus:ring-blue-500"
                  disabled={isReadOnly}
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                >
                  <option value="bank_transfer">
                    Bank Transfer (NEFT/RTGS)
                  </option>
                  <option value="cash">Cash</option>
                  <option value="check">Check / DD</option>
                  <option value="corporate_card">Corporate Card</option>
                  <option value="payroll">Payroll Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number / UTR
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. UTR12345678"
                  className="w-full p-2 border rounded focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  disabled={isReadOnly}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  className="w-full p-2 border rounded focus:ring-blue-500"
                  placeholder="Any comments..."
                />
              </div>

              {isReadOnly && app.advance_processing && (
                <div className="mt-4 pt-4 border-t text-xs text-gray-500">
                  <p>
                    Processed by:{" "}
                    {app.advance_processing.processed_by?.first_name ||
                      "Unknown"}{" "}
                  </p>
                  <p>
                    Date:{" "}
                    {new Date(
                      app.advance_processing.processed_at,
                    ).toLocaleString()}
                  </p>
                </div>
              )}

              {!isReadOnly ? (
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors flex justify-center items-center gap-2"
                >
                  {submitting ? (
                    <Loader className="animate-spin" size={16} />
                  ) : (
                    <CheckCircle size={18} />
                  )}
                  Mark as Processed
                </button>
              ) : (
                <div className="bg-gray-100 text-center py-2 rounded text-gray-500 font-medium cursor-not-allowed">
                  Action Completed
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvanceRequisitionPage;
