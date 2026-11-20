// Cliente WebSocket com reconexão + utilitários compartilhados pelas telas.
export const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function conectar(onEstado, onLive) {
  const sala = new URLSearchParams(location.search).get("sala") || "demo";
  let ws, delay = 500, skew = 0;
  const abrir = () => {
    ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?sala=${encodeURIComponent(sala)}`);
    ws.onopen = () => { delay = 500; onLive(true); };
    ws.onclose = () => { onLive(false); setTimeout(abrir, delay = Math.min(delay * 2, 8000)); };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === "estado") { skew = m.agora - Date.now(); onEstado(m); }
      else if (m.t === "erro") toast(m.msg);
    };
  };
  abrir();
  return { enviar: (o) => ws?.readyState === 1 && ws.send(JSON.stringify(o)), agora: () => Date.now() + skew };
}

export function toast(msg) {
  const d = Object.assign(document.createElement("div"), { className: "toast", textContent: msg, role: "alert" });
  document.body.append(d);
  setTimeout(() => d.remove(), 3000);
}

// Bipe curto via WebAudio (o navegador só libera após um clique do usuário).
let ac;
export function bip() {
  try {
    ac ??= new AudioContext();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.18);
  } catch { /* sem áudio: o alerta visual basta */ }
}
export const liveEl = (el) => (on) => { el.classList.toggle("on", on); el.lastChild.textContent = on ? "ao vivo" : "reconectando…"; };
