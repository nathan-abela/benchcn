import { type ComponentProps, type ReactElement, useEffect, useState } from "react";

import { CheckIcon, CopyIcon } from "@/components/site/icons";
import { Button } from "@/components/ui/button";

export type CopyButtonProps = Omit<ComponentProps<typeof Button>, "onClick" | "children"> & {
  /** The text to copy, or a function that produces it when pressed. */
  text: string | (() => Promise<string>);
  label?: string;
  onCopied?: () => void;
  children?: ReactElement | string;
};

export function CopyButton({
  text,
  label = "Copy",
  onCopied,
  children,
  variant = "ghost",
  size = "icon-xs",
  ...props
}: CopyButtonProps): ReactElement {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-label={copied ? "Copied" : label}
      onClick={() => {
        const value = typeof text === "function" ? text() : Promise.resolve(text);
        void value
          .then((content) => navigator.clipboard.writeText(content))
          .then(() => {
            setCopied(true);
            onCopied?.();
          })
          .catch((error: unknown) => console.error(error));
      }}
      {...props}
    >
      <span className="relative grid size-4 place-items-center *:col-start-1 *:row-start-1 *:transition-[opacity,scale,filter] *:duration-150 *:ease-out">
        <CopyIcon className={copied ? "scale-75 opacity-0 blur-[2px]" : ""} />
        <CheckIcon className={copied ? "text-success" : "scale-75 opacity-0 blur-[2px]"} />
      </span>
      {children}
    </Button>
  );
}
