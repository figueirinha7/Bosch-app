/* ════════════════════════════════════════════════════════════════
   Constantes, formatação, API e cálculos partilhados
════════════════════════════════════════════════════════════════ */
export const APP_VERSAO = "v6";
export const API_URL    = "https://script.google.com/macros/s/AKfycbyWrMJMvV3RpXIck9Z_hl6EPFRERnoBk6O3Ii-rQ3Ccp7PBnNM45TP8HUs-zYICRzeV-Q/exec";

export const MESES   = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
export const MESES_S = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
export const CATS    = ["Utilities","Limpeza","Manutenção","Seguros","Administração","Obras","Outros"];
export const AVISO_TIPOS = ["Aviso","Notificação","Acta de Reunião","Comunicado"];
export const METODOS = ["Transferência","Numerário","TPA","Cheque","Outro"];
export const ESTADOS_CONTRIB = ["Aberto","Fechado"];
export const pad2    = (n) => String(n).padStart(2,"0");
// Data local (não UTC) — evita o dia anterior entre as 00:00 e a 01:00 em Angola
export const today   = () => { const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };
export const chaveMes = (ano, mes) => `${ano}-${pad2(mes)}`;

/* ── FORMAT ── */
// Espaço normal como separador de milhares (o pt-PT usa um espaço fino que imprime mal)
export const fmtNum  = (v) => Math.round(v||0).toLocaleString("pt-PT").replace(/[  ]/g," ");
export const fmtKz   = (v) => fmtNum(v) + " Kz";
export const fmtSinal = (v) => (v>0?"+ ":v<0?"− ":"") + fmtNum(Math.abs(v));
export const fmtDate = (d) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-PT",{day:"2-digit",month:"short",year:"numeric"}) : "";
export const fmtDateCurta = (d) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-PT",{day:"2-digit",month:"short"}) : "";
export const fmtDateNum = (d) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-PT") : "";
export const fmtDateTime = (d) => d ? new Date(d).toLocaleString("pt-PT",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "";
export const nomeApt = (f) => f ? (f.prop_nome||f.proprietario||"") : "";
export const lblMes  = (m) => `${MESES_S[m.mes-1]} ${m.ano}`;

/* ── STORAGE ── */
// localStorage: cache dos dados públicos (sem dados pessoais)
// sessionStorage: sessão do gestor e rascunho de formulário (terminam ao fechar o separador)
export function stGet(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch(_) { return null; }
}
export function stSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(_) {}
}
export function stDel(key) {
  try { localStorage.removeItem(key); } catch(_) {}
}
export function sessGet() {
  try { const s = JSON.parse(sessionStorage.getItem("condo_sessao")||"null"); return s && s.exp > Date.now() ? s : null; } catch(_) { return null; }
}
export function sessSet(s) {
  try { if (s) sessionStorage.setItem("condo_sessao", JSON.stringify(s)); else sessionStorage.removeItem("condo_sessao"); } catch(_) {}
}
export function rascunhoGet() {
  try { return JSON.parse(sessionStorage.getItem("condo_rascunho")||"null"); } catch(_) { return null; }
}
export function rascunhoSet(r) {
  try { if (r) sessionStorage.setItem("condo_rascunho", JSON.stringify(r)); else sessionStorage.removeItem("condo_rascunho"); } catch(_) {}
}
// A cache da v4 guardava todos os dados (incl. palavra-passe) — apagar
stDel("condo_cache");

/* ── API ── */
export class ApiError extends Error { constructor(msg, code) { super(msg); this.code = code; } }
export async function apiGet(apiUrl) {
  const r = await fetch(apiUrl, { redirect:"follow" });
  if (!r.ok) throw new Error("HTTP "+r.status);
  return r.json();
}
export async function apiPost(apiUrl, action, data, token) {
  const r = await fetch(apiUrl, { method:"POST", redirect:"follow", headers:{"Content-Type":"text/plain"}, body:JSON.stringify({action,data,token}) });
  if (!r.ok) throw new Error("HTTP "+r.status);
  const res = await r.json();
  if (!res.ok) throw new ApiError(res.error||"Erro", res.code);
  return res;
}

/* ── WHATSAPP ── */
// Normaliza para o formato internacional (Angola por omissão)
export function waNumero(tel) {
  let d = String(tel||"").replace(/\D/g,"");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9) d = "244" + d;
  return d;
}
export function waAbrir(tel, msg) {
  const n = waNumero(tel);
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(msg)}`, "_blank");
}
export function msgLembrete(f, nome, qi, contribs, config) {
  const linhas = [`🏢 *${config.predio}*`, "", `Caro(a) ${nome||nomeApt(f)},`, "",
    `Lembramos que o apartamento *${f.numero}* tem valores em atraso:`];
  if (qi && qi.mesesEmFalta.length > 0) {
    const meses = qi.mesesEmFalta.map(lblMes).join(", ");
    linhas.push(`• Quotas (${qi.mesesAtraso} ${qi.mesesAtraso===1?"mês":"meses"}): ${meses} — ${fmtKz(qi.divida)}`);
  }
  (contribs||[]).forEach(c => linhas.push(`• ${c.titulo}: ${fmtKz(c.divida)}`));
  const total = (qi?.divida||0) + (contribs||[]).reduce((s,c)=>s+c.divida,0);
  linhas.push("", `*Total em dívida: ${fmtKz(total)}*`, "", "Agradecemos a regularização com a maior brevidade possível.", "", `${config.gestorNome||"A gestão"}`);
  return linhas.join("\n");
}
export function msgAviso(a, config) {
  const url = window.location.origin + window.location.pathname;
  return [`📢 *${config.predio}*`, "", `*${a.tipo}: ${a.titulo}*`, a.data ? fmtDate(a.data) : "", "", a.conteudo||"", "", `Mais informação: ${url}`]
    .filter((l,i,arr)=>!(l===""&&arr[i-1]==="")).join("\n").trim();
}

/* ═══════════════════════════════════════════════════════════════
   QUOTAS E CONTRIBUIÇÕES
═══════════════════════════════════════════════════════════════ */
export function quotaInfo(fracaoId, pags, quotaMensal, anoBase, mesBase) {
  const now = new Date();
  const [ny, nm] = [now.getFullYear(), now.getMonth()+1];
  const mesesEmFalta = [];
  let y = anoBase, m = mesBase;
  while (y < ny || (y===ny && m<=nm)) {
    const key = chaveMes(y, m);
    const pagMes = pags.filter(p=>p.fracaoId===fracaoId && p.mes===m && p.ano===y);
    // Mês isento: existe um registo com metodo="Isento" para este mês
    const isento = pagMes.some(p=>p.metodo==="Isento");
    if (!isento) {
      const pagTotal = pagMes.filter(p=>p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0);
      if (pagTotal < quotaMensal) mesesEmFalta.push({mes:m, ano:y, pago:pagTotal, emFalta:quotaMensal-pagTotal, key});
    }
    m++; if(m>12){m=1;y++;}
  }
  const totalPago = pags.filter(p=>p.fracaoId===fracaoId&&p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0);
  const divida    = mesesEmFalta.reduce((s,x)=>s+x.emFalta,0);
  return { totalPago, divida, mesesAtraso:mesesEmFalta.length, mesesEmFalta };
}

// Estado de um mês para um apartamento: pago | parcial | falta | isento | futuro | antes | excluido
export function estadoMes(f, ano, mes, pags, config) {
  if (f.excluiQuota) return { k:"excluido", pago:0, regs:[] };
  const regs = pags.filter(p=>p.fracaoId===f.id && p.mes===mes && p.ano===ano);
  const pago = regs.filter(p=>p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0);
  const q = config.quotaMensal;
  if (regs.some(p=>p.metodo==="Isento")) return { k:"isento", pago, regs };
  const antes = ano < config.anoBase || (ano===config.anoBase && mes < config.mesBase);
  const now = new Date(), ny = now.getFullYear(), nm = now.getMonth()+1;
  const futuro = ano > ny || (ano===ny && mes > nm);
  if (q>0 ? pago>=q : pago>0) return { k:"pago", pago, regs };
  if (pago>0) return { k:"parcial", pago, regs, emFalta:q-pago };
  if (antes) return { k:"antes", pago, regs };
  if (futuro) return { k:"futuro", pago, regs };
  return { k:"falta", pago, regs, emFalta:q };
}

// Etiquetas de atraso (limiares únicos em toda a app)
//   1 mês = Pendente · 2–3 meses = Em atraso · 4+ meses = Grande atraso
export function nivelAtraso(meses) {
  if (!meses) return { k:"ok", label:"Em dia", tag:"tag-green" };
  if (meses === 1) return { k:"pendente", label:"Pendente", tag:"tag-amber" };
  if (meses <= 3) return { k:"atraso", label:"Em atraso", tag:"tag-red" };
  return { k:"grande", label:"Grande atraso", tag:"tag-red-strong" };
}

export function contribInfo(c, fId, pagsCont) {
  const pags     = pagsCont.filter(p=>p.contribuicaoId===c.id && p.fracaoId===fId);
  // Isento: existe registo com metodo="Isento" para esta contribuição e fracção
  const isento   = pags.some(p=>p.metodo==="Isento");
  const total    = pags.filter(p=>p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0);
  const excluido = (c.excluidos||[]).includes(fId);
  const vpf      = parseFloat(c.valorPorFracao) || 0;
  const vt       = parseFloat(c.valorTotal)     || 0;
  const isLivre  = vpf === 0 && vt === 0;
  if (isLivre || excluido || isento) return { totalPago:total, divida:0, pago:true, excluido, isLivre, isento };
  const divida = vpf > 0 ? Math.max(0, vpf - total) : 0;
  return { totalPago:total, divida, pago: vpf > 0 ? total >= vpf : total > 0, excluido:false, isLivre:false, isento:false };
}

// Meta de uma contribuição: valor total, ou valor por apt × apts participantes
export function metaContrib(c, fracoes) {
  const vt = parseFloat(c.valorTotal)||0, vpf = parseFloat(c.valorPorFracao)||0;
  return vt > 0 ? vt : vpf * fracoes.filter(f=>!(c.excluidos||[]).includes(f.id)).length;
}

// Situação completa de um apartamento (quotas + contribuições)
export function situacaoApt(f, appData) {
  const { pagamentosQuota, contribuicoes, pagamentosContribuicao, config } = appData;
  const qi = f.excluiQuota ? {divida:0,mesesAtraso:0,mesesEmFalta:[],totalPago:0}
    : quotaInfo(f.id, pagamentosQuota, config.quotaMensal, config.anoBase, config.mesBase);
  const contribs = contribuicoes.map(c=>({...c,...contribInfo(c,f.id,pagamentosContribuicao)})).filter(c=>c.divida>0);
  const total = qi.divida + contribs.reduce((s,c)=>s+c.divida,0);
  return { qi, contribs, total };
}

// Lista de {mes, ano} entre dois meses (inclusive)
export function intervaloMeses(mi, ai, mf, af) {
  const r = []; let y = ai, m = mi;
  while ((y < af || (y===af && m<=mf)) && r.length < 240) { r.push({mes:m, ano:y}); m++; if(m>12){m=1;y++;} }
  return r;
}

// Reparte um total pelos meses, preenchendo cada um até ao que falta, por ordem.
// O que sobrar vai para o último mês. Meses que ficam a zero são omitidos.
export function alocar(total, alvos) {
  let resto = Math.round(total);
  const r = alvos.map((a,i)=>{
    const v = i===alvos.length-1 ? resto : Math.min(resto, Math.max(0, a));
    resto -= v; return v;
  });
  return r;
}

// Resume uma lista de meses: "Jan–Mar 2026, Jun 2026"
export function resumoMeses(meses) {
  const ord = [...meses].sort((a,b)=>a.ano-b.ano||a.mes-b.mes);
  const grupos = [];
  ord.forEach(m=>{
    const g = grupos[grupos.length-1];
    if (g && g.ano===m.ano && g.fim===m.mes-1) g.fim = m.mes;
    else grupos.push({ano:m.ano, ini:m.mes, fim:m.mes});
  });
  return grupos.map(g=> g.ini===g.fim ? `${MESES_S[g.ini-1]} ${g.ano}` : `${MESES_S[g.ini-1]}–${MESES_S[g.fim-1]} ${g.ano}`).join(", ");
}

/* ═══════════════════════════════════════════════════════════════
   CAIXA — entradas e saídas pela data em que o dinheiro entrou/saiu
═══════════════════════════════════════════════════════════════ */
const KEY_RE = /^\d{4}-\d{2}/;
// Mês de caixa de um pagamento de quota: data do pagamento; se faltar, o mês de referência
export function mesCaixaQuota(p) {
  if (KEY_RE.test(p.data||"")) return p.data.slice(0,7);
  return p.ano && p.mes ? chaveMes(p.ano, p.mes) : "";
}

// { "2026-09": {quotas, contribuicoes, despesas}, ... }
// Na página pública usa os totais mensais enviados pelo Apps Script (v6),
// porque as datas de cada pagamento não são públicas.
export function fluxoMensal(appData) {
  const map = {};
  const slot = k => (map[k] ||= { quotas:0, contribuicoes:0, despesas:0 });
  if (appData.entradasMensais) {
    appData.entradasMensais.forEach(e => { if (KEY_RE.test(e.mes||"")) { const s=slot(e.mes); s.quotas+=e.quotas||0; s.contribuicoes+=e.contribuicoes||0; } });
  } else {
    (appData.pagamentosQuota||[]).forEach(p=>{ if(p.metodo==="Isento") return; const k=mesCaixaQuota(p); if(k) slot(k).quotas+=p.valor; });
    (appData.pagamentosContribuicao||[]).forEach(p=>{ if(p.metodo==="Isento"||!KEY_RE.test(p.data||"")) return; slot(p.data.slice(0,7)).contribuicoes+=p.valor; });
  }
  (appData.despesas||[]).forEach(d=>{ if(KEY_RE.test(d.data||"")) slot(d.data.slice(0,7)).despesas+=d.valor; });
  return map;
}
export const temContas = (appData) => !!(appData.despesas && (appData.entradasMensais || appData.pagamentosQuota?.some(p=>"data" in p)));

// Conta de um mês: saldo inicial + entradas − despesas = saldo final
export function contaMes(fluxo, ano, mes) {
  const k = chaveMes(ano, mes);
  let saldoInicial = 0;
  Object.entries(fluxo).forEach(([kk,v])=>{ if (kk < k) saldoInicial += v.quotas + v.contribuicoes - v.despesas; });
  const v = fluxo[k] || { quotas:0, contribuicoes:0, despesas:0 };
  const entradas = v.quotas + v.contribuicoes;
  return { saldoInicial, quotas:v.quotas, contribuicoes:v.contribuicoes, entradas, despesas:v.despesas, saldoFinal: saldoInicial + entradas - v.despesas };
}

// Últimos n meses até (ano, mes), com saldo acumulado no fim de cada um
export function serieMeses(fluxo, ano, mes, n=12) {
  const r = [];
  let y = ano, m = mes;
  for (let i=0;i<n;i++){ r.unshift({ano:y, mes:m}); m--; if(m<1){m=12;y--;} }
  return r.map(x=>{ const c = contaMes(fluxo, x.ano, x.mes); return { ...x, label:`${MESES_S[x.mes-1]} ${String(x.ano).slice(2)}`, Entradas:c.entradas, Despesas:c.despesas, Saldo:c.saldoFinal }; });
}

// Primeiro mês com movimento (para limitar navegação)
export function primeiroMes(fluxo, config) {
  const ks = Object.keys(fluxo).sort();
  const base = chaveMes(config.anoBase||new Date().getFullYear(), config.mesBase||1);
  const k = ks.length && ks[0] < base ? ks[0] : base;
  return { ano:+k.slice(0,4), mes:+k.slice(5,7) };
}

// Cobrança das quotas de um mês (pelo mês de referência)
export function cobrancaMes(appData, ano, mes) {
  const { fracoes, pagamentosQuota, config } = appData;
  const q = config.quotaMensal;
  let pagaram = 0, elegiveis = 0, cobrado = 0, isentos = 0;
  const emFalta = [];
  fracoes.filter(f=>!f.excluiQuota).forEach(f=>{
    const e = estadoMes(f, ano, mes, pagamentosQuota, config);
    cobrado += e.pago;
    if (e.k==="isento") { isentos++; return; }
    if (e.k==="antes") return;
    elegiveis++;
    if (e.k==="pago") pagaram++; else emFalta.push({ f, ...e });
  });
  return { pagaram, elegiveis, isentos, cobrado, esperado: elegiveis*q, emFalta, excluidos: fracoes.filter(f=>f.excluiQuota) };
}

// Andar de um apartamento, para a grelha do prédio.
// Usa o campo "andar" (1º Dto → 1, R/C → 0); senão o início do número (3B → 3, 102 → 1).
export function andarDe(f) {
  const a = String(f.andar||"").trim();
  if (/^(r\/?c|rés|res)/i.test(a)) return 0;
  const ma = a.match(/\d+/);
  if (ma) return +ma[0];
  const mn = String(f.numero||"").trim().match(/^\d+/);
  if (mn) return mn[0].length >= 3 ? Math.floor(+mn[0]/100) : +mn[0];
  return null;
}
export const nomeAndar = (n) => n===null ? "Outros" : n===0 ? "R/C" : `${n}º`;
