import type { ComponentType, ReactElement } from "react";

import { boundIds, CATALOG, type Expr, widgetAttrs, widgetHeader } from "@/lib/studio/catalog";
import { HEADER_READING, HEADER_TITLE, literalProps } from "@/lib/studio/codegen";
import type { Widget, WidgetType } from "@/lib/studio/model";
import { type StripSeries, useStripSeries } from "@/registry/benchcn/hooks/use-strip-series";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import { InstrumentFrame } from "@/registry/benchcn/lib/instrument";
import type { SourceHandle } from "@/registry/benchcn/lib/source-store";
import {
  isCommand,
  parseLine,
  setCommand,
  type WireLog,
  type WireSample,
} from "@/registry/benchcn/lib/wire";
import { ActuatorControl } from "@/registry/benchcn/ui/actuator-control/actuator-control";
import { BatteryIndicator } from "@/registry/benchcn/ui/battery-indicator/battery-indicator";
import { ConnectionStatus } from "@/registry/benchcn/ui/connection-status/connection-status";
import { EmergencyStop } from "@/registry/benchcn/ui/emergency-stop/emergency-stop";
import { LedBar } from "@/registry/benchcn/ui/led-bar/led-bar";
import { MeterReadout } from "@/registry/benchcn/ui/meter-readout/meter-readout";
import { MomentaryButton } from "@/registry/benchcn/ui/momentary-button/momentary-button";
import { PwmSlider } from "@/registry/benchcn/ui/pwm-slider/pwm-slider";
import { RangeBar } from "@/registry/benchcn/ui/range-bar/range-bar";
import { RotaryEncoder } from "@/registry/benchcn/ui/rotary-encoder/rotary-encoder";
import { SensorTile } from "@/registry/benchcn/ui/sensor-tile/sensor-tile";
import {
  type ConsoleLine,
  SerialConsole,
} from "@/registry/benchcn/ui/serial-console/serial-console";
import { SetpointInput } from "@/registry/benchcn/ui/setpoint-input/setpoint-input";
import { SevenSegment } from "@/registry/benchcn/ui/seven-segment/seven-segment";
import { SignalStrength } from "@/registry/benchcn/ui/signal-strength/signal-strength";
import { StatusLed } from "@/registry/benchcn/ui/status-led/status-led";
import { StripChart } from "@/registry/benchcn/ui/strip-chart/strip-chart";

// The catalog decides which props each component receives; this map only renders them.
type LooseComponent = ComponentType<Record<string, unknown>>;

const COMPONENTS = {
  "sensor-tile": SensorTile,
  "range-bar": RangeBar,
  "meter-readout": MeterReadout,
  "seven-segment": SevenSegment,
  "led-bar": LedBar,
  "battery-indicator": BatteryIndicator,
  "signal-strength": SignalStrength,
  "strip-chart": StripChart,
  "status-led": StatusLed,
  "actuator-control": ActuatorControl,
  "momentary-button": MomentaryButton,
  "emergency-stop": EmergencyStop,
  "setpoint-input": SetpointInput,
  "pwm-slider": PwmSlider,
  "rotary-encoder": RotaryEncoder,
  "connection-status": ConnectionStatus,
  "serial-console": SerialConsole,
} as unknown as Record<WidgetType, LooseComponent>;

function numberOf(sample: WireSample | undefined): number | null {
  return sample && typeof sample.v === "number" ? sample.v : null;
}

function timeOf(sample: WireSample | undefined): number | undefined {
  return sample?.t === undefined ? undefined : sample.t * 1000;
}

function consoleLines(logs: WireLog[]): ConsoleLine[] {
  return logs.map((log, i) => ({ id: i, text: log.log, level: log.lvl, t: log.t }));
}

/** The live counterpart of `printExpr` in the code generator: same expression, real values. */
function evaluate(expr: Expr, source: SourceHandle, series: StripSeries[]): unknown {
  switch (expr.op) {
    case "number": {
      const value = numberOf(source.readings[expr.id]);
      return expr.fallback === undefined ? value : (value ?? expr.fallback);
    }
    case "sample":
      return source.readings[expr.id];
    case "history":
      return source.history[expr.id];
    case "time":
      return timeOf(source.readings[expr.id]);
    case "confirmedOn":
      return source.actuators[expr.id]?.confirmed === true;
    case "state":
      return source[expr.map][expr.id] ?? INITIAL_ACTUATOR_STATE;
    case "field":
      return (source[expr.map][expr.id] ?? INITIAL_ACTUATOR_STATE)[expr.field];
    case "command":
      return (value: boolean | number) => source.command(expr.id, value);
    case "stream":
      return (value: number) => source.send(setCommand(expr.id, value));
    case "series":
      return series;
    case "source":
      return source;
    case "lines":
      return consoleLines(source.logs);
    case "sendLine":
      return (line: string) => {
        const message = parseLine(line);
        if (message && isCommand(message)) source.send(message);
      };
    case "readout":
      return numberOf(source.readings[expr.id])?.toFixed(expr.digits) ?? "--";
  }
}

const NO_SERIES: StripSeries[] = [];

type WidgetViewProps = { widget: Widget; source: SourceHandle };

export function WidgetView(props: WidgetViewProps): ReactElement {
  return props.widget.type === "strip-chart" ? <SeriesView {...props} /> : <Rendered {...props} />;
}

function SeriesView({ widget, source }: WidgetViewProps): ReactElement {
  const series = useStripSeries(source, boundIds(widget, "series"));
  return <Rendered widget={widget} source={source} series={series} />;
}

function Rendered({
  widget,
  source,
  series = NO_SERIES,
}: WidgetViewProps & { series?: StripSeries[] }): ReactElement {
  const entry = CATALOG[widget.type];
  const Component = COMPONENTS[widget.type];
  const props: Record<string, unknown> = Object.fromEntries(literalProps(widget));
  for (const attr of widgetAttrs(widget)) {
    if ("spread" in attr) Object.assign(props, evaluate(attr.spread, source, series));
    else props[attr.name] = evaluate(attr.expr, source, series);
  }
  if (!entry.inline) return <Component {...props} />;
  const header = widgetHeader(widget);
  if (!header) {
    return (
      <InstrumentFrame className="justify-center">
        <Component {...props} />
      </InstrumentFrame>
    );
  }
  return (
    <InstrumentFrame className="items-start">
      <div className="flex w-full items-center justify-between gap-3">
        <span className={HEADER_TITLE}>{header.title}</span>
        {header.reading ? (
          <span className={HEADER_READING}>
            {String(evaluate(header.reading, source, series))}
            {header.unit ? ` ${header.unit}` : null}
          </span>
        ) : null}
      </div>
      <Component {...props} />
    </InstrumentFrame>
  );
}
