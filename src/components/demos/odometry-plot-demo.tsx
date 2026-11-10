import { type ReactElement, useEffect } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { usePoseTrail } from "@/registry/benchcn/hooks/use-pose-trail";
import { setCommand } from "@/registry/benchcn/lib/wire";
import { OdometryPlot } from "@/registry/benchcn/ui/odometry-plot/odometry-plot";

export function OdometryPlotDemo(): ReactElement {
  const source = useMockDevice({ seed: 61, sampleInterval: 200, faultRate: 0 });
  const { path, pose } = usePoseTrail(source);
  const { command, send } = source;

  // Drive the mock robot in a slow arc so the plot has a path to draw.
  useEffect(() => {
    command("drive", true);
    const timer = window.setInterval(() => {
      send(setCommand("linear", 0.3));
      send(setCommand("angular", 0.35));
    }, 100);
    return () => window.clearInterval(timer);
  }, [command, send]);

  return <OdometryPlot className="mx-auto w-full max-w-md" path={path} pose={pose} />;
}
