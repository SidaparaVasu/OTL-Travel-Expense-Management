import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { approvalAPI } from "@/src/api/approval";
import {
  StatCard,
  TravelRequestItem,
  ExpenseReportItem,
  ExpenseTrendChart,
} from "@/components/dashboard";
import {
  StatCardPlane,
  StatCardFileText,
  StatCardWaiting,
  StatCardExpense,
} from "@/assets/icons";
import { CheckCheckIcon, IndianRupeeIcon } from "lucide-react";
import { ROUTES } from "@/routes/routes";

interface ApprovalStats {
  pending_approvals: number;
  total_approvals_done: number;
  approvals_this_month: number;
  active_trips: number;
  pending_expenses_amount: number;
}

interface RecentActivities {
  action: string;
  approval_level: string;
  employee_name: string;
  travel_request_id: string;
  location: {
    from_location__city_name?: string;
    to_location__city_name?: string;
  } | null;
}

interface ExpenseReport {
  title: string;
  submitted_by: string;
  amount: number;
  status: string;
}

interface ExpenseTrends {
  months: string[];
  values: number[];
}

export function DashboardOverview() {
  const navigate = useNavigate();

  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [activity, setAcitivity] = useState<RecentActivities[]>([]);
  const [expenseReports, setExpenseReports] = useState<ExpenseReport[]>([]);
  const [expenseTrends, setExpenseTrends] = useState<ExpenseTrends | null>(
    null,
  );

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      const dashboardData = await approvalAPI.getDashboard();
      setStats(dashboardData.data.statistics);
      setAcitivity(dashboardData.data.recent_activity || []);
      setExpenseReports(dashboardData.data.expense_reports || []);
      setExpenseTrends(dashboardData.data.expense_trends);
      console.log(dashboardData.data);
    } catch (err) {
      console.error("Failed to load approval statistics!", err);
    } finally {
      setLoading(false);
    }
  };

  const months = expenseTrends?.months || [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sept",
    "Oct",
    "Nov",
    "Dec",
  ];
  const values = expenseTrends?.values || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[26px] font-bold text-foreground">
          Dashboard Overview
        </h1>
        <p className="mt-2 text-lg text-foreground">
          Welcome back! Here's what's happening with your travel & expenses.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Trips"
            value={String(stats.active_trips || 0)}
            icon={
              <StatCardPlane className="h-9 w-9 text-[#0B98D3] [&_*]:fill-current" />
            }
            bgColor="bg-blue-50"
          />
          <StatCard
            title="Pending Expenses"
            value={`₹${(stats.pending_expenses_amount || 0).toLocaleString("en-IN")}`}
            icon={<StatCardFileText className="h-9 w-9" />}
            bgColor="bg-red-50"
          />
          <StatCard
            title="Awaiting Approval"
            value={String(stats.pending_approvals || 0)}
            icon={<StatCardWaiting className="h-9 w-9" />}
            bgColor="bg-orange-50"
          />
          <StatCard
            title="Total Approved"
            value={String(stats.total_approvals_done)}
            icon={<CheckCheckIcon className="h-9 w-9 text-green-500" />}
            bgColor="bg-green-50"
          />
          {/* <StatCard
          title="Monthly Budget"
          value="₹45,000"
          icon={<IndianRupeeIcon className="h-9 w-9 text-green-500" />}
          bgColor="bg-green-50"
        /> */}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-[10px] bg-white p-6 shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">
              Recent Travel Requests
            </h2>
            <button
              className="text-base font-bold text-primary underline"
              onClick={() => navigate(ROUTES.travelRequestApproval)}
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {Array.isArray(activity) &&
              activity.map((request) => (
                <div>
                  <TravelRequestItem
                    name={request.employee_name}
                    avatar={request.employee_name.split(' ').map(word => word.charAt(0).toUpperCase()).join('') || 'U'}
                    from={request.location?.from_location__city_name || "N/A"}
                    to={request.location?.to_location__city_name || "N/A"}
                    status={request.action as any}
                  />
                  <div className="h-px bg-foreground/10" />
                </div>
              ))}
            {activity?.length === 0 && (
              <center className="m-5">No recent application found.</center>
            )}
            {/* <TravelRequestItem
              name="Sarah Johnson"
              avatar="https://api.builder.io/api/v1/image/assets/TEMP/4fa4c38ef3892012b166bc2fbb474ffbd49bda2e?width=100"
              from="New York"
              to="London"
              status="pending"
            />
            <div className="h-px bg-foreground/10" />
            <TravelRequestItem
              name="Mike Chen"
              avatar="https://api.builder.io/api/v1/image/assets/TEMP/584eb215fe812bf81c2c9ffc953c457482b1f3de?width=100"
              from="San Francisco"
              to="Tokyo"
              status="approved"
            />
            <div className="h-px bg-foreground/10" />
            <TravelRequestItem
              name="Emma Davis"
              avatar="https://api.builder.io/api/v1/image/assets/TEMP/39373ec2416a0763f8d322ef0bcb73c6be64dd70?width=100"
              from="Chicago"
              to="Berlin"
              status="rejected"
            /> */}
          </div>
        </div>

        <div className="rounded-[10px] bg-white p-6 shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">
              Expense Reports
            </h2>
            <button className="text-base font-bold text-primary underline"
              onClick={() => navigate(ROUTES.claimApprovalPage)}
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {expenseReports.length > 0 ? (
              expenseReports.map((report, index) => (
                <div key={index}>
                  <ExpenseReportItem
                    title={report.title}
                    submittedBy={report.submitted_by}
                    amount={`₹${report.amount.toLocaleString("en-IN")}`}
                    status={report.status as any}
                  />
                  {index < expenseReports.length - 1 && (
                    <div className="h-px bg-foreground/10" />
                  )}
                </div>
              ))
            ) : (
              <center className="m-5 text-sm text-gray-500">
                No recent expense reports found.
              </center>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[10px] bg-white p-6 shadow-[0_2px_2px_0_rgba(59,130,247,0.30)]">
        <h2 className="mb-8 text-xl font-bold text-foreground">
          Monthly Expense Trends
        </h2>
        <ExpenseTrendChart months={months} values={values} />
      </div>

      <div className="flex items-center justify-between py-4 text-base text-primary">
        <span>© 2025 Orange Technolab pvt. ltd. - All rights reserved.</span>
        <div className="flex gap-8">
          <a href="#" className="hover:underline">
            Privacy
          </a>
          <a href="#" className="hover:underline">
            Terms
          </a>
          <a href="#" className="hover:underline">
            Support
          </a>
        </div>
      </div>
    </div>
  );
}
