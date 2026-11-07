import { Check, Copy } from "lucide-react";
import { type ComponentProps, type ReactElement, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export type CopyButtonProps = Omit<ComponentProps<typeof Button>, "onClick" | "children"> & {
  text: string;
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
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          onCopied?.();
        });
      }}
      {...props}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
      {children}
    </Button>
  );
}
