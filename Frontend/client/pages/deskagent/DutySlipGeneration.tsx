import React, { useState } from "react";
import { Search, FileText, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { travelDeskAPI } from "@/src/api/travel-desk";
import { formatDateToDDMMYYYY } from "./utils/format";

export default function DutySlipGeneration() {
  const [trId, setTrId] = useState("");
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Valid modes for frontend filtering feedback (though backend enforces it too)
  const VALID_MODES = [
    "Pick-up and Drop",
    "Car at Disposal",
    "Goods Carriage",
    "BUS/Tempo Traveller",
  ];

  const handleSearch = async () => {
    if (!trId.trim()) {
      toast.error("Please enter a Travel Request ID");
      return;
    }

    setLoading(true);
    setSearched(true);
    setBookings([]);

    try {
      const response = await travelDeskAPI.applications.list({ search: trId });

      if (response.data && response.data.length > 0) {
        // Find the exact match or close match
        const app =
          response.data.find((a: any) => a.travel_request_id === trId) ||
          response.data[0];

        // Now fetch details to get bookings
        const detailResponse = await travelDeskAPI.applications.detail(app.id);
        if (detailResponse.success && detailResponse.data) {
          // The serializer maps trip_details to "trips"
          const allBookings = (detailResponse.data.trips || []).flatMap(
            (trip: any) => trip.bookings,
          );

          // Filter for "Conveyance" (Car, Bus, etc.)
          // And specifically the valid modes for duty slip
          const conveyanceBookings = allBookings.filter((b: any) => {
            // Basic check if it's likely a vehicle
            const isVehicle = ["Car", "Bus", "Taxi", "Cab"].some(
              (k) =>
                b.booking_type_name.includes(k) ||
                b.booking_type_name.includes("Pick-up"),
            );
            // Strict check against valid list
            const isValidMode = VALID_MODES.some(
              (m) =>
                b.booking_type_name.includes(m) ||
                m.includes(b.booking_type_name),
            );

            return isVehicle || isValidMode;
          });

          setBookings(conveyanceBookings);

          if (conveyanceBookings.length === 0) {
            toast.info("No conveyance bookings found for this Travel Request.");
          }
        }
      } else {
        toast.error("Travel Request not found.");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Travel Request ID is not valid.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (bookingId: number) => {
    try {
      toast.loading("Generating Duty Slip...");
      const response = await travelDeskAPI.bookings.downloadDutySlip(bookingId);

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `DutySlip_${bookingId}.pdf`); // or get from content-disposition
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.dismiss();
      toast.success("Duty Slip downloaded successfully");
    } catch (error) {
      toast.dismiss();
      console.error("Download error:", error);
      toast.error(
        "Failed to generate Duty Slip. Ensure the booking type is valid.",
      );
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Generate Vehicle Duty Slip
        </h1>
        <p className="text-muted-foreground">
          Search for a Travel Request ID to generate duty slips for conveyance
          bookings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search Travel Request</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 max-w-xl">
            <Input
              placeholder="Enter Travel Request ID (e.g., TR/2025/12345)"
              value={trId}
              onChange={(e) => setTrId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? (
                <div className="animate-spin mr-2">C</div>
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {searched && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Bookings Found ({bookings.length})</span>
              {bookings.length === 0 && !loading && (
                <span className="text-sm font-normal text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> No eligible bookings
                  matches criteria
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Sub-Option</TableHead>
                    <TableHead>Route / Details</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">
                        #{booking.id}
                      </TableCell>
                      <TableCell>{booking.booking_type_name}</TableCell>
                      <TableCell>
                        <StatusBadge
                          statusType="booking"
                          variant="rounded"
                          status={booking.sub_option_name}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {booking.booking_details?.from_location_name}
                          {booking.booking_details?.to_location_name
                            ? ` → ${booking.booking_details.to_location_name}`
                            : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {booking.booking_details?.vehicle_model}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDateToDDMMYYYY(
                          booking.booking_details?.start_date ||
                            booking.created_at,
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          statusType="booking"
                          variant="rounded"
                          status={booking.status}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleGenerate(booking.id)}
                        >
                          <Download className="w-4 h-4" />
                          Generate Duty Slip
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              !loading && (
                <div className="p-8 text-center text-muted-foreground">
                  No conveyance bookings found.
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
