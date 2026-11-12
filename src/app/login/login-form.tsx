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
      <Field label="Usuário" htmlFor="login">
        <Input
          id="login"
          name="login"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus={!state?.login}
          defaultValue={state?.login ?? ""}
          key={state?.login ?? "empty"}
        />
      </Field>
      <Field label="Senha" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus={!!state?.login} />
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
