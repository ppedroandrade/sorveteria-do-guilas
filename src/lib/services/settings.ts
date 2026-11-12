import { cache } from "react";
import { prisma } from "@/lib/prisma";

export async function loadSettings() {
  return prisma.businessSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/** Deduplicado por requisição. */
export const getSettings = cache(loadSettings);
