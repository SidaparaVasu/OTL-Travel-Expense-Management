// Formatting utilities for Booking Agent UI

export const formatDateToDDMMYYYY = (dateString: string | null | undefined): string => {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
};

export const formatTime = (timeString: string | null | undefined): string => {
  if (!timeString) return '—';
  return timeString;
};

export const formatDateTime = (dateTimeString: string | null | undefined): string => {
  if (!dateTimeString) return '—';
  try {
    const date = new Date(dateTimeString);
    return `${formatDateToDDMMYYYY(dateTimeString)} at ${date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch {
    return dateTimeString;
  }
};

// export const formatCurrency = (amount: string | number | null | undefined): string => {
//   if (amount === null || amount === undefined || amount === '') return '—';
//   const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
//   if (isNaN(numAmount)) return '—';
//   return `₹${numAmount.toLocaleString('en-IN', {
//     minimumFractionDigits: 0,
//     maximumFractionDigits: 2,
//   })}`;
// };

export function formatCurrency(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return "N/A";
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return "N/A";
  
  return `₹${numAmount.toLocaleString('en-IN')}`;
}

export const formatHours = (hours: number | null | undefined): string => {
  if (hours === null || hours === undefined) return '—';
  return `${hours.toFixed(1)} hrs`;
};

export const getBookingTypeLabel = (type: number): string => {
  const typeMap: Record<number, string> = {
    1: 'Flight',
    2: 'Train',
    3: 'Bus',
    4: 'Taxi',
    5: 'Conveyance',
    6: 'Car Rental',
    7: 'Accommodation',
    8: 'Hotel',
  };
  return typeMap[type] || `Type ${type}`;
};

export const getSubOptionLabel = (subOption: number): string => {
  const subOptionMap: Record<number, string> = {
    1: 'Economy',
    2: 'Business',
    3: 'Sleeper',
    4: 'AC 2-Tier',
    5: 'AC 3-Tier',
    6: 'First Class',
    7: 'Sedan',
    8: 'SUV',
    9: 'Guest House',
    10: 'Hotel',
  };
  return subOptionMap[subOption] || `Option ${subOption}`;
};
