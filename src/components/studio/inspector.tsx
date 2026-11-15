import { type ReactElement, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { CATALOG, channelsFor, type Slot } from "@/lib/studio/catalog";
import { type Control, controlsFor, defaultOf } from "@/lib/studio/controls";
import { type PropLiteral, type Span, SPANS, type Widget } from "@/lib/studio/model";
import { bindSlot, CHANNEL_ID, setProp } from "@/lib/studio/state";
import { cn } from "@/lib/utils";
import type { WireChannelInfo } from "@/registry/benchcn/lib/wire";

import { Field, FIELD, Section, Segmented, StudioSelect } from "./fields";

const NONE = "__none";

const SPAN_LABEL: Record<Span, string> = { 3: "1/4", 4: "1/3", 6: "1/2", 8: "2/3", 12: "Full" };

export type InspectorProps = {
  widget: Widget;
  channels: readonly WireChannelInfo[];
  onChange: (widget: Widget) => void;
  onRemove: () => void;
  onClose: () => void;
};

export function Inspector({
  widget,
  channels,
  onChange,
  onRemove,
  onClose,
}: InspectorProps): ReactElement {
  const entry = CATALOG[widget.type];
  const controls = controlsFor(widget.type, entry.editable);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{entry.title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>

      {entry.slots.length > 0 ? (
        <Section title="Data">
          {entry.slots.map((slot) => (
            <SlotField
              key={slot.name}
              slot={slot}
              widget={widget}
              channels={channels}
              onChange={onChange}
            />
          ))}
        </Section>
      ) : null}

      <Section title="Width">
        <Segmented
          label="Width"
          value={String(widget.span)}
          options={SPANS.map((span) => ({
            value: String(span),
            label: SPAN_LABEL[span],
            title: `${span} of 12 columns`,
            disabled: span < entry.minSpan,
          }))}
          onChange={(next) => onChange({ ...widget, span: Number(next) as Span })}
        />
      </Section>

      {controls.length > 0 ? (
        <Section title="Props">
          {controls.map((control) => (
            <ControlField
              key={control.name}
              control={control}
              value={widget.props[control.name]}
              onChange={(value) => onChange(setProp(widget, control.name, value))}
            />
          ))}
        </Section>
      ) : null}

      <Button variant="outline" size="sm" className="self-start" onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}

function channelText(channel: WireChannelInfo): string {
  const name = channel.label ?? channel.id;
  return channel.u ? `${name} (${channel.u})` : name;
}

function SlotField({
  slot,
  widget,
  channels,
  onChange,
}: {
  slot: Slot;
  widget: Widget;
  channels: readonly WireChannelInfo[];
  onChange: (widget: Widget) => void;
}): ReactElement {
  const id = useId();
  const options = channelsFor(slot, channels);
  const value = widget.bind[slot.name];
  const info = (channel: string) => options.find((c) => c.id === channel);

  if (slot.multiple) {
    const selected = Array.isArray(value) ? value : [];
    if (options.length === 0) {
      return (
        <Field label={slot.label} htmlFor={id}>
          <TextInput
            id={id}
            value={selected.join(", ")}
            placeholder="temp, humidity"
            onCommit={(text) => {
              const ids = text
                .split(",")
                .map((s) => s.trim())
                .filter((s) => CHANNEL_ID.test(s));
              onChange(bindSlot(widget, slot.name, ids));
            }}
          />
        </Field>
      );
    }
    return (
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 font-mono text-xs">{slot.label}</legend>
        {options.map((channel) => (
          <label key={channel.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={selected.includes(channel.id)}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...selected, channel.id]
                  : selected.filter((s) => s !== channel.id);
                onChange(bindSlot(widget, slot.name, next));
              }}
            />
            <span className="truncate">{channelText(channel)}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  const current = typeof value === "string" ? value : "";
  if (options.length === 0) {
    return (
      <Field label={slot.label} htmlFor={id}>
        <TextInput
          id={id}
          value={current}
          placeholder={slot.optional ? "None" : "Channel id"}
          onCommit={(text) => {
            if (text === "" && slot.optional) onChange(bindSlot(widget, slot.name, null));
            else if (CHANNEL_ID.test(text)) onChange(bindSlot(widget, slot.name, text));
          }}
        />
      </Field>
    );
  }
  const known = options.some((c) => c.id === current);
  return (
    <Field label={slot.label}>
      <StudioSelect
        label={slot.label}
        value={current === "" ? NONE : current}
        options={[
          ...(slot.optional ? [{ value: NONE, label: "None" }] : []),
          ...(!known && current !== "" ? [{ value: current, label: current }] : []),
          ...options.map((channel) => ({ value: channel.id, label: channelText(channel) })),
        ]}
        onChange={(next) =>
          onChange(bindSlot(widget, slot.name, next === NONE ? null : next, info(next)))
        }
      />
    </Field>
  );
}

/** Commits on blur or Enter, so a half-typed channel id never reaches the canvas. */
function TextInput({
  value,
  onCommit,
  ...props
}: {
  id: string;
  value: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}): ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) onCommit(draft.trim());
    setDraft(null);
  };
  return (
    <input
      {...props}
      className={FIELD}
      value={draft ?? value}
      spellCheck={false}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
}

function NumberInput({
  id,
  value,
  placeholder,
  onChange,
  className,
}: {
  id: string;
  value: number | undefined;
  placeholder?: string;
  onChange: (value: number | undefined) => void;
  className?: string;
}): ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      step="any"
      className={cn(FIELD, "tabular-nums", className)}
      value={draft ?? (value === undefined ? "" : String(value))}
      placeholder={placeholder}
      onChange={(event) => {
        setDraft(event.target.value);
        const text = event.target.value.trim();
        const parsed = Number(text);
        if (text === "") onChange(undefined);
        else if (Number.isFinite(parsed)) onChange(parsed);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function ControlField({
  control,
  value,
  onChange,
}: {
  control: Control;
  value: PropLiteral | undefined;
  onChange: (value: PropLiteral | undefined) => void;
}): ReactElement {
  const id = useId();
  const fallback = defaultOf(control);
  const placeholder = fallback === undefined ? undefined : String(fallback);

  switch (control.kind) {
    case "text":
      return (
        <Field label={control.name} htmlFor={id}>
          <input
            id={id}
            className={FIELD}
            value={typeof value === "string" ? value : ""}
            placeholder={placeholder}
            maxLength={200}
            onChange={(event) =>
              onChange(
                event.target.value === "" && !control.required ? undefined : event.target.value,
              )
            }
          />
        </Field>
      );
    case "number":
      return (
        <Field label={control.name} htmlFor={id}>
          <NumberInput
            id={id}
            value={typeof value === "number" ? value : undefined}
            placeholder={placeholder}
            onChange={(next) => {
              if (next !== undefined || !control.required) onChange(next);
            }}
          />
        </Field>
      );
    case "boolean":
      return (
        <Field label={control.name} htmlFor={id}>
          <Segmented
            label={control.name}
            value={(typeof value === "boolean" ? value : control.default) ? "yes" : "no"}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
            onChange={(next) => onChange(next === "yes")}
          />
        </Field>
      );
    case "choice": {
      const current = typeof value === "string" ? value : (control.default ?? NONE);
      const short =
        control.default !== undefined &&
        control.options.length <= 3 &&
        control.options.every((option) => option.length <= 10);
      return (
        <Field label={control.name}>
          {short ? (
            <Segmented
              label={control.name}
              value={current}
              options={control.options.map((option) => ({ value: option, label: option }))}
              onChange={onChange}
            />
          ) : (
            <StudioSelect
              label={control.name}
              value={current}
              options={[
                ...(control.default === undefined ? [{ value: NONE, label: "Default" }] : []),
                ...control.options.map((option) => ({ value: option, label: option })),
              ]}
              onChange={(next) => onChange(next === NONE ? undefined : next)}
            />
          )}
        </Field>
      );
    }
    case "numbers": {
      const values = typeof value === "object" ? value : {};
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-mono text-xs">{control.name}</legend>
          <div className="grid grid-cols-2 gap-2">
            {control.keys.map((key) => (
              <NumbersKey
                key={key}
                name={key}
                value={values[key]}
                onChange={(next) => {
                  const rest = { ...values };
                  if (next === undefined) delete rest[key];
                  else rest[key] = next;
                  onChange(Object.keys(rest).length === 0 ? undefined : rest);
                }}
              />
            ))}
          </div>
        </fieldset>
      );
    }
  }
}

function NumbersKey({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}): ReactElement {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-muted-foreground font-mono text-xs">
        {name}
      </label>
      <NumberInput id={id} value={value} onChange={onChange} />
    </div>
  );
}
