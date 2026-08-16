import type { PlatformId } from "./models";

export interface ActiveSessionSnapshot {
  platform: PlatformId;
  date: string;
  plannedSeconds: number;
}

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
  | {
      type: "dopamine-fast:set-active-session";
      session: ActiveSessionSnapshot;
    }
  | {
      type: "dopamine-fast:get-active-session";
      platform: PlatformId;
    }
  | {
      type: "dopamine-fast:clear-active-session";
      platform: PlatformId;
    }
  | { type: "dopamine-fast:open-options" }
  | { type: "dopamine-fast:leave-feed" };

export interface ReserveAllowanceResponse {
  granted: number;
}

export interface AddUsageSecondsResponse {
  remainingSeconds: number;
}

export interface GetActiveSessionResponse {
  session: ActiveSessionSnapshot | null;
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
    case "dopamine-fast:set-active-session":
      return isActiveSessionSnapshot(candidate.session);
    case "dopamine-fast:get-active-session":
    case "dopamine-fast:clear-active-session":
      return isPlatform(candidate.platform);
    case "dopamine-fast:open-options":
    case "dopamine-fast:leave-feed":
      return true;
    default:
      return false;
  }
}

const isPlatform = (value: unknown): value is PlatformId =>
  value === "reddit" ||
  value === "x" ||
  value === "instagram" ||
  value === "youtube";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function isActiveSessionSnapshot(
  value: unknown,
): value is ActiveSessionSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    isPlatform(candidate.platform) &&
    typeof candidate.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.date) &&
    isFiniteNumber(candidate.plannedSeconds) &&
    candidate.plannedSeconds > 0 &&
    candidate.plannedSeconds <= 60 * 60
  );
}
