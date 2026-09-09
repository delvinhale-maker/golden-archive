import type { IncidentStatus } from "./types";

const transitions: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ["CONTAINED", "INVESTIGATING"],
  CONTAINED: ["INVESTIGATING", "REMEDIATING"],
  INVESTIGATING: ["REMEDIATING", "RESOLVED"],
  REMEDIATING: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export function canTransitionIncident(from: IncidentStatus, to: IncidentStatus): boolean {
  return from === to || transitions[from].includes(to);
}

export function assertIncidentTransition(from: IncidentStatus, to: IncidentStatus): void {
  if (!canTransitionIncident(from, to)) throw new Error(`Invalid incident transition: ${from} → ${to}`);
}
