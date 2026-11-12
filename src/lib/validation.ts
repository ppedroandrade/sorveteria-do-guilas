import { z } from "zod";

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .optional()
    .nullable()
    .transform((v) => (v && v.length ? v : null));

const cents = (label = "Valor") =>
  z
    .number({ error: `${label} inválido.` })
    .int(`${label} inválido.`)
    .min(0, `${label} não pode ser negativo.`)
    .max(100_000_000, `${label} muito alto.`);

const imageDataUrl = z
  .string()
  .max(1_500_000, "Imagem muito grande (máx. ~1 MB).")
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Formato de imagem inválido.")
  .optional()
  .nullable()
  .transform((v) => v || null);

export const PAYMENT_METHOD_VALUES = ["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD", "TRANSFER", "OTHER"] as const;
export const ORDER_STATUS_VALUES = ["PENDING", "IN_PREPARATION", "READY", "DELIVERED", "CANCELLED"] as const;

// ───────────── Auth ─────────────
export const loginSchema = z.object({
  login: z.string().trim().toLowerCase().min(3, "Informe o usuário.").max(120),
  password: z.string().min(1, "Informe a senha.").max(200),
});

// ───────────── Clientes ─────────────
export const customerSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do cliente.").max(120),
  phone: optionalText(30).refine((v) => !v || v.replace(/\D/g, "").length >= 8, "Telefone incompleto."),
  email: optionalText(160).refine((v) => !v || z.string().email().safeParse(v).success, "E-mail inválido."),
  address: optionalText(250),
  neighborhood: optionalText(100),
  city: optionalText(100),
  notes: optionalText(1000),
  preferences: optionalText(1000),
});
export type CustomerInput = z.input<typeof customerSchema>;

// ───────────── Catálogo ─────────────
export const variantSchema = z.object({
  id: z.string().optional().nullable(),
  presentationId: z.string().optional().nullable(),
  customName: optionalText(60),
  priceCents: cents("Preço"),
  stockConsumptionMilli: z.number().int().positive("O consumo deve ser maior que zero.").nullable().optional(),
  active: z.boolean().default(true),
});

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do sabor.").max(120),
    description: optionalText(1000),
    categoryId: z.string().optional().nullable().transform((v) => v || null),
    imageDataUrl,
    isVegan: z.boolean().default(false),
    isAvailable: z.boolean().default(true),
    trackStock: z.boolean().default(false),
    stockUnit: optionalText(30),
    minStockMilli: z.number().int().min(0).default(0),
    allowNegativeStock: z.boolean().default(false),
    variants: z.array(variantSchema).min(1, "Cadastre pelo menos uma apresentação com preço."),
  })
  .superRefine((p, ctx) => {
    p.variants.forEach((v, i) => {
      if (!v.presentationId && !v.customName) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "customName"], message: "Escolha a apresentação ou dê um nome." });
      }
      if (p.trackStock && v.active && !v.stockConsumptionMilli) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", i, "stockConsumptionMilli"],
          message: "Informe quanto do estoque cada unidade vendida consome.",
        });
      }
    });
    if (p.trackStock && !p.stockUnit) {
      ctx.addIssue({ code: "custom", path: ["stockUnit"], message: "Informe a unidade de estoque." });
    }
    if (!p.variants.some((v) => v.active)) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Mantenha pelo menos uma apresentação ativa." });
    }
  });
export type ProductInput = z.input<typeof productSchema>;

export const presentationSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().trim().min(1, "Informe o nome.").max(60),
  description: optionalText(200),
  sortOrder: z.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
});

export const categorySchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  sortOrder: z.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
});

// ───────────── Pedidos ─────────────
export const orderItemSchema = z.object({
  id: z.string().optional().nullable(), // item existente (edição) — preserva o preço praticado
  variantId: z.string().min(1, "Selecione a apresentação."),
  quantity: z.number().int("Quantidade inválida.").min(1, "Quantidade mínima: 1.").max(999, "Quantidade muito alta."),
  notes: optionalText(200),
});

export const orderSchema = z
  .object({
    idempotencyKey: z.string().min(8).max(100).optional().nullable(),
    customerId: z.string().optional().nullable().transform((v) => v || null),
    items: z.array(orderItemSchema).min(1, "Adicione pelo menos um produto.").max(100),
    fulfillment: z.enum(["PICKUP", "DELIVERY"]),
    deliveryAddress: optionalText(300),
    deliveryFeeCents: cents("Taxa de entrega").default(0),
    scheduledFor: z.string().optional().nullable().transform((v) => v || null),
    discountType: z.enum(["AMOUNT", "PERCENT"]).optional().nullable().transform((v) => v ?? null),
    discountValue: z.number().int().min(0).default(0),
    preferredPaymentMethod: z.enum(PAYMENT_METHOD_VALUES).optional().nullable().transform((v) => v ?? null),
    notes: optionalText(1000),
    payNow: z
      .object({ method: z.enum(PAYMENT_METHOD_VALUES), amountCents: cents("Valor pago") })
      .optional()
      .nullable(),
  })
  .superRefine((o, ctx) => {
    if (o.fulfillment === "DELIVERY" && !o.deliveryAddress) {
      ctx.addIssue({ code: "custom", path: ["deliveryAddress"], message: "Informe o endereço de entrega." });
    }
    if (o.discountType === "PERCENT" && o.discountValue > 10000) {
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: "O desconto não pode passar de 100%." });
    }
    if (o.scheduledFor && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(o.scheduledFor)) {
      ctx.addIssue({ code: "custom", path: ["scheduledFor"], message: "Data/horário inválidos." });
    }
  });
export type OrderInput = z.input<typeof orderSchema>;
export type OrderParsed = z.output<typeof orderSchema>;

export const statusChangeSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["PENDING", "IN_PREPARATION", "READY", "DELIVERED"]),
});

export const cancelOrderSchema = z.object({
  orderId: z.string().min(1),
  reason: optionalText(300),
});

export const paymentSchema = z.object({
  orderId: z.string().min(1),
  kind: z.enum(["PAYMENT", "REFUND"]).default("PAYMENT"),
  method: z.enum(PAYMENT_METHOD_VALUES),
  amountCents: z.number().int().positive("Informe um valor maior que zero.").max(100_000_000),
  paidAt: z.string().optional().nullable().transform((v) => v || null),
  notes: optionalText(300),
  idempotencyKey: z.string().min(8).max(100).optional().nullable(),
});
export type PaymentInput = z.input<typeof paymentSchema>;

// ───────────── Estoque ─────────────
export const movementSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  // IN/OUT: quantidade positiva movimentada; ADJUSTMENT: novo saldo contado (≥ 0)
  quantityMilli: z.number().int().min(0).max(1_000_000_000),
  reason: optionalText(300),
});
export type MovementInput = z.input<typeof movementSchema>;

// ───────────── Configurações ─────────────
export const settingsSchema = z.object({
  businessName: z.string().trim().min(2, "Informe o nome da sorveteria.").max(100),
  logoDataUrl: imageDataUrl,
  phone: optionalText(30),
  address: optionalText(250),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use o código ISO da moeda (ex.: BRL)."),
  timezone: z.string().trim().min(3).max(60),
  defaultDeliveryFeeCents: cents("Taxa de entrega"),
  receiptHeader: optionalText(300),
  receiptFooter: optionalText(300),
});
export type SettingsInput = z.input<typeof settingsSchema>;

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres.").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "As senhas não conferem." });
