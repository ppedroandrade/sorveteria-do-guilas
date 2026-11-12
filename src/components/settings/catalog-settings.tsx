"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { useAction } from "@/components/shared/use-action";
import { resetVariantNamesAction, saveCategoryAction, savePresentationAction } from "@/server/actions/products";

type Row = { id: string; name: string; description?: string | null; sortOrder: number; active: boolean; count: number; customCount?: number };

export function PresentationsEditor({ rows }: { rows: Row[] }) {
  return <Editor rows={rows} kind="presentation" />;
}
export function CategoriesEditor({ rows }: { rows: Row[] }) {
  return <Editor rows={rows} kind="category" />;
}

function Editor({ rows, kind }: { rows: Row[]; kind: "presentation" | "category" }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [newName, setNewName] = React.useState("");
  const save = (data: Record<string, unknown>) =>
    run(() => (kind === "presentation" ? savePresentationAction(data) : saveCategoryAction(data)), { onSuccess: () => router.refresh() });

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <EditorRow key={r.id} row={r} kind={kind} onSave={save} pending={pending} />
      ))}
      <form
        className="flex gap-2 pt-1"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          const res = await save({ name: newName, sortOrder: (rows.at(-1)?.sortOrder ?? 0) + 1, active: true });
          if (res.ok) setNewName("");
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={kind === "presentation" ? "Nova apresentação (ex.: 500 ml)" : "Nova categoria"}
          maxLength={60}
        />
        <Button type="submit" variant="outline" disabled={!newName.trim()} loading={pending}>
          <Plus /> Adicionar
        </Button>
      </form>
    </div>
  );
}

function EditorRow({
  row,
  kind,
  onSave,
  pending,
}: {
  row: Row;
  kind: "presentation" | "category";
  onSave: (d: Record<string, unknown>) => Promise<unknown>;
  pending: boolean;
}) {
  const router = useRouter();
  const { run, pending: resetting } = useAction();
  const [name, setName] = React.useState(row.name);
  const [desc, setDesc] = React.useState(row.description ?? "");
  const [confirmReset, setConfirmReset] = React.useState(false);
  const dirty = name !== row.name || (kind === "presentation" && desc !== (row.description ?? ""));
  const payload = { id: row.id, name, description: desc, sortOrder: row.sortOrder, active: row.active };

  return (
    <div className="rounded-xl border bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 min-w-[140px] flex-1" aria-label="Nome" maxLength={60} />
        {kind === "presentation" && (
          <Input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Capacidade/descrição (opcional)"
            className="h-9 min-w-[160px] flex-1"
            aria-label="Descrição"
            maxLength={200}
          />
        )}
        {dirty && (
          <Button size="sm" onClick={() => onSave(payload)} loading={pending}>
            <Check /> Salvar
          </Button>
        )}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={row.active} onCheckedChange={(v) => onSave({ ...payload, name: row.name, description: row.description, active: v })} />
          Ativa
        </label>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Usada em {row.count} {kind === "presentation" ? "variante(s)" : "produto(s)"}
        {kind === "presentation" && !!row.customCount && (
          <>
            {" "}
            · {row.customCount} com nome próprio{" "}
            <button type="button" className="inline-flex items-center gap-0.5 underline" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="h-3 w-3" /> usar nome global em todos
            </button>
          </>
        )}
      </p>
      <ConfirmAction
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={`Usar "${row.name}" em todos os produtos?`}
        description="Remove os nomes próprios definidos por produto para esta apresentação. Pedidos já feitos mantêm o nome da época."
        destructive={false}
        loading={resetting}
        onConfirm={async () => {
          const r = await run(() => resetVariantNamesAction({ presentationId: row.id }));
          if (r.ok) {
            setConfirmReset(false);
            router.refresh();
          }
        }}
      />
    </div>
  );
}
