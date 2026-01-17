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
import { cn } from "@/lib/utils";
import { travelDeskAPI } from "@/src/api/travel-desk";
import type { BookingAgent } from "@/src/types/travel-desk.types";

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (agentId: number, note: string) => void;
  title: string;
  isLoading?: boolean;
  type?: "forward" | "reassign";
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  isLoading,
  type = "forward",
}) => {
  const [agents, setAgents] = useState<BookingAgent[]>([]);
  const [fetchingAgents, setFetchingAgents] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openCombobox, setOpenCombobox] = useState(false);

  // Fetch all agents when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadAgents = async () => {
        setFetchingAgents(true);
        try {
          const res = await travelDeskAPI.agents.list();
          setAgents(res.data || []);
        } catch (err) {
          console.error("Failed to load agents", err);
          setError("Failed to load booking agents list.");
        } finally {
          setFetchingAgents(false);
        }
      };
      loadAgents();
    }
  }, [isOpen]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setSelectedAgentId(null);
      setNote("");
      setError(null);
      setOpenCombobox(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedAgentId) {
      setError("Please select a booking agent");
      return;
    }

    setError(null);
    onConfirm(selectedAgentId, note);
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

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
            <Label>Select Booking Agent</Label>
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full justify-between"
                  disabled={fetchingAgents}
                >
                  {selectedAgent
                    ? `${selectedAgent.organization_name} - ${selectedAgent.full_name || "No Contact"}`
                    : fetchingAgents
                      ? "Loading agents..."
                      : "Search & Select Agent..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search agent name or organization..." className="hover:bg-slate-50 " />
                  <CommandList>
                    <CommandEmpty>No agent found.</CommandEmpty>
                    <CommandGroup>
                      {agents.map((agent) => (
                        <CommandItem
                          key={agent.id}
                          value={`${agent.organization_name} ${agent.full_name}`}
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
                              {agent.organization_name}
                            </span>
                            <span className="text-xs text-slate-400">
                              {agent.full_name}
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
              : type === "forward"
                ? "Forward"
                : "Reassign"}
          </Button>
        </div>
      </div>
    </div>
  );
};
