// benchcn.dev · robot
// A teleoperated robot: an e-stop that wins over everything, a drive that must be enabled on
// purpose, a joystick that streams velocities only while the drive is confirmed, the path driven
// so far, battery and speed, alarms and the log. Runs on the mock device until you pass a source.
import type { ComponentProps, ReactElement, ReactNode } from "react";

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
import { BatteryIndicator } from "@/registry/benchcn/ui/battery-indicator/battery-indicator";
import { ConnectionStatus } from "@/registry/benchcn/ui/connection-status/connection-status";
import { EmergencyStop } from "@/registry/benchcn/ui/emergency-stop/emergency-stop";
import { Joystick, type JoystickVector } from "@/registry/benchcn/ui/joystick/joystick";
import { OdometryPlot } from "@/registry/benchcn/ui/odometry-plot/odometry-plot";
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
  const { readings, actuators, logs, command, send, received } = source;
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
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
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
          <BatteryIndicator
            label="Battery"
            unit="V"
            min={3.0}
            max={4.2}
            value={typeof battery === "number" ? battery : null}
          />
          <ConnectionStatus source={source} />
        </div>
      </header>

      {kiosk ? (
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 [&_[data-slot=actuator-control]_dl]:hidden">
          {stopControl}
          {pad}
          {driveControl}
        </div>
      ) : (
        // Stop and enable come first so a phone shows them first. On wide screens each row pairs
        // cards of similar height (stop, joystick, odometry; drive and motion; alarms and the log)
        // and the cards stretch to the row, so no column leaves a hole under it.
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Cell className="xl:col-start-1 xl:row-start-1">{stopControl}</Cell>
          <Cell className="xl:col-start-1 xl:row-start-2">{driveControl}</Cell>
          <Cell className="xl:col-start-2 xl:row-start-1">{pad}</Cell>
          <Cell className="xl:col-start-3 xl:row-start-1">
            <OdometryPlot path={trail.path} pose={trail.pose} />
          </Cell>
          <Cell className="md:col-span-2 xl:col-start-2 xl:row-start-2">
            <StripChart title="Motion" series={motion} seconds={30} height={150} />
          </Cell>
          <Cell className="md:col-span-2 xl:col-span-1 xl:col-start-1 xl:row-start-3">
            <AlarmList
              alarms={alarms.alarms}
              onAcknowledge={alarms.acknowledge}
              onAcknowledgeAll={alarms.acknowledgeAll}
              onShelve={alarms.shelve}
              onUnshelve={alarms.unshelve}
            />
          </Cell>
          <Cell className="md:col-span-2 xl:col-start-2 xl:row-start-3">
            <SerialConsole
              lines={logs.map((log, i) => ({ id: i, text: log.log, level: log.lvl, t: log.t }))}
              height={120}
              status={`${received} msgs`}
            />
          </Cell>
        </div>
      )}
    </section>
  );
}

/** A grid cell whose card fills the row's height. */
function Cell({ className, children }: { className?: string; children: ReactNode }): ReactElement {
  return <div className={cn("flex *:min-w-0 *:flex-1", className)}>{children}</div>;
}
