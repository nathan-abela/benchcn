import { describe, expect, it } from "vitest";

import {
  type Bitmap,
  createBitmap,
  drawLine,
  drawRect,
  drawText,
  fromSsd1306,
  getPixel,
  setPixel,
  textBitmap,
  textWidth,
  toSsd1306,
  windowBitmap,
} from "./bitmap";

function rows(bitmap: Bitmap): string[] {
  return Array.from({ length: bitmap.height }, (_, y) =>
    Array.from({ length: bitmap.width }, (__, x) => (getPixel(bitmap, x, y) ? "#" : ".")).join(""),
  );
}

describe("setPixel", () => {
  it("should ignore pixels outside the bitmap", () => {
    // #given
    const bitmap = createBitmap(2, 2);

    // #when
    setPixel(bitmap, -1, 0);
    setPixel(bitmap, 2, 1);
    setPixel(bitmap, 1, 1);

    // #then
    expect(rows(bitmap)).toEqual(["..", ".#"]);
  });
});

describe("drawLine", () => {
  it("should include both end points of a diagonal", () => {
    // #given
    const bitmap = createBitmap(4, 4);

    // #when
    drawLine(bitmap, 0, 0, 3, 3);

    // #then
    expect(rows(bitmap)).toEqual(["#...", ".#..", "..#.", "...#"]);
  });

  it("should draw right to left the same as left to right", () => {
    // #given
    const bitmap = createBitmap(5, 2);

    // #when
    drawLine(bitmap, 4, 0, 0, 0);

    // #then
    expect(rows(bitmap)).toEqual(["#####", "....."]);
  });
});

describe("drawRect", () => {
  it("should outline without filling", () => {
    // #given
    const bitmap = createBitmap(4, 3);

    // #when
    drawRect(bitmap, 0, 0, 4, 3);

    // #then
    expect(rows(bitmap)).toEqual(["####", "#..#", "####"]);
  });
});

describe("drawText", () => {
  it("should draw the HD44780 glyph with its left column at x", () => {
    // #given
    const bitmap = createBitmap(5, 8);

    // #when
    drawText(bitmap, "1", 0, 0);

    // #then
    expect(rows(bitmap)).toEqual([
      "..#..",
      ".##..",
      "..#..",
      "..#..",
      "..#..",
      "..#..",
      ".###.",
      ".....",
    ]);
  });

  it("should return where the next character starts", () => {
    // #given
    const bitmap = createBitmap(32, 16);

    // #when
    const next = drawText(bitmap, "ab", 2, 0, { scale: 2 });

    // #then
    expect(next).toBe(26);
  });
});

describe("textWidth", () => {
  it("should leave out the spacing after the last character", () => {
    // #when / #then
    expect([textWidth(""), textWidth("a"), textWidth("abc"), textWidth("ab", 2)]).toEqual([
      0, 5, 17, 22,
    ]);
  });
});

describe("windowBitmap", () => {
  it("should slide content in from the right for a negative offset", () => {
    // #given
    const source = textBitmap("1");

    // #when
    const view = windowBitmap(source, -3, 5, 2);

    // #then
    expect(rows(view)).toEqual([".....", "....#"]);
  });

  it("should leave columns past the end of the source blank", () => {
    // #given
    const source = createBitmap(2, 1);
    setPixel(source, 1, 0);

    // #when
    const view = windowBitmap(source, 1, 3, 1);

    // #then
    expect(rows(view)).toEqual(["#.."]);
  });
});

describe("fromSsd1306", () => {
  it("should read bit 0 as the top row of each page", () => {
    // #given
    const buffer = new Uint8Array(128 * 8);
    buffer[0] = 0b0000_0001;
    buffer[3] = 0b1000_0000;
    buffer[128 + 5] = 0b0000_0100;

    // #when
    const bitmap = fromSsd1306(buffer);

    // #then
    expect([
      getPixel(bitmap, 0, 0),
      getPixel(bitmap, 3, 7),
      getPixel(bitmap, 5, 10),
      bitmap.data.reduce((sum, v) => sum + v, 0),
    ]).toEqual([true, true, true, 3]);
  });

  it("should treat a short buffer as blank past its end", () => {
    // #when
    const bitmap = fromSsd1306([0xff], 4, 8);

    // #then
    expect(rows(bitmap).map((row) => row[0] + row[1])).toEqual(Array<string>(8).fill("#."));
  });
});

describe("toSsd1306", () => {
  it("should round trip through fromSsd1306", () => {
    // #given
    const bitmap = createBitmap(128, 64);
    drawText(bitmap, "benchcn 21.5", 3, 9);
    drawLine(bitmap, 0, 63, 127, 20);

    // #when
    const back = fromSsd1306(toSsd1306(bitmap));

    // #then
    expect(back.data).toEqual(bitmap.data);
  });

  it("should round a height that is not a multiple of eight up to whole pages", () => {
    // #when / #then
    expect(toSsd1306(createBitmap(8, 12)).length).toBe(16);
  });
});
