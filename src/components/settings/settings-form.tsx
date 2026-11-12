"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/money-input";
import { ImagePicker } from "@/components/shared/image-picker";
import { useAction } from "@/components/shared/use-action";
import { settingsSchema } from "@/lib/validation";
import { saveSettingsAction } from "@/server/actions/settings";

type In = z.input<typeof settingsSchema>;
type Out = z.output<typeof settingsSchema>;

export function SettingsForm({ defaultValues }: { defaultValues: In }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const { register, control, handleSubmit, formState, setError } = useForm<In, unknown, Out>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  });
  const e = formState.errors;
  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={handleSubmit(async (v) => {
        const r = await run(() => saveSettingsAction(v));
        if (r.ok) router.refresh();
        else if (r.fieldErrors) for (const [k, m] of Object.entries(r.fieldErrors)) setError(k as keyof In, { message: m });
      })}
    >
      <Field label="Nome da sorveteria" htmlFor="bn" required error={e.businessName?.message} className="sm:col-span-2">
        <Input id="bn" {...register("businessName")} />
      </Field>
      <Field label="Logotipo" className="sm:col-span-2" error={e.logoDataUrl?.message}>
        <Controller control={control} name="logoDataUrl" render={({ field }) => <ImagePicker value={field.value} onChange={field.onChange} size={256} label="Logotipo" />} />
      </Field>
      <Field label="Telefone" htmlFor="ph" error={e.phone?.message}>
        <Input id="ph" type="tel" {...register("phone")} />
      </Field>
      <Field label="Taxa de entrega padrão" htmlFor="fee" error={e.defaultDeliveryFeeCents?.message}>
        <Controller
          control={control}
          name="defaultDeliveryFeeCents"
          render={({ field }) => <MoneyInput id="fee" value={field.value} onValueChange={field.onChange} />}
        />
      </Field>
      <Field label="Endereço" htmlFor="ad" error={e.address?.message} className="sm:col-span-2">
        <Input id="ad" {...register("address")} />
      </Field>
      <Field label="Moeda" htmlFor="cur" error={e.currency?.message} hint="Código ISO (BRL, USD, EUR…)">
        <Input id="cur" maxLength={3} className="uppercase" {...register("currency")} />
      </Field>
      <Field label="Fuso horário" htmlFor="tz" error={e.timezone?.message} hint="Define o que é “hoje” nos indicadores.">
        <Input id="tz" list="tz-list" {...register("timezone")} />
        <datalist id="tz-list">
          {["America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Belem", "America/Fortaleza", "America/Recife", "America/Rio_Branco", "America/Noronha"].map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Field>
      <Field label="Cabeçalho do comprovante" htmlFor="rh" className="sm:col-span-2" hint="Ex.: CNPJ, Instagram, horário de funcionamento.">
        <Textarea id="rh" rows={2} {...register("receiptHeader")} />
      </Field>
      <Field label="Rodapé do comprovante" htmlFor="rf" className="sm:col-span-2">
        <Textarea id="rf" rows={2} placeholder="Obrigado pela preferência!" {...register("receiptFooter")} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>
          Salvar configurações
        </Button>
      </div>
    </form>
  );
}
