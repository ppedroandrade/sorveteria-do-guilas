"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, {});
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus={!state?.email} defaultValue={state?.email ?? ""} key={state?.email ?? "empty"} placeholder="voce@exemplo.com" />
      </Field>
      <Field label="Senha" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus={!!state?.email} />
      </Field>
      {state?.error && (
        <p role="alert" data-testid="login-error" className="rounded-lg bg-destructive-soft px-3 py-2 text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        Entrar
      </Button>
    </form>
  );
}
