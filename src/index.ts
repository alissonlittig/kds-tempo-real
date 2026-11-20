import { Sala } from "./sala";
export { Sala };

interface Env { SALA: DurableObjectNamespace; ASSETS: Fetcher }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      if (req.headers.get("Upgrade") !== "websocket") return new Response("Esperava WebSocket", { status: 426 });
      // Uma sala por nome: cada visitante pode ter a sua (?sala=minha-loja).
      const nome = (url.searchParams.get("sala") ?? "demo").replace(/[^a-z0-9-]/gi, "").slice(0, 32) || "demo";
      return env.SALA.get(env.SALA.idFromName(nome)).fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
};
