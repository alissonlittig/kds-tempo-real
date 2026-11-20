import { DurableObject } from "cloudflare:workers";

export type Status = "novo" | "preparando" | "pronto" | "entregue";
export interface Item { nome: string; qtd: number; preco: number }
export interface Pedido { id: number; mesa: string; itens: Item[]; status: Status; criado: number; pronto: number | null; total: number }

const ORDEM: Status[] = ["novo", "preparando", "pronto", "entregue"];
const MAX_ATIVOS = 60;

/** Uma sala = uma lanchonete. Estado em SQLite do Durable Object; sockets via hibernation API. */
export class Sala extends DurableObject<Record<string, never>> {
  constructor(ctx: DurableObjectState, env: Record<string, never>) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, mesa TEXT NOT NULL, itens TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'novo', criado INTEGER NOT NULL, pronto INTEGER, total REAL NOT NULL)`);
  }

  fetch(_req: Request): Response {
    const [cliente, servidor] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(servidor);
    servidor.send(JSON.stringify(this.estado()));
    return new Response(null, { status: 101, webSocket: cliente });
  }

  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    let m: any;
    try { m = JSON.parse(String(raw)); } catch { return; }
    const sql = this.ctx.storage.sql;
    if (m.t === "novo") {
      const itens = this.validar(m.itens);
      const mesa = String(m.mesa ?? "").trim().slice(0, 12);
      if (!itens.length || !mesa) return ws.send(JSON.stringify({ t: "erro", msg: "Informe mesa e ao menos um item." }));
      const ativos = sql.exec("SELECT COUNT(*) c FROM pedidos WHERE status != 'entregue'").one().c as number;
      if (ativos >= MAX_ATIVOS) return ws.send(JSON.stringify({ t: "erro", msg: "Fila cheia (limite da demo)." }));
      const total = itens.reduce((s, i) => s + i.preco * i.qtd, 0);
      sql.exec("INSERT INTO pedidos (mesa, itens, criado, total) VALUES (?,?,?,?)", mesa, JSON.stringify(itens), Date.now(), total);
    } else if (m.t === "status" && ORDEM.includes(m.status)) {
      const pronto = m.status === "pronto" ? Date.now() : null;
      sql.exec("UPDATE pedidos SET status=?, pronto=COALESCE(?, pronto) WHERE id=?", m.status, pronto, Number(m.id));
    } else if (m.t === "limpar") {
      sql.exec("DELETE FROM pedidos");
    } else return;
    this.difundir();
  }

  webSocketClose(ws: WebSocket, code: number): void { try { ws.close(code); } catch { /* já fechado */ } }

  private validar(itens: unknown): Item[] {
    if (!Array.isArray(itens)) return [];
    return itens.slice(0, 20).map((i: any) => ({
      nome: String(i?.nome ?? "").slice(0, 40), qtd: Math.min(20, Math.max(1, Math.floor(Number(i?.qtd)) || 1)),
      preco: Math.min(500, Math.max(0, Number(i?.preco) || 0)),
    })).filter((i) => i.nome);
  }

  private estado() {
    const rows = this.ctx.storage.sql.exec("SELECT * FROM pedidos ORDER BY id").toArray();
    const pedidos: Pedido[] = rows.map((r: any) => ({ ...r, itens: JSON.parse(r.itens) }));
    const feitos = pedidos.filter((p) => p.pronto);
    return {
      t: "estado", agora: Date.now(), pedidos,
      resumo: {
        total: pedidos.length,
        ativos: pedidos.filter((p) => p.status !== "entregue" && p.status !== "pronto").length,
        faturamento: pedidos.reduce((s, p) => s + p.total, 0),
        tempoMedioMs: feitos.length ? feitos.reduce((s, p) => s + (p.pronto! - p.criado), 0) / feitos.length : 0,
      },
    };
  }

  private difundir(): void {
    const msg = JSON.stringify(this.estado());
    for (const ws of this.ctx.getWebSockets()) ws.send(msg);
  }
}
