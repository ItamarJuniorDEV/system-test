/** Quantidade sem notação científica, milhares implícitos ou arredondamento. */
export function parseOperationalQuantity(text: string): number {
  const value = text.trim();
  if (!/^(?:0|[1-9]\d*)(?:[.,]\d{1,4})?$/.test(value))
    throw new Error(
      "Informe uma quantidade positiva com até quatro casas decimais, sem separador de milhares.",
    );
  const quantity = Number(value.replace(",", "."));
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000)
    throw new Error(
      "A quantidade deve ser maior que zero e no máximo 1.000.000.",
    );
  return quantity;
}

/** Configuração inicial da loja: UTC−3. Datas impossíveis não são ajustadas para outro dia. */
export function parseStoreDateTime(text: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(text);
  if (!match || Number(match[2]) > 23 || Number(match[3]) > 59)
    throw new Error("Informe uma data e uma hora válidas.");
  const day = new Date(`${match[1]}T00:00:00Z`);
  if (
    Number.isNaN(day.getTime()) ||
    day.toISOString().slice(0, 10) !== match[1]
  )
    throw new Error("Esta data não existe no calendário.");
  return new Date(`${text}:00-03:00`).toISOString();
}
