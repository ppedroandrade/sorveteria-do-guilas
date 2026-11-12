import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportButton({ tipo, query, label = "Exportar CSV" }: { tipo: string; query: Record<string, string | undefined>; label?: string }) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) sp.set(k, v);
  return (
    <Button asChild variant="outline" size="sm">
      <a href={`/api/relatorios/${tipo}?${sp.toString()}`} download>
        <Download /> {label}
      </a>
    </Button>
  );
}
