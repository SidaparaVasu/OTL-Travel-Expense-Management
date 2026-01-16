import React, { useState, useEffect } from 'react';
import { X, Star } from 'lucide-react';
import { toast } from "sonner";
import { accommodationAPI } from "@/src/api/master_accommodation";

const ARCHotelDetailModal = ({ hotelId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hotelId) fetchHotelData();
  }, [hotelId]);

  const fetchHotelData = async () => {
    try {
      setLoading(true);
      const response = await accommodationAPI.arcHotel.get(hotelId);
      setData(response.data.data);
      setLoading(false);
      
      // Mock data
      // setTimeout(() => {
      //   setData({
      //     id: hotelId,
      //     name: 'Taj Mahal Palace',
      //     hotel_type: 'resort',
      //     star_rating: 5,
      //     group_name: 'Taj Hotels',
      //     category: '5_star',
      //     is_active: true,
      //     gstin: '27AABCT1332L1ZK',
      //     pan: 'AABCT1332L',
      //     operating_since: 1903,
      //     address: 'Apollo Bunder, Colaba',
      //     city_name: 'Mumbai',
      //     state_name: 'Maharashtra',
      //     country_name: 'India',
      //     postal_code: '400001',
      //     phone_number: '+91 22 6665 3366',
      //     email: 'reservations@tajhotels.com',
      //     website: 'https://www.tajhotels.com',
      //     social_media: {
      //       Facebook: 'https://facebook.com/tajhotels',
      //       Instagram: 'https://instagram.com/tajhotels'
      //     },
      //     total_rooms: 285,
      //     room_types: [
      //       { type: 'Deluxe Room', count: 100 },
      //       { type: 'Palace Room', count: 85 },
      //       { type: 'Grand Presidential Suite', count: 10 }
      //     ],
      //     check_in_time: '14:00',
      //     check_out_time: '12:00',
      //     facilities: {
      //       'Swimming Pool': true,
      //       'Gym': true,
      //       'Spa': true,
      //       'Restaurant': true,
      //       'Bar': true,
      //       'Room Service': true,
      //       'WiFi': true,
      //       'Parking': true,
      //       'Conference Hall': true,
      //       'Business Center': true
      //     },
      //     rate_per_night: 15000.00,
      //     tax_percentage: 12.00,
      //     contract_start_date: '2024-01-01',
      //     contract_end_date: '2024-12-31',
      //     created_at: '2024-01-01T10:00:00Z',
      //     updated_at: '2024-01-15T14:30:00Z'
      //   });
      //   setLoading(false);
      // }, 500);
    } catch (error) {
      console.error('Error fetching hotel:', error);
      toast.error("Failed to load hotel details");
      setLoading(false);
      onClose();
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 shadow-lg">
          <div className="animate-spin border-b-2 border-blue-500 rounded-full h-10 w-10 mx-auto"></div>
          <p className="mt-3 text-gray-600">Loading details...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const renderStatus = (status) =>
    status ? (
      <span className="text-green-700 font-medium">Active</span>
    ) : (
      <span className="text-red-700 font-medium">Inactive</span>
    );

  const getContractStatus = () => {
    const today = new Date();
    const start = new Date(data.contract_start_date);
    const end = new Date(data.contract_end_date);
    
    if (today >= start && today <= end) {
      return <span className="text-green-700 font-medium">Valid</span>;
    }
    return <span className="text-red-700 font-medium">Expired</span>;
  };

  const calculateTotalRate = () => {
    const taxAmount = (parseFloat(data.rate_per_night) * parseFloat(data.tax_percentage)) / 100;
    const total = parseFloat(data.rate_per_night) + taxAmount;
    return total.toFixed(2);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-end bg-black bg-opacity-50 z-50">
      <div className="bg-white w-[100%] max-w-6xl shadow-2xl border border-gray-200 p-6 max-h-screen overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-5 text-gray-600 hover:text-gray-900"
        >
          <X size={20} />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            ARC Hotel Details
          </h2>
          <p className="text-sm text-gray-600">
            Detailed information about selected hotel
          </p>
        </div>

        {/* Basic Info */}
        <SectionTable
          title="Basic Information"
          headers={["Name", "Hotel Type", "Star Rating", "Group Name", "Category", "Status"]}
          row={[
            data.name || "-",
            data.hotel_type?.replace('_', ' ') || "-",
            data.star_rating ? (
              <div className="flex items-center gap-1">
                <Star size={14} className="text-yellow-500" fill="currentColor" />
                <span>{data.star_rating} Star</span>
              </div>
            ) : "-",
            data.group_name || "-",
            data.category?.replace('_', ' ') || "-",
            renderStatus(data.is_active)
          ]}
        />

        {/* Registration */}
        <SectionTable
          title="Registration Details"
          headers={["GSTIN", "PAN", "Operating Since"]}
          row={[
            data.gstin || "-",
            data.pan || "-",
            data.operating_since ? `${data.operating_since} (${new Date().getFullYear() - data.operating_since} years)` : "-"
          ]}
        />

        {/* Location */}
        <SectionTable
          title="Location"
          headers={["Address", "City", "State", "Country", "Postal Code"]}
          row={[
            data.address || "-",
            data.city_name || "-",
            data.state_name || "-",
            data.country_name || "-",
            data.postal_code || "-"
          ]}
        />

        {/* Contact */}
        <SectionTable
          title="Contact Information"
          headers={["Phone Number", "Email", "Website", "Social Media"]}
          row={[
            data.phone_number || "-",
            data.email || "-",
            data.website ? (
              <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {data.website}
              </a>
            ) : "-",
            data.social_media && Object.keys(data.social_media).length > 0
              ? Object.entries(data.social_media).map(([platform, url]) => (
                  <div key={platform}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {platform}
                    </a>
                  </div>
                ))
              : "-"
          ]}
        />

        {/* Capacity */}
        <SectionTable
          title="Capacity & Timings"
          headers={["Total Rooms", "Room Types", "Check-in Time", "Check-out Time"]}
          row={[
            data.total_rooms || "-",
            data.room_types?.length > 0
              ? data.room_types.map((rt, idx) => (
                  <div key={idx}>{rt.type}: {rt.count} rooms</div>
                ))
              : "-",
            data.check_in_time || "-",
            data.check_out_time || "-"
          ]}
        />

        {/* Facilities */}
        <SectionTable
          title="Facilities"
          headers={["Available Facilities"]}
          row={[
            data.facilities && Object.keys(data.facilities).filter(key => data.facilities[key]).length > 0
              ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(data.facilities)
                      .filter(([_, value]) => value)
                      .map(([facility]) => (
                        <span key={facility} className="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
                          {facility}
                        </span>
                      ))}
                  </div>
                )
              : "-"
          ]}
        />

        {/* Rate & Contract */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Rate & Contract Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-700">Rate Per Night</th>
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-700">Tax %</th>
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-700">Total Rate (incl. tax)</th>
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-700">Contract Period</th>
                  <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-700">Contract Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-4 py-2 text-gray-800">₹{data.rate_per_night}</td>
                  <td className="border border-gray-300 px-4 py-2 text-gray-800">{data.tax_percentage}%</td>
                  <td className="border border-gray-300 px-4 py-2 text-gray-800 font-medium">₹{calculateTotalRate()}</td>
                  <td className="border border-gray-300 px-4 py-2 text-gray-800">
                    {new Date(data.contract_start_date).toLocaleDateString()} to {new Date(data.contract_end_date).toLocaleDateString()}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-gray-800">{getContractStatus()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Info */}
        <SectionTable
          title="Audit Information"
          headers={["Created At", "Last Updated"]}
          row={[
            data.created_at ? new Date(data.created_at).toLocaleString() : "-",
            data.updated_at ? new Date(data.updated_at).toLocaleString() : "-"
          ]}
        />

        {/* Close Button */}
        <div className="mt-6 flex justify-end">
          <button onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Section Table Component
const SectionTable = ({ title, headers, row }) => (
  <div className="mb-6">
    <h3 className="text-lg font-medium text-gray-700 mb-2">{title}</h3>
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300 text-sm">
        <thead>
          <tr className="bg-gray-100">
            {headers.map((h, idx) => (
              <th
                key={idx}
                className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-700"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {row.map((val, idx) => (
              <td
                key={idx}
                className="border border-gray-300 px-4 py-2 text-gray-800"
              >
                {val}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

export default ARCHotelDetailModal;