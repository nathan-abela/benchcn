import type { ReactElement, ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// 16px on touch screens so focusing a field does not zoom the page.
export const FIELD =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full min-w-0 rounded-lg border px-2.5 text-base outline-none focus-visible:ring-[3px] disabled:opacity-50 pointer-fine:text-sm dark:bg-input/30";

export function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <h2 className="text-muted-foreground text-xs font-medium">{title}</h2>
      {children}
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={htmlFor} className="truncate font-mono text-xs">
        {label}
      </label>
      {children}
    </div>
  );
}

export type Option = { value: string; label: string };

/** A shadcn select that takes plain options; Base UI needs `items` to show the chosen label. */
export function StudioSelect({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
}): ReactElement {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next);
      }}
    >
      <SelectTrigger
        aria-label={label}
        className={cn("w-full min-w-0 text-base pointer-fine:text-sm", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Two to four short choices side by side, for options worth seeing at a glance. */
export function Segmented({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: (Option & { disabled?: boolean; title?: string })[];
  onChange: (value: string) => void;
  className?: string;
}): ReactElement {
  return (
    <fieldset
      className={cn(
        "bg-muted grid min-w-0 auto-cols-fr grid-flow-col gap-0.5 rounded-lg p-0.5",
        className,
      )}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={option.disabled}
          aria-pressed={value === option.value}
          aria-label={option.title}
          onClick={() => onChange(option.value)}
          className="text-muted-foreground aria-pressed:bg-background aria-pressed:text-foreground focus-visible:ring-ring/50 dark:aria-pressed:bg-input/50 h-7 min-w-0 truncate rounded-md px-1.5 text-xs font-medium tabular-nums transition-colors duration-150 outline-none focus-visible:ring-[3px] disabled:opacity-40 aria-pressed:shadow-sm"
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
