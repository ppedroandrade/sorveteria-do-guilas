"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/shared/use-action";
import { passwordChangeSchema } from "@/lib/validation";
import { changePasswordAction } from "@/server/actions/auth";

type V = z.input<typeof passwordChangeSchema>;

export function PasswordForm() {
  const { pending, run } = useAction();
  const { register, handleSubmit, formState, reset, setError } = useForm<V>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  const e = formState.errors;
  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-3"
      onSubmit={handleSubmit(async (v) => {
        const r = await run(() => changePasswordAction(v));
        if (r.ok) reset();
        else if (r.fieldErrors) for (const [k, m] of Object.entries(r.fieldErrors)) setError(k as keyof V, { message: m });
      })}
    >
      <Field label="Senha atual" htmlFor="cp" error={e.currentPassword?.message}>
        <Input id="cp" type="password" autoComplete="current-password" {...register("currentPassword")} />
      </Field>
      <Field label="Nova senha" htmlFor="np" error={e.newPassword?.message}>
        <Input id="np" type="password" autoComplete="new-password" {...register("newPassword")} />
      </Field>
      <Field label="Confirmar nova senha" htmlFor="cf" error={e.confirm?.message}>
        <Input id="cf" type="password" autoComplete="new-password" {...register("confirm")} />
      </Field>
      <div className="sm:col-span-3">
        <Button type="submit" variant="outline" loading={pending}>
          Alterar senha
        </Button>
      </div>
    </form>
  );
}
