import { TypeTable } from "fumadocs-ui/components/type-table";
import type { ReactElement } from "react";

import { props } from "@/lib/props";

export type PropsTableProps = {
  of: string;
};

export function PropsTable({ of }: PropsTableProps): ReactElement {
  const doc = props[of];
  if (!doc) return <p className="text-destructive text-sm">No props documented for “{of}”.</p>;
  return (
    <TypeTable
      type={Object.fromEntries(
        Object.entries(doc).map(([name, p]) => [
          name,
          { type: p.type, description: p.description, default: p.default, required: p.required },
        ]),
      )}
    />
  );
}
