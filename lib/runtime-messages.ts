import type { PlatformId } from "./models";

export type RuntimeMessage =
  | {
      type: "dopamine-fast:reserve-allowance";
      platform: PlatformId;
      requested: number;
      isUnlock: boolean;
    }
  | {
      type: "dopamine-fast:add-usage-seconds";
      platform: PlatformId;
      elapsedSeconds: number;
    }
  | { type: "dopamine-fast:reset-daily-state" }
  | { type: "dopamine-fast:open-options" }
  | { type: "dopamine-fast:leave-feed" };

export interface ReserveAllowanceResponse {
  granted: number;
}

export interface AddUsageSecondsResponse {
  remainingSeconds: number;
}

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const candidate = value as Record<string, unknown>;
  switch (candidate.type) {
    case "dopamine-fast:reserve-allowance":
      return (
        isPlatform(candidate.platform) &&
        isFiniteNumber(candidate.requested) &&
        typeof candidate.isUnlock === "boolean"
      );
    case "dopamine-fast:add-usage-seconds":
      return (
        isPlatform(candidate.platform) &&
        isFiniteNumber(candidate.elapsedSeconds)
      );
    case "dopamine-fast:reset-daily-state":
    case "dopamine-fast:open-options":
    case "dopamine-fast:leave-feed":
      return true;
    default:
      return false;
  }
}

const isPlatform = (value: unknown): value is PlatformId =>
  value === "reddit" || value === "x" || value === "instagram";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
