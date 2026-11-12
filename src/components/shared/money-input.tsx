"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo monetário estilo "caixa registradora": os dígitos entram pela direita
 * (digitar 4 5 0 0 → 45,00). Rápido no teclado numérico do celular.
 * O valor é sempre em centavos.
 */
export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
    value: number | null | undefined;
    onValueChange: (cents: number) => void;
    prefix?: string;
  }
>(({ value, onValueChange, prefix = "R$", className, ...props }, ref) => {
  const cents = value ?? 0;
  const display = (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>
      <Input
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        className={cn("pl-10 text-right tabular", className)}
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
          onValueChange(Number(digits || "0"));
        }}
        onFocus={(e) => requestAnimationFrame(() => e.target.setSelectionRange(e.target.value.length, e.target.value.length))}
        {...props}
      />
    </div>
  );
});
MoneyInput.displayName = "MoneyInput";
