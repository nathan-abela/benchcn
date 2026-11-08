// benchcn.dev · power-bench
// A bench supply driving a device under test: voltage and current-limit setpoints that only count
// once acknowledged, an output that must be held to switch, the supply's own readback with its
// CV/CC mode, a meter at the load, a trend of both and the log. Runs on the mock device until you
// pass a source.
import type { ComponentProps, ReactElement } from "react";

import { cn } from "@/lib/utils";
import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { useStripSeries } from "@/registry/benchcn/hooks/use-strip-series";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";
import type { SourceHandle } from "@/registry/benchcn/lib/source-store";
import type { WireSample } from "@/registry/benchcn/lib/wire";
import { ActuatorControl } from "@/registry/benchcn/ui/actuator-control/actuator-control";
import { MeterReadout } from "@/registry/benchcn/ui/meter-readout/meter-readout";
import { SerialConsole } from "@/registry/benchcn/ui/serial-console/serial-console";
import { SetpointInput } from "@/registry/benchcn/ui/setpoint-input/setpoint-input";
import { SevenSegment } from "@/registry/benchcn/ui/seven-segment/seven-segment";
import { StatusLed } from "@/registry/benchcn/ui/status-led/status-led";
import { StripChart } from "@/registry/benchcn/ui/strip-chart/strip-chart";

export type PowerBenchProps = ComponentProps<"section"> & {
  /** Any source handle. Without one the block runs its own mock device. */
  source?: SourceHandle;
  title?: string;
  /** `kiosk` fills an 800×480 touchscreen with the supply controls and no chart or console. */
  layout?: "grid" | "kiosk";
  /** Channel ids, if your device names them differently. */
  channels?: Partial<typeof DEFAULT_CHANNELS>;
  /** Ranges the setpoint inputs accept. Match them to your supply. */
  limits?: { volts?: number; amps?: number };
};

const DEFAULT_CHANNELS = {
  /** Setpoints and the output relay. */
  volts: "psu-v",
  amps: "psu-i",
  output: "psu-out",
  /** Readback from the supply, its regulation mode, and a meter at the load. */
  vout: "psu-vout",
  iout: "psu-iout",
  mode: "psu-mode",
  meter: "dmm-v",
};

export function PowerBench({ source, ...props }: PowerBenchProps): ReactElement {
  return source ? <Panel source={source} {...props} /> : <MockPanel {...props} />;
}

function MockPanel(props: Omit<PowerBenchProps, "source">): ReactElement {
  const source = useMockDevice({
    seed: 31,
    sampleInterval: 500,
    failSafe: { "psu-out": false },
  });
  return <Panel source={source} {...props} />;
}

function numberOf(sample: WireSample | undefined): number | null {
  return sample && typeof sample.v === "number" ? sample.v : null;
}

function Panel({
  source,
  title = "Power bench",
  layout = "grid",
  channels: overrides,
  limits,
  className,
  ...props
}: Omit<PowerBenchProps, "source"> & { source: SourceHandle }): ReactElement {
  const ch = { ...DEFAULT_CHANNELS, ...overrides };
  const { readings, setpoints, actuators, logs, command, received } = source;
  const kiosk = layout === "kiosk";
  const output = actuators[ch.output] ?? INITIAL_ACTUATOR_STATE;
  const volts = setpoints[ch.volts] ?? INITIAL_ACTUATOR_STATE;
  const amps = setpoints[ch.amps] ?? INITIAL_ACTUATOR_STATE;
  const vout = numberOf(readings[ch.vout]);
  const iout = numberOf(readings[ch.iout]);
  const mode = typeof readings[ch.mode]?.v === "string" ? (readings[ch.mode]?.v as string) : null;
  const meter = readings[ch.meter];
  const series = useStripSeries(source, [ch.vout, ch.iout]);
  const watts = vout !== null && iout !== null ? vout * iout : null;

  const channel = (
    <div
      data-slot="power-bench-channel"
      className={cn(INSTRUMENT_FRAME, "gap-4", kiosk && "flex-1 justify-between")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Channel 1</span>
        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            mode === "CC" ? "text-warning" : "text-muted-foreground",
          )}
        >
          {mode === "OFF" || mode === null ? "Off" : mode}
        </span>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Readback value={vout} decimals={2} unit="V" color="amber" />
        <Readback value={iout} decimals={3} unit="A" color="red" />
      </div>
      <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
        <span>Power</span>
        <span>{watts === null ? "--" : `${watts.toFixed(2)} W`}</span>
      </div>
    </div>
  );
  const meterReadout = (
    <MeterReadout
      label="Meter at the load"
      mode="DC V"
      value={numberOf(meter)}
      unit="V"
      sampleKey={meter}
      color="green"
    />
  );
  const outputControl = (
    <ActuatorControl
      className="md:col-span-2 xl:col-span-1"
      label="Output"
      description="Hold to switch · fail-safe off"
      {...output}
      onCommand={(next) => command(ch.output, next)}
    />
  );
  const voltage = (
    <SetpointInput
      label="Voltage"
      unit="V"
      min={0}
      max={limits?.volts ?? 30}
      step={0.01}
      confirm={5}
      value={vout}
      {...volts}
      onCommand={(next) => command(ch.volts, next)}
    />
  );
  const current = (
    <SetpointInput
      label="Current limit"
      unit="A"
      min={0.05}
      max={limits?.amps ?? 3}
      step={0.01}
      precision={2}
      value={iout}
      {...amps}
      onCommand={(next) => command(ch.amps, next)}
    />
  );

  return (
    <section
      data-slot="power-bench"
      data-layout={layout}
      className={cn(
        "bg-background text-foreground flex flex-col gap-4",
        kiosk && "h-[480px] w-[800px] overflow-hidden p-4",
        className,
      )}
      {...props}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <InstrumentLabel>{title}</InstrumentLabel>
        <div className="flex items-center gap-4">
          <StatusLed
            label="Output"
            color="green"
            size="sm"
            on={output.confirmed === true}
            showLabel
          />
          <StatusLed label="CC" color="amber" size="sm" on={mode === "CC"} showLabel />
          <StatusLed
            label="Link"
            color="blue"
            size="sm"
            pattern="heartbeat"
            rate={1}
            on={received > 0}
            showLabel
          />
        </div>
      </header>

      {kiosk ? (
        // 800×480: readback tall on the left, setpoints and output beside it. The readout rows are
        // hidden because each card's status word already says Waiting or Confirmed.
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 [&_[data-slot=actuator-control]_dl]:hidden [&_[data-slot=setpoint-input]_dl]:hidden">
          <div className="row-span-2 flex">{channel}</div>
          {voltage}
          {current}
          <div className="col-span-2">{outputControl}</div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {channel}
            {meterReadout}
            {outputControl}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {voltage}
            {current}
          </div>
        </>
      )}

      {kiosk ? null : <StripChart title="Output" series={series} seconds={60} height={160} />}

      {kiosk ? null : (
        <SerialConsole
          lines={logs.map((log, i) => ({ id: i, text: log.log, level: log.lvl, t: log.t }))}
          height={120}
          status={`${received} msgs`}
        />
      )}
    </section>
  );
}

function Readback({
  value,
  decimals,
  unit,
  color,
}: {
  value: number | null;
  decimals: number;
  unit: string;
  color: "amber" | "red";
}): ReactElement {
  return (
    <div className="flex items-end gap-2">
      <SevenSegment
        value={value === null ? "----" : value}
        decimals={value === null ? undefined : decimals}
        digits={5}
        size={40}
        color={color}
        label={value === null ? `No ${unit} reading` : `${value.toFixed(decimals)} ${unit}`}
      />
      <span className="text-muted-foreground w-4 pb-0.5 text-sm">{unit}</span>
    </div>
  );
}
