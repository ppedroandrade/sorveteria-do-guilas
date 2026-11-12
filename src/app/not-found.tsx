import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-5xl font-semibold text-caramel">404</p>
      <h1 className="mt-2 text-xl font-semibold">Página não encontrada</h1>
      <p className="mt-1 text-sm text-muted-foreground">O registro pode ter sido removido ou o endereço está incorreto.</p>
      <Button asChild className="mt-6">
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  );
}
