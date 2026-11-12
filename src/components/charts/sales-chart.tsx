"use client";
import * as React from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";

// Paleta validada (CVD/contraste) — pistache para vendido, ube para recebido.
export const CHART_SOLD = "#4a7a1e";
export const CHART_RECEIVED = "#9a6bc4";

export type SeriesPoint = { key: string; label: string; soldCents: number; receivedCents: number; orders: number };

function compact(cents: number) {
  const v = cents / 100;
  if (v >= 1000) return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function SalesChart({ data, currency, height = 260 }: { data: SeriesPoint[]; currency: string; height?: number }) {
  const hasData = data.some((d) => d.soldCents || d.receivedCents);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_SOLD }} /> Vendido
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: CHART_RECEIVED }} /> Recebido
        </span>
      </div>
      <div style={{ height }} role="img" aria-label="Gráfico de vendido e recebido por período">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="soldFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_SOLD} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={CHART_SOLD} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="0" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={compact}
                width={56}
              />
              <Tooltip
                cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.3 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as SeriesPoint;
                  return (
                    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lift">
                      <p className="mb-1 font-semibold">{p.label}</p>
                      <p className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm" style={{ background: CHART_SOLD }} />
                        Vendido: <strong className="tabular">{formatMoney(p.soldCents, currency)}</strong>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm" style={{ background: CHART_RECEIVED }} />
                        Recebido: <strong className="tabular">{formatMoney(p.receivedCents, currency)}</strong>
                      </p>
                      <p className="mt-0.5 text-muted-foreground">{p.orders} pedido(s)</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="soldCents"
                stroke={CHART_SOLD}
                strokeWidth={2}
                fill="url(#soldFill)"
                animationDuration={500}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
              />
              <Line
                type="monotone"
                dataKey="receivedCents"
                stroke={CHART_RECEIVED}
                strokeWidth={2}
                dot={false}
                animationDuration={500}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            Sem vendas no período.
          </div>
        )}
      </div>
    </div>
  );
}
