// Teste de fumaça: dois clientes na mesma sala; pedido do balcão chega na cozinha.
// Uso: npm run dev (outro terminal) e depois npm test   [BASE=wss://host para testar o online]
import assert from "node:assert/strict";
const BASE = process.env.BASE ?? "ws://127.0.0.1:8787";
const sala = "teste" + Date.now();
const abrir = () => new Promise((res, rej) => {
  const ws = new WebSocket(`${BASE}/ws?sala=${sala}`);
  ws.msgs = [];
  ws.addEventListener("message", (e) => ws.msgs.push(JSON.parse(e.data)));
  ws.addEventListener("open", () => res(ws));
  ws.addEventListener("error", rej);
});
const espera = async (f) => { for (let i = 0; i < 50; i++) { const r = f(); if (r) return r; await new Promise((r) => setTimeout(r, 100)); } throw new Error("timeout"); };
const ultimo = (ws) => ws.msgs.filter((m) => m.t === "estado").at(-1);

const balcao = await abrir(), cozinha = await abrir();
await espera(() => ultimo(cozinha));
balcao.send(JSON.stringify({ t: "novo", mesa: "7", itens: [{ nome: "X-Brasa", qtd: 2, preco: 32 }] }));
let e = await espera(() => ultimo(cozinha)?.pedidos.length === 1 && ultimo(cozinha));
assert.equal(e.pedidos[0].status, "novo");
assert.equal(e.pedidos[0].total, 64);
const id = e.pedidos[0].id;
cozinha.send(JSON.stringify({ t: "status", id, status: "preparando" }));
cozinha.send(JSON.stringify({ t: "status", id, status: "pronto" }));
e = await espera(() => ultimo(balcao)?.pedidos[0]?.status === "pronto" && ultimo(balcao));
assert.equal(e.resumo.faturamento, 64);
assert.ok(e.resumo.tempoMedioMs >= 0 && e.pedidos[0].pronto);
// entrada inválida é rejeitada, não vira pedido
balcao.send(JSON.stringify({ t: "novo", mesa: "", itens: [] }));
await espera(() => balcao.msgs.some((m) => m.t === "erro"));
assert.equal(ultimo(balcao).pedidos.length, 1);
balcao.send(JSON.stringify({ t: "limpar" }));
await espera(() => ultimo(cozinha)?.pedidos.length === 0);
console.log("OK: sincronia balcão→cozinha→resumo, validação e limpeza");
balcao.close(); cozinha.close();
