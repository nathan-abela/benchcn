import { type ReactElement, useEffect, useRef, useState } from "react";

import { LogicAnalyzerDemo } from "@/components/demos/logic-analyzer-demo";
import { OscilloscopeDemo } from "@/components/demos/oscilloscope-demo";
import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { useStripSeries } from "@/registry/benchcn/hooks/use-strip-series";
import { StripChart } from "@/registry/benchcn/ui/strip-chart/strip-chart";

const MIN_PLOT = 200;

/**
 * Grows the plot to whatever height the slot has, so the column beside the scope ends where the
 * scope does. The scope keeps a fixed aspect, so that height changes with the page width.
 */
function useFillHeight() {
  const slotRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [plot, setPlot] = useState(MIN_PLOT);

  useEffect(() => {
    const slot = slotRef.current;
    const chart = chartRef.current;
    if (!slot || !chart) return;
    const observer = new ResizeObserver(() => {
      setPlot((current) => {
        const chrome = chart.offsetHeight - current;
        return Math.max(MIN_PLOT, Math.floor(slot.clientHeight - chrome));
      });
    });
    // The chart is watched too: its first layout lands after the slot's, and only then is the
    // height around its plot known.
    observer.observe(slot);
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);

  return { slotRef, chartRef, plot };
}

/** The three signal instruments: a fast analog capture, a digital bus, and a slow trend. */
export function SignalsBench(): ReactElement {
  const source = useMockDevice({ seed: 12, sampleInterval: 500 });
  const series = useStripSeries(source, ["temp", "pressure"]);
  const { slotRef, chartRef, plot } = useFillHeight();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0 self-start">
        <OscilloscopeDemo />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        {/* The chart sits out of flow, so the slot takes the height left over, not the chart's. */}
        <div ref={slotRef} className="relative min-h-[308px] flex-1">
          <div ref={chartRef} className="absolute inset-x-0 top-0">
            <StripChart
              title="Climate"
              series={series}
              seconds={60}
              staleAfter={2000}
              height={plot}
            />
          </div>
        </div>
        <LogicAnalyzerDemo />
      </div>
    </div>
  );
}
