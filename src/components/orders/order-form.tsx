"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Leaf, Minus, Plus, Search, Store, Trash2, Truck, StickyNote } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { MoneyInput } from "@/components/shared/money-input";
import { CustomerPicker } from "./customer-picker";
import { useAction } from "@/components/shared/use-action";
import { computeOrderTotals } from "@/lib/domain/order-calc";
import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS } from "@/lib/domain/labels";
import { formatMilli, formatMoney } from "@/lib/money";
import { orderSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { SellableProduct } from "@/lib/services/products";
import type { CustomerOption } from "@/server/actions/customers";
import { createOrderAction, updateOrderAction } from "@/server/actions/orders";

export type OrderFormItem = {
  key: string;
  id?: string | null; // item já gravado (edição)
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  unitPriceCents: number;
  quantity: number;
  notes: string;
  showNotes?: boolean;
};

export type OrderFormValues = {
  customer: CustomerOption | null;
  items: OrderFormItem[];
  fulfillment: "PICKUP" | "DELIVERY";
  deliveryAddress: string;
  deliveryFeeCents: number;
  scheduledFor: string;
  discountType: "AMOUNT" | "PERCENT";
  discountAmountCents: number;
  discountPercent: string;
  preferredPaymentMethod: PaymentMethod | "";
  notes: string;
  payNow: boolean;
  payNowMethod: PaymentMethod;
  payNowAmountCents: number | null; // null = valor total
};

function newKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function safeQty(q: unknown): number {
  const n = Number(q);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, 999) : 1;
}

function percentToBasisPoints(text: string): number {
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

function customerAddress(c: CustomerOption | null) {
  if (!c) return "";
  return [c.address, c.neighborhood, c.city].filter(Boolean).join(", ");
}

export function OrderForm({
  mode,
  orderId,
  catalog,
  currency,
  defaultDeliveryFeeCents,
  initial,
  warnings,
}: {
  mode: "create" | "edit";
  orderId?: string;
  catalog: SellableProduct[];
  currency: string;
  defaultDeliveryFeeCents: number;
  initial?: Partial<OrderFormValues>;
  warnings?: string[];
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [idempotencyKey] = React.useState(newKey);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string | null>(null);

  const form = useForm<OrderFormValues>({
    defaultValues: {
      customer: null,
      items: [],
      fulfillment: "PICKUP",
      deliveryAddress: "",
      deliveryFeeCents: defaultDeliveryFeeCents,
      scheduledFor: "",
      discountType: "AMOUNT",
      discountAmountCents: 0,
      discountPercent: "",
      preferredPaymentMethod: "",
      notes: "",
      payNow: false,
      payNowMethod: "PIX",
      payNowAmountCents: null,
      ...initial,
    },
  });
  const { control, register, setValue, getValues, handleSubmit, formState } = form;
  const items = useFieldArray({ control, name: "items", keyName: "_rhfKey" });
  const w = useWatch({ control });

  const discountValue =
    w.discountType === "PERCENT" ? percentToBasisPoints(w.discountPercent ?? "") : (w.discountAmountCents ?? 0);

  const totals = React.useMemo(() => {
    try {
      return {
        ok: true as const,
        ...computeOrderTotals({
          items: (w.items ?? []).map((i) => ({ unitPriceCents: i?.unitPriceCents ?? 0, quantity: safeQty(i?.quantity) })),
          discountType: w.discountType,
          discountValue,
          deliveryFeeCents: w.fulfillment === "DELIVERY" ? (w.deliveryFeeCents ?? 0) : 0,
        }),
      };
    } catch (e) {
      const subtotal = (w.items ?? []).reduce((s, i) => s + (i?.unitPriceCents ?? 0) * safeQty(i?.quantity), 0);
      return {
        ok: false as const,
        error: (e as Error).message,
        subtotalCents: subtotal,
        discountCents: 0,
        deliveryFeeCents: w.fulfillment === "DELIVERY" ? (w.deliveryFeeCents ?? 0) : 0,
        totalCents: subtotal + (w.fulfillment === "DELIVERY" ? (w.deliveryFeeCents ?? 0) : 0),
      };
    }
  }, [w.items, w.discountType, discountValue, w.fulfillment, w.deliveryFeeCents]);

  const categories = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of catalog) map.set(p.categoryId ?? "none", p.categoryName);
    return [...map.entries()];
  }, [catalog]);

  const visibleProducts = React.useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "");
    return catalog.filter((p) => {
      if (category && (p.categoryId ?? "none") !== category) return false;
      if (!term) return true;
      return p.name.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "").includes(term);
    });
  }, [catalog, search, category]);

  // Quantidade já no carrinho por variante (para destacar os botões)
  const qtyByVariant = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const it of w.items ?? []) if (it?.variantId) m.set(it.variantId, (m.get(it.variantId) ?? 0) + safeQty(it.quantity));
    return m;
  }, [w.items]);

  function addVariant(p: SellableProduct, v: SellableProduct["variants"][number]) {
    const current = getValues("items");
    // incrementa uma linha nova (sem id gravado) da mesma variante, se houver
    const idx = current.findIndex((i) => i.variantId === v.id && !i.id);
    if (idx >= 0) {
      setValue(`items.${idx}.quantity`, Math.min(999, safeQty(current[idx].quantity) + 1), { shouldDirty: true });
    } else {
      items.append({
        key: newKey(),
        id: null,
        variantId: v.id,
        productId: p.id,
        productName: p.name,
        variantName: v.name,
        unitPriceCents: v.priceCents,
        quantity: 1,
        notes: "",
      });
    }
  }

  function setCustomer(c: CustomerOption | null) {
    setValue("customer", c, { shouldDirty: true });
    const addr = customerAddress(c);
    if (c && addr && !getValues("deliveryAddress")) setValue("deliveryAddress", addr);
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      idempotencyKey: mode === "create" ? idempotencyKey : null,
      customerId: values.customer?.id ?? null,
      items: values.items.map((i) => ({ id: i.id ?? null, variantId: i.variantId, quantity: Number(i.quantity), notes: i.notes })),
      fulfillment: values.fulfillment,
      deliveryAddress: values.deliveryAddress,
      deliveryFeeCents: values.fulfillment === "DELIVERY" ? values.deliveryFeeCents : 0,
      scheduledFor: values.scheduledFor || null,
      discountType: discountValue > 0 ? values.discountType : null,
      discountValue,
      preferredPaymentMethod: values.preferredPaymentMethod || null,
      notes: values.notes,
      payNow:
        mode === "create" && values.payNow
          ? { method: values.payNowMethod, amountCents: values.payNowAmountCents ?? totals.totalCents }
          : null,
    };
    const parsed = orderSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      toast.error(issue?.message ?? "Verifique os dados do pedido.");
      return;
    }
    if (!totals.ok) {
      toast.error(totals.error);
      return;
    }
    if (mode === "create") {
      const res = await run(() => createOrderAction(parsed.data));
      if (res.ok) router.push(`/pedidos/${res.data.id}?novo=1`);
    } else if (orderId) {
      const res = await run(() => updateOrderAction(orderId, parsed.data));
      if (res.ok) router.push(`/pedidos/${orderId}`);
    }
  });

  const itemCount = (w.items ?? []).reduce((s, i) => s + safeQty(i?.quantity), 0);

  return (
    <form onSubmit={onSubmit} noValidate>
      {warnings && warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-caramel/30 bg-caramel-soft px-4 py-3 text-sm text-caramel-foreground">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          {/* 1. Cliente */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="mr-2 text-caramel">1</span>Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Controller
                control={control}
                name="customer"
                render={({ field }) => <CustomerPicker value={field.value} onChange={setCustomer} currency={currency} />}
              />
            </CardContent>
          </Card>

          {/* 2. Sabores */}
          <Card>
            <CardHeader className="gap-3">
              <CardTitle>
                <span className="mr-2 text-caramel">2</span>Sabores
              </CardTitle>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar sabor…"
                  className="pl-9"
                  aria-label="Buscar sabor"
                />
              </div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
                <CategoryChip active={!category} onClick={() => setCategory(null)}>
                  Todos
                </CategoryChip>
                {categories.map(([id, name]) => (
                  <CategoryChip key={id} active={category === id} onClick={() => setCategory(id)}>
                    {name}
                  </CategoryChip>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {visibleProducts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum sabor encontrado.</p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                  {visibleProducts.map((p) => {
                    const blocked = !p.isAvailable;
                    const low = p.trackStock && p.stockMilli <= p.minStockMilli;
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "rounded-xl border bg-background/40 p-3 transition",
                          blocked && "opacity-55",
                        )}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug">{p.name}</p>
                          <div className="flex shrink-0 gap-1">
                            {p.isVegan && (
                              <span title="Vegano" className="rounded-full bg-primary-soft p-1 text-primary">
                                <Leaf className="h-3 w-3" />
                                <span className="sr-only">Vegano</span>
                              </span>
                            )}
                          </div>
                        </div>
                        {blocked ? (
                          <p className="text-xs font-medium text-muted-foreground">Indisponível no momento</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {p.variants.map((v) => {
                              const q = qtyByVariant.get(v.id) ?? 0;
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => addVariant(p, v)}
                                  className={cn(
                                    "relative flex min-h-[44px] flex-1 flex-col items-start rounded-lg border bg-card px-2.5 py-1.5 text-left transition hover:border-primary hover:bg-primary-soft/50 active:scale-[0.97]",
                                    q > 0 && "border-primary bg-primary-soft/60",
                                  )}
                                  aria-label={`Adicionar ${p.name} ${v.name}`}
                                >
                                  <span className="text-[11px] font-medium text-muted-foreground">{v.name}</span>
                                  <span className="text-sm font-semibold tabular">{formatMoney(v.priceCents, currency)}</span>
                                  {q > 0 && (
                                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                                      {q}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {low && !blocked && (
                          <p className="mt-1.5 text-[11px] font-medium text-caramel-foreground">
                            Estoque baixo: {formatMilli(p.stockMilli)} {p.stockUnit}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Entrega e agenda */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="mr-2 text-caramel">3</span>Entrega e data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Controller
                control={control}
                name="fulfillment"
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modalidade">
                    {(
                      [
                        ["PICKUP", "Retirada", Store],
                        ["DELIVERY", "Entrega", Truck],
                      ] as const
                    ).map(([val, label, Icon]) => (
                      <button
                        key={val}
                        type="button"
                        role="radio"
                        aria-checked={field.value === val}
                        onClick={() => field.onChange(val)}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition",
                          field.value === val ? "border-primary bg-primary-soft text-primary" : "bg-card hover:bg-accent",
                        )}
                      >
                        <Icon className="h-4 w-4" /> {label}
                      </button>
                    ))}
                  </div>
                )}
              />
              {w.fulfillment === "DELIVERY" && (
                <div className="grid gap-4 sm:grid-cols-[1fr_180px] animate-fade-up">
                  <Field label="Endereço de entrega" htmlFor="addr" required>
                    <Input id="addr" {...register("deliveryAddress")} placeholder="Rua, número, bairro" />
                  </Field>
                  <Field label="Taxa de entrega" htmlFor="fee">
                    <Controller
                      control={control}
                      name="deliveryFeeCents"
                      render={({ field }) => <MoneyInput id="fee" value={field.value} onValueChange={field.onChange} />}
                    />
                  </Field>
                </div>
              )}
              <Field label="Data e horário previstos" htmlFor="when" hint="Deixe em branco para pedidos imediatos.">
                <div className="flex gap-2">
                  <Input id="when" type="datetime-local" {...register("scheduledFor")} className="flex-1" />
                  {w.scheduledFor && (
                    <Button type="button" variant="ghost" onClick={() => setValue("scheduledFor", "")}>
                      Limpar
                    </Button>
                  )}
                </div>
              </Field>
            </CardContent>
          </Card>

          {/* 4. Pagamento e observações */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="mr-2 text-caramel">4</span>Pagamento e observações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Forma de pagamento">
                <Controller
                  control={control}
                  name="preferredPaymentMethod"
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-1.5">
                      {PAYMENT_METHODS.map((m) => (
                        <CategoryChip
                          key={m}
                          active={field.value === m}
                          onClick={() => {
                            field.onChange(field.value === m ? "" : m);
                            setValue("payNowMethod", m);
                          }}
                        >
                          {PAYMENT_METHOD_LABEL[m]}
                        </CategoryChip>
                      ))}
                    </div>
                  )}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Desconto" error={totals.ok ? undefined : totals.error}>
                  <div className="flex gap-2">
                    <Controller
                      control={control}
                      name="discountType"
                      render={({ field }) => (
                        <div className="flex shrink-0 rounded-lg bg-muted p-0.5">
                          {(["AMOUNT", "PERCENT"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => field.onChange(t)}
                              className={cn(
                                "rounded-md px-2.5 text-sm font-semibold text-muted-foreground",
                                field.value === t && "bg-card text-foreground shadow-sm",
                              )}
                              aria-pressed={field.value === t}
                            >
                              {t === "AMOUNT" ? "R$" : "%"}
                            </button>
                          ))}
                        </div>
                      )}
                    />
                    {w.discountType === "PERCENT" ? (
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        {...register("discountPercent")}
                        aria-label="Desconto em porcentagem"
                        className="text-right"
                      />
                    ) : (
                      <Controller
                        control={control}
                        name="discountAmountCents"
                        render={({ field }) => (
                          <div className="flex-1">
                            <MoneyInput value={field.value} onValueChange={field.onChange} aria-label="Desconto em reais" />
                          </div>
                        )}
                      />
                    )}
                  </div>
                </Field>
              </div>

              {mode === "create" && (
                <div className="rounded-xl border bg-background/40 p-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-semibold">Já recebi o pagamento</span>
                      <span className="text-xs text-muted-foreground">Registra o pagamento junto com o pedido.</span>
                    </span>
                    <Controller
                      control={control}
                      name="payNow"
                      render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
                    />
                  </label>
                  {w.payNow && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 animate-fade-up">
                      <Field label="Recebido via">
                        <select
                          {...register("payNowMethod")}
                          className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {PAYMENT_METHOD_LABEL[m]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Valor recebido" hint="Padrão: total do pedido. Pagamentos parciais são aceitos.">
                        <Controller
                          control={control}
                          name="payNowAmountCents"
                          render={({ field }) => (
                            <MoneyInput value={field.value ?? totals.totalCents} onValueChange={field.onChange} />
                          )}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              )}

              <Field label="Observações do pedido" htmlFor="notes">
                <Textarea id="notes" rows={2} placeholder="Ex.: embalar para presente, sem colher…" {...register("notes")} />
              </Field>
            </CardContent>
          </Card>
        </div>

        {/* Resumo / carrinho */}
        <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-secondary/40 pb-4">
              <CardTitle className="flex items-center justify-between">
                <span className="font-display text-lg">Resumo</span>
                <span className="text-sm font-medium text-muted-foreground">{itemCount} item(ns)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {items.fields.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Toque em um sabor para adicionar ao pedido.
                </p>
              ) : (
                <ul className="max-h-[50vh] divide-y overflow-y-auto scrollbar-thin">
                  {items.fields.map((f, idx) => {
                    const item = w.items?.[idx];
                    if (!item) return null;
                    return (
                      <li key={f._rhfKey} className="px-5 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.variantName} · {formatMoney(item.unitPriceCents ?? 0, currency)}
                              {item.id && <span title="Preço da venda original preservado"> · preço original</span>}
                            </p>
                          </div>
                          <p className="text-sm font-semibold tabular">
                            {formatMoney((item.unitPriceCents ?? 0) * safeQty(item.quantity), currency)}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center rounded-lg border bg-card">
                            <button
                              type="button"
                              className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                (item.quantity ?? 1) <= 1
                                  ? items.remove(idx)
                                  : setValue(`items.${idx}.quantity`, (item.quantity ?? 1) - 1)
                              }
                              aria-label="Diminuir quantidade"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={999}
                              inputMode="numeric"
                              className="h-9 w-10 bg-transparent text-center text-sm font-semibold tabular focus:outline-none"
                              {...register(`items.${idx}.quantity`, { valueAsNumber: true, min: 1 })}
                              aria-label="Quantidade"
                            />
                            <button
                              type="button"
                              className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                              onClick={() => setValue(`items.${idx}.quantity`, Math.min(999, safeQty(item.quantity) + 1))}
                              aria-label="Aumentar quantidade"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setValue(`items.${idx}.showNotes`, !item.showNotes)}
                              aria-label="Observação do item"
                              className={cn(item.notes && "text-caramel")}
                            >
                              <StickyNote />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => items.remove(idx)}
                              aria-label="Remover item"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </div>
                        {(item.showNotes || item.notes) && (
                          <Input
                            className="mt-2 h-8 text-xs"
                            placeholder="Observação deste item"
                            {...register(`items.${idx}.notes`)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <dl className="space-y-1.5 border-t bg-background/40 px-5 py-4 text-sm">
                <Row label="Subtotal" value={formatMoney(totals.subtotalCents, currency)} />
                {totals.discountCents > 0 && (
                  <Row label="Desconto" value={`− ${formatMoney(totals.discountCents, currency)}`} className="text-primary" />
                )}
                {totals.deliveryFeeCents > 0 && <Row label="Taxa de entrega" value={formatMoney(totals.deliveryFeeCents, currency)} />}
                <div className="flex items-baseline justify-between pt-2">
                  <dt className="font-semibold">Total</dt>
                  <dd className="font-display text-2xl font-semibold tabular">{formatMoney(totals.totalCents, currency)}</dd>
                </div>
              </dl>
              <div className="hidden border-t p-4 xl:block">
                <Button type="submit" size="lg" className="w-full" loading={pending || formState.isSubmitting} disabled={!itemCount}>
                  {mode === "create" ? "Confirmar pedido" : "Salvar alterações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Barra fixa no celular */}
      <div className="no-print sticky bottom-0 z-30 -mx-4 mt-5 border-t bg-card/95 px-4 py-3 shadow-lift backdrop-blur sm:-mx-6 sm:px-6 xl:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{itemCount} item(ns)</p>
            <p className="font-display text-xl font-semibold tabular">{formatMoney(totals.totalCents, currency)}</p>
          </div>
          <Button type="submit" size="lg" loading={pending || formState.isSubmitting} disabled={!itemCount}>
            {mode === "create" ? "Confirmar" : "Salvar"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between", className)}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:text-sm",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground/80 hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
