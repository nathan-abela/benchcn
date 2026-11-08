// benchcn.dev · alarm-list
// An alarm summary an operator can work from: the alarm that needs a person most on top, flashing
// only until it is acknowledged, a cleared alarm kept until someone has seen it, and shelving that
// hides an alarm without pretending it went away.
import { type ComponentProps, type ReactElement, type ReactNode, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type AlarmPriority, type AlarmRecord, alarmState } from "@/registry/benchcn/lib/alarms";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";

export type { AlarmPriority, AlarmRecord, AlarmRule } from "@/registry/benchcn/lib/alarms";

export type AlarmListProps = ComponentProps<"div"> & {
  /** Most urgent first, as `useAlarms` returns them. Shelved alarms are listed separately. */
  alarms: AlarmRecord[];
  title?: ReactNode;
  onAcknowledge?: (id: string) => void;
  onAcknowledgeAll?: () => void;
  onShelve?: (id: string, minutes?: number) => void;
  onUnshelve?: (id: string) => void;
  /** Minutes the Shelve button hides an alarm for. Leave out to shelve until the alarm clears. */
  shelveMinutes?: number;
};

const PRIORITY_TEXT: Record<AlarmPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_EDGE: Record<AlarmPriority, string> = {
  critical: "bg-destructive",
  high: "bg-destructive",
  medium: "bg-warning",
  low: "bg-muted-foreground",
};

const PRIORITY_TONE: Record<AlarmPriority, string> = {
  critical: "text-destructive",
  high: "text-destructive",
  medium: "text-warning",
  low: "text-muted-foreground",
};

const STATE_TEXT = {
  unacknowledged: "Unacknowledged",
  acknowledged: "Acknowledged",
  "cleared-unacknowledged": "Cleared, unacknowledged",
  normal: "Normal",
} as const;

function formatAge(ms: number): string {
  if (ms < 5000) return "now";
  if (ms < 60_000) return `${Math.floor(ms / 1000)} s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min`;
  return `${Math.floor(ms / 3_600_000)} h`;
}

function formatClock(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function useNow(interval: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

export function AlarmList({
  alarms,
  title = "Alarms",
  onAcknowledge,
  onAcknowledgeAll,
  onShelve,
  onUnshelve,
  shelveMinutes,
  className,
  children,
  ...props
}: AlarmListProps): ReactElement {
  const now = useNow(1000);
  const listed = alarms.filter((a) => a.shelving === null);
  const shelved = alarms.filter((a) => a.shelving !== null);
  const active = listed.filter((a) => a.active).length;
  const unacked = listed.filter((a) => !a.acked).length;
  const newest = listed
    .filter((a) => a.active && !a.acked)
    .reduce<AlarmRecord | null>(
      (latest, a) => (!latest || a.activeSince > latest.activeSince ? a : latest),
      null,
    );

  return (
    <div data-slot="alarm-list" className={cn(INSTRUMENT_FRAME, className)} {...props}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <InstrumentLabel>{title}</InstrumentLabel>
          <span className="text-muted-foreground text-xs tabular-nums">
            {active} active, {unacked} unacknowledged
          </span>
        </div>
        {onAcknowledgeAll ? (
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            disabled={unacked === 0}
            onClick={onAcknowledgeAll}
          >
            Acknowledge all
          </Button>
        ) : null}
      </div>

      {listed.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">No alarms</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {listed.map((alarm) => {
            const state = alarmState(alarm);
            const flashing = state === "unacknowledged";
            return (
              <li
                key={alarm.id}
                data-state={state}
                data-priority={alarm.priority}
                className={cn(
                  "bg-background relative flex flex-wrap items-center gap-x-3 gap-y-1.5 overflow-hidden rounded-lg border py-2 pr-2 pl-4",
                  !alarm.active && "bg-transparent",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 left-0 w-1",
                    PRIORITY_EDGE[alarm.priority],
                    flashing && "motion-safe:animate-pulse",
                    !alarm.active && "opacity-40",
                  )}
                />
                <div className="flex min-w-48 flex-1 flex-col gap-0.5">
                  <span
                    className={cn(
                      "truncate text-sm font-medium",
                      !alarm.active && "text-muted-foreground",
                    )}
                  >
                    {alarm.message}
                  </span>
                  <span className="text-muted-foreground flex flex-wrap gap-x-2 text-xs tabular-nums">
                    <span className={PRIORITY_TONE[alarm.priority]}>
                      {PRIORITY_TEXT[alarm.priority]}
                    </span>
                    <span>{STATE_TEXT[state]}</span>
                    <span title={new Date(alarm.activeSince).toLocaleString()}>
                      {formatAge(now - alarm.activeSince)}
                    </span>
                    {alarm.activations > 1 ? <span>{alarm.activations} times</span> : null}
                  </span>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  {!alarm.acked && onAcknowledge ? (
                    <Button variant="outline" size="xs" onClick={() => onAcknowledge(alarm.id)}>
                      Acknowledge
                    </Button>
                  ) : null}
                  {onShelve ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onShelve(alarm.id, shelveMinutes)}
                    >
                      Shelve
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {shelved.length > 0 ? (
        <details className="group text-sm">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs select-none">
            {shelved.length} shelved
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {shelved.map((alarm) => (
              <li key={alarm.id} className="flex items-center gap-3 rounded-md px-2 py-1">
                <span className="text-muted-foreground min-w-0 flex-1 truncate">
                  {alarm.message}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {alarm.shelving?.kind === "timed"
                    ? `until ${formatClock(alarm.shelving.until)}`
                    : "until it clears"}
                </span>
                {onUnshelve ? (
                  <Button variant="ghost" size="xs" onClick={() => onUnshelve(alarm.id)}>
                    Unshelve
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="sr-only" aria-live="assertive">
        {newest ? `${PRIORITY_TEXT[newest.priority]} alarm: ${newest.message}` : ""}
      </p>
      {children}
    </div>
  );
}
