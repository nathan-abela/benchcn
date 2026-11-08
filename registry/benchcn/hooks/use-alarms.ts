// benchcn.dev · alarm-list
// Raises and clears alarms from rules evaluated against any source, and keeps acknowledgement
// and shelving on the page. Readings are timed on arrival, so a channel that goes quiet raises
// its signal-lost alarm even when the device's clock is wrong.
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import {
  type AlarmRecord,
  type AlarmRule,
  reduceAlarms,
  ruleActive,
  sortAlarms,
} from "@/registry/benchcn/lib/alarms";
import type { SourceStore } from "@/registry/benchcn/lib/source-store";
import type { WireSample } from "@/registry/benchcn/lib/wire";

export type UseAlarmsResult = {
  /** Every listed alarm, shelved ones included, most urgent first. */
  alarms: AlarmRecord[];
  acknowledge: (id: string) => void;
  acknowledgeAll: () => void;
  /** Shelves until the condition clears, or for `minutes`. */
  shelve: (id: string, minutes?: number) => void;
  unshelve: (id: string) => void;
};

export function useAlarms(source: { store: SourceStore }, rules: AlarmRule[]): UseAlarmsResult {
  const [table, dispatch] = useReducer(reduceAlarms, {});
  const rulesRef = useRef(rules);
  const tableRef = useRef(table);

  useEffect(() => {
    rulesRef.current = rules;
    tableRef.current = table;
  });

  useEffect(() => {
    const conditions = new Map<string, boolean>();
    const seen = new Map<string, { sample: WireSample; at: number }>();

    const evaluate = () => {
      const now = Date.now();
      const { readings } = source.store.getSnapshot();
      for (const [channel, sample] of Object.entries(readings)) {
        if (seen.get(channel)?.sample !== sample) seen.set(channel, { sample, at: now });
      }
      for (const rule of rulesRef.current) {
        const last = seen.get(rule.channel);
        const value = typeof last?.sample.v === "number" ? last.sample.v : null;
        const age = last ? now - last.at : null;
        const was = conditions.get(rule.id) ?? tableRef.current[rule.id]?.active ?? false;
        const active = ruleActive(rule, value, age, was);
        if (active === was) continue;
        conditions.set(rule.id, active);
        dispatch(
          active
            ? {
                type: "activate",
                id: rule.id,
                message: rule.message,
                priority: rule.priority,
                at: now,
              }
            : { type: "clear", id: rule.id, at: now },
        );
      }
    };

    evaluate();
    const unsubscribe = source.store.subscribe(evaluate);
    const timer = window.setInterval(() => {
      evaluate();
      dispatch({ type: "tick", at: Date.now() });
    }, 1000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [source.store]);

  const acknowledge = useCallback(
    (id: string) => dispatch({ type: "acknowledge", id, at: Date.now() }),
    [],
  );
  const acknowledgeAll = useCallback(() => {
    const at = Date.now();
    for (const record of Object.values(tableRef.current)) {
      if (!record.acked && record.shelving === null)
        dispatch({ type: "acknowledge", id: record.id, at });
    }
  }, []);
  const shelve = useCallback(
    (id: string, minutes?: number) => dispatch({ type: "shelve", id, minutes, at: Date.now() }),
    [],
  );
  const unshelve = useCallback(
    (id: string) => dispatch({ type: "unshelve", id, at: Date.now() }),
    [],
  );

  const alarms = useMemo(() => sortAlarms(Object.values(table)), [table]);
  return { alarms, acknowledge, acknowledgeAll, shelve, unshelve };
}
