/**
 * Dinheiro sempre em centavos (inteiros). Nunca some floats de reais.
 */

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(cents: number, currency = "BRL"): string {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("pt-BR", { style: "currency", currency });
    formatters.set(currency, f);
  }
  // Intl usa espaço não separável; normalizamos para espaço comum (mensagens/CSV).
  return f.format(cents / 100).replace(/ /g, " ");
}

/** Converte "45,90", "R$ 1.234,50", "45.9" ou "45" em centavos. Retorna null se inválido. */
export function parseMoneyToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 100);
  }
  let s = input.replace(/[R$\s ]/g, "").trim();
  if (!s) return null;
  const negative = s.startsWith("-");
  s = s.replace(/^-/, "");
  if (s.includes(",")) {
    // padrão brasileiro: ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [int, dec = ""] = s.split(".");
  const cents = Number(int) * 100 + Number((dec + "00").slice(0, 2));
  return negative ? -cents : cents;
}

/** Formata centavos para edição: 4590 → "45,90" */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Quantidade em milésimos → texto pt-BR ("1,5"). */
export function formatMilli(milli: number, maxDecimals = 3): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: maxDecimals }).format(milli / 1000);
}

/** "1,5" | "1.5" | 1.5 → 1500 */
export function parseMilli(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  let n: number;
  if (typeof input === "number") n = input;
  else {
    const s = String(input).trim();
    n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  }
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1000);
}
