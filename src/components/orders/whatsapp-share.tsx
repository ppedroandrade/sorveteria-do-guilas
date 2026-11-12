"use client";
import * as React from "react";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function WhatsAppShare({ message, link }: { message: string; link: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Resumo copiado!");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }
  return (
    <div className="space-y-3">
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border bg-background/60 p-3 font-sans text-xs leading-relaxed">
        {message}
      </pre>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="bg-[#1f8f4e] hover:bg-[#1a7a42]">
          <a href={link} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> Enviar no WhatsApp
          </a>
        </Button>
        <Button variant="outline" type="button" onClick={copy}>
          <Copy /> Copiar
        </Button>
      </div>
    </div>
  );
}
