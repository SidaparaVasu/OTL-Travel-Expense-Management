import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { BookingAgentDashboardStats } from "@/src/api/bookingAgentAPI";

interface BookingStatsChartProps {
  stats: BookingAgentDashboardStats;
}

const COLORS = {
  pending: "#EAB308",      // yellow-500
  in_progress: "#3B82F6",  // blue-500
  confirmed: "#22C55E",    // green-500
  cancelled: "#EF4444",    // red-500
  closed: "#64748B",       // slate-500
};

export function BookingStatsChart({ stats }: BookingStatsChartProps) {
  const data = [
    { name: "Pending", value: stats.pending, color: COLORS.pending },
    { name: "In Progress", value: stats.in_progress, color: COLORS.in_progress },
    { name: "Confirmed", value: stats.confirmed, color: COLORS.confirmed },
    { name: "Cancelled", value: stats.cancelled, color: COLORS.cancelled },
    { name: "Closed", value: stats.closed ?? 0, color: COLORS.closed },
  ].filter(item => item.value > 0);

  // If no data, show empty state
  if (data.length === 0 || stats.total_assigned === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
        <p className="text-sm">No booking data to display</p>
      </div>
    );
  }

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            formatter={(value: number, name: string) => [value, name]}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => (
              <span className="text-sm text-foreground">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
