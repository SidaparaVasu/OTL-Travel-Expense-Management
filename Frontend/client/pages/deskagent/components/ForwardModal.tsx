import React, { useEffect, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { travelDeskAPI } from "@/src/api/travel-desk";
import type {
  BookingAgent,
  Booking,
  VehicleType,
  TravelDeskUser,
} from "@/src/types/travel-desk.types";

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (agentId: number, note: string, vehicleTypeId?: number) => void;
  title: string;
  isLoading?: boolean;
  type?: "forward" | "reassign" | "forward_to_desk";
  booking?: Booking | null;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  isLoading,
  type = "forward",
  booking,
}) => {
  const [agents, setAgents] = useState<BookingAgent[]>([]);
  const [deskUsers, setDeskUsers] = useState<TravelDeskUser[]>([]);
  const [fetchingAgents, setFetchingAgents] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openCombobox, setOpenCombobox] = useState(false);

  // Vehicle Type Selection State
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [fetchingVehicleTypes, setFetchingVehicleTypes] = useState(false);
  const [selectedVehicleTypeId, setSelectedVehicleTypeId] = useState<
    number | null
  >(null);

  const isDeskForward = type === "forward_to_desk";

  // Fetch agents or desk users when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        setFetchingAgents(true);
        try {
          if (isDeskForward) {
            const res = await travelDeskAPI.users.getTravelDeskUsers();
            setDeskUsers(res.data || []);
          } else {
            const res = await travelDeskAPI.agents.list();
            setAgents(res.data || []);
          }
        } catch (err) {
          console.error("Failed to load data", err);
          setError(
            isDeskForward
              ? "Failed to load travel desk users list."
              : "Failed to load booking agents list.",
          );
        } finally {
          setFetchingAgents(false);
        }
      };
      loadData();
    }
  }, [isOpen, isDeskForward]);

  // Determine if vehicle selection is applicable
  const isVehicleSelectionApplicable = () => {
    if (!booking || type !== "forward" || isDeskForward) return false;
    const typeName = booking.booking_type_name?.toLowerCase() || "";
    // Exclude Flight, Train, Accommodation
    if (
      typeName.includes("flight") ||
      typeName.includes("train") ||
      typeName.includes("accommodation") ||
      typeName.includes("hotel")
    ) {
      return false;
    }

    // Exclude Own Car / Self Arranged
    const subOption = booking.sub_option_name?.toLowerCase() || "";
    if (
      typeName.includes("own") ||
      subOption.includes("own") ||
      subOption.includes("self")
    ) {
      return false;
    }

    return true;
  };

  const showVehicleSelection = isVehicleSelectionApplicable();

  // Fetch Vehicle Types when Agent matches and Booking is applicable
  useEffect(() => {
    if (showVehicleSelection && selectedAgentId) {
      const fetchVehicles = async () => {
        setFetchingVehicleTypes(true);
        setVehicleTypes([]); // Clear previous
        try {
          const res =
            await travelDeskAPI.agents.getAgentVehicleTypes(selectedAgentId);
          setVehicleTypes(res.data || []);
        } catch (err) {
          console.error("Failed to load vehicle types", err);
          // Don't block UI, just no options
        } finally {
          setFetchingVehicleTypes(false);
        }
      };
      fetchVehicles();
    } else {
      setVehicleTypes([]);
    }
    setSelectedVehicleTypeId(null);
  }, [selectedAgentId, showVehicleSelection]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setSelectedAgentId(null);
      setNote("");
      setError(null);
      setOpenCombobox(false);
      setVehicleTypes([]);
      setSelectedVehicleTypeId(null);
      setDeskUsers([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedAgentId) {
      setError(
        isDeskForward
          ? "Please select a travel desk user"
          : "Please select a booking agent",
      );
      return;
    }

    setError(null);
    onConfirm(selectedAgentId, note, selectedVehicleTypeId || undefined);
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const selectedAgent = isDeskForward
    ? deskUsers.find((u) => u.id === selectedAgentId)
    : agents.find((a) => a.id === selectedAgentId);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleClose}
    >
      <div
        className="bg-card rounded-lg shadow-lg w-full max-w-lg border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>
              {isDeskForward
                ? "Select Travel Desk User"
                : "Select Booking Agent"}
            </Label>
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full justify-between"
                  disabled={fetchingAgents}
                >
                  {isDeskForward
                    ? (selectedAgent as TravelDeskUser | undefined)
                      ? (selectedAgent as TravelDeskUser).full_name
                      : fetchingAgents
                        ? "Loading users..."
                        : "Search & Select User..."
                    : selectedAgent
                      ? `${(selectedAgent as BookingAgent).organization_name} - ${(selectedAgent as BookingAgent).name || "No Contact"}`
                      : fetchingAgents
                        ? "Loading agents..."
                        : "Search & Select Agent..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput
                    placeholder={
                      isDeskForward
                        ? "Search desk user name..."
                        : "Search agent name or organization..."
                    }
                    className="hover:bg-slate-50 "
                  />
                  <CommandList>
                    <CommandEmpty>
                      {isDeskForward ? "No desk user found." : "No agent found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {isDeskForward
                        ? deskUsers.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={`${user.full_name} ${user.email}`}
                              onSelect={() => {
                                setSelectedAgentId(user.id);
                                setOpenCombobox(false);
                                setError(null);
                              }}
                              className="hover:bg-blue-50 hover:text-blue-500"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedAgentId === user.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {user.full_name}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {user.role} · {user.email}
                                </span>
                              </div>
                            </CommandItem>
                          ))
                        : agents.map((agent) => (
                            <CommandItem
                              key={agent.id}
                              value={`${agent.name} ${agent.organization_name}`}
                              onSelect={() => {
                                setSelectedAgentId(agent.id);
                                setOpenCombobox(false);
                                setError(null);
                              }}
                              className="hover:bg-blue-50 hover:text-blue-500"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedAgentId === agent.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {agent.organization_name || "Unknown Org"}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {agent.name}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Vehicle Type Selection */}
          {showVehicleSelection && selectedAgentId && (
            <div className="space-y-2">
              <Label>Preferred Vehicle Type (Optional)</Label>
              {fetchingVehicleTypes ? (
                <div className="text-sm text-slate-500">
                  Loading vehicle types...
                </div>
              ) : vehicleTypes.length > 0 ? (
                <Select
                  value={selectedVehicleTypeId?.toString()}
                  onValueChange={(val) =>
                    setSelectedVehicleTypeId(parseInt(val))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select vehicle type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleTypes.map((vt) => (
                      <SelectItem key={vt.id} value={vt.id.toString()}>
                        {vt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-slate-400 italic">
                  No specific vehicle types mapped for this agent.
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Note (Optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any additional instructions..."
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !selectedAgentId}
          >
            {isLoading
              ? "Processing..."
              : type === "reassign"
                ? "Reassign"
                : "Forward"}
          </Button>
        </div>
      </div>
    </div>
  );
};
