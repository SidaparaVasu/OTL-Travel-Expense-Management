import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Building2 } from "lucide-react";
import { travelDeskAPI } from "@/src/api/travel-desk";
import { locationAPI } from "@/src/api/master_location";
import { AgentAnalyticsSummary } from "@/src/types/travel-desk.types";
import { BookingAgentDetailModal } from "./BookingAgentDetailModal";
import { BookingAgentCityFilter } from "./BookingAgentCityFilter";
import { City } from "@/src/api/travel-api"; // Ensure City type is available or use from API file

export default function BookingAgentList() {
  const [agents, setAgents] = useState<AgentAnalyticsSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);

  // Filter States
  const [cities, setCities] = useState<any[]>([]); // Using any for now to match API response if strict type unavailable
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [agentsData, citiesData] = await Promise.all([
        travelDeskAPI.analytics.agents.list("", null),
        locationAPI.getAllCities(),
      ]);
      setAgents(agentsData);
      // Handle explicit array or paginated response (results/data)
      const citiesList = Array.isArray(citiesData)
        ? citiesData
        : citiesData?.results || citiesData?.data || [];

      setCities(citiesList);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    setLoading(true);
    try {
      const data = await travelDeskAPI.analytics.agents.list(
        search,
        selectedCityId,
      );
      setAgents(data);
    } catch (error) {
      console.error("Error loading agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadAgents();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-[1200px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Booking Agents
            </h1>
            <p className="text-sm text-slate-500">
              Manage and monitor booking agent performance
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <form
              onSubmit={handleSearch}
              className="flex flex-col md:flex-row gap-4 items-end md:items-center"
            >
              <div className="relative flex-1 w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by name or company..."
                  className="pl-9 h-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="w-full md:w-64">
                <BookingAgentCityFilter
                  cities={cities}
                  value={selectedCityId}
                  onChange={(id) => setSelectedCityId(id)}
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white flex-1 md:flex-none h-10"
                >
                  Search
                </Button>
                {(search || selectedCityId) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setSelectedCityId(null);
                      // loadAgents will be called by useEffect or manually below if needed,
                      // but since state updates are async, we might want to trigger fetch
                      // However, loadAgents depends on state.
                      // Best to just reset state and let user click search, OR trigger effect.
                      // Here we can just call API directly with empty params for immediate feedback
                      travelDeskAPI.analytics.agents
                        .list("", null)
                        .then(setAgents);
                    }}
                    className="h-10 px-4 text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Agent List Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">
            Loading agents...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => setSelectedAgentId(agent.id)}
              />
            ))}
            {agents.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-400">
                No agents found matching your criteria.
              </div>
            )}
          </div>
        )}
      </div>

      <BookingAgentDetailModal
        isOpen={!!selectedAgentId}
        onClose={() => setSelectedAgentId(null)}
        agentId={selectedAgentId}
      />
    </div>
  );
}

function AgentCard({
  agent,
  onClick,
}: {
  agent: AgentAnalyticsSummary;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-lg border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">
            {agent.first_name?.[0]}
            {agent.last_name?.[0]}
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
              {agent.first_name} {agent.last_name}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              <Building2 className="w-3 h-3" />
              {agent.organization_name}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-3 border-t border-b border-gray-50 mb-3">
        <div>
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
            Response Time
          </div>
          <div className="font-semibold text-slate-700">
            {agent.avg_response_time}h
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
            Active Jobs
          </div>
          <div className="font-semibold text-slate-700">
            {agent.active_bookings}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
        <div>{agent.completed_bookings} completed bookings</div>
        <div className="text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          View Details →
        </div>
      </div>
    </div>
  );
}
