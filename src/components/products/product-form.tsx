"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MoneyInput } from "@/components/shared/money-input";
import { DecimalInput } from "@/components/shared/decimal-input";
import { ImagePicker } from "@/components/shared/image-picker";
import { useAction } from "@/components/shared/use-action";
import { productSchema } from "@/lib/validation";
import { STOCK_UNITS } from "@/lib/domain/labels";
import { saveProductAction } from "@/server/actions/products";

type In = z.input<typeof productSchema>;
type Out = z.output<typeof productSchema>;

export function ProductForm({
  productId,
  defaultValues,
  categories,
  presentations,
  hasSales,
}: {
  productId?: string;
  defaultValues: In;
  categories: { id: string; name: string }[];
  presentations: { id: string; name: string; active: boolean }[];
  hasSales?: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(productSchema), defaultValues });
  const { control, register, handleSubmit, formState, setError } = form;
  const variants = useFieldArray({ control, name: "variants" });
  const trackStock = useWatch({ control, name: "trackStock" });
  const stockUnit = useWatch({ control, name: "stockUnit" });
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    const res = await run(() => saveProductAction(productId ?? null, values));
    if (res.ok) {
      router.push("/produtos");
      router.refresh();
    } else if (res.fieldErrors) {
      for (const [k, m] of Object.entries(res.fieldErrors)) setError(k as keyof In, { message: m });
    }
  });

  const presentationName = (id: string | null | undefined) => presentations.find((p) => p.id === id)?.name;

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]" noValidate>
      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do sabor" htmlFor="name" required error={errors.name?.message} className="sm:col-span-2">
              <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
            </Field>
            <Field label="Categoria" htmlFor="category">
              <NativeSelect id="category" {...register("categoryId")}>
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="flex items-end gap-6 pb-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Controller control={control} name="isVegan" render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} />} />
                Vegano
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <Controller
                  control={control}
                  name="isAvailable"
                  render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} />}
                />
                Disponível para venda
              </label>
            </div>
            <Field label="Descrição" htmlFor="desc" className="sm:col-span-2">
              <Textarea id="desc" rows={3} {...register("description")} />
            </Field>
            <Field label="Imagem (opcional)" className="sm:col-span-2" error={errors.imageDataUrl?.message}>
              <Controller
                control={control}
                name="imageDataUrl"
                render={({ field }) => <ImagePicker value={field.value} onChange={field.onChange} />}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Apresentações e preços</CardTitle>
            <CardDescription>
              Os nomes vêm das apresentações globais (
              <Link href="/configuracoes#apresentacoes" className="underline">
                renomear em Configurações
              </Link>
              ). Use &quot;Nome neste produto&quot; só se este sabor tiver um nome diferente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {typeof errors.variants?.message === "string" && <p className="text-sm text-destructive">{errors.variants.message}</p>}
            {variants.fields.map((f, i) => {
              const ve = errors.variants?.[i];
              return (
                <div key={f.id} className="rounded-xl border bg-background/40 p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px_auto]">
                    <Field label="Apresentação" error={ve?.presentationId?.message}>
                      <NativeSelect {...register(`variants.${i}.presentationId`)}>
                        <option value="">— Nome próprio —</option>
                        {presentations.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {!p.active ? " (inativa)" : ""}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field label="Nome neste produto" error={ve?.customName?.message}>
                      <Input placeholder="Opcional" {...register(`variants.${i}.customName`)} />
                    </Field>
                    <Field label="Preço" required error={ve?.priceCents?.message}>
                      <Controller
                        control={control}
                        name={`variants.${i}.priceCents`}
                        render={({ field }) => <MoneyInput value={field.value} onValueChange={field.onChange} />}
                      />
                    </Field>
                    <div className="flex items-end gap-2 pb-0.5">
                      <label className="flex h-10 items-center gap-2 text-xs font-medium" title="Variante ativa">
                        <Controller
                          control={control}
                          name={`variants.${i}.active`}
                          render={({ field }) => <Switch checked={field.value !== false} onCheckedChange={field.onChange} />}
                        />
                        Ativa
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => variants.remove(i)}
                        aria-label="Remover apresentação"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  {trackStock && (
                    <Field
                      className="mt-3 sm:max-w-sm"
                      label={`Consumo de estoque por unidade vendida${stockUnit ? ` (em ${stockUnit})` : ""}`}
                      required
                      error={ve?.stockConsumptionMilli?.message}
                      hint={`Quanto do estoque 1 unidade de "${presentationName(form.getValues(`variants.${i}.presentationId`)) ?? "esta apresentação"}" consome.`}
                    >
                      <Controller
                        control={control}
                        name={`variants.${i}.stockConsumptionMilli`}
                        render={({ field }) => (
                          <DecimalInput value={field.value ?? null} onValueChange={(v) => field.onChange(v && v > 0 ? v : null)} placeholder="Ex.: 1 ou 0,5" />
                        )}
                      />
                    </Field>
                  )}
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                variants.append({ presentationId: presentations.find((p) => p.active)?.id ?? null, customName: "", priceCents: 0, stockConsumptionMilli: null, active: true })
              }
            >
              <Plus /> Adicionar apresentação
            </Button>
            {hasSales && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Alterar preços não afeta pedidos já registrados. Apresentações já vendidas são desativadas em vez de excluídas.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Controle de estoque
              <Controller
                control={control}
                name="trackStock"
                render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} aria-label="Controlar estoque" />}
              />
            </CardTitle>
            <CardDescription>
              Opcional. Quando ativo, cada pedido baixa o estoque conforme o consumo informado em cada apresentação.
            </CardDescription>
          </CardHeader>
          {trackStock && (
            <CardContent className="space-y-4 animate-fade-up">
              <Field label="Unidade de estoque" required error={errors.stockUnit?.message} hint="Ex.: litro, kg, pote.">
                <Input list="stock-units" {...register("stockUnit")} placeholder="litro" />
                <datalist id="stock-units">
                  {STOCK_UNITS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </Field>
              <Field label="Estoque mínimo (alerta)">
                <Controller
                  control={control}
                  name="minStockMilli"
                  render={({ field }) => <DecimalInput value={field.value ?? 0} onValueChange={(v) => field.onChange(v ?? 0)} />}
                />
              </Field>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="block font-medium">Permitir estoque negativo</span>
                  <span className="text-xs text-muted-foreground">Desligado: o pedido é bloqueado quando faltar estoque.</span>
                </span>
                <Controller
                  control={control}
                  name="allowNegativeStock"
                  render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} />}
                />
              </label>
              <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                O saldo é ajustado na tela <Link href="/estoque" className="underline">Estoque</Link> (entradas, saídas e ajustes).
              </p>
            </CardContent>
          )}
        </Card>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" loading={pending}>
            {productId ? "Salvar" : "Cadastrar"}
          </Button>
        </div>
      </div>
    </form>
  );
}
