"use client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">Algo deu errado</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Não foi possível carregar esta página. Seus dados estão seguros — tente novamente.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted-foreground">Código: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
