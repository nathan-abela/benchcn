// benchcn.dev · robot
// A teleoperated robot: an e-stop that wins over everything, a drive that must be enabled on
// purpose, a joystick that streams velocities only while the drive is confirmed, the path driven
// so far, battery and speed, alarms and the log. Runs on the mock device until you pass a source.
import type { ComponentProps, ReactElement } from "react";

import { cn } from "@/lib/utils";
import { useAlarms } from "@/registry/benchcn/hooks/use-alarms";
import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { usePoseTrail } from "@/registry/benchcn/hooks/use-pose-trail";
import { useStripSeries } from "@/registry/benchcn/hooks/use-strip-series";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import type { AlarmRule } from "@/registry/benchcn/lib/alarms";
import { InstrumentLabel } from "@/registry/benchcn/lib/instrument";
import type { SourceHandle } from "@/registry/benchcn/lib/source-store";
import { setCommand } from "@/registry/benchcn/lib/wire";
import { ActuatorControl } from "@/registry/benchcn/ui/actuator-control/actuator-control";
import { AlarmList } from "@/registry/benchcn/ui/alarm-list/alarm-list";
import { EmergencyStop } from "@/registry/benchcn/ui/emergency-stop/emergency-stop";
import { Joystick, type JoystickVector } from "@/registry/benchcn/ui/joystick/joystick";
import { OdometryPlot } from "@/registry/benchcn/ui/odometry-plot/odometry-plot";
import { RangeBar } from "@/registry/benchcn/ui/range-bar/range-bar";
import { SerialConsole } from "@/registry/benchcn/ui/serial-console/serial-console";
import { StatusLed } from "@/registry/benchcn/ui/status-led/status-led";
import { StripChart } from "@/registry/benchcn/ui/strip-chart/strip-chart";

export type RobotProps = ComponentProps<"section"> & {
  /** Any source handle. Without one the block runs its own mock device. */
  source?: SourceHandle;
  title?: string;
  /** `kiosk` fills an 800×480 touchscreen with the stop, the drive and the joystick. */
  layout?: "grid" | "kiosk";
  /** Channel ids, if your device names them differently. */
  channels?: Partial<typeof DEFAULT_CHANNELS>;
  /** Full-stick speeds sent to the device. Match them to the robot. */
  limits?: { linear?: number; angular?: number };
};

const DEFAULT_CHANNELS = {
  estop: "estop",
  drive: "drive",
  linear: "linear",
  angular: "angular",
  speed: "speed",
  turnRate: "turn-rate",
  battery: "battery",
};

export function Robot({ source, ...props }: RobotProps): ReactElement {
  return source ? <Panel source={source} {...props} /> : <MockPanel {...props} />;
}

function MockPanel(props: Omit<RobotProps, "source">): ReactElement {
  const source = useMockDevice({ seed: 41, sampleInterval: 200, failSafe: { drive: false } });
  return <Panel source={source} {...props} />;
}

function Panel({
  source,
  title = "Robot",
  layout = "grid",
  channels: overrides,
  limits,
  className,
  ...props
}: Omit<RobotProps, "source"> & { source: SourceHandle }): ReactElement {
  const ch = { ...DEFAULT_CHANNELS, ...overrides };
  const { readings, history, actuators, logs, command, send, received } = source;
  const kiosk = layout === "kiosk";
  const estop = actuators[ch.estop] ?? INITIAL_ACTUATOR_STATE;
  const drive = actuators[ch.drive] ?? INITIAL_ACTUATOR_STATE;
  const stopped = estop.commanded === true || estop.confirmed === true;
  // Velocities only go out while the device has confirmed the drive and nobody has pressed stop.
  const canDrive = drive.confirmed === true && !stopped;
  const maxLinear = limits?.linear ?? 0.5;
  const maxAngular = limits?.angular ?? 1.5;

  const onDrive = ({ x, y }: JoystickVector) => {
    if (!canDrive && (x !== 0 || y !== 0)) return;
    send(setCommand(ch.linear, Number((y * maxLinear).toFixed(3))));
    send(setCommand(ch.angular, Number((-x * maxAngular).toFixed(3))));
  };

  const rules: AlarmRule[] = [
    {
      id: "battery-low",
      channel: ch.battery,
      message: "Battery low",
      priority: "medium",
      below: 3.5,
      deadband: 0.05,
    },
    {
      id: "telemetry-lost",
      channel: ch.speed,
      message: "Telemetry lost",
      priority: "high",
      staleAfter: 2000,
    },
  ];
  const alarms = useAlarms(source, rules);
  const trail = usePoseTrail(source);
  const motion = useStripSeries(source, [ch.speed, ch.turnRate]);
  const battery = readings[ch.battery]?.v;

  const stopControl = (
    <EmergencyStop
      {...estop}
      onCommand={(engaged) => command(ch.estop, engaged)}
      description="Reset does not restart it"
    />
  );
  const driveControl = (
    <ActuatorControl
      label="Drive"
      description="Refused while stopped"
      {...drive}
      onCommand={(next) => command(ch.drive, next)}
    />
  );
  const pad = <Joystick onChange={onDrive} disabled={!canDrive} />;

  return (
    <section
      data-slot="robot"
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
            label="Drive"
            color="green"
            size="sm"
            on={drive.confirmed === true}
            showLabel
          />
          <StatusLed
            label="Stop"
            color="red"
            size="sm"
            pattern="blink"
            on={estop.confirmed === true}
            showLabel
          />
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
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 [&_[data-slot=actuator-control]_dl]:hidden">
          {stopControl}
          {pad}
          {driveControl}
        </div>
      ) : (
        <>
          {/* Stop and enable sit together, so on a phone they come first. */}
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="flex flex-col gap-4">
              {stopControl}
              {driveControl}
            </div>
            <div className="flex flex-col gap-4">
              {pad}
              <RangeBar
                label="Battery"
                unit="V"
                min={3}
                max={4.2}
                precision={2}
                thresholds={{ low: 3.3, warnBelow: 3.5 }}
                value={typeof battery === "number" ? battery : null}
                recent={history[ch.battery]}
              />
            </div>
            <OdometryPlot
              className="md:col-span-2 xl:col-span-1"
              path={trail.path}
              pose={trail.pose}
            />
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-3">
            <AlarmList
              alarms={alarms.alarms}
              onAcknowledge={alarms.acknowledge}
              onAcknowledgeAll={alarms.acknowledgeAll}
              onShelve={alarms.shelve}
              onUnshelve={alarms.unshelve}
            />
            <StripChart
              className="xl:col-span-2"
              title="Motion"
              series={motion}
              seconds={30}
              height={150}
            />
          </div>
          <SerialConsole
            lines={logs.map((log, i) => ({ id: i, text: log.log, level: log.lvl, t: log.t }))}
            height={120}
            status={`${received} msgs`}
          />
        </>
      )}
    </section>
  );
}
