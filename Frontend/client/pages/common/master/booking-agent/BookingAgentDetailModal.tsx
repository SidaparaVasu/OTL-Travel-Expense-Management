import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AgentAnalyticsDetail,
  AgentRecentBooking,
} from "@/src/types/travel-desk.types";
import { travelDeskAPI } from "@/src/api/travel-desk";
import {
  User,
  Phone,
  Mail,
  Building2,
  MapPin,
  Clock,
  CheckCircle2,
  Briefcase,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/StatusBadge";

interface BookingAgentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: number | null;
}

const StatCard = ({ icon: Icon, label, value, subtext }: any) => (
  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
    <div className="flex items-center gap-3 mb-2">
      <div className="p-2 bg-white rounded-full shadow-sm">
        <Icon className="w-4 h-4 text-blue-600" />
      </div>
      <span className="text-sm text-slate-500 font-medium">{label}</span>
    </div>
    <div className="text-2xl font-bold text-slate-800">{value}</div>
    {subtext && <div className="text-xs text-slate-400 mt-1">{subtext}</div>}
  </div>
);

export const BookingAgentDetailModal: React.FC<
  BookingAgentDetailModalProps
> = ({ isOpen, onClose, agentId }) => {
  const [data, setData] = useState<{
    agent: AgentAnalyticsDetail;
    recent_bookings: AgentRecentBooking[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && agentId) {
      loadData();
    } else {
      setData(null);
    }
  }, [isOpen, agentId]);

  const loadData = async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const response = await travelDeskAPI.analytics.agents.detail(agentId);
      setData(response as any); // Type assertion if API response structure varies slightly
    } catch (error) {
      console.error("Failed to load agent details", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Booking Agent Details</DialogTitle>
        </DialogHeader>

        <Separator />

        {loading ? (
          <div className="flex justify-center py-12">Loading...</div>
        ) : data ? (
          <div className="space-y-8">
            {/* Header / Profile Info */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium tracking-wider">
                        {data.agent.organization_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-medium font-bold text-slate-800">
                        {data.agent.first_name} {data.agent.last_name}
                      </h2>
                      <span className="text-slate-400">
                        @{data.agent.username}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span className="text-slate-500">Email:</span>
                    {data.agent.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-blue-600" />
                    <span className="text-slate-500">Contact:</span>
                    {data.agent.phone || "N/A"}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span className="text-slate-500">Address:</span>
                    {data.agent.address || "No address provided"}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span className="text-slate-500">Generic Contact:</span>
                    {data.agent.contact_person || "N/A"}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={Briefcase}
                label="Active"
                value={data.agent.active_bookings}
                subtext="Current workload"
              />
              <StatCard
                icon={CheckCircle2}
                label="Completed"
                value={data.agent.completed_bookings}
                subtext="Lifetime bookings"
              />
              <StatCard
                icon={Clock}
                label="Avg Response"
                value={`${data.agent.avg_response_time}h`}
                subtext="Assignment to Accept"
              />
              <StatCard
                icon={Briefcase}
                label="Today"
                value={data.agent.today_assignments}
                subtext="New assignments"
              />
            </div>

            {/* Recent Bookings Table */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                Recent Bookings
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-medium">Trip ID</th>
                      <th className="px-4 py-3 font-medium">Employee</th>
                      <th className="px-4 py-3 font-medium">Booking</th>
                      <th className="px-4 py-3 font-medium">Route</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recent_bookings.length > 0 ? (
                      data.recent_bookings.map((booking) => (
                        <tr key={booking.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-medium text-blue-600">
                            {booking.trip_id}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {booking.employee_name}
                          </td>
                          <td className="flex items-center px-4 py-3 gap-1">
                            <span className="font-medium text-slate-700">
                              {booking.booking_type}
                            </span>
                            <span className="text-slate-600">
                              ({booking.sub_option || ""})
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {booking.from_loc} → {booking.to_loc}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {booking.travel_date}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              variant="rounded"
                              status={booking.status}
                              statusType="booking"
                              className="font-normal"
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-8 text-center text-slate-400"
                        >
                          No recent bookings found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500">No data found</div>
        )}
      </DialogContent>
    </Dialog>
  );
};
