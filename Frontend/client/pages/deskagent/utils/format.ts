// Date formatting utilities

export function formatDateToDDMMYYYY(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  
  try {
    const [year, month, day] = dateStr.split("-");
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short' 
    });
  } catch {
    return dateStr;
  }
}

export function formatFullDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "—";
  
  try {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return timeStr;
  }
}

export function formatCurrency(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return "N/A";
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return "N/A";
  
  return `₹${numAmount.toLocaleString('en-IN')}`;
}

export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "—";
  
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  
  return `${hours.toFixed(1)} hrs`;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    pending_travel_desk: 'Pending by Travel Desk',
    booking_in_progress: 'Booking in Progress',
    assigned: 'Assigned',
    booked: 'Booked',
    completed: 'Completed',
    cancelled: 'Cancelled',
    approved_by_manager: 'Approved by Manager',
  };
  
  return labels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function getStatusVariant(status: string): 'pending' | 'in-progress' | 'booked' | 'completed' | 'cancelled' | 'default' {
  const variants: Record<string, 'pending' | 'in-progress' | 'booked' | 'completed' | 'cancelled'> = {
    pending: 'pending',
    pending_travel_desk: 'pending',
    booking_in_progress: 'in-progress',
    assigned: 'in-progress',
    booked: 'booked',
    completed: 'completed',
    cancelled: 'cancelled',
  };
  
  return variants[status] || 'default';
}
