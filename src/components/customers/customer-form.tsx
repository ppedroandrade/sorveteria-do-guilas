"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { customerSchema } from "@/lib/validation";
import { saveCustomerAction, type CustomerOption } from "@/server/actions/customers";
import { useAction } from "@/components/shared/use-action";

type In = z.input<typeof customerSchema>;
type Out = z.output<typeof customerSchema>;

export type CustomerFormValues = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  notes?: string | null;
  preferences?: string | null;
};

export function CustomerForm({
  customerId,
  defaultValues,
  onSaved,
  onCancel,
  compact,
}: {
  customerId?: string | null;
  defaultValues?: Partial<CustomerFormValues>;
  onSaved?: (c: CustomerOption) => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const { pending, run } = useAction();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      neighborhood: "",
      city: "",
      notes: "",
      preferences: "",
      ...Object.fromEntries(Object.entries(defaultValues ?? {}).map(([k, v]) => [k, v ?? ""])),
    },
  });
  const { register, handleSubmit, formState, setError } = form;
  const err = (k: keyof In) => formState.errors[k]?.message as string | undefined;

  const onSubmit = handleSubmit(async (values) => {
    const res = await run(() => saveCustomerAction(customerId ?? null, values));
    if (res.ok) onSaved?.(res.data);
    else if (res.fieldErrors) {
      for (const [k, msg] of Object.entries(res.fieldErrors)) setError(k as keyof In, { message: msg });
    }
  });

  return (
    <form
      onSubmit={(e) => {
        e.stopPropagation(); // evita submeter o formulário do pedido quando aninhado em diálogo
        onSubmit(e);
      }}
      className="space-y-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" htmlFor="c-name" required error={err("name")} className="sm:col-span-2">
          <Input id="c-name" autoFocus {...register("name")} aria-invalid={!!err("name")} />
        </Field>
        <Field label="Telefone / WhatsApp" htmlFor="c-phone" error={err("phone")}>
          <Input id="c-phone" type="tel" inputMode="tel" placeholder="(11) 98765-4321" {...register("phone")} />
        </Field>
        <Field label="E-mail" htmlFor="c-email" error={err("email")}>
          <Input id="c-email" type="email" {...register("email")} />
        </Field>
        <Field label="Endereço" htmlFor="c-address" error={err("address")} className="sm:col-span-2">
          <Input id="c-address" placeholder="Rua, número, complemento" {...register("address")} />
        </Field>
        <Field label="Bairro" htmlFor="c-neighborhood" error={err("neighborhood")}>
          <Input id="c-neighborhood" {...register("neighborhood")} />
        </Field>
        <Field label="Cidade" htmlFor="c-city" error={err("city")}>
          <Input id="c-city" {...register("city")} />
        </Field>
        {!compact && (
          <>
            <Field label="Preferências" htmlFor="c-pref" hint="Ex.: adora pistache, sem lactose…" className="sm:col-span-2">
              <Textarea id="c-pref" rows={2} {...register("preferences")} />
            </Field>
            <Field label="Observações" htmlFor="c-notes" className="sm:col-span-2">
              <Textarea id="c-notes" rows={2} {...register("notes")} />
            </Field>
          </>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={pending}>
          {customerId ? "Salvar alterações" : "Cadastrar cliente"}
        </Button>
      </div>
    </form>
  );
}

export function CustomerDialog({
  open,
  onOpenChange,
  customerId,
  defaultValues,
  onSaved,
  compact,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customerId?: string | null;
  defaultValues?: Partial<CustomerFormValues>;
  onSaved?: (c: CustomerOption) => void;
  compact?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{customerId ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>Apenas o nome é obrigatório.</DialogDescription>
        </DialogHeader>
        {open && (
          <CustomerForm
            customerId={customerId}
            defaultValues={defaultValues}
            compact={compact}
            onCancel={() => onOpenChange(false)}
            onSaved={(c) => {
              onOpenChange(false);
              onSaved?.(c);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
