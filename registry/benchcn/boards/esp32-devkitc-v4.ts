// benchcn.dev · boards-esp32-devkitc-v4
import type { BoardDefinition, PinDefinition } from "@/registry/benchcn/boards/types";

const INPUT_ONLY = "Input only (Type I in the user guide)";
const FLASH =
  "Used internally for communication between ESP32 and SPI flash memory; avoid using this pin";
const WROVER =
  "Available only on boards with ESP32-WROOM and ESP32-SOLO-1 modules; " +
  "reserved for internal use on ESP32-WROVER boards";

function adc(channel: string): NonNullable<PinDefinition["alt"]>[number] {
  return { adc: { channel } };
}

const gnd = (number: number): PinDefinition => ({
  number,
  name: "GND",
  kind: "ground",
  functions: ["Ground"],
});

export const esp32DevkitcV4: BoardDefinition = {
  id: "esp32-devkitc-v4",
  name: "ESP32-DevKitC V4",
  vendor: "Espressif Systems",
  source: {
    title: "ESP32-DevKitC V4",
    url:
      "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/" +
      "user_guide.html",
    retrieved: "2026-11-07",
  },
  logicLevel: 3.3,
  headers: [
    {
      id: "j2",
      label: "J2",
      rows: 19,
      columns: 1,
      numbering: "columns",
      pins: [
        { number: 1, name: "3V3", kind: "power", functions: ["3.3 V power supply"], voltage: 3.3 },
        {
          number: 2,
          name: "EN",
          kind: "reserved",
          functions: ["CHIP_PU", "Reset"],
          note: INPUT_ONLY,
        },
        {
          number: 3,
          name: "VP",
          kind: "gpio",
          functions: ["GPIO36", "ADC1_CH0", "S_VP"],
          alt: [adc("ADC1_CH0")],
          note: INPUT_ONLY,
        },
        {
          number: 4,
          name: "VN",
          kind: "gpio",
          functions: ["GPIO39", "ADC1_CH3", "S_VN"],
          alt: [adc("ADC1_CH3")],
          note: INPUT_ONLY,
        },
        {
          number: 5,
          name: "IO34",
          kind: "gpio",
          functions: ["GPIO34", "ADC1_CH6", "VDET_1"],
          alt: [adc("ADC1_CH6")],
          note: INPUT_ONLY,
        },
        {
          number: 6,
          name: "IO35",
          kind: "gpio",
          functions: ["GPIO35", "ADC1_CH7", "VDET_2"],
          alt: [adc("ADC1_CH7")],
          note: INPUT_ONLY,
        },
        {
          number: 7,
          name: "IO32",
          kind: "gpio",
          functions: ["GPIO32", "ADC1_CH4", "TOUCH_CH9", "XTAL_32K_P"],
          alt: [adc("ADC1_CH4")],
        },
        {
          number: 8,
          name: "IO33",
          kind: "gpio",
          functions: ["GPIO33", "ADC1_CH5", "TOUCH_CH8", "XTAL_32K_N"],
          alt: [adc("ADC1_CH5")],
        },
        {
          number: 9,
          name: "IO25",
          kind: "gpio",
          functions: ["GPIO25", "ADC2_CH8", "DAC_1"],
          alt: [adc("ADC2_CH8")],
        },
        {
          number: 10,
          name: "IO26",
          kind: "gpio",
          functions: ["GPIO26", "ADC2_CH9", "DAC_2"],
          alt: [adc("ADC2_CH9")],
        },
        {
          number: 11,
          name: "IO27",
          kind: "gpio",
          functions: ["GPIO27", "ADC2_CH7", "TOUCH_CH7"],
          alt: [adc("ADC2_CH7")],
        },
        {
          number: 12,
          name: "IO14",
          kind: "gpio",
          functions: ["GPIO14", "ADC2_CH6", "TOUCH_CH6", "MTMS"],
          alt: [adc("ADC2_CH6")],
        },
        {
          number: 13,
          name: "IO12",
          kind: "gpio",
          functions: ["GPIO12", "ADC2_CH5", "TOUCH_CH5", "MTDI"],
          alt: [adc("ADC2_CH5")],
        },
        gnd(14),
        {
          number: 15,
          name: "IO13",
          kind: "gpio",
          functions: ["GPIO13", "ADC2_CH4", "TOUCH_CH4", "MTCK"],
          alt: [adc("ADC2_CH4")],
        },
        { number: 16, name: "D2", kind: "reserved", functions: ["GPIO9", "D2"], note: FLASH },
        { number: 17, name: "D3", kind: "reserved", functions: ["GPIO10", "D3"], note: FLASH },
        { number: 18, name: "CMD", kind: "reserved", functions: ["GPIO11", "CMD"], note: FLASH },
        { number: 19, name: "5V", kind: "power", functions: ["5 V power supply"], voltage: 5 },
      ],
    },
    {
      id: "j3",
      label: "J3",
      rows: 19,
      columns: 1,
      numbering: "columns",
      pins: [
        gnd(1),
        { number: 2, name: "IO23", kind: "gpio", functions: ["GPIO23"] },
        { number: 3, name: "IO22", kind: "gpio", functions: ["GPIO22"] },
        {
          number: 4,
          name: "TX",
          kind: "gpio",
          functions: ["GPIO1", "U0TXD"],
          alt: [{ uart: { port: 0, role: "tx" } }],
        },
        {
          number: 5,
          name: "RX",
          kind: "gpio",
          functions: ["GPIO3", "U0RXD"],
          alt: [{ uart: { port: 0, role: "rx" } }],
        },
        { number: 6, name: "IO21", kind: "gpio", functions: ["GPIO21"] },
        gnd(7),
        { number: 8, name: "IO19", kind: "gpio", functions: ["GPIO19"] },
        { number: 9, name: "IO18", kind: "gpio", functions: ["GPIO18"] },
        { number: 10, name: "IO5", kind: "gpio", functions: ["GPIO5"] },
        { number: 11, name: "IO17", kind: "gpio", functions: ["GPIO17"], note: WROVER },
        { number: 12, name: "IO16", kind: "gpio", functions: ["GPIO16"], note: WROVER },
        {
          number: 13,
          name: "IO4",
          kind: "gpio",
          functions: ["GPIO4", "ADC2_CH0", "TOUCH_CH0"],
          alt: [adc("ADC2_CH0")],
        },
        {
          number: 14,
          name: "IO0",
          kind: "gpio",
          functions: ["GPIO0", "ADC2_CH1", "TOUCH_CH1", "Boot"],
          alt: [adc("ADC2_CH1")],
          note: "Boot button pulls this pin low to enter Firmware Download mode",
        },
        {
          number: 15,
          name: "IO2",
          kind: "gpio",
          functions: ["GPIO2", "ADC2_CH2", "TOUCH_CH2"],
          alt: [adc("ADC2_CH2")],
        },
        {
          number: 16,
          name: "IO15",
          kind: "gpio",
          functions: ["GPIO15", "ADC2_CH3", "TOUCH_CH3", "MTDO"],
          alt: [adc("ADC2_CH3")],
        },
        { number: 17, name: "D1", kind: "reserved", functions: ["GPIO8", "D1"], note: FLASH },
        { number: 18, name: "D0", kind: "reserved", functions: ["GPIO7", "D0"], note: FLASH },
        { number: 19, name: "CLK", kind: "reserved", functions: ["GPIO6", "CLK"], note: FLASH },
      ],
    },
  ],
};
