"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Briefcase, Share2 } from "lucide-react";

interface DashboardTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: {
    id: string;
    label: string;
    icon: React.ElementType;
    count?: number;
  }[];
}

export function DashboardTabs({
  activeTab,
  onTabChange,
  tabs,
}: DashboardTabsProps) {
  return (
    <div className="relative w-full border bg-white pt-2 rounded-t-lg">
      <div
        className="flex items-center"
        role="tablist"
        aria-label="Dashboard views"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-6 py-4 text-sm font-medium outline-none transition-colors",
                isActive
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              style={{ marginBottom: "-1px" }}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
