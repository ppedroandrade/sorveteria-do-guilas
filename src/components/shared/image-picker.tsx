"use client";
import * as React from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Seleciona uma imagem e a reduz no navegador (máx. `size` px, JPEG/WebP),
 * guardando-a como data URL no banco. Evita depender de storage externo.
 */
export function ImagePicker({
  value,
  onChange,
  size = 480,
  label = "Imagem",
}: {
  value: string | null | undefined;
  onChange: (dataUrl: string | null) => void;
  size?: number;
  label?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem.");
    if (file.size > 15 * 1024 * 1024) return toast.error("Imagem muito grande (máx. 15 MB).");
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const keepAlpha = file.type === "image/png";
      onChange(canvas.toDataURL(keepAlpha ? "image/png" : "image/jpeg", 0.85));
    } catch {
      toast.error("Não foi possível ler esta imagem.");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <ImagePlus /> {value ? "Trocar" : "Adicionar"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onChange(null)}>
            <Trash2 /> Remover
          </Button>
        )}
      </div>
    </div>
  );
}
