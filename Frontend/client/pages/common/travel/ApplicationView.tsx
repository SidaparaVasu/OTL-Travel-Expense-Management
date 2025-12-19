// ApplicationView.tsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { travelAPI } from "@/lib/api/travel";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/ui/use-toast";
import { useTravelStore } from "@/src/store/travelStore";
import {
  FileText,
  Plane,
  MapPin,
  CalendarDays,
  Home,
  Car,
  Users,
  User,
  SendHorizontal,
  Trash2,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ROUTES } from "@/routes/routes";
import { docViewer } from "@/src/api/document_viewer";

function formatDateToDDMMYYYY(dateStr) {
  if (!dateStr) return "";

  const [year, month, day] = dateStr.split("-");
  return `${day}-${month}-${year}`;
}

const ApplicationView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { submitApplication, deleteApplication } = useTravelStore();

  const [application, setApplication] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(false);

  useEffect(() => {
    if (id) getApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const getApp = async () => {
    try {
      setLoading(true);
      if (!id) return;
      const app = await travelAPI.getApplication(Number(id));
      console.log(app);
      setApplication(app.data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load application");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApplication = async (appId: number) => {
    try {
      await submitApplication(appId);
      toast({
        title: "Success",
        description: "Application submitted successfully",
      });
      await getApp();
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to submit application",
        variant: "destructive",
      });
    }
  };

  const handleDeleteApplication = async (appId: number) => {
    if (!confirm("Are you sure you want to delete this application?")) return;
    try {
      await deleteApplication(appId);
      toast({
        title: "Success",
        description: "Application deleted successfully",
      });
      navigate(ROUTES.travelApplicationList);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete application",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-72">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading application...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      // <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
      // </Layout>
    );
  }

  if (!application) return null;

  return (
    // <Layout>
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <HeaderCard
        application={application}
        onSubmit={() => handleSubmitApplication(application.id)}
        onDelete={() => handleDeleteApplication(application.id)}
      />

      <InfoCard application={application} />

      {application.trip_details?.map((trip: any) => (
        <TripCard
          key={trip.id}
          trip={trip}
          parentPurpose={application.purpose}
          guestHousesMap={createGuestHouseMap(application)}
        />
      ))}
    </div>
    // </Layout>
  );
};

export default ApplicationView;

/* -----------------------------
   Helper to attempt guest house id->name mapping
   (If application includes names in details, it's used; otherwise IDs remain)
   ----------------------------- */
function createGuestHouseMap(application: any) {
  // naive mapping attempt: if application contains guest house list somewhere, expand later
  // For now return empty map — BookingCard attempts to show ID if no name found.
  return new Map<number, string>();
}

/* ==========================
   HeaderCard (Top header with actions)
   ========================== */
const HeaderCard = ({ application, onSubmit, onDelete }: any) => {
  const statusColorClass = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-700 hover:bg-green-200";
      case "pending_manager":
        return "bg-yellow-100 text-yellow-700 hover:bg-yellow-200";
      case "draft":
        return "bg-slate-100 text-slate-700 hover:bg-slate-200";
      default:
        return "bg-blue-100 text-blue-700 hover:bg-blue-200";
    }
  };

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-row justify-between items-start pb-4">
        <div className="flex-1 min-w-0">
          <div className="flex justify-between">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <div className="flex gap-2">
                  <CardTitle className="text-xl font-semibold text-slate-800 truncate">
                    {application.travel_request_id}
                  </CardTitle>

                  <StatusBadge
                    statusType="travel"
                    status={application.status}
                  />
                </div>

                <p className="text-xs text-slate-500">
                  Created on{" "}
                  {new Date(application.created_at).toLocaleDateString(
                    "en-IN",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    },
                  )}{" "}
                  by{" "}
                  <span className="font-medium text-slate-800">
                    {application.employee_name}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex justify-end items-center">
              {!application.is_settled ? (
                <>
                  {application.settlement_due_date !== null && (
                    <>
                      <p className="text-sm">
                        Settlement due date:
                        <span className="font-medium text-slate-800">
                          {" "}
                          {formatDateToDDMMYYYY(
                            application.settlement_due_date,
                          )}
                        </span>
                      </p>
                    </>
                  )}
                </>
              ) : (
                <StatusBadge
                  statusType="booking"
                  status={application.status_code}
                />
              )}
            </div>
          </div>
        </div>

        {application.status === "draft" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onSubmit}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <SendHorizontal className="w-4 h-4 mr-2" />
              Submit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        )}
      </CardHeader>
    </Card>
  );
};

/* ==========================
   InfoCard (Purpose & Basic Info)
   ========================== */
const InfoCard = ({ application }: any) => {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3 border-b bg-slate-50">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" />
          Travel Purpose & Information
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4 space-y-6">
        <div className="p-4 rounded-lg bg-blue-50/60 border border-blue-100">
          <p className="text-xs font-medium text-slate-500">Purpose</p>
          <p className="text-sm text-slate-800 mt-1">
            {application.purpose || "Not specified"}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <InfoItem label="Employee Grade" value={application.employee_grade} />
          <InfoItem label="GL Code" value={application.gl_code_name} />
          <InfoItem label="Internal Order" value={application.internal_order} />
          <InfoItem
            label="Sanction Number"
            value={application.sanction_number || "N/A"}
          />
          <InfoItem
            label="Estimated Total Cost"
            value={`₹${Number(application.estimated_total_cost || 0).toLocaleString("en-IN")}`}
            highlight
          />
          <InfoItem
            label="Advance Amount"
            value={`₹${Number(application.advance_amount || 0).toLocaleString("en-IN")}`}
            highlight
          />
        </div>
      </CardContent>
    </Card>
  );
};

/* InfoItem — small reusable pair */
const InfoItem = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: any;
  highlight?: boolean;
}) => (
  <div>
    <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
    <p
      className={`text-sm ${highlight ? "text-blue-600 font-semibold" : "text-slate-800 font-medium"}`}
    >
      {value ?? "N/A"}
    </p>
  </div>
);

/* ==========================
   TripCard (Collapsible whole-card)
   ========================== */
const TripCard = ({ trip, parentPurpose, guestHousesMap }: any) => {
  const [open, setOpen] = useState(true);

  // Collapse/expand animation variants
  const containerVariants = {
    collapsed: { height: "auto" }, // leaving height auto; content animates separately
    expanded: { height: "auto" },
  };

  const contentVariants = {
    collapsed: { opacity: 0, height: 0, y: -6 },
    expanded: { opacity: 1, height: "auto", y: 0 },
  };

  // group bookings
  const ticketing = (trip.bookings || []).filter((b: any) =>
    /flight|train/i.test(b.booking_type_name || ""),
  );
  const accommodation = (trip.bookings || []).filter((b: any) =>
    /accommodation/i.test(b.booking_type_name || ""),
  );
  const conveyance = (trip.bookings || []).filter((b: any) =>
    /car|conveyance|taxi|pick-up|drop|own|personal/i.test(
      b.booking_type_name || "",
    ),
  );

  return (
    <motion.div
      layout
      initial={false}
      animate={open ? "expanded" : "collapsed"}
      variants={containerVariants}
    >
      <Card className="border-slate-200 shadow-sm mb-2">
        {/* Header clickable — collapses the whole card */}
        <div
          role="button"
          onClick={() => setOpen((v) => !v)}
          className="cursor-pointer select-none"
          aria-expanded={open}
        >
          <CardHeader className="bg-slate-50 border-b py-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-800 truncate">
                    {trip.from_location_name}{" "}
                    <span className="mx-2 text-slate-400">→</span>{" "}
                    {trip.to_location_name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {trip.trip_purpose || parentPurpose || "Not specified"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-md border border-slate-200">
                  <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                  <div className="text-xs text-slate-700 text-right">
                    <p className="font-medium text-slate-800 flex gap-2">
                      {formatShortDate(trip.departure_date)} -{" "}
                      {formatShortDate(trip.return_date)}
                      <p className="text-slate-500">
                        ({trip.duration_days} days)
                      </p>
                    </p>
                  </div>
                </div>

                <div className="ml-2">
                  {open ? (
                    <ChevronUp className="w-5 h-5 text-slate-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-600" />
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              variants={contentVariants}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <CardContent className="pt-5 pb-6">
                <div className="space-y-6">
                  {/* Booking sections rendered in order */}
                  {ticketing.length > 0 && (
                    <BookingSection
                      title="Flight & Train Bookings"
                      icon={Plane}
                      bookings={ticketing}
                      type="ticketing"
                      fromLocationName={trip.from_location_name}
                      toLocationName={trip.to_location_name}
                    />
                  )}
                  {accommodation.length > 0 && (
                    <BookingSection
                      title="Accommodation"
                      icon={Home}
                      bookings={accommodation}
                      type="accommodation"
                      guestHousesMap={guestHousesMap}
                    />
                  )}
                  {conveyance.length > 0 && (
                    <BookingSection
                      title="Local Conveyance"
                      icon={Car}
                      bookings={conveyance}
                      type="conveyance"
                    />
                  )}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};

/* Utility: short date (dd MMM) */
const formatShortDate = (d: string) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return d;
  }
};

/* ==========================
   BookingSection (header + horizontal scroll area)
   - Mobile optimized: horizontal swipe, snap
   - Medium spacing
   ========================== */
const BookingSection = ({
  title,
  icon: Icon,
  bookings,
  type,
  guestHousesMap,
}: any) => {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-blue-600" />
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        <Badge variant="secondary" className="ml-2 text-xs">
          {bookings.length} booking{bookings.length > 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Bookings area: horizontally scrollable on small screens, grid on large */}
      <div className="relative">
        <div className="hidden lg:grid lg:grid-cols-2 gap-4">
          {bookings.map((b: any, i: number) => (
            <BookingCard
              key={b.id ?? i}
              booking={b}
              type={type}
              guestHousesMap={guestHousesMap}
            />
          ))}
        </div>

        {/* Swipeable container for mobile & tablet */}
        <div className="lg:hidden -mx-4 px-4">
          <div className="flex gap-3 overflow-x-auto py-1 snap-x snap-mandatory touch-pan-x">
            {bookings.map((b: any, i: number) => (
              <div
                key={b.id ?? i}
                className="snap-start w-[86%] sm:w-[70%] md:w-[50%]"
              >
                <BookingCard
                  booking={b}
                  type={type}
                  guestHousesMap={guestHousesMap}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ==========================
   BookingCard (compact, medium spacing)
   ========================== */
const BookingCard = ({ booking, type, guestHousesMap }: any) => {
  const details = booking.booking_details || {};

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        {/* Left side: title */}
        <div className="min-w-0">
          <h5 className="text-sm font-semibold text-slate-800 flex flex-col items-left gap-2">
            <span className="truncate">{booking.booking_type_name}</span>
            {booking.sub_option_name && (
              <Badge variant="outline" className="text-xs">
                {booking.sub_option_name}
              </Badge>
            )}
          </h5>

          {booking.booking_reference && (
            <p className="text-xs text-slate-500 mt-1">
              Ref: {booking.booking_reference}
            </p>
          )}
        </div>

        {/* Right side: cost + status badge */}
        <div className="text-right flex flex-col items-end gap-1">
          <p className="text-sm font-semibold text-blue-600">
            ₹{Number(booking.estimated_cost || 0).toLocaleString("en-IN")}
          </p>

          {/* StatusBadge replaces plain text */}
          <StatusBadge statusType="booking" status={booking.status} />
        </div>
      </div>

      {/* Type-specific detail grid */}
      {type === "ticketing" && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <DetailRow
            label="From"
            value={details.from_location_name || details.from_location || "N/A"}
          />
          <DetailRow
            label="To"
            value={details.to_location_name || details.to_location || "N/A"}
          />
          <DetailRow
            label="Departure"
            value={
              `${details.departure_date || ""} ${details.departure_time || ""}`.trim() ||
              "N/A"
            }
          />
          <DetailRow
            label="Arrival"
            value={
              `${details.arrival_date || ""} ${details.arrival_time || ""}`.trim() ||
              "N/A"
            }
          />
          <DetailRow
            label="Meal Preference"
            value={
              details.meal_preference || details.meal_preference_name || "N/A"
            }
          />
        </div>
      )}

      {type === "accommodation" && (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <DetailRow label="Place" value={details.place || "N/A"} />
            <DetailRow
              label="Check-in"
              value={
                `${details.check_in_date || ""} ${details.check_in_time || ""}`.trim() ||
                "N/A"
              }
            />
            <DetailRow
              label="Check-out"
              value={
                `${details.check_out_date || ""} ${details.check_out_time || ""}`.trim() ||
                "N/A"
              }
            />
            <DetailRow label="Status" value={booking.status || "N/A"} />
          </div>

          {/* Guest House Preferences Display Removed */}
          {/* {Array.isArray(details.guest_house_preferences) &&
            details.guest_house_preferences.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs font-medium text-slate-600 mb-2">
                  Guest House Preferences
                </p>

                <div className="flex flex-wrap gap-2">
                  {details.guest_house_preferences.map((pref: any, idx: number) => (
                    <Badge key={idx} className="text-xs">
                      {guestHousesMap?.get(pref) ?? `Preference ${idx + 1}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )} */}
        </>
      )}

      {type === "conveyance" && (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <DetailRow
              label="From"
              value={
                details.from_location_name || details.from_location || "N/A"
              }
            />
            <DetailRow
              label="To"
              value={details.to_location_name || details.to_location || "N/A"}
            />
            <DetailRow label="Report At" value={details.report_at || "N/A"} />
            <DetailRow label="Drop At" value={details.drop_location || "N/A"} />
            <DetailRow
              label="Date & Time"
              value={
                `${details.start_date || ""} ${details.start_time || ""}`.trim() ||
                "N/A"
              }
            />
            <DetailRow
              label="Club Booking"
              value={details.club_booking ? "Yes" : "No"}
            />
          </div>

          {!details.club_booking && details.club_reason && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-600 mb-1">
                Reason for not clubbing
              </p>
              <p className="text-sm text-slate-700">{details.club_reason}</p>
            </div>
          )}

          {booking.guests?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-slate-600" />
                <p className="text-xs font-medium text-slate-600">
                  Guests ({booking.guests.length})
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {booking.guests.map((guest: any, idx: number) => (
                  <Badge
                    key={idx}
                    className={
                      guest.employee_id
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3" />
                      <span className="text-xs">
                        {guest.name}
                        {guest.employee_id ? ` (${guest.employee_id})` : ""}
                      </span>
                    </div>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Special instructions */}
      {booking.special_instruction && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs font-medium text-slate-600 mb-1">
            Special Instructions
          </p>
          <p className="text-sm text-slate-700">
            {booking.special_instruction}
          </p>
        </div>
      )}

      {/* View Document Icon */}
      {booking.booking_file && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => docViewer.onViewFile(booking.booking_file)}
            title="View Document"
            className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 transition"
          >
            <FileText className="w-4 h-4 text-slate-700" />
          </button>
        </div>
      )}
    </div>
  );
};

/* ==========================
   DetailRow small
   ========================== */
const DetailRow = ({ label, value }: { label: string; value: any }) => (
  <div>
    <p className="text-[11px] text-slate-500">{label}</p>
    <p className="text-sm font-medium text-slate-800 capitalize">
      {value ?? "—"}
    </p>
  </div>
);

/* ==========================
   Small helpers
   ========================== */
const capitalize = (s: string = "") =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
