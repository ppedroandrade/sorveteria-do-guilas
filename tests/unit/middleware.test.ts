import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { SESSION_COOKIE } from "@/lib/auth/constants";

const req = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "http://localhost:3000"), cookie ? { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } } : undefined);

describe("proteção de rotas (middleware)", () => {
  it("redireciona páginas para /login sem sessão, preservando o destino", () => {
    const res = middleware(req("/pedidos?view=list"));
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).toBe("/pedidos?view=list");
  });
  it("responde 401 em APIs sem sessão", async () => {
    const res = middleware(req("/api/relatorios/vendas"));
    expect(res.status).toBe(401);
  });
  it("libera a tela de login", () => {
    expect(middleware(req("/login")).headers.get("x-middleware-next")).toBe("1");
  });
  it("deixa passar com cookie (validação real ocorre no servidor)", () => {
    expect(middleware(req("/", "qualquer")).headers.get("x-middleware-next")).toBe("1");
  });
});
