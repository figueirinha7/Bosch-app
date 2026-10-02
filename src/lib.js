/* ════════════════════════════════════════════════════════════════
   Constantes, formatação, API e cálculos partilhados
════════════════════════════════════════════════════════════════ */
export const APP_VERSAO = "v7.7";
export const API_URL    = "https://script.google.com/macros/s/AKfycbyvN52wjCWtvSOMrRqszVtOZC1OfSnfciOSN1iANp-vH-Ap6wIgchYlUuIu9SUyQgUsVw/exec";

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
// Responsável pelo pagamento: o inquilino, se existir; senão, o proprietário
export const nomeResp = (f) => f ? (f.inq_nome||nomeApt(f)) : "";
// O outro nome (para mostrar em pequeno junto do responsável): o proprietário quando há inquilino
export const nomeOutro = (f) => f && f.inq_nome ? nomeApt(f) : "";
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
// Recibo por WhatsApp (D1) — rec vem de reciboNovo / reciboDePagamento
export function msgRecibo(rec, nome, config) {
  return [`🏢 *${config.predio}*`, "", `*Recibo de pagamento n.º ${rec.numero}*`, "",
    `Caro(a) ${nome||nomeResp(rec.f)},`, "",
    `Confirmamos a recepção de *${fmtKz(rec.total)}* do apartamento *${rec.f?.numero}*, pago a ${fmtDate(rec.data)}${rec.metodo?` (${rec.metodo})`:""}, referente a:`,
    ...rec.meses.map(m=>`• Quota ${MESES[m.mes-1]} ${m.ano}: ${fmtKz(m.valor)}`),
    "", "Obrigado.", "", `${config.gestorNome||"A gestão"}`].join("\n");
}
export function msgAviso(a, config) {
  const url = window.location.origin + window.location.pathname;
  return [`📢 *${config.predio}*`, "", `*${a.tipo}: ${a.titulo}*`, a.data ? fmtDate(a.data) : "", "", a.conteudo||"", "", `Mais informação: ${url}`]
    .filter((l,i,arr)=>!(l===""&&arr[i-1]==="")).join("\n").trim();
}

/* ═══════════════════════════════════════════════════════════════
   QUOTAS E CONTRIBUIÇÕES
═══════════════════════════════════════════════════════════════ */
/* ── APARTAMENTOS INACTIVOS (A2) ──
   fracao_ativa = "Não" na folha: não paga quotas nem contribuições e aparece como "Inactivo". */
export const inativa = (f) => f?.ativa === false;
// Apartamento que não paga quota mensal (acordo especial ou inactivo)
export const semQuota = (f) => !!f?.excluiQuota || inativa(f);

/* ── VALOR DA QUOTA AO LONGO DO TEMPO (B1) ──
   config.quotaHistorico = [{ano, mes, valor}, ...] vindo da aba "💲 Valor da Quota".
   Cada valor vale a partir desse mês. Sem histórico usa quota_mensal_kz para todos os meses;
   antes do primeiro valor do histórico usa o primeiro valor. */
export function historicoQuota(config) {
  return [...(config?.quotaHistorico||[])].filter(h=>h.ano>2000&&h.mes>=1&&h.mes<=12)
    .sort((a,b)=>a.ano-b.ano||a.mes-b.mes);
}
export function quotaDoMes(config, ano, mes) {
  const h = historicoQuota(config);
  if (!h.length) return config?.quotaMensal||0;
  const k = chaveMes(ano, mes);
  let v = h[0].valor;
  h.forEach(x=>{ if (chaveMes(x.ano,x.mes) <= k) v = x.valor; });
  return v;
}
export function quotaAtual(config) {
  const d = new Date();
  return quotaDoMes(config, d.getFullYear(), d.getMonth()+1);
}

// ate = {ano, mes}: calcula a situação no fim desse mês (por omissão, hoje)
export function quotaInfo(fracaoId, pags, config, ate) {
  const { anoBase, mesBase } = config;
  const now = new Date();
  const [ny, nm] = ate ? [ate.ano, ate.mes] : [now.getFullYear(), now.getMonth()+1];
  const mesesEmFalta = [];
  let y = anoBase, m = mesBase;
  while (y < ny || (y===ny && m<=nm)) {
    const key = chaveMes(y, m);
    const pagMes = pags.filter(p=>p.fracaoId===fracaoId && p.mes===m && p.ano===y);
    // Mês isento: existe um registo com metodo="Isento" para este mês
    const isento = pagMes.some(p=>p.metodo==="Isento");
    if (!isento) {
      const q = quotaDoMes(config, y, m);
      const pagTotal = pagMes.filter(p=>p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0);
      if (pagTotal < q) mesesEmFalta.push({mes:m, ano:y, pago:pagTotal, emFalta:q-pagTotal, key});
    }
    m++; if(m>12){m=1;y++;}
  }
  const totalPago = pags.filter(p=>p.fracaoId===fracaoId&&p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0);
  const divida    = mesesEmFalta.reduce((s,x)=>s+x.emFalta,0);
  return { totalPago, divida, mesesAtraso:mesesEmFalta.length, mesesEmFalta };
}

// Estado de um mês para um apartamento: pago | parcial | falta | isento | futuro | antes | excluido | inativo
export function estadoMes(f, ano, mes, pags, config) {
  const regs = pags.filter(p=>p.fracaoId===f.id && p.mes===mes && p.ano===ano);
  if (inativa(f)) return { k:"inativo", pago:regs.filter(p=>p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0), regs };
  if (f.excluiQuota) return { k:"excluido", pago:0, regs:[] };
  const pago = regs.filter(p=>p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0);
  const q = quotaDoMes(config, ano, mes);
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

// Contribuição fechada: mantém o histórico, mas não aceita pagamentos nem conta como dívida
export const contribFechada = (c) => String(c?.estado||"").trim().toLowerCase() === "fechado";
// Abertas primeiro, fechadas no fim (a ordem dentro de cada grupo mantém-se)
export const ordenarContribs = (cs) => [...cs.filter(c=>!contribFechada(c)), ...cs.filter(contribFechada)];

// f: apartamento (objecto) ou só o id. Um apartamento inactivo não participa (fica como excluído).
export function contribInfo(c, f, pagsCont) {
  const fId = typeof f === "object" && f ? f.id : f;
  const inativo = typeof f === "object" && inativa(f);
  const pags     = pagsCont.filter(p=>p.contribuicaoId===c.id && p.fracaoId===fId);
  // Isento: existe registo com metodo="Isento" para esta contribuição e fracção
  const isento   = pags.some(p=>p.metodo==="Isento");
  const total    = pags.filter(p=>p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0);
  const excluido = inativo || (c.excluidos||[]).includes(fId);
  const vpf      = parseFloat(c.valorPorFracao) || 0;
  const vt       = parseFloat(c.valorTotal)     || 0;
  const isLivre  = vpf === 0 && vt === 0;
  const fechada  = contribFechada(c);
  if (isLivre || excluido || isento) return { totalPago:total, divida:0, pago:true, excluido, inativo, isLivre, isento, fechada };
  const divida = fechada ? 0 : vpf > 0 ? Math.max(0, vpf - total) : 0;
  return { totalPago:total, divida, pago: vpf > 0 ? total >= vpf : total > 0, excluido:false, isLivre:false, isento:false, fechada };
}

// Meta de uma contribuição: valor total, ou valor por apt × apts participantes
export function metaContrib(c, fracoes) {
  const vt = parseFloat(c.valorTotal)||0, vpf = parseFloat(c.valorPorFracao)||0;
  return vt > 0 ? vt : vpf * fracoes.filter(f=>!inativa(f)&&!(c.excluidos||[]).includes(f.id)).length;
}

// Situação completa de um apartamento (quotas + contribuições)
// ate = {ano, mes}: situação no fim desse mês — só contam os pagamentos feitos até lá
export function situacaoApt(f, appData, ate) {
  const { contribuicoes, config } = appData;
  let { pagamentosQuota, pagamentosContribuicao } = appData;
  if (ate) {
    const k = chaveMes(ate.ano, ate.mes);
    pagamentosQuota = pagamentosQuota.filter(p=>{ const m=mesCaixaQuota(p); return !m || m<=k; });
    pagamentosContribuicao = pagamentosContribuicao.filter(p=>!p.data || p.data.slice(0,7)<=k);
  }
  const qi = semQuota(f) ? {divida:0,mesesAtraso:0,mesesEmFalta:[],totalPago:0}
    : quotaInfo(f.id, pagamentosQuota, config, ate);
  const contribs = contribuicoes.map(c=>({...c,...contribInfo(c,f,pagamentosContribuicao)})).filter(c=>c.divida>0);
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
  const q = quotaDoMes(config, ano, mes);
  let pagaram = 0, elegiveis = 0, cobrado = 0, isentos = 0;
  const emFalta = [];
  fracoes.filter(f=>!semQuota(f)).forEach(f=>{
    const e = estadoMes(f, ano, mes, pagamentosQuota, config);
    cobrado += e.pago;
    if (e.k==="isento") { isentos++; return; }
    if (e.k==="antes") return;
    elegiveis++;
    if (e.k==="pago") pagaram++; else emFalta.push({ f, ...e });
  });
  return { pagaram, elegiveis, isentos, cobrado, esperado: elegiveis*q, quota: q, emFalta, excluidos: fracoes.filter(f=>f.excluiQuota&&!inativa(f)), inativos: fracoes.filter(inativa) };
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

/* ═══════════════════════════════════════════════════════════════
   CONCILIAÇÃO COM O BANCO (fase 1)
   Colunas lidas pelo Apps Script (só gestor): idMov, dataExtrato, descExtrato,
   valorMov, canal, confianca, notaRec.
═══════════════════════════════════════════════════════════════ */
export const CANAIS = ["Banco","Numerário","Gestor anterior","Isento","Acerto"];
const FORA_BANCO = ["Numerário","Gestor anterior","Acerto"];
// Estado de um registo (quota, pagamento de contribuição ou despesa)
//   conciliado  — ligado a um movimento do extracto
//   isento      — isenção (não mexe em dinheiro)
//   fora        — dinheiro que não passou pelo banco (numerário, gestor anterior, acerto)
//   porConciliar— o resto
export function estadoConc(r) {
  if (!r) return { k:"porConciliar" };
  if (r.metodo === "Isento" || r.canal === "Isento") return { k:"isento", label:"Isento", tag:"tag-grey" };
  if (r.idMov) return { k:"conciliado", label: r.canal==="Gestor anterior" ? "Banco · gestor anterior" : "No banco", tag:"tag-green" };
  if (FORA_BANCO.includes(r.canal)) return { k:"fora", label: r.canal, tag:"tag-blue" };
  return { k:"porConciliar", label:"Por conciliar", tag:"tag-amber" };
}
// A folha tem as colunas de reconciliação? (sem elas, os sinais ficam escondidos)
export const temConciliacao = (appData) =>
  [appData.pagamentosQuota, appData.pagamentosContribuicao, appData.despesas].some(l => (l||[]).some(r => r.idMov || r.canal));

// Saldo da app explicado pelos movimentos do banco, até ao fim de um mês (aaaa-mm; por omissão, tudo):
//   saldo da app = movimentos do banco ligados + entradas sem movimento − despesas sem movimento + diferenças
// "banco" é o saldo que o extracto deve mostrar nessa data (a comparar com o banco).
// "diferenças" = registos que somam mais (ou menos) do que o movimento a que estão ligados
// (ex.: quotas pagas ao gestor anterior, todas ligadas a um único depósito).
export function resumoConciliacao(appData, ate) {
  const dentro = (d) => !ate || (KEY_RE.test(d||"") ? d.slice(0,7) <= ate : true);
  const movs = {};      // id → { data, valor (com sinal), soma dos registos (com sinal) }
  const r = { app:0, banco:0, entradasSem:0, despesasSem:0, nEntradasSem:0, nDespesasSem:0, cont:{conciliado:0,isento:0,fora:0,porConciliar:0} };
  const passa = (x, sinal, dataCaixa) => {
    const e = estadoConc(x); r.cont[e.k]++;
    if (e.k === "isento" || !dentro(dataCaixa)) return;
    const v = sinal * (x.valor||0);
    r.app += v;
    if (x.idMov) {
      const m = (movs[x.idMov] ||= { data: x.dataExtrato || dataCaixa, valor: sinal * (x.valorMov ?? x.valor ?? 0), soma: 0 });
      m.soma += v;
    } else if (sinal > 0) { r.entradasSem += v; r.nEntradasSem++; }
    else { r.despesasSem += -v; r.nDespesasSem++; }
  };
  (appData.pagamentosQuota||[]).forEach(p => passa(p, 1, mesCaixaQuota(p)+"-01"));
  (appData.pagamentosContribuicao||[]).forEach(p => passa(p, 1, p.data));
  (appData.despesas||[]).forEach(d => passa(d, -1, d.data));
  const lista = Object.entries(movs).filter(([,m]) => dentro(m.data));
  r.banco = lista.reduce((s,[,m]) => s + m.valor, 0);
  r.nMovs = lista.length;
  r.difs = lista.filter(([,m]) => Math.abs(m.soma - m.valor) > 0.5).map(([id,m]) => ({ id, ...m, dif: m.soma - m.valor }));
  r.dif = r.difs.reduce((s,x) => s + x.dif, 0);
  return r;
}

/* ═══════════════════════════════════════════════════════════════
   CONCILIAÇÃO — fase 2: extracto bancário
═══════════════════════════════════════════════════════════════ */
// Lê as linhas de um extracto .xlsx (formato "Movimentos" do banco: cabeçalho
// DATA MOV. | DATA VALOR | PEDIDO NUM. | NUM. OPER. | NUM. DOC. | DESCRIÇÃO | VALOR | SALDO | MOEDA).
// rows = array de linhas (cada uma um array de células). Devolve { movimentos, conta, erro }.
const semAcentos = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const dataIso = v => {
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad2(v.getUTCMonth()+1)}-${pad2(v.getUTCDate())}`;
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/); if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  return "";
};
const numero = v => typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;
export function lerExtracto(rows) {
  const iH = rows.findIndex(r => (r||[]).some(c => semAcentos(c) === "NUM. DOC.") && (r||[]).some(c => semAcentos(c) === "DESCRICAO"));
  if (iH < 0) return { erro: "Não encontrei o cabeçalho do extracto (NUM. DOC., DESCRIÇÃO, VALOR…). Use o ficheiro \"Movimentos\" exportado do banco em .xlsx." };
  const h = rows[iH].map(semAcentos), col = n => h.indexOf(n);
  const c = { dataMov: col("DATA MOV."), dataValor: col("DATA VALOR"), pedido: col("PEDIDO NUM."), numOper: col("NUM. OPER."),
    numDoc: col("NUM. DOC."), descricao: col("DESCRICAO"), valor: col("VALOR"), saldo: col("SALDO"), moeda: col("MOEDA") };
  if ([c.dataMov, c.numDoc, c.descricao, c.valor].some(i => i < 0)) return { erro: "Faltam colunas no extracto (DATA MOV., NUM. DOC., DESCRIÇÃO e VALOR são obrigatórias)." };
  const conta = rows.slice(0, iH).map(r => (r||[]).filter(x => x != null).join(" ")).find(t => /conta/i.test(t)) || "";
  const movimentos = [];
  rows.slice(iH + 1).forEach(r => {
    if (!r || r.every(x => x == null || x === "")) return;
    const numDoc = String(r[c.numDoc] ?? "").trim();
    if (!numDoc) return;
    movimentos.push({ ordem: movimentos.length, numDoc, dataMov: dataIso(r[c.dataMov]), dataValor: c.dataValor >= 0 ? dataIso(r[c.dataValor]) : "",
      pedido: c.pedido >= 0 ? String(r[c.pedido] ?? "").trim() : "", numOper: c.numOper >= 0 ? String(r[c.numOper] ?? "").trim() : "",
      descricao: String(r[c.descricao] ?? "").trim(), valor: numero(r[c.valor]), saldo: c.saldo >= 0 && r[c.saldo] != null && r[c.saldo] !== "" ? numero(r[c.saldo]) : null });
  });
  const docs = new Set(movimentos.map(m => m.numDoc));
  if (docs.size !== movimentos.length) return { erro: "O extracto tem NUM. DOC. repetidos — não consigo identificar os movimentos com segurança." };
  return { movimentos, conta };
}

// Identificadores antigos (EXT-AAAAMMDD-NNN = data + posição no ficheiro original) → NUM. DOC.
// Só converte quando a data do id coincide com a do movimento nessa posição.
export function mapaIdsAntigos(appData, movimentos) {
  const ids = new Set();
  [appData.pagamentosQuota, appData.pagamentosContribuicao, appData.despesas].forEach(l => (l||[]).forEach(r => { if (/^EXT-\d{8}-\d+$/.test(r.idMov||"")) ids.add(r.idMov); }));
  const mapa = {}, falham = [];
  ids.forEach(id => {
    const [, d, n] = id.match(/^EXT-(\d{8})-(\d+)$/);
    const m = movimentos[+n];
    if (m && m.dataMov.replace(/-/g, "") === d) mapa[id] = m.numDoc; else falham.push(id);
  });
  return { mapa, falham, total: ids.size };
}

// Saldo do extracto no fim de um mês (aaaa-mm): saldo do último movimento até lá
export function saldoExtracto(extracto, ate) {
  const l = (extracto||[]).filter(m => m.saldo != null && (!ate || (m.dataMov||"").slice(0,7) <= ate));
  if (!l.length) return null;
  const u = l.reduce((a, b) => ((b.dataMov||"") >= (a.dataMov||"") ? b : a));   // a ordem do ficheiro desempata
  return { saldo: u.saldo, data: u.dataMov };
}

// Movimentos do extracto sem nenhum registo da app ligado
export function movimentosPorIdentificar(appData) {
  const lig = new Set();
  [appData.pagamentosQuota, appData.pagamentosContribuicao, appData.despesas].forEach(l => (l||[]).forEach(r => { if (r.idMov) lig.add(String(r.idMov)); }));
  return (appData.extracto||[]).filter(m => !lig.has(String(m.numDoc)) && !(m.idAntigo && lig.has(m.idAntigo)));
}

/* ═══════════════════════════════════════════════════════════════
   CONCILIAÇÃO — fase 3: livro de NIBs e propostas automáticas
═══════════════════════════════════════════════════════════════ */
// Chave de quem paga: o NIB (21 dígitos) se vier na descrição; senão o nome do ordenante.
// Descrições genéricas ("Transferência") não dão chave.
const PREFIXOS = /^(TC STC DE|TRF KWIK DE|TRANSF\.? PELO NIB|TRANSFERENCIA DE|TRANSF\.? DE|TC DE|TRF DE)\s+/;
export function chavePagador(desc) {
  const s = semAcentos(desc);
  const nib = s.match(/\d{21}/);
  if (nib) return nib[0];
  const nome = s.replace(PREFIXOS, "").replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
  const pal = nome.split(" ").filter(p => p.length > 1);
  if (pal.length < 2 || /^TRANSFERENCIA|^TRANSF |^PAGAMENTO|^CONDOMINIO/.test(nome)) return "";
  return "NOME:" + pal.slice(0, 3).join(" ");
}
// Livro de NIBs: aprendido das ligações que já existem (movimento ↔ apartamento) e da aba "🔗 NIBs", se existir.
// Devolve Map chave → [ids de apartamentos], ignorando chaves "genéricas" que apontam para muitos apartamentos.
export function livroNibs(appData) {
  const ext = new Map(); (appData.extracto||[]).forEach(m => { ext.set(String(m.numDoc), m); if (m.idAntigo) ext.set(m.idAntigo, m); });
  const conta = new Map();
  const junta = (chave, fId) => { if (!chave || !fId) return; if (!conta.has(chave)) conta.set(chave, new Set()); conta.get(chave).add(fId); };
  [appData.pagamentosQuota, appData.pagamentosContribuicao].forEach(l => (l||[]).forEach(r => {
    if (!r.idMov || r.canal === "Gestor anterior") return;
    const m = ext.get(String(r.idMov));
    junta(chavePagador(m ? m.descricao : r.descExtrato), r.fracaoId);
  }));
  const num2id = new Map((appData.fracoes||[]).map(f => [String(f.numero).trim(), f.id]));
  (appData.nibs||[]).forEach(n => String(n.fracoes||"").split(/[,;/ ]+/).forEach(x => junta(n.chave, num2id.get(x.trim()))));
  const livro = new Map();
  conta.forEach((ids, k) => { if (ids.size <= 6) livro.set(k, [...ids]); });
  return livro;
}

const diasEntre = (a, b) => Math.abs((new Date(a+"T12:00:00") - new Date(b+"T12:00:00")) / 864e5);
// Subconjunto de registos cuja soma dá exactamente o valor (prefere os registados juntos e os mais próximos da data)
function somaExacta(cands, valor, data) {
  const v = Math.round(valor);
  // 1) registos do mesmo dia (um pagamento de vários meses fica registado de uma vez)
  const porDia = {}; cands.forEach(c => { (porDia[(c.r.data||"")+"|"+c.r.fracaoId] ||= []).push(c); });
  const grupos = Object.values(porDia).filter(g => Math.round(g.reduce((s,c)=>s+c.r.valor,0)) === v)
    .sort((a,b) => diasEntre(a[0].r.data,data) - diasEntre(b[0].r.data,data));
  if (grupos.length) return grupos[0];
  // 2) um só registo
  const um = cands.filter(c => Math.round(c.r.valor) === v).sort((a,b) => diasEntre(a.r.data,data) - diasEntre(b.r.data,data));
  if (um.length) return [um[0]];
  // 3) combinação (limitada), dos registos mais antigos para os mais recentes
  const l = [...cands].sort((a,b) => (a.r.ano||0)-(b.r.ano||0) || (a.r.mes||0)-(b.r.mes||0) || (a.r.data||"").localeCompare(b.r.data||"")).slice(0, 18);
  let passos = 0, res = null;
  const rec = (i, soma, esc) => {
    if (res || ++passos > 40000) return;
    if (soma === v && esc.length) { res = [...esc]; return; }
    if (i >= l.length || soma > v) return;
    esc.push(l[i]); rec(i+1, soma + Math.round(l[i].r.valor), esc); esc.pop();
    rec(i+1, soma, esc);
  };
  rec(0, 0, []);
  return res;
}

// Repartição de uma entrada por um apartamento: quotas em falta mais antigas, depois contribuições abertas em dívida,
// depois quotas futuras (adiantamento, até 12 meses). Devolve null se não der certo ao kwanza.
export function repartirEntrada(appData, fId, valor) {
  const { pagamentosQuota, contribuicoes, pagamentosContribuicao, config } = appData;
  const f = (appData.fracoes||[]).find(x => x.id === fId);
  if (!f || inativa(f)) return null;
  let resto = Math.round(valor);
  const quotas = [], contribs = [];
  if (!semQuota(f)) {
    quotaInfo(fId, pagamentosQuota, config).mesesEmFalta.forEach(m => {
      if (resto <= 0) return; const v = Math.min(resto, Math.round(m.emFalta)); quotas.push({ mes:m.mes, ano:m.ano, valor:v }); resto -= v; });
  }
  contribuicoes.filter(c => !contribFechada(c)).forEach(c => {
    if (resto <= 0) return; const ci = contribInfo(c, f, pagamentosContribuicao);
    if (ci.divida > 0) { const v = Math.min(resto, Math.round(ci.divida)); contribs.push({ c, valor:v }); resto -= v; } });
  if (resto > 0 && !semQuota(f)) {
    const now = new Date(); let y = now.getFullYear(), m = now.getMonth()+2; if (m > 12) { m = 1; y++; }
    for (let i = 0; i < 12 && resto > 0; i++) {
      const ja = quotas.some(q => q.mes===m && q.ano===y) || pagamentosQuota.some(p => p.fracaoId===fId && p.mes===m && p.ano===y);
      if (!ja) { const q = quotaDoMes(config, y, m); const v = Math.min(resto, q); quotas.push({ mes:m, ano:y, valor:v }); resto -= v; }
      m++; if (m > 12) { m = 1; y++; }
    }
  }
  return resto === 0 && (quotas.length || contribs.length) ? { quotas, contribs } : null;
}

// Propostas para os movimentos do extracto ainda sem ligação.
//   tipo "ligar": registos da app já existentes (sem movimento) que somam o valor
//   tipo "criar": entrada de um apartamento conhecido sem registos → repartir por quotas/contribuições
//   tipo "despesa": saída → ligar a uma despesa sem movimento com o mesmo valor, ou criar uma nova
//   tipo "manual": não há proposta segura (o gestor escolhe o apartamento)
export function propostasConciliacao(appData, { dias = 10 } = {}) {
  const livro = livroNibs(appData);
  const livres = (lista, chave) => (lista||[]).filter(r => !r.idMov && r.metodo !== "Isento" && !["Isento","Numerário","Gestor anterior","Acerto"].includes(r.canal))
    .map(r => ({ chave, r }));
  const candEnt = [...livres(appData.pagamentosQuota, "QUOTAS"), ...livres(appData.pagamentosContribuicao, "PGC")];
  const candDesp = livres(appData.despesas, "DESPESAS");
  const usados = new Set();
  // Estado "virtual": o que as propostas anteriores já criaram conta para as seguintes (não repetir meses)
  const virt = { ...appData, pagamentosQuota:[...(appData.pagamentosQuota||[])], pagamentosContribuicao:[...(appData.pagamentosContribuicao||[])] };
  return movimentosPorIdentificar(appData).sort((a,b) => (a.dataMov||"").localeCompare(b.dataMov||"")).map(m => {
    const data = m.dataValor || m.dataMov;
    const perto = c => !usados.has(c.chave+c.r._row) && c.r.data && diasEntre(c.r.data, data) <= dias;
    if (m.valor < 0) {
      const ds = somaExacta(candDesp.filter(perto).map(c => ({ ...c, r:{ ...c.r, fracaoId:"" } })), -m.valor, data);
      if (ds) { const orig = ds.map(x => candDesp.find(c => c.r._row === x.r._row)); orig.forEach(c => usados.add(c.chave+c.r._row));
        return { m, tipo:"despesa", ligar:orig, confianca: orig.every(c => diasEntre(c.r.data,data) <= 3) ? "Alta" : "Média" }; }
      return { m, tipo:"despesa", criarDespesa:{ data, valor:-m.valor, descricao:m.descricao }, confianca:"Média" };
    }
    const chave = chavePagador(m.descricao);
    const apts = chave && livro.get(chave) || null;
    const cands = candEnt.filter(c => perto(c) && (!apts || apts.includes(c.r.fracaoId)));
    const sel = somaExacta(cands, m.valor, data);
    if (sel && (apts || sel.every(c => c.r.fracaoId === sel[0].r.fracaoId))) {
      sel.forEach(c => usados.add(c.chave+c.r._row));
      const perfeito = apts && sel.every(c => diasEntre(c.r.data, data) <= 3);
      return { m, tipo:"ligar", ligar:sel, apts, confianca: perfeito ? (chave.startsWith("NOME:") ? "Alta" : "Confirmado") : "Média" };
    }
    if (apts && apts.length === 1) {
      const rep = repartirEntrada(virt, apts[0], m.valor);
      if (rep) {
        rep.quotas.forEach(q => virt.pagamentosQuota.push({ fracaoId:apts[0], mes:q.mes, ano:q.ano, valor:q.valor, metodo:"Transferência", data }));
        rep.contribs.forEach(x => virt.pagamentosContribuicao.push({ contribuicaoId:x.c.id, fracaoId:apts[0], valor:x.valor, metodo:"Transferência", data }));
        return { m, tipo:"criar", fId:apts[0], ...rep, apts, confianca: chave.startsWith("NOME:") ? "Média" : "Alta" };
      }
    }
    return { m, tipo:"manual", apts, chave };
  });
}

// Proposta para um movimento de entrada quando o gestor escolhe o apartamento à mão:
// primeiro tenta ligar a registos sem movimento desse apartamento; senão reparte (criar).
export function propostaParaApt(appData, m, fId, { dias = 10 } = {}) {
  const data = m.dataValor || m.dataMov;
  const cands = [["QUOTAS", appData.pagamentosQuota], ["PGC", appData.pagamentosContribuicao]].flatMap(([chave, l]) =>
    (l||[]).filter(r => r.fracaoId === fId && !r.idMov && r.metodo !== "Isento" && !["Isento","Numerário","Gestor anterior","Acerto"].includes(r.canal) && r.data && diasEntre(r.data, data) <= dias)
      .map(r => ({ chave, r })));
  const sel = somaExacta(cands, m.valor, data);
  if (sel) return { m, tipo:"ligar", ligar:sel, apts:[fId], confianca:"Alta", manual:true };
  const rep = repartirEntrada(appData, fId, m.valor);
  return rep ? { m, tipo:"criar", fId, ...rep, apts:[fId], confianca:"Alta", manual:true } : { m, tipo:"manual", apts:[fId], semReparticao:true };
}
