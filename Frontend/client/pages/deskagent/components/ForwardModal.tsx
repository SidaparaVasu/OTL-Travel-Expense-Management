import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { RecommendedAgentsResponse } from '@/src/types/travel-desk.types';

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (agentId: number, note: string) => void;
  title: string;
  recommendations?: RecommendedAgentsResponse | null;
  isLoading?: boolean;
  bookingTypes: Set<string>;
  type?: 'forward' | 'reassign';
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  recommendations,
  isLoading,
  bookingTypes,
  type = 'forward',
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const showFlightTrain =
  bookingTypes.has('flight') || bookingTypes.has('train');

const showAccommodation =
  bookingTypes.has('accommodation') ||
  bookingTypes.has('guest house') ||
  bookingTypes.has('hotel');

  /* --------------------------------------------------
     Preselect recommended accommodation agent
     Fallback to flight/train agent if needed
  -------------------------------------------------- */
  useEffect(() => {
    if (!isOpen || !recommendations) return;

    for (const group of recommendations.accommodation || []) {
      const recommended = group.agents.find(a => a.is_recommended);
      if (recommended) {
        setSelectedAgentId(recommended.id);
        return;
      }
    }

    if (recommendations.flight_train?.agent?.id) {
      setSelectedAgentId(recommendations.flight_train.agent.id);
    }
  }, [isOpen, recommendations]);

  /* --------------------------------------------------
     Reset state on close
  -------------------------------------------------- */
  useEffect(() => {
    if (!isOpen) {
      setSelectedAgentId(null);
      setNote('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedAgentId) {
      setError('Please select a booking agent');
      return;
    }

    setError(null);
    onConfirm(selectedAgentId, note);
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

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

          {/* Flight / Train (read-only info) */}
          {showFlightTrain && recommendations?.flight_train && (
            <div className="p-3 border rounded bg-muted">
              <p className="text-sm font-semibold">Flight / Train</p>
              <p className="text-sm">
                {recommendations.flight_train.agent.name}
                <span className="text-muted-foreground ml-1">
                  ({recommendations.flight_train.agent.organization})
                </span>
              </p>
            </div>
          )}

          {/* Accommodation (city-wise selection) */}
          {recommendations?.accommodation.map(group => (
            <div key={group.city.id} className="p-3 border rounded space-y-2">
              <div>
                <p className="text-sm font-semibold">
                  Accommodation - {group.city.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {group.agents.length > 1
                    ? 'Recommended agent is preselected. You may choose another if required.'
                    : 'Only one eligible booking agent is available for this location.'}
                </p>
              </div>

              {group.agents.map(agent => (
                <label
                  key={agent.id}
                  // className="flex items-center gap-2 text-sm cursor-pointer"
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded"
                >
                  <input
                    type="radio"
                    name="accommodation-agent"
                    checked={selectedAgentId === agent.id}
                    onChange={() => setSelectedAgentId(agent.id)}
                  />
                  <span>{agent.name}</span>
                  <span className="text-muted-foreground">
                    ({agent.organization})
                  </span>
                  {agent.is_recommended && (
                    <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full
                           bg-green-50 text-green-700 border border-green-200">
                      Recommended
                    </span>
                  )}
                </label>
              ))}
            </div>
          ))}

          {/* Note */}
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
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Processing...' : type === 'forward' ? 'Forward' : 'Reassign'}
          </Button>
        </div>
      </div>
    </div>
  );
};
