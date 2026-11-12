"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ellipsis, Pencil, Power, PowerOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { useAction } from "@/components/shared/use-action";
import { toggleProductAction } from "@/server/actions/products";

export function AvailabilitySwitch({ id, value, disabled }: { id: string; value: boolean; disabled?: boolean }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [checked, setChecked] = React.useState(value);
  React.useEffect(() => setChecked(value), [value]);
  return (
    <Switch
      checked={checked}
      disabled={pending || disabled}
      aria-label="Disponível para venda"
      onCheckedChange={async (v) => {
        setChecked(v);
        const r = await run(() => toggleProductAction({ id, field: "isAvailable", value: v }));
        if (!r.ok) setChecked(!v);
        else router.refresh();
      }}
    />
  );
}

export function ProductMenu({ id, active, name }: { id: string; active: boolean; name: string }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [confirm, setConfirm] = React.useState(false);
  const toggle = async () => {
    const r = await run(() => toggleProductAction({ id, field: "active", value: !active }));
    if (r.ok) {
      setConfirm(false);
      router.refresh();
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${name}`}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/produtos/${id}`}>
              <Pencil /> Editar
            </Link>
          </DropdownMenuItem>
          {active ? (
            <DropdownMenuItem destructive onSelect={() => setConfirm(true)}>
              <PowerOff /> Desativar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={toggle}>
              <Power /> Reativar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmAction
        open={confirm}
        onOpenChange={setConfirm}
        title={`Desativar "${name}"?`}
        description="O sabor some do cadastro de pedidos e dos relatórios de catálogo, mas o histórico de vendas é preservado. Você pode reativá-lo depois."
        confirmLabel="Desativar"
        loading={pending}
        onConfirm={toggle}
      />
    </>
  );
}
