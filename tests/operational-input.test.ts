import { describe, expect, it } from "vitest";
import {
  parseOperationalQuantity,
  parseStoreDateTime,
} from "../src/lib/operational-input";

describe("quantidades operacionais", () => {
  it.each([
    ["1.5", 1.5],
    ["1,5", 1.5],
    ["0.0001", 0.0001],
    ["1000000", 1000000],
  ])("interpreta %s sem truncar", (text, expected) =>
    expect(parseOperationalQuantity(text)).toBe(expected),
  );
  it.each([
    "1e3",
    "0x10",
    "1.234,56",
    "1,234.56",
    "0.00001",
    "-2",
    "0",
    "1000001",
    "Infinity",
    "NaN",
    "",
  ])("recusa %s", (text) =>
    expect(() => parseOperationalQuantity(text)).toThrow(),
  );
});

describe("agenda no horário fixado para a loja", () => {
  it("converte 09:30 UTC−3 para 12:30Z", () =>
    expect(parseStoreDateTime("2026-11-02T09:30")).toBe(
      "2026-11-02T12:30:00.000Z",
    ));
  it("aceita o dia bissexto que existe", () =>
    expect(parseStoreDateTime("2028-02-29T23:30")).toBe(
      "2028-03-01T02:30:00.000Z",
    ));
  it.each([
    "2026-02-29T09:00",
    "2026-11-31T09:00",
    "2026-13-01T09:00",
    "2026-11-01T24:00",
    "2026-11-01T09:60",
    "2026-11-01",
    "2026-11-01T09:00Z",
  ])("não corrige silenciosamente %s", (text) =>
    expect(() => parseStoreDateTime(text)).toThrow(),
  );
});
