import { describe, expect, it } from "vitest";
import { parseMoney } from "../src/lib/format";

describe("valores monetários dos formulários", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,5", 123450],
    ["0,01", 1],
    ["1500", 150000],
    ["0", 0],
  ])("converte %s exatamente em centavos", (input, cents) =>
    expect(parseMoney(input)).toBe(cents),
  );
  it.each([
    "12.34",
    "1,234",
    "-1",
    "1e3",
    "NaN",
    "",
    "12 000",
    "9999999999999999999999",
    "01,00",
    "1.234,567",
  ])("rejeita entrada ambígua ou inválida %s", (input) =>
    expect(() => parseMoney(input)).toThrow(),
  );
});
