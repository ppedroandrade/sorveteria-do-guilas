import { tz, TZDate } from "@date-fns/tz";
import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Todas as fronteiras de dia/mês são calculadas no fuso do negócio, não no fuso
 * do servidor (na Vercel o servidor roda em UTC — sem isso o "faturamento do dia"
 * viraria às 21h no horário de Brasília).
 */
export const DEFAULT_TZ = "America/Sao_Paulo";

const plain = (d: Date) => new Date(d.getTime());

export function startOfDayTz(date: Date, zone = DEFAULT_TZ): Date {
  return plain(startOfDay(date, { in: tz(zone) }));
}

export function dayRange(date: Date, zone = DEFAULT_TZ): { start: Date; end: Date } {
  const start = startOfDay(date, { in: tz(zone) });
  return { start: plain(start), end: plain(addDays(start, 1)) };
}

export function monthRange(date: Date, zone = DEFAULT_TZ): { start: Date; end: Date } {
  const start = startOfMonth(date, { in: tz(zone) });
  const next = new TZDate(start.getFullYear(), start.getMonth() + 1, 1, zone);
  return { start: plain(start), end: plain(next) };
}

/** "2026-11-12" → início desse dia no fuso. */
export function parseDateInput(value: string | null | undefined, zone = DEFAULT_TZ): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new TZDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), zone);
  return Number.isNaN(d.getTime()) ? null : plain(d);
}

/** "2026-11-12T15:30" (input datetime-local) → instante correspondente no fuso. */
export function parseDateTimeLocal(value: string | null | undefined, zone = DEFAULT_TZ): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const d = new TZDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), zone);
  return Number.isNaN(d.getTime()) ? null : plain(d);
}

export function toDateInputValue(date: Date, zone = DEFAULT_TZ): string {
  return format(date, "yyyy-MM-dd", { in: tz(zone) });
}

export function toDateTimeLocalValue(date: Date | null | undefined, zone = DEFAULT_TZ): string {
  if (!date) return "";
  return format(date, "yyyy-MM-dd'T'HH:mm", { in: tz(zone) });
}

export function formatDate(date: Date | string | null | undefined, pattern = "dd/MM/yyyy", zone = DEFAULT_TZ): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, pattern, { in: tz(zone), locale: ptBR });
}

export function formatDateTime(date: Date | string | null | undefined, zone = DEFAULT_TZ): string {
  return formatDate(date, "dd/MM/yyyy HH:mm", zone);
}

/** "Hoje, 15:30" / "Amanhã, 09:00" / "Sex, 14/11 18:00" */
export function formatRelativeSchedule(date: Date | string | null | undefined, now = new Date(), zone = DEFAULT_TZ): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = differenceInCalendarDays(new TZDate(d, zone), new TZDate(now, zone));
  const time = formatDate(d, "HH:mm", zone);
  if (diff === 0) return `Hoje, ${time}`;
  if (diff === 1) return `Amanhã, ${time}`;
  if (diff === -1) return `Ontem, ${time}`;
  return formatDate(d, "EEE, dd/MM HH:mm", zone);
}

export type PeriodPreset = "today" | "7d" | "30d" | "month" | "lastMonth" | "custom";

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  month: "Este mês",
  lastMonth: "Mês passado",
  custom: "Personalizado",
};

export type ResolvedPeriod = {
  preset: PeriodPreset;
  start: Date; // inclusivo
  end: Date; // exclusivo
  from: string; // yyyy-MM-dd (inclusivo)
  to: string; // yyyy-MM-dd (inclusivo)
  label: string;
  days: number;
};

/**
 * Resolve um período a partir de parâmetros de URL. Datas inválidas caem no padrão.
 * "to" é inclusivo para o usuário; internamente usamos fim exclusivo (to + 1 dia).
 */
export function resolvePeriod(
  params: { period?: string | null; from?: string | null; to?: string | null },
  zone = DEFAULT_TZ,
  now = new Date(),
  fallback: PeriodPreset = "30d",
): ResolvedPeriod {
  const today = startOfDay(now, { in: tz(zone) });
  let preset = (params.period ?? fallback) as PeriodPreset;
  if (!(preset in PERIOD_LABELS)) preset = fallback;

  let start: Date;
  let endInclusive: Date = today;

  switch (preset) {
    case "today":
      start = today;
      break;
    case "7d":
      start = subDays(today, 6);
      break;
    case "30d":
      start = subDays(today, 29);
      break;
    case "month":
      start = startOfMonth(today, { in: tz(zone) });
      break;
    case "lastMonth": {
      const thisMonth = startOfMonth(today, { in: tz(zone) });
      start = startOfMonth(subDays(thisMonth, 1), { in: tz(zone) });
      endInclusive = subDays(thisMonth, 1);
      break;
    }
    case "custom": {
      const f = parseDateInput(params.from, zone);
      const t = parseDateInput(params.to, zone);
      if (!f || !t) return resolvePeriod({ period: fallback }, zone, now, fallback);
      start = f <= t ? f : t;
      endInclusive = f <= t ? t : f;
      // limita a 2 anos para evitar consultas gigantes por engano
      if (differenceInCalendarDays(endInclusive, start) > 731) start = subDays(endInclusive, 731);
      break;
    }
  }

  const startTz = new TZDate(start, zone);
  const endTz = new TZDate(endInclusive, zone);
  const from = format(startTz, "yyyy-MM-dd");
  const to = format(endTz, "yyyy-MM-dd");
  const label =
    preset === "custom"
      ? `${format(startTz, "dd/MM/yyyy")} a ${format(endTz, "dd/MM/yyyy")}`
      : PERIOD_LABELS[preset];

  return {
    preset,
    start: plain(startTz),
    end: plain(addDays(endTz, 1)),
    from,
    to,
    label,
    days: differenceInCalendarDays(endTz, startTz) + 1,
  };
}

/** Lista as chaves yyyy-MM-dd de cada dia do período (para séries de gráficos). */
export function eachDayKey(start: Date, end: Date, zone = DEFAULT_TZ): string[] {
  const keys: string[] = [];
  let cur = new TZDate(start, zone);
  const stop = new TZDate(end, zone);
  while (cur < stop) {
    keys.push(format(cur, "yyyy-MM-dd"));
    cur = addDays(cur, 1);
  }
  return keys;
}

export function dayKey(date: Date, zone = DEFAULT_TZ): string {
  return format(date, "yyyy-MM-dd", { in: tz(zone) });
}

export function weekKey(date: Date, zone = DEFAULT_TZ): string {
  return format(startOfWeek(date, { in: tz(zone), weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function monthKey(date: Date, zone = DEFAULT_TZ): string {
  return format(date, "yyyy-MM", { in: tz(zone) });
}
