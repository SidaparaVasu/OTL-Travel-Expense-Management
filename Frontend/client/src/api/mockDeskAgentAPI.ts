/**
 * MOCK API for Desk Agent Dashboard
 *
 * - Works fully offline (localStorage persistence)
 * - Matches backend structure we discussed
 * - Simulates network delay for realism
 * - Covers:
 *    • getPendingRequests()
 *    • getRecentBookings()
 *    • approveRequest(id)
 *    • rejectRequest(id, reason)
 */

const LS_KEY_PENDING = "mock_pending_requests";
const LS_KEY_RECENT = "mock_recent_bookings";

// Simulate network latency
const delay = (ms = 600) => new Promise((res) => setTimeout(res, ms));

// Seed mock data if not exists
function seed() {
  if (!localStorage.getItem(LS_KEY_PENDING)) {
    const sample = [
      {
        id: 101,
        application_id: "TR/TSF/2025/0000101",
        employee_name: "Rohan Gupta",
        purpose: "Client Visit – Delhi",
        from_location: "Jamshedpur",
        to_location: "New Delhi",
        travel_mode: "Flight",
        departure_date: "2025-02-05T09:30:00Z",
        approved_date: "2025-02-01T14:20:00Z",
        status: "approved_by_manager",
      },
      {
        id: 102,
        application_id: "TR/TSF/2025/0000102",
        employee_name: "Sneha Patel",
        purpose: "CSR Site Audit",
        from_location: "Ranchi",
        to_location: "Jamshedpur",
        travel_mode: "Car",
        departure_date: "2025-02-03T07:00:00Z",
        approved_date: "2025-02-02T10:00:00Z",
        status: "approved_by_manager",
      },
      {
        id: 103,
        application_id: "TR/TSF/2025/0000103",
        employee_name: "Arjun Mehta",
        purpose: "Training Workshop",
        from_location: "Kolkata",
        to_location: "Jamshedpur",
        travel_mode: "Train",
        departure_date: "2025-02-06T06:00:00Z",
        approved_date: "2025-02-03T11:00:00Z",
        status: "approved_by_manager",
      },
    ];
    localStorage.setItem(LS_KEY_PENDING, JSON.stringify(sample));
  }

  if (!localStorage.getItem(LS_KEY_RECENT)) {
    const recent = [
      {
        id: 1,
        application_id: "TR/TSF/2025/0000088",
        employee_name: "Amit Sharma",
        booking_type: "Flight Booking",
        vendor: "Eastern Travels",
      },
      {
        id: 2,
        application_id: "TR/TSF/2025/0000090",
        employee_name: "Kavita Rao",
        booking_type: "Hotel Booking",
        vendor: "Clarks Inn",
      },
    ];
    localStorage.setItem(LS_KEY_RECENT, JSON.stringify(recent));
  }
}

seed(); // initialize once

// Utility: read + write
const read = (key: string) => JSON.parse(localStorage.getItem(key) || "[]");
const write = (key: string, data: any) =>
  localStorage.setItem(key, JSON.stringify(data));

export const mockDeskAgentAPI = {
  /** GET: Pending requests */
  async getPendingRequests() {
    await delay();
    const items = read(LS_KEY_PENDING);
    return {
      data: {
        results: items,
      },
    };
  },

  /** GET: Recent bookings */
  async getRecentBookings() {
    await delay();
    const items = read(LS_KEY_RECENT);
    return {
      data: {
        results: items,
      },
    };
  },

  /** POST: Approve → Send to booking */
  async approveRequest(id: number) {
    await delay(500);

    const pending = read(LS_KEY_PENDING);
    const item = pending.find((x: any) => x.id === id);
    if (!item) throw new Error("Not found");

    // Remove from pending list
    const updated = pending.filter((x: any) => x.id !== id);
    write(LS_KEY_PENDING, updated);

    // Add to recent bookings
    const recent = read(LS_KEY_RECENT);
    recent.unshift({
      id,
      application_id: item.application_id,
      employee_name: item.employee_name,
      booking_type: `${item.travel_mode} Booking`,
      vendor: "Eastern Travels",
    });
    write(LS_KEY_RECENT, recent);

    return {
      data: {
        success: true,
        message: "Assigned to booking",
      },
    };
  },

  /** POST: Reject request */
  async rejectRequest(id: number, reason: string) {
    await delay(600);

    const pending = read(LS_KEY_PENDING);
    const item = pending.find((x: any) => x.id === id);
    if (!item) throw new Error("Not found");

    // Remove from pending
    const updated = pending.filter((x: any) => x.id !== id);
    write(LS_KEY_PENDING, updated);

    // Optionally store rejected logs if needed
    console.log("REJECTED_TR:", {
      id,
      application_id: item.application_id,
      employee: item.employee_name,
      reason,
      timestamp: new Date().toISOString(),
    });

    return {
      data: {
        success: true,
        message: "Travel Request rejected",
      },
    };
  },
};
