"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerDialog, type CustomerFormValues } from "./customer-form";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { useAction } from "@/components/shared/use-action";
import { archiveCustomerAction } from "@/server/actions/customers";

export function NewCustomerButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus /> Novo cliente
      </Button>
      <CustomerDialog open={open} onOpenChange={setOpen} onSaved={(c) => router.push(`/clientes/${c.id}`)} />
    </>
  );
}

export function EditCustomerButtons({ customerId, values }: { customerId: string; values: CustomerFormValues }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [archive, setArchive] = React.useState(false);
  const { pending, run } = useAction();
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil /> Editar
      </Button>
      <Button variant="ghost" className="text-muted-foreground" onClick={() => setArchive(true)}>
        <Archive /> Arquivar
      </Button>
      <CustomerDialog
        open={open}
        onOpenChange={setOpen}
        customerId={customerId}
        defaultValues={values}
        onSaved={() => router.refresh()}
      />
      <ConfirmAction
        open={archive}
        onOpenChange={setArchive}
        title="Arquivar cliente?"
        description="O cliente sai da lista e da busca, mas os pedidos e o histórico financeiro continuam preservados."
        confirmLabel="Arquivar"
        loading={pending}
        onConfirm={async () => {
          const r = await run(() => archiveCustomerAction(customerId));
          if (r.ok) router.push("/clientes");
        }}
      />
    </>
  );
}
