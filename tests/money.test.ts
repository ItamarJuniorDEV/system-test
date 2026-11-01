import { describe, expect, it } from "vitest";
import { brl, parseMoney } from "../src/lib/format";

describe("exibição exata de centavos", () => {
  it.each([
    [1, "R$\u00a00,01"],
    [-1, "-R$\u00a00,01"],
    [586418, "R$\u00a05.864,18"],
    ["8999999999999999", "R$\u00a089.999.999.999.999,99"],
    ["-8999999999999999", "-R$\u00a089.999.999.999.999,99"],
    [null, "R$\u00a00,00"],
  ])("formata %s sem perder o último centavo", (cents, expected) => {
    expect(brl(cents)).toBe(expected);
  });
});

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
