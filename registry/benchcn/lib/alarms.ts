// benchcn.dev · alarm-list
// Alarm state as independent flags, after the OPC UA Alarms and Conditions model (Part 9): whether
// the condition is active comes from the process, whether it is acknowledged from the operator,
// and shelving is a small state machine of its own. ISA-18.2 style names are derived from them.

export type AlarmPriority = "critical" | "high" | "medium" | "low";

export type AlarmShelving = { kind: "one-shot" } | { kind: "timed"; until: number };

export type AlarmRecord = {
  id: string;
  message: string;
  priority: AlarmPriority;
  /** The condition exists right now. */
  active: boolean;
  /** The operator has acknowledged the latest activation. */
  acked: boolean;
  shelving: AlarmShelving | null;
  /** Milliseconds timestamp of the latest activation. */
  activeSince: number;
  /** Milliseconds timestamp of the latest change of any flag. */
  changedAt: number;
  /** Activations so far, so a chattering alarm is visible. */
  activations: number;
};

export type AlarmEvent =
  | { type: "activate"; id: string; message: string; priority: AlarmPriority; at: number }
  | { type: "clear"; id: string; at: number }
  | { type: "acknowledge"; id: string; at: number }
  | { type: "shelve"; id: string; at: number; minutes?: number }
  | { type: "unshelve"; id: string; at: number }
  | { type: "tick"; at: number };

export type AlarmTable = Record<string, AlarmRecord>;

/** ISA-18.2 style name for an unshelved alarm's flags. */
export type AlarmState = "unacknowledged" | "acknowledged" | "cleared-unacknowledged" | "normal";

export function alarmState(record: Pick<AlarmRecord, "active" | "acked">): AlarmState {
  if (record.active) return record.acked ? "acknowledged" : "unacknowledged";
  return record.acked ? "normal" : "cleared-unacknowledged";
}

const without = (table: AlarmTable, id: string): AlarmTable => {
  const { [id]: _removed, ...rest } = table;
  return rest;
};

/** A record that is inactive, acknowledged and unshelved has nothing left to show. */
const settle = (table: AlarmTable, record: AlarmRecord): AlarmTable =>
  !record.active && record.acked && record.shelving === null
    ? without(table, record.id)
    : { ...table, [record.id]: record };

export function reduceAlarms(table: AlarmTable, event: AlarmEvent): AlarmTable {
  if (event.type === "tick") {
    let next = table;
    for (const record of Object.values(table)) {
      if (record.shelving?.kind === "timed" && event.at >= record.shelving.until) {
        next = settle(next, { ...record, shelving: null, changedAt: event.at });
      }
    }
    return next;
  }

  const record = table[event.id];
  switch (event.type) {
    case "activate": {
      if (record?.active) return table;
      // Every new activation needs its own acknowledgement.
      return {
        ...table,
        [event.id]: {
          id: event.id,
          message: event.message,
          priority: event.priority,
          active: true,
          acked: false,
          shelving: record?.shelving ?? null,
          activeSince: event.at,
          changedAt: event.at,
          activations: (record?.activations ?? 0) + 1,
        },
      };
    }
    case "clear": {
      if (!record?.active) return table;
      // A one-shot shelve lasts for one episode and ends when the condition clears.
      const shelving = record.shelving?.kind === "one-shot" ? null : record.shelving;
      return settle(table, { ...record, active: false, shelving, changedAt: event.at });
    }
    case "acknowledge": {
      if (!record || record.acked) return table;
      return settle(table, { ...record, acked: true, changedAt: event.at });
    }
    case "shelve": {
      if (!record) return table;
      const shelving: AlarmShelving =
        event.minutes === undefined
          ? { kind: "one-shot" }
          : { kind: "timed", until: event.at + event.minutes * 60_000 };
      return { ...table, [event.id]: { ...record, shelving, changedAt: event.at } };
    }
    case "unshelve": {
      if (!record?.shelving) return table;
      return settle(table, { ...record, shelving: null, changedAt: event.at });
    }
  }
}

const PRIORITY_RANK: Record<AlarmPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Display order: unacknowledged before acknowledged, active before cleared, then priority, then
 * newest first. The alarm that needs a person most is always at the top.
 */
export function sortAlarms(records: AlarmRecord[]): AlarmRecord[] {
  return [...records].sort(
    (a, b) =>
      Number(a.acked) - Number(b.acked) ||
      Number(b.active) - Number(a.active) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      b.activeSince - a.activeSince,
  );
}

export type AlarmRule = {
  id: string;
  /** Channel id the rule watches. */
  channel: string;
  message: string;
  priority: AlarmPriority;
  /** Active while the value is above this. */
  above?: number;
  /** Active while the value is below this. */
  below?: number;
  /** How far back past the limit the value must go before the alarm clears, against chatter. */
  deadband?: number;
  /** Active when a channel that has reported stops updating for this many milliseconds. */
  staleAfter?: number;
};

/**
 * Whether a rule's condition holds. `wasActive` applies the deadband: an active alarm clears only
 * once the value is back past the limit by the deadband, so noise at the limit does not chatter.
 */
export function ruleActive(
  rule: AlarmRule,
  value: number | null,
  age: number | null,
  wasActive: boolean,
): boolean {
  // A channel that never reported has no signal to lose; connection state is the source's job.
  if (rule.staleAfter !== undefined) return age !== null && age > rule.staleAfter;
  if (value === null) return wasActive;
  const band = wasActive ? (rule.deadband ?? 0) : 0;
  if (rule.above !== undefined && value > rule.above - band) return true;
  if (rule.below !== undefined && value < rule.below + band) return true;
  return false;
}
