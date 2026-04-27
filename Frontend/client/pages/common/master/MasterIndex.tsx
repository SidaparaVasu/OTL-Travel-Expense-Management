import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  MapPin,
  Award,
  Plane,
  Home,
  CheckCircle2,
  Users,
  ChevronRight,
  IndianRupeeIcon,
  Car,
} from "lucide-react";
import { ROUTES } from "@/routes/routes";

// Master settings configuration — display order / priority driven
const MASTER_CATEGORIES = [
  {
    id: "company",
    title: "Company",
    icon: Building2,
    items: [
      { id: "company-info", title: "Company Information", route: ROUTES.orgMaster },
      { id: "department", title: "Department", route: ROUTES.orgMaster },
      { id: "designation", title: "Designation", route: ROUTES.orgMaster },
      { id: "employee-type", title: "Employee Type", route: ROUTES.employeeTypeMaster },
      { id: "location", title: "Unit Location", route: ROUTES.locationMaster },
    ],
  },
  {
    id: "geography",
    title: "Geography",
    icon: MapPin,
    items: [
      { id: "city-category", title: "City Category", route: ROUTES.cityCategoryMaster },
      { id: "city", title: "City, State, Country", route: ROUTES.geographyMaster },
    ],
  },
  {
    id: "grades",
    title: "Grades",
    icon: Award,
    items: [{ id: "grade", title: "Grade", route: "/masters/grade" }],
  },
  {
    id: "travel",
    title: "Travel",
    icon: Plane,
    items: [
      { id: "gl-code", title: "GL Code", route: ROUTES.glCodeMaster },
      { id: "travel-mode", title: "Travel Mode", route: ROUTES.travelModeMaster },
      { id: "grade-entitlement", title: "Grade Entitlement", route: ROUTES.gradeEntitlementMaster },
      { id: "backdated-allowance", title: "Backdated TR Allowance", route: ROUTES.backdatedTRAllowance },
      { id: "travel-export", title: "Travel Application Export", route: ROUTES.travelApplicationExport },
    ],
  },
  {
    id: "accommodation",
    title: "Accommodation",
    icon: Home,
    items: [
      { id: "guest-house", title: "Guest House", route: ROUTES.guestHouseMaster },
      { id: "arc-hotel", title: "ARC Hotel", route: ROUTES.arcHotelMaster },
      // { id: "location-spoc", title: "Location SPOC", route: ROUTES.locationSPOCMaster },
    ],
  },
  {
    id: "approval",
    title: "Approval",
    icon: CheckCircle2,
    items: [
      { id: "approval-matrix", title: "Approval Matrix", route: ROUTES.approvalMatrixMaster },
      { id: "da-incidental", title: "Daily Allowance Incidental", route: ROUTES.daIncidentalMaster },
      { id: "conveyance-rate", title: "Conveyance Rate", route: ROUTES.conveyanceRateMaster },
    ],
  },
  {
    id: "expense",
    title: "Expense",
    icon: IndianRupeeIcon,
    items: [
      { id: "expense-type", title: "Expense Type", route: ROUTES.expenseTypeMaster },
      { id: "claim-status", title: "Claim Status", route: ROUTES.claimStatusMaster },
    ],
  },
  {
    id: "users",
    title: "Users",
    icon: Users,
    items: [
      // { id: "users", title: "Users", route: ROUTES.users },
      { id: "user-role", title: "User Role Assigner", route: ROUTES.userRoleAssigner },
      { id: "booking-agents", title: "Booking Agents", route: ROUTES.bookingAgents },
      { id: "spoc-assignment", title: "SPOC Users", route: ROUTES.spocAssignmentMaster },
    ],
  },
  {
    id: "vehicle",
    title: "Vehicle",
    icon: Car,
    items: [
      { id: "vehicle-category", title: "Vehicle Category", route: ROUTES.vehicleCategoryMaster },
      { id: "vehicle-type", title: "Vehicle Type", route: ROUTES.vehicleTypeMaster },
    ],
  },
];

const CategoryCard = ({ category, onNavigate }) => {
  const Icon = category.icon;
  return (
    <div className="rounded-lg p-4 bg-white shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-blue-50 text-blue-600">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-700">
            {category.title}
          </h3>
          <div className="mt-1 h-0.5 w-8 bg-blue-100 rounded"></div>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {category.items.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => onNavigate(item.route)}
              className="text-sm text-slate-600 hover:text-blue-600 hover:translate-x-1 flex items-center gap-2 transition-all duration-200 group"
            >
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              <span>{item.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default function MasterSettingsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const searchInputRef = useRef(null);
  const listRefs = useRef([]);

  // Flatten all masters for search
  const allItems = MASTER_CATEGORIES.flatMap((cat) =>
    cat.items.map((item) => ({
      ...item,
      categoryTitle: cat.title,
      categoryIcon: cat.icon,
    })),
  );

  const filteredResults = searchTerm
    ? allItems.filter((i) =>
        i.title.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : [];

  // Focus search on Ctrl + /
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  // Handle arrow key navigation
  const handleKeyDown = (e) => {
    if (!filteredResults.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + filteredResults.length) % filteredResults.length,
      );
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && selectedIndex < filteredResults.length) {
        navigate(filteredResults[selectedIndex].route);
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRefs.current[selectedIndex]) {
      listRefs.current[selectedIndex].scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-full mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-800">
            Master Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage all admin masters and configuration from a single place.
          </p>
        </header>

        <div className="mb-6 relative flex items-center gap-4 w-full">
          <div className="flex-1 relative">
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search across masters (Ctrl + /)"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(e.target.value.length > 0);
                setSelectedIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="w-full px-4 py-2 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
            />

            {/* Suggestion dropdown */}
            {showSuggestions && (
              <ul className="absolute z-50 left-0 right-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
                {filteredResults.length > 0 ? (
                  filteredResults.map((result, index) => {
                    const Icon = result.categoryIcon;
                    return (
                      <li
                        key={result.id}
                        ref={(el) => (listRefs.current[index] = el)}
                        onClick={() => {
                          navigate(result.route);
                          setShowSuggestions(false);
                        }}
                        className={`px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-blue-50 ${index === selectedIndex ? "bg-blue-50" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-blue-500" />
                          <div>
                            <p className="text-sm font-medium text-slate-700">
                              {result.title}
                            </p>
                            <p className="text-xs text-slate-400">
                              {result.categoryTitle}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })
                ) : (
                  <li className="px-4 py-4 text-sm text-slate-400">
                    No results found
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Grid layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {MASTER_CATEGORIES.map((cat) => (
            <CategoryCard key={cat.id} category={cat} onNavigate={navigate} />
          ))}
        </div>

        <footer className="mt-8 text-xs text-slate-400">
          Tip: click any item to open its management screen (in-place drawer or
          navigation).
        </footer>
      </div>
    </div>
  );
}
