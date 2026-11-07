// benchcn.dev · boards
import { arduinoUnoR3 } from "@/registry/benchcn/boards/arduino-uno-r3";
import { esp32DevkitcV4 } from "@/registry/benchcn/boards/esp32-devkitc-v4";
import { raspberryPi40Pin } from "@/registry/benchcn/boards/raspberry-pi-40pin";
import { raspberryPiPico } from "@/registry/benchcn/boards/raspberry-pi-pico";
import type { BoardDefinition } from "@/registry/benchcn/boards/types";

export { arduinoUnoR3, esp32DevkitcV4, raspberryPi40Pin, raspberryPiPico };
export type {
  BoardDefinition,
  BusRole,
  HeaderDefinition,
  PinDefinition,
  PinKind,
} from "@/registry/benchcn/boards/types";

export const boards: BoardDefinition[] = [
  raspberryPi40Pin,
  raspberryPiPico,
  esp32DevkitcV4,
  arduinoUnoR3,
];
