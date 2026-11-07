import type { ReactElement } from "react";

import { TimingDiagram } from "@/registry/benchcn/ui/timing-diagram/timing-diagram";

export function TimingDiagramDemo(): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <TimingDiagram
        title="SPI mode 0, one byte"
        signals={[
          { name: "CS", wave: "10.........1" },
          { name: "SCLK", wave: "0.pppppppp0." },
          { name: "MOSI", wave: "x.22222222x.", data: ["7", "6", "5", "4", "3", "2", "1", "0"] },
          { name: "MISO", wave: "x.33333333x.", data: ["7", "6", "5", "4", "3", "2", "1", "0"] },
        ]}
        caption="Data is launched on the falling edge and sampled on the rising edge; CS frames the byte."
      />
      <TimingDiagram
        title="I²C write, one byte"
        signals={[
          { name: "SCL", wave: "1.0ppppppppp01" },
          {
            name: "SDA",
            wave: "10.22222222001",
            data: ["A6", "A5", "A4", "A3", "A2", "A1", "A0", "W"],
          },
        ]}
        caption="START is SDA falling while SCL is high; the slave pulls SDA low for ACK on the ninth clock; STOP is SDA rising while SCL is high."
      />
      <TimingDiagram
        title="UART 8N1 frame"
        signals={[
          {
            name: "TX",
            wave: "1.0.=.=.=.=.=.=.=.=.1.",
            data: ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7"],
          },
        ]}
        hscale={24}
        caption="Idle high, one start bit, eight data bits LSB first, one stop bit."
      />
    </div>
  );
}
