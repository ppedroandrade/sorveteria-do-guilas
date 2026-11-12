"use client";
import * as React from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/errors";

/**
 * Executa uma server action com estado de carregamento e feedback (toast).
 * Retorna o resultado para quem chamou decidir o próximo passo.
 */
export function useAction() {
  const [pending, startTransition] = React.useTransition();
  const run = React.useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string | false; onSuccess?: (data: T) => void } = {}) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          try {
            const res = await fn();
            if (res.ok) {
              const msg = opts.success === false ? null : (res.message ?? opts.success);
              if (msg) toast.success(msg);
              opts.onSuccess?.(res.data);
            } else {
              toast.error(res.error);
            }
            resolve(res);
          } catch (e) {
            console.error(e);
            toast.error("Falha de conexão. Verifique a internet e tente novamente.");
            resolve({ ok: false, error: "Falha de conexão." });
          }
        });
      }),
    [],
  );
  return { pending, run };
}
