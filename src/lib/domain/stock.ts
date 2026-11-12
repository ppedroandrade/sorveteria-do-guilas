/**
 * Regra única de baixa de estoque (evita duplicidade):
 *
 * O consumo "devido" por um pedido é recalculado a partir dos itens atuais:
 *   devido(produto) = Σ quantidade × consumo_por_unidade (fotografado no item)
 * e é zero se o pedido estiver cancelado.
 *
 * O consumo "já aplicado" é a soma das movimentações SALE/SALE_REVERSAL do pedido.
 * A reconciliação lança apenas a diferença. Por isso criar, editar, cancelar ou
 * reprocessar o mesmo pedido N vezes nunca baixa o estoque em dobro.
 * Mudanças de status (pendente → pronto → entregue) não mexem no estoque.
 */

export type StockItem = {
  productId: string;
  quantity: number;
  stockConsumptionMilli: number | null;
};

export type AppliedMovement = { productId: string; quantityMilli: number };

export function requiredConsumption(items: StockItem[], cancelled: boolean): Map<string, number> {
  const map = new Map<string, number>();
  if (cancelled) return map;
  for (const it of items) {
    if (!it.stockConsumptionMilli) continue;
    map.set(it.productId, (map.get(it.productId) ?? 0) + it.quantity * it.stockConsumptionMilli);
  }
  return map;
}

/** Retorna, por produto, a variação a lançar (negativa = baixa; positiva = estorno). */
export function stockDeltas(required: Map<string, number>, applied: AppliedMovement[]): Map<string, number> {
  const alreadyConsumed = new Map<string, number>();
  for (const m of applied) {
    alreadyConsumed.set(m.productId, (alreadyConsumed.get(m.productId) ?? 0) - m.quantityMilli);
  }
  const deltas = new Map<string, number>();
  const ids = new Set([...required.keys(), ...alreadyConsumed.keys()]);
  for (const id of ids) {
    const diff = (required.get(id) ?? 0) - (alreadyConsumed.get(id) ?? 0);
    if (diff !== 0) deltas.set(id, -diff);
  }
  return deltas;
}

export type StockLevel = "ok" | "low" | "out" | "untracked";

export function stockLevel(p: { trackStock: boolean; stockMilli: number; minStockMilli: number }): StockLevel {
  if (!p.trackStock) return "untracked";
  if (p.stockMilli <= 0) return "out";
  if (p.stockMilli <= p.minStockMilli) return "low";
  return "ok";
}
