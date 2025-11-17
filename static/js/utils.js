// utils.js — helpers globais bem simples e sem dependências
(() => {
  const brl = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const num = (v) => {
    if (v == null) return 0;
    const n =
      typeof v === "string" ? v.replace(/\./g, "").replace(",", ".") : v;
    const x = Number(n);
    return Number.isFinite(x) ? x : 0;
  };
  const fmtMoeda = (v) => brl.format(num(v));

  const escapeHTML = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  // expõe no escopo global de forma explícita
  window.AppUtils = { brl, num, fmtMoeda, escapeHTML, fmtDate, pad2 };
})();
