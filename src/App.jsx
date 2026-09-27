import { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

/* ════════════════════════════════════════════════════════════════
   ⚙️  CONFIGURAÇÃO — v5
   Só o URL da Aplicação Web do Apps Script. Já não há chave secreta
   no site: as gravações usam a sessão do gestor (palavra-passe).
════════════════════════════════════════════════════════════════ */
const APP_VERSAO = "v5";
const API_URL    = "https://script.google.com/macros/s/AKfycbzEzULjCGbEOiCZ7wBZGsDkyphY7cKtxQtNJFIRNF1HH15CzdSX6pC9yxufQdGmu6XFtw/exec";

/* ── FONTS ── */
const Fonts = () => <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Nunito:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />;

/* ── CONSTANTS ── */
const MESES   = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_S = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const CATS    = ["Utilities","Limpeza","Manutenção","Seguros","Administração","Obras","Outros"];
const AVISO_TIPOS = ["Aviso","Notificação","Acta de Reunião","Comunicado"];
const METODOS = ["Transferência","Numerário","Cheque","TPA","Outro"];
const ESTADOS_CONTRIB = ["Aberto","Fechado"];
const pad2    = (n) => String(n).padStart(2,"0");
// Data local (não UTC) — evita o dia anterior entre as 00:00 e a 01:00 em Angola
const today   = () => { const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };

/* ── FORMAT ── */
const fmtKz   = (v) => Math.round(v||0).toLocaleString("pt-PT") + " Kz";
const fmtDate = (d) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-PT",{day:"2-digit",month:"short",year:"numeric"}) : "";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("pt-PT",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "";
const nomeApt = (f) => f ? (f.prop_nome||f.proprietario||"") : "";

/* ── STORAGE ── */
// localStorage: cache dos dados públicos (sem dados pessoais)
// sessionStorage: sessão do gestor (termina ao fechar o separador)
function stGet(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch(_) { return null; }
}
function stSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(_) {}
}
function sessGet() {
  try { const s = JSON.parse(sessionStorage.getItem("condo_sessao")||"null"); return s && s.exp > Date.now() ? s : null; } catch(_) { return null; }
}
function sessSet(s) {
  try { if (s) sessionStorage.setItem("condo_sessao", JSON.stringify(s)); else sessionStorage.removeItem("condo_sessao"); } catch(_) {}
}
// A cache da v4 guardava todos os dados (incl. palavra-passe) — apagar
try { localStorage.removeItem("condo_cache"); } catch(_) {}

/* ── API ── */
class ApiError extends Error { constructor(msg, code) { super(msg); this.code = code; } }
async function apiGet(apiUrl) {
  const r = await fetch(apiUrl, { redirect:"follow" });
  if (!r.ok) throw new Error("HTTP "+r.status);
  return r.json();
}
async function apiPost(apiUrl, action, data, token) {
  const r = await fetch(apiUrl, { method:"POST", redirect:"follow", headers:{"Content-Type":"text/plain"}, body:JSON.stringify({action,data,token}) });
  if (!r.ok) throw new Error("HTTP "+r.status);
  const res = await r.json();
  if (!res.ok) throw new ApiError(res.error||"Erro", res.code);
  return res;
}

/* ── WHATSAPP ── */
// Normaliza para o formato internacional (Angola por omissão)
function waNumero(tel) {
  let d = String(tel||"").replace(/\D/g,"");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9) d = "244" + d;
  return d;
}
function waAbrir(tel, msg) {
  const n = waNumero(tel);
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(msg)}`, "_blank");
}
function msgLembrete(f, nome, qi, contribs, config) {
  const linhas = [`🏢 *${config.predio}*`, "", `Caro(a) ${nome||nomeApt(f)},`, "",
    `Lembramos que o apartamento *${f.numero}* tem valores em atraso:`];
  if (qi && qi.mesesEmFalta.length > 0) {
    const meses = qi.mesesEmFalta.map(m=>`${MESES_S[m.mes-1]} ${m.ano}`).join(", ");
    linhas.push(`• Quotas (${qi.mesesAtraso} ${qi.mesesAtraso===1?"mês":"meses"}): ${meses} — ${fmtKz(qi.divida)}`);
  }
  (contribs||[]).forEach(c => linhas.push(`• ${c.titulo}: ${fmtKz(c.divida)}`));
  const total = (qi?.divida||0) + (contribs||[]).reduce((s,c)=>s+c.divida,0);
  linhas.push("", `*Total em dívida: ${fmtKz(total)}*`, "", "Agradecemos a regularização com a maior brevidade possível.", "", `${config.gestorNome||"A gestão"}`);
  return linhas.join("\n");
}

/* ═══════════════════════════════════════════════════════════════
   CALC HELPERS
═══════════════════════════════════════════════════════════════ */
function quotaInfo(fracaoId, pags, quotaMensal, anoBase, mesBase) {
  const now = new Date();
  const [ny, nm] = [now.getFullYear(), now.getMonth()+1];
  const mesesEmFalta = [];
  let y = anoBase, m = mesBase;
  while (y < ny || (y===ny && m<=nm)) {
    const key = `${y}-${pad2(m)}`;
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

function contribInfo(c, fId, pagsCont) {
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

// Lista de {mes, ano} entre dois meses (inclusive)
function intervaloMeses(mi, ai, mf, af) {
  const r = []; let y = ai, m = mi;
  while ((y < af || (y===af && m<=mf)) && r.length < 240) { r.push({mes:m, ano:y}); m++; if(m>12){m=1;y++;} }
  return r;
}

// Reparte um total por n meses (Kz inteiros; o resto vai para o último mês)
function repartir(total, n) {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  return Array.from({length:n}, (_,i)=> i===n-1 ? total - base*(n-1) : base);
}

/* ═══════════════════════════════════════════════════════════════
   REPORTS
═══════════════════════════════════════════════════════════════ */
function printReport(appData, mes, ano, anual=false) {
  const { config, fracoes, pagamentosQuota, contribuicoes, pagamentosContribuicao, despesas } = appData;
  const { predio, endereco, gestorNome, quotaMensal, anoBase, mesBase } = config;
  const fmtR = v => Math.round(v||0).toLocaleString("pt-PT")+" Kz";

  // ── MENSAL ──────────────────────────────────────────
  if (!anual) {
    const pqSel   = pagamentosQuota.filter(p=>p.mes===mes&&p.ano===ano&&p.metodo!=="Isento");
    const despSel = despesas.filter(d=>d.data?.startsWith(`${ano}-${pad2(mes)}`));
    const pcSel   = pagamentosContribuicao.filter(p=>p.data?.startsWith(`${ano}-${pad2(mes)}`)&&p.metodo!=="Isento");
    const totalRec  = pqSel.reduce((s,p)=>s+p.valor,0)+pcSel.reduce((s,p)=>s+p.valor,0);
    const totalDesp = despSel.reduce((s,d)=>s+d.valor,0);
    const saldo     = totalRec-totalDesp;
    const pagaram   = fracoes.filter(f=>pqSel.some(p=>p.fracaoId===f.id));
    const naoPageram= fracoes.filter(f=>!f.excluiQuota&&!pqSel.some(p=>p.fracaoId===f.id)&&!pagamentosQuota.some(p=>p.fracaoId===f.id&&p.mes===mes&&p.ano===ano&&p.metodo==="Isento"));
    const titulo    = `Relatório ${MESES[mes-1]} ${ano}`;
    const html = `<!DOCTYPE html><html lang="pt"><head>
<meta charset="UTF-8"><title>${titulo}</title>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Nunito:wght@400;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0} body{font-family:'Nunito',sans-serif;color:#1C1A16;background:#fff;padding:28px;max-width:820px;margin:0 auto;font-size:13px}
  h2{font-family:'Lora',serif;font-size:15px;font-weight:700;color:#B5341A;border-bottom:2px solid #B5341A;padding-bottom:5px;margin:22px 0 10px}
  .hdr{border-bottom:3px solid #B5341A;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start}
  .meta{font-size:12px;color:#8A8278;margin-top:6px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
  .stat{background:#F5F3EF;border-radius:8px;padding:12px 14px}
  .sl{font-size:10px;color:#8A8278;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
  .sv{font-size:16px;font-weight:700} .g{color:#1E7A4A} .r{color:#B5341A}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  th{font-size:10px;color:#8A8278;text-transform:uppercase;letter-spacing:.4px;padding:7px 9px;border-bottom:1.5px solid #E2DDD6;text-align:left}
  td{padding:8px 9px;font-size:12px;border-bottom:1px solid #F0EDE8}
  .foot{margin-top:28px;padding-top:12px;border-top:1px solid #E2DDD6;font-size:11px;color:#8A8278;display:flex;justify-content:space-between}
  @media print{body{padding:16px}}
</style></head><body>
<div class="hdr">
  <div><div style="font-family:'Lora',serif;font-size:24px;font-weight:700">${predio}</div>
  <div class="meta">${endereco}</div>
  <div class="meta">📅 ${titulo} &nbsp;·&nbsp; 👤 ${gestorNome} &nbsp;·&nbsp; 🖨️ ${new Date().toLocaleDateString("pt-PT")}</div></div>
  <div style="font-family:'Lora',serif;font-size:20px;font-weight:700;color:#B5341A;text-align:right">Relatório<br>Mensal</div>
</div>
<h2>Resumo</h2>
<div class="grid">
  <div class="stat"><div class="sl">Cobrado</div><div class="sv g">${fmtR(totalRec)}</div></div>
  <div class="stat"><div class="sl">Despesas</div><div class="sv r">${fmtR(totalDesp)}</div></div>
  <div class="stat"><div class="sl">Saldo do Mês</div><div class="sv ${saldo>=0?'g':'r'}">${fmtR(saldo)}</div></div>
</div>
${naoPageram.length>0?`<h2>Em Atraso</h2><table><thead><tr><th>Apt.</th><th>Proprietário / Residente</th></tr></thead><tbody>
${naoPageram.map(f=>`<tr><td><b>${f.numero}</b></td><td>${f.inq_nome||f.prop_nome||f.proprietario}</td></tr>`).join("")}
</tbody></table>`:""}
${pagaram.length>0?`<h2>Pagamentos de Quota</h2><table><thead><tr><th>Apt.</th><th>Residente</th><th>Data</th><th>Valor</th><th>Método</th></tr></thead><tbody>
${pagaram.map(f=>{const p=pqSel.find(x=>x.fracaoId===f.id);return`<tr><td><b>${f.numero}</b></td><td>${f.inq_nome||f.prop_nome||f.proprietario}</td><td>${fmtDate(p?.data)}</td><td><b>${fmtR(p?.valor)}</b></td><td style="color:#8A8278">${p?.metodo||"—"}</td></tr>`;}).join("")}
</tbody></table>`:""}
${despSel.length>0?`<h2>Despesas</h2><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Obs.</th></tr></thead><tbody>
${despSel.map(d=>`<tr><td>${fmtDate(d.data)}</td><td>${d.descricao}</td><td style="color:#C96B15">${d.categoria}</td><td><b>${fmtR(d.valor)}</b></td><td style="color:#8A8278">${d.observacoes||""}</td></tr>`).join("")}
<tr style="background:#FEF4E8"><td colspan="3"><b>Total Despesas</b></td><td><b>${fmtR(totalDesp)}</b></td><td></td></tr>
</tbody></table>`:""}
<div class="foot"><div>${predio} · ${endereco}</div><div>Gerado automaticamente · ${new Date().toLocaleString("pt-PT")}</div></div>
</body></html>`;
    const w=window.open("","_blank"); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),600);
    return;
  }

  // ── ANUAL ────────────────────────────────────────────
  const titulo = `Relatório Anual ${ano}`;

  // Receitas e despesas do ano seleccionado
  const pqAno  = pagamentosQuota.filter(p=>p.ano===ano&&p.metodo!=="Isento");
  const despAno= despesas.filter(d=>d.data?.startsWith(`${ano}-`));
  const pcAno  = pagamentosContribuicao.filter(p=>p.data?.startsWith(`${ano}-`)&&p.metodo!=="Isento");

  // Saldo transitado: tudo antes de 1/Jan/ano (excluindo isentos)
  const pqAnte = pagamentosQuota.filter(p=>p.ano<ano&&p.metodo!=="Isento");
  const despAnte=despesas.filter(d=>parseInt(d.data?.slice(0,4)||"0")<ano);
  const pcAnte = pagamentosContribuicao.filter(p=>parseInt(p.data?.slice(0,4)||"0")<ano&&p.metodo!=="Isento");
  const recAnte= pqAnte.reduce((s,p)=>s+p.valor,0)+pcAnte.reduce((s,p)=>s+p.valor,0);
  const despAnteT=despAnte.reduce((s,d)=>s+d.valor,0);
  const saldoTransitado = recAnte - despAnteT;

  // YTD
  const recAno  = pqAno.reduce((s,p)=>s+p.valor,0)+pcAno.reduce((s,p)=>s+p.valor,0);
  const despAnoT= despAno.reduce((s,d)=>s+d.valor,0);
  const saldoAno= recAno - despAnoT;
  const saldoFinal = saldoTransitado + saldoAno;

  // Detalhe mensal
  const mesesRows = MESES.map((nm,i)=>{
    const m=i+1;
    const r=pagamentosQuota.filter(p=>p.mes===m&&p.ano===ano&&p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0)
           +pagamentosContribuicao.filter(p=>p.data?.startsWith(`${ano}-${pad2(m)}`)&&p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0);
    const d=despesas.filter(x=>x.data?.startsWith(`${ano}-${pad2(m)}`)).reduce((s,x)=>s+x.valor,0);
    const s=r-d;
    const hasData=r>0||d>0;
    return `<tr style="${hasData?'':'color:#C5C0B8'}"><td>${nm}</td><td class="${r>0?'g':''}">${fmtR(r)}</td><td class="${d>0?'r':''}">${fmtR(d)}</td><td class="${s>=0?'g':'r'}">${fmtR(s)}</td></tr>`;
  }).join("");

  // Dívidas de quotas em atraso (todos os anos até hoje)
  const devedoresQuota = fracoes
    .filter(f=>!f.excluiQuota)
    .map(f=>{
      const qi = quotaInfo(f.id, pagamentosQuota, quotaMensal, anoBase, mesBase);
      return {...f, ...qi};
    })
    .filter(f=>f.divida>0)
    .sort((a,b)=>b.divida-a.divida);

  const totalDivida = devedoresQuota.reduce((s,f)=>s+f.divida,0);
  const nome = f => f.inq_nome || f.prop_nome || f.proprietario;

  const html = `<!DOCTYPE html><html lang="pt"><head>
<meta charset="UTF-8"><title>${titulo}</title>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Nunito:wght@400;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0} body{font-family:'Nunito',sans-serif;color:#1C1A16;background:#fff;padding:28px;max-width:820px;margin:0 auto;font-size:13px}
  h2{font-family:'Lora',serif;font-size:15px;font-weight:700;color:#B5341A;border-bottom:2px solid #B5341A;padding-bottom:5px;margin:22px 0 10px}
  .hdr{border-bottom:3px solid #B5341A;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start}
  .meta{font-size:12px;color:#8A8278;margin-top:6px}
  .ytd{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;background:#F5F3EF;border-radius:10px;padding:16px}
  .ytd-col{display:flex;flex-direction:column;gap:8px}
  .ytd-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #E2DDD6;font-size:13px}
  .ytd-row:last-child{border-bottom:none;font-weight:700;font-size:14px;padding-top:10px;margin-top:4px}
  .stat{background:#fff;border-radius:8px;padding:10px 14px;border:1px solid #E2DDD6}
  .sl{font-size:10px;color:#8A8278;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
  .sv{font-size:15px;font-weight:700} .g{color:#1E7A4A} .r{color:#B5341A}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  th{font-size:10px;color:#8A8278;text-transform:uppercase;letter-spacing:.4px;padding:7px 9px;border-bottom:1.5px solid #E2DDD6;text-align:left}
  td{padding:7px 9px;font-size:12px;border-bottom:1px solid #F0EDE8}
  .saldo-box{background:${saldoFinal>=0?'#EBF7F1':'#FAF0EE'};border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}
  .divida-total{background:#FAF0EE;border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}
  .foot{margin-top:28px;padding-top:12px;border-top:1px solid #E2DDD6;font-size:11px;color:#8A8278;display:flex;justify-content:space-between}
  @media print{body{padding:16px}}
</style></head><body>
<div class="hdr">
  <div><div style="font-family:'Lora',serif;font-size:24px;font-weight:700">${predio}</div>
  <div class="meta">${endereco}</div>
  <div class="meta">📅 ${titulo} &nbsp;·&nbsp; 👤 ${gestorNome} &nbsp;·&nbsp; 🖨️ ${new Date().toLocaleDateString("pt-PT")}</div></div>
  <div style="font-family:'Lora',serif;font-size:20px;font-weight:700;color:#B5341A;text-align:right">Relatório<br>Anual</div>
</div>

<h2>Posição Financeira Year-to-Date</h2>
<div class="ytd">
  <div class="ytd-col">
    <div style="font-size:11px;font-weight:700;color:#8A8278;text-transform:uppercase;margin-bottom:4px">Exercício Anterior</div>
    <div class="ytd-row"><span>Receitas acumuladas</span><span class="g">${fmtR(recAnte)}</span></div>
    <div class="ytd-row"><span>Despesas acumuladas</span><span class="r">${fmtR(despAnteT)}</span></div>
    <div class="ytd-row"><span>Saldo transitado</span><span class="${saldoTransitado>=0?'g':'r'}">${fmtR(saldoTransitado)}</span></div>
  </div>
  <div class="ytd-col">
    <div style="font-size:11px;font-weight:700;color:#8A8278;text-transform:uppercase;margin-bottom:4px">${ano} (ano corrente)</div>
    <div class="ytd-row"><span>Receitas do ano</span><span class="g">${fmtR(recAno)}</span></div>
    <div class="ytd-row"><span>Despesas do ano</span><span class="r">${fmtR(despAnoT)}</span></div>
    <div class="ytd-row"><span>Saldo do ano</span><span class="${saldoAno>=0?'g':'r'}">${fmtR(saldoAno)}</span></div>
  </div>
</div>
<div class="saldo-box">
  <span style="font-size:14px;font-weight:700">Saldo Final (transitado + ${ano})</span>
  <span style="font-size:22px;font-weight:700;color:${saldoFinal>=0?'#1E7A4A':'#B5341A'}">${fmtR(saldoFinal)}</span>
</div>

<h2>Detalhe por Mês — ${ano}</h2>
<table><thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Saldo</th></tr></thead>
<tbody>${mesesRows}</tbody>
<tfoot><tr style="background:#F5F3EF;font-weight:700"><td>Total ${ano}</td><td class="g">${fmtR(recAno)}</td><td class="r">${fmtR(despAnoT)}</td><td class="${saldoAno>=0?'g':'r'}">${fmtR(saldoAno)}</td></tr></tfoot>
</table>

${despAno.length>0?`<h2>Detalhe de Despesas — ${ano}</h2>
<table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Obs.</th></tr></thead><tbody>
${[...despAno].sort((a,b)=>(a.data||"").localeCompare(b.data||"")).map(d=>`<tr><td>${fmtDate(d.data)}</td><td>${d.descricao}</td><td style="color:#C96B15">${d.categoria}</td><td><b>${fmtR(d.valor)}</b></td><td style="color:#8A8278">${d.observacoes||""}</td></tr>`).join("")}
<tr style="background:#FEF4E8"><td colspan="3"><b>Total Despesas ${ano}</b></td><td><b>${fmtR(despAnoT)}</b></td><td></td></tr>
</tbody></table>`:""}

${devedoresQuota.length>0?`<h2>Quotas Mensais em Atraso (acumulado)</h2>
<div class="divida-total">
  <span style="font-size:14px;font-weight:700">Total em dívida de quotas</span>
  <span style="font-size:20px;font-weight:700;color:#B5341A">${fmtR(totalDivida)}</span>
</div>
<table><thead><tr><th>Apt.</th><th>Residente</th><th>Meses em Falta</th><th>Dívida</th></tr></thead><tbody>
${devedoresQuota.map(f=>`<tr>
  <td><b>${f.numero}</b></td>
  <td>${nome(f)}</td>
  <td style="color:#8A8278;font-size:11px">${f.mesesEmFalta.slice(0,6).map(m=>`${MESES_S[m.mes-1]}'${String(m.ano).slice(2)}`).join(", ")}${f.mesesEmFalta.length>6?` +${f.mesesEmFalta.length-6} mais`:""}</td>
  <td><b class="r">${fmtR(f.divida)}</b></td>
</tr>`).join("")}
<tr style="background:#FAF0EE;font-weight:700"><td colspan="3">Total em Dívida</td><td class="r">${fmtR(totalDivida)}</td></tr>
</tbody></table>`:"<p style='color:#1E7A4A;margin:8px 0'>✅ Sem dívidas de quotas em atraso.</p>"}

<div class="foot"><div>${predio} · ${endereco}</div><div>Gerado automaticamente · ${new Date().toLocaleString("pt-PT")}</div></div>
</body></html>`;
  const w=window.open("","_blank"); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),600);
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const G = () => <style>{`
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#F5F3EF;font-family:'Nunito',sans-serif;color:#1C1A16}
  ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#D5D0C8;border-radius:3px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .anim{animation:fadeUp .3s ease forwards}
  .btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:8px;border:none;font-family:'Nunito',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;letter-spacing:.2px}
  .btn-red{background:#B5341A;color:#fff}.btn-red:hover{background:#9B2C14;transform:translateY(-1px)}
  .btn-outline{background:transparent;color:#8A8278;border:1.5px solid #E2DDD6}.btn-outline:hover{color:#1C1A16;border-color:#B5341A}
  .btn-ghost{background:transparent;color:#8A8278;border:none}.btn-ghost:hover{color:#1C1A16}
  .btn-green{background:#1E7A4A;color:#fff}.btn-green:hover{background:#186040;transform:translateY(-1px)}
  .btn-blue{background:#1A4F8B;color:#fff}.btn-blue:hover{background:#163F70;transform:translateY(-1px)}
  .btn-sm{padding:6px 12px;font-size:12px}
  .input{width:100%;padding:9px 13px;background:#fff;border:1.5px solid #E2DDD6;border-radius:8px;color:#1C1A16;font-size:14px;font-family:'Nunito',sans-serif;outline:none;transition:border-color .18s}
  .input:focus{border-color:#B5341A}.input::placeholder{color:#C5C0B8} select.input{cursor:pointer}
  textarea.input{resize:vertical;min-height:80px;line-height:1.5}
  label.lbl{font-size:12px;font-weight:600;color:#8A8278;text-transform:uppercase;letter-spacing:.5px}
  .card{background:#fff;border:1px solid #E2DDD6;border-radius:12px;padding:20px}
  .divider{height:1px;background:#F0EDE8;margin:16px 0}
  table{width:100%;border-collapse:collapse}
  th{font-size:11px;color:#8A8278;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding:10px 12px;border-bottom:1.5px solid #E2DDD6;text-align:left;white-space:nowrap}
  td{padding:11px 12px;font-size:14px;border-bottom:1px solid #F5F3EF;vertical-align:middle}
  tr:last-child td{border-bottom:none} tbody tr:hover td{background:#FBF9F7}
  .tag{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap}
  .tag-red{background:#FAF0EE;color:#B5341A}.tag-green{background:#EBF7F1;color:#1E7A4A}
  .tag-amber{background:#FEF4E8;color:#C96B15}.tag-blue{background:#EBF1FA;color:#1A4F8B}
  .tag-teal{background:#E8F5F5;color:#0F766E}.tag-grey{background:#F0EDE8;color:#8A8278}
  .modal-bg{position:fixed;inset:0;background:#0006;backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px}
  .modal{background:#fff;border-radius:16px;width:100%;max-width:520px;box-shadow:0 20px 60px #0003;animation:fadeUp .25s ease}
  .modal-lg{max-width:680px}
  .nav-pill{padding:7px 14px;border-radius:8px;border:none;background:transparent;font-size:13px;font-weight:600;color:#8A8278;cursor:pointer;transition:all .15s;font-family:'Nunito',sans-serif}
  .nav-pill.on{background:#FAF0EE;color:#B5341A}.nav-pill:not(.on):hover{color:#1C1A16;background:#F0EDE8}
  .pub-nav-pill{padding:8px 16px;border-radius:20px;border:none;background:transparent;font-size:13px;font-weight:600;color:rgba(255,255,255,.65);cursor:pointer;transition:all .15s;font-family:'Nunito',sans-serif}
  .pub-nav-pill.on{background:rgba(255,255,255,.2);color:#fff}
  .pub-nav-pill:not(.on):hover{color:#fff}
  .mono{font-family:'DM Mono',monospace}.serif{font-family:'Lora',serif}
  .section-hd{font-family:'Lora',serif;font-size:18px;font-weight:700}
  .progress-bg{background:#E2DDD6;border-radius:20px;height:8px;overflow:hidden}
  .progress-fill{height:100%;border-radius:20px;transition:width .5s ease}
  .spinner{width:20px;height:20px;border:2.5px solid #E2DDD6;border-top-color:#B5341A;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
  .arrear-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #F0EDE8}
  .arrear-row:last-child{border-bottom:none}
  .frac-badge{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'Lora',serif;font-size:14px;font-weight:700;flex-shrink:0}
  .wa-btn{background:#25D366;color:#fff;border:none;border-radius:8px;padding:9px 16px;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s;font-family:'Nunito',sans-serif}
  .wa-btn:hover{background:#1ebe5d;transform:translateY(-1px)}
  .status-bar{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
  .toast{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:300;box-shadow:0 8px 30px #0003;max-width:92vw;cursor:pointer;animation:fadeUp .2s ease}
  .status-ok{background:#EBF7F1;color:#1E7A4A}.status-err{background:#FAF0EE;color:#B5341A}
  .drill-row{background:#F9F7F5;border-left:3px solid #B5341A;padding:12px 16px;border-radius:0 8px 8px 0;margin:4px 0;font-size:13px}
  .aviso-card{border-left:4px solid #B5341A;padding:14px 16px;background:#fff;border-radius:0 10px 10px 0;margin-bottom:10px}
  .aviso-card.notif{border-color:#1A4F8B}.aviso-card.acta{border-color:#1E7A4A}.aviso-card.comum{border-color:#C96B15}
  .checkbox-row{display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer}
  .checkbox-row input{width:16px;height:16px;accent-color:#B5341A;cursor:pointer}
  @media(max-width:640px){th,td{font-size:12px;padding:9px 8px}.hide-sm{display:none!important}.btn{padding:8px 14px;font-size:12px}.pub-nav-pill{padding:6px 10px;font-size:12px}}
`}</style>;

/* ── HELPERS ── */
const WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";
const WaSvg = ({s=15}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d={WA_PATH}/></svg>;

function Modal({title, onClose, children, lg=false}) {
  return (
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={`modal${lg?" modal-lg":""}`}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 24px",borderBottom:"1px solid #F0EDE8"}}>
          <span className="serif" style={{fontSize:19,fontWeight:700}}>{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{padding:"24px",maxHeight:"75vh",overflowY:"auto"}}>{children}</div>
      </div>
    </div>
  );
}
const FG = ({label,children,hint}) => (
  <div style={{display:"flex",flexDirection:"column",gap:5}}>
    <label className="lbl">{label}</label>
    {children}
    {hint && <span style={{fontSize:11,color:"#8A8278"}}>{hint}</span>}
  </div>
);
const CheckRow = ({label, checked, onChange}) => (
  <label className="checkbox-row">
    <input type="checkbox" checked={!!checked} onChange={e=>onChange(e.target.checked)}/>
    <span style={{fontSize:13}}>{label}</span>
  </label>
);
const RowActions = ({onEdit, onDelete}) => (
  <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
    {onEdit&&<button className="btn btn-outline btn-sm" onClick={onEdit} title="Editar">✏️</button>}
    {onDelete&&<button className="btn btn-outline btn-sm" onClick={onDelete} title="Apagar">🗑️</button>}
  </div>
);
const Warn = ({children}) => (
  <div style={{background:"#FEF4E8",border:"1px solid #F7D9A8",borderRadius:8,padding:"9px 13px",fontSize:13,color:"#C96B15"}}>{children}</div>
);
const ModalBtns = ({onCancel, onOk, saving, label, cls="btn-red", disabled=false}) => (
  <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
    <button className="btn btn-outline" onClick={onCancel}>Cancelar</button>
    <button className={`btn ${cls}`} disabled={saving||disabled} onClick={onOk}>{saving?<span className="spinner"/>:label}</button>
  </div>
);
const AptSelect = ({fracoes, value, onChange}) => (
  <select className="input" value={value||""} onChange={e=>onChange(e.target.value)}>
    <option value="">Seleccione...</option>{fracoes.map(f=><option key={f.id} value={f.numero}>{f.numero} — {nomeApt(f)}</option>)}
  </select>
);
const MesSelect = ({value, onChange}) => (
  <select className="input" value={value} onChange={e=>onChange(+e.target.value)}>{MESES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select>
);
const AnoSelect = ({value, onChange, anos}) => (
  <select className="input" value={value} onChange={e=>onChange(+e.target.value)}>{anos.map(y=><option key={y} value={y}>{y}</option>)}</select>
);

/* ═══════════════════════════════════════════════════════════════
   SETUP SCREEN
═══════════════════════════════════════════════════════════════ */
function SetupScreen({onSave}) {
  const [url,setUrl]=useState("");
  const [testing,setTest]=useState(false); const [result,setResult]=useState(null);
  const test = async()=>{ if(!url)return; setTest(true); setResult(null);
    try{ const d=await apiGet(url); setResult(d.ok?{ok:true,msg:`✅ Ligação com sucesso! Prédio: "${d.config?.predio}"${d.versao?` · script ${d.versao}`:""}`}:{ok:false,msg:"❌ "+d.error}); }
    catch(e){ setResult({ok:false,msg:"❌ Erro: "+e.message}); } setTest(false); };
  return (
    <div style={{minHeight:"100vh",background:"#F5F3EF",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:560}} className="anim">
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:42,marginBottom:12}}>🔗</div>
          <div className="serif" style={{fontSize:26,fontWeight:700,color:"#B5341A",marginBottom:8}}>Configurar Ligação</div>
          <div style={{color:"#8A8278",fontSize:14,lineHeight:1.6}}>Cole o URL da Aplicação Web do Google Apps Script.<br/>Este passo faz-se apenas uma vez.</div>
        </div>
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <FG label="URL do Google Apps Script"><input className="input" type="url" value={url} placeholder="https://script.google.com/macros/s/.../exec" onChange={e=>setUrl(e.target.value.trim())}/></FG>
            {result && <div style={{background:result.ok?"#EBF7F1":"#FAF0EE",border:`1px solid ${result.ok?"#A8DFC6":"#F5C9BF"}`,borderRadius:8,padding:"10px 14px",fontSize:13,color:result.ok?"#1E7A4A":"#B5341A"}}>{result.msg}</div>}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button className="btn btn-outline" onClick={test} disabled={!url||testing}>{testing?<span className="spinner"/>:"🧪 Testar"}</button>
              <button className="btn btn-red" onClick={()=>onSave({apiUrl:url})} disabled={!url}>Guardar e continuar →</button>
            </div>
          </div>
        </div>
        <div className="card" style={{background:"#FEF4E8",border:"1px solid #F7D9A8"}}>
          <div style={{fontWeight:700,color:"#C96B15",marginBottom:8}}>📌 Como obter o URL</div>
          <ol style={{paddingLeft:18,fontSize:13,color:"#8A8278",lineHeight:2}}>
            <li>Google Sheets → <b>Extensões → Apps Script</b></li>
            <li>Cole o conteúdo do <b>Code.gs</b> (v5)</li>
            <li>Definições do projecto → Propriedades do script → <b>GESTOR_PASSWORD</b></li>
            <li><b>Implementar → Nova implementação → Aplicação Web</b></li>
            <li>Acesso: <b>Qualquer pessoa</b> → copie o URL</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DATA HOOK — dados públicos
═══════════════════════════════════════════════════════════════ */
function usePublicData(apiUrl) {
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const load = useCallback(async(force=false)=>{
    if(!apiUrl) return;
    setLoading(true); setError(null);
    if(!force){ const c=stGet("condo_pub"); if(c){setData(c);setLoading(false);} }
    try {
      const fresh=await apiGet(apiUrl);
      if(!fresh.ok) throw new Error(fresh.error||"Erro na API");
      setData(fresh); stSet("condo_pub",fresh);
    } catch(e) {
      setError(e.message);
      setData(d=>d||stGet("condo_pub"));
    }
    setLoading(false);
  },[apiUrl]);
  useEffect(()=>{load();},[load]);
  return {data,loading,error,reload:()=>load(true)};
}

/* ═══════════════════════════════════════════════════════════════
   AVISO CARD
═══════════════════════════════════════════════════════════════ */
function AvisoCard({a}) {
  const [open,setOpen]=useState(false);
  const cls = a.tipo==="Notificação"?"notif":a.tipo==="Acta de Reunião"?"acta":a.tipo==="Comunicado"?"comum":"";
  const tipoCor = a.tipo==="Notificação"?"tag-blue":a.tipo==="Acta de Reunião"?"tag-green":a.tipo==="Comunicado"?"tag-amber":"tag-red";
  return (
    <div className={`aviso-card ${cls}`}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
            <span className={`tag ${tipoCor}`}>{a.tipo}</span>
            <span style={{fontSize:11,color:"#8A8278"}}>{fmtDate(a.data)}</span>
            {a.autor && <span style={{fontSize:11,color:"#8A8278"}}>· {a.autor}</span>}
          </div>
          <div style={{fontWeight:700,fontSize:14}}>{a.titulo}</div>
          {(open||a.conteudo?.length<120) && <div style={{marginTop:6,fontSize:13,color:"#555",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{a.conteudo}</div>}
        </div>
        {a.conteudo?.length>=120 &&
          <button className="btn btn-ghost btn-sm" onClick={()=>setOpen(o=>!o)} style={{flexShrink:0}}>{open?"▲ Menos":"▼ Mais"}</button>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VER O MEU APARTAMENTO (public)
═══════════════════════════════════════════════════════════════ */
function MeuApartamento({appData}) {
  const [q,setQ]=useState("");
  const { config, fracoes, pagamentosQuota, contribuicoes, pagamentosContribuicao } = appData;
  const { quotaMensal, anoBase, mesBase } = config;
  const termo = q.trim().toLowerCase();
  const f = termo ? (fracoes.find(x=>String(x.numero).trim().toLowerCase()===termo)
                  || (()=>{ const c=fracoes.filter(x=>String(x.numero).trim().toLowerCase().startsWith(termo)); return c.length===1?c[0]:null; })()) : null;
  const qi = f && !f.excluiQuota ? quotaInfo(f.id,pagamentosQuota,quotaMensal,anoBase,mesBase) : null;
  const contribs = f ? contribuicoes.map(c=>({...c,...contribInfo(c,f.id,pagamentosContribuicao)})).filter(c=>c.divida>0) : [];
  const total = (qi?.divida||0) + contribs.reduce((s,c)=>s+c.divida,0);
  return (
    <div className="card anim" style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontWeight:700,fontSize:14}}>🔎 Ver o meu apartamento</span>
        <input className="input" style={{maxWidth:180}} placeholder="Nº do apartamento" value={q} onChange={e=>setQ(e.target.value)}/>
        {q&&<button className="btn btn-ghost btn-sm" onClick={()=>setQ("")}>✕</button>}
      </div>
      {termo&&!f&&<div style={{marginTop:12,fontSize:13,color:"#8A8278"}}>Apartamento não encontrado.</div>}
      {f&&(
        <div style={{marginTop:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:10}}>
            <div>
              <span className="serif" style={{fontWeight:700,fontSize:18,color:"#B5341A"}}>{f.numero}</span>
              <span style={{marginLeft:8,fontWeight:600}}>{nomeApt(f)}</span>
              {f.inq_nome&&<div style={{fontSize:12,color:"#1A4F8B"}}>👤 {f.inq_nome}</div>}
            </div>
            <span className={`tag ${total>0?"tag-red":"tag-green"}`}>{total>0?`Em dívida: ${fmtKz(total)}`:"✅ Tudo em dia"}</span>
          </div>
          {f.excluiQuota&&<div style={{fontSize:12,color:"#8A8278",marginBottom:8}}>Este apartamento não paga quota mensal (acordo com a gestão).</div>}
          {qi&&qi.mesesEmFalta.length>0&&(
            <div style={{marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:700,color:"#B5341A",marginBottom:6}}>💳 Quotas em falta ({qi.mesesAtraso})</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {qi.mesesEmFalta.map(m=>(
                  <span key={m.key} style={{background:"#FAF0EE",borderRadius:8,padding:"4px 9px",fontSize:12}}>
                    <b>{MESES_S[m.mes-1]} {m.ano}</b> <span style={{color:"#B5341A"}}>{fmtKz(m.emFalta)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {contribs.length>0&&(
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#C96B15",marginBottom:6}}>📋 Contribuições em dívida</div>
              {contribs.map(c=>(
                <div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:"#FEF4E8",borderRadius:8,marginBottom:4,fontSize:13}}>
                  <span>{c.titulo}</span><span className="mono" style={{fontWeight:700,color:"#C96B15"}}>{fmtKz(c.divida)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PUBLIC VIEW
═══════════════════════════════════════════════════════════════ */
function PublicView({appData, offline, onGestor}) {
  const [tab,setTab]=useState("quotas");
  const { config, fracoes, pagamentosQuota, contribuicoes, pagamentosContribuicao, avisos=[] } = appData;
  const { predio, endereco, quotaMensal, anoBase, mesBase } = config;

  const devedores = useMemo(()=>
    fracoes.filter(f=>!f.excluiQuota)
      .map(f=>({...f,...quotaInfo(f.id,pagamentosQuota,quotaMensal,anoBase,mesBase)}))
      .filter(f=>f.divida>0).sort((a,b)=>b.mesesAtraso-a.mesesAtraso),
    [fracoes,pagamentosQuota,quotaMensal,anoBase,mesBase]);

  const emDia = fracoes.filter(f=>!f.excluiQuota&&!devedores.find(d=>d.id===f.id));
  const totalDivida = devedores.reduce((s,f)=>s+f.divida,0);

  const contribStatus = useMemo(()=>
    contribuicoes.map(c=>({
      ...c,
      apts: fracoes.map(f=>({...f,...contribInfo(c,f.id,pagamentosContribuicao)})),
      totalCob: pagamentosContribuicao.filter(p=>p.contribuicaoId===c.id).reduce((s,p)=>s+p.valor,0),
    })),
    [contribuicoes,fracoes,pagamentosContribuicao]);

  const avisosSorted = [...avisos].sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  const avisosRecentes = avisosSorted.filter(a=>a.tipo==="Aviso"||a.tipo==="Notificação");

  return (
    <div style={{minHeight:"100vh",background:"#F5F3EF"}}>
      {/* HEADER */}
      <div style={{background:"linear-gradient(135deg,#2D2926 0%,#B5341A 100%)",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:840,margin:"0 auto",padding:"0 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
            <div>
              <div className="serif" style={{fontSize:16,fontWeight:700,color:"#fff",lineHeight:1}}>{predio}</div>
              <div className="hide-sm" style={{fontSize:10,color:"rgba(255,255,255,.55)",marginTop:1}}>{endereco}</div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:10,color:offline?"#FFD7C9":"rgba(255,255,255,.4)",textAlign:"right"}}>
                {offline?"⚠ Sem ligação · dados de ":"Actualizado "}{fmtDateTime(appData.timestamp)}
              </span>
              <button onClick={onGestor} className="btn btn-outline btn-sm" style={{color:"rgba(255,255,255,.8)",borderColor:"rgba(255,255,255,.25)",background:"rgba(255,255,255,.08)"}}>🔐 Gestores</button>
            </div>
          </div>
          {/* NAV TABS */}
          <div style={{display:"flex",gap:4,paddingBottom:8}}>
            {[["quotas","💰 Quotas"],["contribuicoes","📋 Contribuições"],["avisos",`📢 Avisos${avisosRecentes.length>0?" ("+avisosRecentes.length+")":""}`]].map(([k,l])=>(
              <button key={k} className={`pub-nav-pill${tab===k?" on":""}`} onClick={()=>setTab(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:840,margin:"0 auto",padding:"20px 16px"}}>

        {/* ── HERO STATS ── */}
        <div className="anim" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          {[
            {l:"Apartamentos em atraso", v:`${devedores.length} / ${fracoes.filter(f=>!f.excluiQuota).length}`, s:"quota mensal"},
            {l:"Total em dívida (quotas)", v:fmtKz(totalDivida), s:`${fmtKz(quotaMensal)}/mês`},
          ].map((s,i)=>(
            <div key={i} style={{background:"linear-gradient(135deg,#2D2926,#B5341A)",borderRadius:12,padding:"16px 18px",color:"#fff"}}>
              <div style={{fontSize:10,opacity:.65,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>{s.l}</div>
              <div className="mono" style={{fontSize:22,fontWeight:700}}>{s.v}</div>
              <div style={{fontSize:11,opacity:.5,marginTop:3}}>{s.s}</div>
            </div>
          ))}
        </div>

        {/* ── VER O MEU APARTAMENTO ── */}
        <MeuApartamento appData={appData}/>

        {/* ── QUOTAS TAB ── */}
        {tab==="quotas" && (
          <div className="anim card">
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <span className="section-hd">Taxas em Atraso</span>
              {devedores.length>0&&<span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,borderRadius:"50%",background:"#B5341A",color:"#fff",fontSize:11,fontWeight:700}}>{devedores.length}</span>}
            </div>
            {devedores.length===0?(
              <div style={{textAlign:"center",padding:"28px 0",color:"#1E7A4A"}}><div style={{fontSize:32,marginBottom:8}}>✅</div><div style={{fontWeight:600}}>Todos os apartamentos em dia!</div></div>
            ):(
              <>
                {devedores.map(f=>(
                  <div key={f.id} className="arrear-row">
                    <div className="frac-badge" style={{background:"#FAF0EE",color:"#B5341A"}}>{f.numero}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:14,marginBottom:1}}>{nomeApt(f)}</div>
                      {f.inq_nome&&<div style={{fontSize:12,color:"#1A4F8B"}}>👤 {f.inq_nome}</div>}
                      <div style={{fontSize:12,color:"#8A8278"}}>{f.mesesAtraso} {f.mesesAtraso===1?"mês":"meses"} em atraso</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div className="mono" style={{fontWeight:700,color:"#B5341A",fontSize:15}}>{fmtKz(f.divida)}</div>
                      <span className={`tag ${f.mesesAtraso>2?"tag-red":"tag-amber"}`}>{f.mesesAtraso>3?"Grande atraso":f.mesesAtraso>1?"Em atraso":"Pendente"}</span>
                    </div>
                  </div>
                ))}
                {emDia.length>0&&(
                  <><div className="divider"/>
                  <div style={{fontSize:12,color:"#8A8278",marginBottom:10,fontWeight:600}}>EM DIA ({emDia.length})</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {emDia.map(f=>(
                      <div key={f.id} style={{display:"flex",alignItems:"center",gap:6,background:"#EBF7F1",borderRadius:8,padding:"6px 10px"}}>
                        <span style={{fontFamily:"'Lora',serif",fontWeight:700,color:"#1E7A4A",fontSize:13}}>{f.numero}</span>
                        <span style={{fontSize:12,color:"#1E7A4A"}}>{nomeApt(f).split(" ")[0]} ✓</span>
                      </div>
                    ))}
                  </div></>
                )}
              </>
            )}
          </div>
        )}

        {/* ── CONTRIBUIÇÕES TAB ── */}
        {tab==="contribuicoes" && (
          <div className="anim">
            {contribStatus.length===0?(
              <div className="card" style={{textAlign:"center",padding:"36px 0",color:"#8A8278"}}>Sem contribuições registadas.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {contribStatus.map(c=>{
                  const vpf      = parseFloat(c.valorPorFracao) || 0;
                  const vt       = parseFloat(c.valorTotal)     || 0;
                  const isLivre  = vpf === 0 && vt === 0;
                  // % baseada em valorTotal se definido; senão em valorPorFracao × nApts
                  const meta     = vt > 0 ? vt : (vpf * c.apts.filter(f=>!f.excluido).length);
                  const pct      = meta>0 ? Math.min(100,Math.round((c.totalCob/meta)*100)) : 0;
                  // Devedores: apartamentos que ainda não pagaram o valorPorFracao
                  const devedoresC = (!isLivre && vpf > 0)
                    ? c.apts.filter(f=>f.divida>0 && !f.excluido)
                    : [];
                  const vencido = c.dataVencimento && c.dataVencimento<today();
                  return (
                    <div key={c.id} className="card">
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:15,marginBottom:3}}>{c.titulo}</div>
                          <div style={{fontSize:12,color:"#8A8278"}}>{c.descricao}</div>
                          {c.dataVencimento&&<div style={{fontSize:11,color:vencido?"#B5341A":"#8A8278",marginTop:4}}>{vencido?"⚠ Vencido: ":"Prazo: "}{fmtDate(c.dataVencimento)}</div>}
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          {isLivre?(
                            <div>
                              <span className="tag tag-teal" style={{marginBottom:4,display:"inline-block"}}>Arrecadação livre</span>
                              <div className="mono" style={{fontWeight:700,fontSize:14,color:"#1E7A4A"}}>{fmtKz(c.totalCob)}</div>
                              <div style={{fontSize:11,color:"#8A8278"}}>recebido</div>
                            </div>
                          ):(
                            <div className="mono" style={{fontWeight:700,fontSize:14,color:"#B5341A"}}>{fmtKz(c.totalCob)}<span style={{fontSize:11,color:"#8A8278"}}> / {fmtKz(meta)}</span></div>
                          )}
                        </div>
                      </div>
                      {/* Barra de progresso — apenas quando há meta definida */}
                      {!isLivre&&meta>0&&(
                        <div style={{marginBottom:12}}>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#8A8278",marginBottom:5}}>
                            <span className="mono">{fmtKz(c.totalCob)} de {fmtKz(meta)}</span>
                            <span className="mono" style={{fontWeight:700,color:pct>=80?"#1E7A4A":pct>=50?"#C96B15":"#B5341A"}}>{pct}%</span>
                          </div>
                          <div className="progress-bg"><div className="progress-fill" style={{width:`${pct}%`,background:pct>=80?"#1E7A4A":pct>=50?"#C96B15":"#B5341A"}}/></div>
                        </div>
                      )}
                      {/* Devedores (contribuições com valor fixo) */}
                      {!isLivre&&devedoresC.length>0&&(
                        <div style={{display:"flex",flexDirection:"column",gap:5}}>
                          {devedoresC.map(f=>(
                            <div key={f.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:"#FBF9F7",borderRadius:8}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <span className="serif" style={{fontWeight:700,color:"#B5341A",fontSize:13}}>{f.numero}</span>
                                <div><div style={{fontSize:13}}>{nomeApt(f)}</div>
                                {f.inq_nome&&<div style={{fontSize:11,color:"#1A4F8B"}}>Inquilino: {f.inq_nome}</div>}</div>
                              </div>
                              <span className="mono" style={{fontSize:13,color:"#B5341A",fontWeight:700}}>{fmtKz(f.divida)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Contribuidores (arrecadação livre — mostra quem pagou) */}
                      {isLivre&&(()=>{
                        const contrib = c.apts.filter(f=>f.totalPago>0).sort((a,b)=>b.totalPago-a.totalPago);
                        if(contrib.length===0) return <div style={{fontSize:12,color:"#C5C0B8",textAlign:"center",padding:"8px 0"}}>Ainda sem contribuições registadas.</div>;
                        return <div style={{display:"flex",flexDirection:"column",gap:5}}>
                          {contrib.map(f=>(
                            <div key={f.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:"#EBF7F1",borderRadius:8}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <span className="serif" style={{fontWeight:700,color:"#1E7A4A",fontSize:13}}>{f.numero}</span>
                                <div><div style={{fontSize:13}}>{nomeApt(f)}</div>
                                {f.inq_nome&&<div style={{fontSize:11,color:"#1A4F8B"}}>Inquilino: {f.inq_nome}</div>}</div>
                              </div>
                              <span className="mono" style={{fontSize:13,color:"#1E7A4A",fontWeight:700}}>{fmtKz(f.totalPago)}</span>
                            </div>
                          ))}
                        </div>;
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── AVISOS TAB ── */}
        {tab==="avisos" && (
          <div className="anim">
            {avisosSorted.length===0?(
              <div className="card" style={{textAlign:"center",padding:"36px 0",color:"#8A8278"}}>Sem avisos ou notificações publicados.</div>
            ):(
              avisosSorted.map(a=><AvisoCard key={a.id} a={a}/>)
            )}
          </div>
        )}

        <div style={{textAlign:"center",padding:"20px 0",color:"#C5C0B8",fontSize:12}}>
          Portal do Condomínio · {predio} · {APP_VERSAO}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GESTOR LOGIN — a palavra-passe é validada no Apps Script
═══════════════════════════════════════════════════════════════ */
function GestorLogin({apiUrl,onLogin,onBack}) {
  const [v,setV]=useState(""); const [err,setErr]=useState(null); const [busy,setBusy]=useState(false);
  const go=async()=>{
    if(!v||busy) return;
    setBusy(true); setErr(null);
    try { const r=await apiPost(apiUrl,"login",{password:v}); onLogin({token:r.token,exp:r.exp}); }
    catch(e){ setErr(e.message); setV(""); }
    setBusy(false);
  };
  return (
    <div style={{minHeight:"100vh",background:"#F5F3EF",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:360}}>
        <button onClick={onBack} className="btn btn-ghost btn-sm" style={{marginBottom:24}}>← Voltar</button>
        <div className="card anim" style={{border:`1.5px solid ${err?"#B5341A":"#E2DDD6"}`}}>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontSize:38,marginBottom:12}}>🔐</div>
            <div className="serif" style={{fontSize:24,fontWeight:700}}>Área de Gestores</div>
          </div>
          {err&&<div style={{background:"#FAF0EE",borderRadius:8,padding:"9px 14px",color:"#B5341A",fontSize:13,marginBottom:16,textAlign:"center"}}>{err}</div>}
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <FG label="Palavra-passe"><input className="input" type="password" value={v} placeholder="••••••••" onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} autoFocus/></FG>
            <button className="btn btn-red" style={{justifyContent:"center"}} onClick={go} disabled={busy||!v}>{busy?<span className="spinner"/>:"Entrar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DRILL-DOWN MODAL — detalhe da dívida por apartamento
═══════════════════════════════════════════════════════════════ */
function DrillModal({fracao, appData, onClose}) {
  const { pagamentosQuota, contribuicoes, pagamentosContribuicao, config } = appData;
  const { quotaMensal, anoBase, mesBase } = config;
  const qi = fracao.excluiQuota ? {divida:0,mesesAtraso:0,mesesEmFalta:[]} : quotaInfo(fracao.id, pagamentosQuota, quotaMensal, anoBase, mesBase);
  const contribs = contribuicoes.map(c=>({...c,...contribInfo(c,fracao.id,pagamentosContribuicao)})).filter(c=>c.divida>0);
  const totalDivida = qi.divida + contribs.reduce((s,c)=>s+c.divida,0);
  const propTel = fracao.prop_telefone||fracao.telefone;
  return (
    <Modal title={`Apt. ${fracao.numero} — Detalhe da Dívida`} onClose={onClose} lg>
      <div style={{marginBottom:16,display:"flex",gap:10,flexWrap:"wrap"}}>
        <div style={{flex:1,background:"#FAF0EE",borderRadius:10,padding:"12px 16px"}}>
          <div style={{fontSize:10,color:"#8A8278",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Proprietário</div>
          <div style={{fontWeight:700}}>{nomeApt(fracao)}</div>
          <div style={{fontSize:12,color:"#8A8278"}}>{propTel}</div>
          {fracao.inq_nome&&<><div style={{fontSize:10,color:"#8A8278",textTransform:"uppercase",letterSpacing:.5,margin:"8px 0 4px"}}>Inquilino</div>
          <div style={{fontWeight:600}}>{fracao.inq_nome}</div><div style={{fontSize:12,color:"#8A8278"}}>{fracao.inq_telefone}</div></>}
        </div>
        <div style={{flex:1,background:"#FAF0EE",borderRadius:10,padding:"12px 16px"}}>
          <div style={{fontSize:10,color:"#8A8278",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Dívida Total</div>
          <div className="mono" style={{fontSize:22,fontWeight:700,color:"#B5341A"}}>{fmtKz(totalDivida)}</div>
        </div>
      </div>

      {/* Lembrete por WhatsApp */}
      {totalDivida>0&&(propTel||fracao.inq_telefone)&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          {propTel&&<button className="wa-btn" onClick={()=>waAbrir(propTel,msgLembrete(fracao,nomeApt(fracao),qi,contribs,config))}><WaSvg s={14}/>Lembrete ao proprietário</button>}
          {fracao.inq_telefone&&<button className="wa-btn" onClick={()=>waAbrir(fracao.inq_telefone,msgLembrete(fracao,fracao.inq_nome,qi,contribs,config))}><WaSvg s={14}/>Lembrete ao inquilino</button>}
        </div>
      )}

      {/* Quotas em falta */}
      {qi.mesesEmFalta.length>0&&(
        <>
          <div style={{fontWeight:700,fontSize:14,marginBottom:8,color:"#B5341A"}}>💳 Quotas Mensais em Falta</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
            {qi.mesesEmFalta.map(m=>(
              <div key={m.key} style={{background:"#FAF0EE",borderRadius:8,padding:"5px 10px",fontSize:13}}>
                <span style={{fontWeight:700}}>{MESES_S[m.mes-1]} {m.ano}</span>
                {m.pago>0&&<span style={{fontSize:11,color:"#8A8278",marginLeft:4}}>(pago {fmtKz(m.pago)})</span>}
                <span style={{color:"#B5341A",marginLeft:4,fontWeight:700}}>{fmtKz(m.emFalta)}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:600,padding:"8px 12px",background:"#F5F3EF",borderRadius:8,marginBottom:16}}>
            <span>Subtotal quotas</span><span className="mono" style={{color:"#B5341A"}}>{fmtKz(qi.divida)}</span>
          </div>
        </>
      )}

      {/* Contribuições em dívida */}
      {contribs.length>0&&(
        <>
          <div style={{fontWeight:700,fontSize:14,marginBottom:8,color:"#C96B15"}}>📋 Contribuições em Dívida</div>
          {contribs.map(c=>(
            <div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:"#FEF4E8",borderRadius:8,marginBottom:6,fontSize:13}}>
              <span>{c.titulo}</span>
              <span className="mono" style={{fontWeight:700,color:"#C96B15"}}>{fmtKz(c.divida)}</span>
            </div>
          ))}
        </>
      )}

      {totalDivida===0&&(
        <div style={{textAlign:"center",padding:"24px 0",color:"#1E7A4A"}}><div style={{fontSize:28,marginBottom:8}}>✅</div><div style={{fontWeight:600}}>Sem dívidas registadas</div></div>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GESTOR DASHBOARD
═══════════════════════════════════════════════════════════════ */
function GestorDashboard({appData, apiUrl, token, onBack, onLogout, onExpired, onReload, loading}) {
  const [tab,setTab]=useState("dashboard");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState(null);
  const [relMes,setRelMes]=useState(new Date().getMonth()+1);
  const [relAno,setRelAno]=useState(new Date().getFullYear());
  const [relTipo,setRelTipo]=useState("mensal");
  const [drillApt,setDrillApt]=useState(null);
  // filtros
  const [fApt,setFApt]=useState("");
  const [fQApt,setFQApt]=useState(""); const [fQAno,setFQAno]=useState("");
  const [fDAno,setFDAno]=useState(""); const [fDCat,setFDCat]=useState(""); const [fDTxt,setFDTxt]=useState("");

  const { config, fracoes, pagamentosQuota, contribuicoes, pagamentosContribuicao, despesas, avisos=[] } = appData;
  const { quotaMensal, anoBase, mesBase } = config;
  const anoAtual = new Date().getFullYear(), mesAtual = new Date().getMonth()+1;

  const sf = k=>v=>setForm(p=>({...p,[k]:v}));
  const om = (type,d={})=>{ setModal(type); setForm({data:today(),...d}); };
  const cm = ()=>{ setModal(null); setForm({}); };
  const showToast = (t)=>{ setToast(t); setTimeout(()=>setToast(x=>x===t?null:x), t.ok?2500:6000); };
  const fail = (msg)=>{ showToast({ok:false,msg:"⚠️ "+msg}); };

  const post = async(action,data)=>{
    setSaving(true);
    try {
      await apiPost(apiUrl,action,data,token);
      showToast({ok:true,msg:"✅ Guardado no Google Sheets"});
      cm(); onReload();
    } catch(e){
      if(e.code==="AUTH"){ onExpired(); return; }
      showToast({ok:false,msg:"❌ "+e.message});
    }
    setSaving(false);
  };
  const apagar = (action, item, desc, extra={})=>{
    if(!window.confirm(`Apagar ${desc}?\n\nEsta acção não pode ser desfeita.`)) return;
    post(action,{_row:item._row,_sig:item._sig,...extra});
  };

  const aptById  = id=>fracoes.find(x=>x.id===id);
  const aptByNum = n=>fracoes.find(x=>String(x.numero)===String(n));
  const contribById = id=>contribuicoes.find(c=>c.id===id);

  /* stats */
  const totalRec  = pagamentosQuota.reduce((s,p)=>s+p.valor,0)+pagamentosContribuicao.reduce((s,p)=>s+p.valor,0);
  const totalDesp = despesas.reduce((s,d)=>s+d.valor,0);
  const saldo     = totalRec-totalDesp;
  const totalDivida = useMemo(()=>
    fracoes.filter(f=>!f.excluiQuota).reduce((s,f)=>s+quotaInfo(f.id,pagamentosQuota,quotaMensal,anoBase,mesBase).divida,0)+
    fracoes.reduce((s,f)=>s+contribuicoes.reduce((ss,c)=>ss+contribInfo(c,f.id,pagamentosContribuicao).divida,0),0),
    [fracoes,pagamentosQuota,contribuicoes,pagamentosContribuicao,quotaMensal,anoBase,mesBase]);

  /* gráfico — receitas = quotas + contribuições (P3) */
  const evolucao = useMemo(()=>{
    const map={};
    const slot=(k)=>{ if(!map[k]){ const [y,m]=k.split("-").map(Number); map[k]={label:`${MESES_S[(m||1)-1]} '${String(y).slice(2)}`,ano:y,Receitas:0,Despesas:0,Saldo:0}; } return map[k]; };
    pagamentosQuota.forEach(p=>{ if(p.metodo==="Isento"||!p.ano||!p.mes) return; slot(`${p.ano}-${pad2(p.mes)}`).Receitas+=p.valor; });
    pagamentosContribuicao.forEach(p=>{ const k=p.data?.slice(0,7); if(p.metodo==="Isento"||!k||k.length<7) return; slot(k).Receitas+=p.valor; });
    despesas.forEach(d=>{ const k=d.data?.slice(0,7); if(!k||k.length<7) return; slot(k).Despesas+=d.valor; });
    return Object.entries(map).sort().map(([,v])=>({...v,Saldo:v.Receitas-v.Despesas}));
  },[pagamentosQuota,pagamentosContribuicao,despesas]);

  const TT=({active,payload,label})=>{
    if(!active||!payload?.length)return null;
    return <div style={{background:"#fff",border:"1px solid #E2DDD6",borderRadius:8,padding:"10px 14px"}}>
      <div style={{fontSize:12,color:"#8A8278",marginBottom:6}}>{label}</div>
      {payload.map((p,i)=><div key={i} className="mono" style={{fontSize:13,color:p.color}}>{p.name}: {fmtKz(p.value)}</div>)}
    </div>;
  };

  const TABS=[["dashboard","📊 Dashboard"],["fracoes","🏠 Apartamentos"],["quotas","💳 Quotas"],["contribuicoes","📋 Contribuições"],["despesas","🧾 Despesas"],["avisos","📢 Avisos"]];
  const anos = useMemo(()=>{
    const ys=[anoBase,...pagamentosQuota.map(p=>p.ano),...despesas.map(d=>parseInt(d.data?.slice(0,4)||"0"))].filter(y=>y>2000&&y<=anoAtual+1);
    const r=[]; for(let y=Math.min(anoAtual,...ys);y<=anoAtual+1;y++) r.push(y); return r;
  },[anoBase,pagamentosQuota,despesas,anoAtual]);

  /* ── meses já pagos/isentos (aviso de duplicado) ── */
  const mesesJaPagos = (fid, meses)=>meses.filter(m=>{
    const ps=pagamentosQuota.filter(p=>p.fracaoId===fid&&p.mes===m.mes&&p.ano===m.ano);
    return ps.some(p=>p.metodo==="Isento") || (quotaMensal>0 && ps.reduce((s,p)=>s+p.valor,0)>=quotaMensal);
  });
  const lblMes = m=>`${MESES_S[m.mes-1]} ${m.ano}`;

  /* ════ SUBMITS ════ */
  const submitFracao = ()=>{
    const numero=String(form.numero||"").trim(), nome=String(form.prop_nome||"").trim();
    if(!numero) return fail("Indique o número do apartamento");
    if(!nome) return fail("Indique o nome do proprietário");
    if(fracoes.some(f=>String(f.numero).trim().toLowerCase()===numero.toLowerCase()&&f._row!==form._row)) return fail(`Já existe o apartamento ${numero}`);
    const d={numero,andar:form.andar||"",prop_nome:nome,prop_telefone:form.prop_telefone||"",prop_email:form.prop_email||"",prop_nif:form.prop_nif||"",
      inq_nome:form.inq_nome||"",inq_telefone:form.inq_telefone||"",inq_email:form.inq_email||"",inq_inicio_contrato:form.inq_inicio_contrato||"",
      observacoes:form.observacoes||"",exclui_quota:form.excluiQuota?"Sim":"Não"};
    form._row ? post("edit_fracao",{...d,_row:form._row,_sig:form._sig}) : post("add_fracao",d);
  };

  const quotaMeses = ()=> form.multi ? intervaloMeses(+form.mesIni,+form.anoIni,+form.mesFim,+form.anoFim) : [{mes:+form.mesIni,ano:+form.anoIni}];
  const submitQuota = ()=>{
    const f=aptByNum(form.fracaoNum);
    if(!f) return fail("Seleccione o apartamento");
    if(!form.data) return fail("Indique a data do pagamento");
    const meses=quotaMeses();
    if(!meses.length) return fail("O mês final tem de ser igual ou posterior ao inicial");
    const total = form.valor===""||form.valor===undefined ? quotaMensal*meses.length : Math.round(+form.valor);
    if(!(total>0)) return fail("Indique um valor maior que zero");
    const dup=mesesJaPagos(f.id,meses);
    if(dup.length&&!window.confirm(`Atenção: ${dup.map(lblMes).join(", ")} já ${dup.length===1?"está pago ou isento":"estão pagos ou isentos"} para o apt. ${f.numero}.\n\nRegistar mesmo assim?`)) return;
    const valores=repartir(total,meses.length);
    post("add_pagamentos_quota",{fracao_numero:f.numero,data:form.data,metodo:form.metodo||"",referencia:form.referencia||"",meses:meses.map((m,i)=>({...m,valor:valores[i]}))});
  };
  const submitEditQuota = ()=>{
    const f=aptByNum(form.fracaoNum);
    if(!f) return fail("Seleccione o apartamento");
    if(!form.data) return fail("Indique a data");
    if(form.valor===""||isNaN(+form.valor)||+form.valor<0) return fail("Indique um valor válido");
    post("edit_pagamento_quota",{_row:form._row,_sig:form._sig,fracao_numero:f.numero,data:form.data,valor:+form.valor,mes:+form.mes,ano:+form.ano,metodo:form.metodo||"",referencia:form.referencia||""});
  };
  const submitIsencao = ()=>{
    if(!aptByNum(form.fracaoNum)) return fail("Seleccione o apartamento");
    const meses=intervaloMeses(+form.mesIni,+form.anoIni,+form.mesFim,+form.anoFim);
    if(!meses.length) return fail("O mês final tem de ser igual ou posterior ao inicial");
    post("add_isencoes_quota",{fracao_numero:form.fracaoNum,meses,motivo:form.motivo||""});
  };

  const submitContrib = ()=>{
    const titulo=String(form.titulo||"").trim();
    if(!titulo) return fail("Indique o título");
    if(contribuicoes.some(c=>c.titulo.trim().toLowerCase()===titulo.toLowerCase()&&c.id!==form.id)) return fail("Já existe uma contribuição com esse título");
    const vpf=+form.valorPorFracao||0, vt=+form.valorTotal||0;
    if(vpf<0||vt<0) return fail("Os valores não podem ser negativos");
    const d={titulo,valorPorFracao:vpf,valorTotal:vt,dataVencimento:form.dataVencimento||"",descricao:form.descricao||"",categoria:form.categoria||"",excluidos:(form.excluidos||[]).join(",")};
    form._row ? post("edit_contribuicao",{...d,estado:form.estado||"Aberto",id:form.id,_row:form._row,_sig:form._sig}) : post("add_contribuicao",d);
  };
  const submitPagContrib = ()=>{
    const c=contribById(form.contribId), f=aptByNum(form.fracaoNum);
    if(!c) return fail("Seleccione a contribuição");
    if(!f) return fail("Seleccione o apartamento");
    if(!form.data) return fail("Indique a data");
    if(!(+form.valor>0)) return fail("Indique um valor maior que zero");
    const d={contribuicao_id:c.id,fracao_numero:f.numero,data:form.data,valor:+form.valor,metodo:form.metodo||""};
    if(form._row) return post("edit_pagamento_contribuicao",{...d,_row:form._row,_sig:form._sig});
    const ci=contribInfo(c,f.id,pagamentosContribuicao);
    if(!ci.isLivre&&(ci.isento||ci.excluido)&&!window.confirm(`O apt. ${f.numero} está ${ci.isento?"isento":"excluído"} desta contribuição.\n\nRegistar mesmo assim?`)) return;
    if(!ci.isLivre&&!ci.isento&&!ci.excluido&&ci.pago&&!window.confirm(`O apt. ${f.numero} já pagou esta contribuição (${fmtKz(ci.totalPago)}).\n\nRegistar mesmo assim?`)) return;
    post("add_pagamento_contribuicao",d);
  };
  const submitIsentarContrib = ()=>{
    const c=contribById(form.contribId), f=aptByNum(form.fracaoNum);
    if(!c) return fail("Seleccione a contribuição");
    if(!f) return fail("Seleccione o apartamento");
    post("add_pagamento_contribuicao",{contribuicao_id:c.id,fracao_numero:f.numero,data:today(),valor:0,metodo:"Isento",referencia:form.motivo||""});
  };
  const submitBulk = ()=>{
    const c=contribById(form.contribId), apts=form.bulkApts||[];
    if(!c) return fail("Seleccione a contribuição");
    if(!form.data) return fail("Indique a data");
    if(!(+form.valor>0)) return fail("Indique um valor maior que zero");
    if(!apts.length) return fail("Seleccione pelo menos um apartamento");
    const jaPagaram=apts.filter(n=>{const f=aptByNum(n);const ci=f&&contribInfo(c,f.id,pagamentosContribuicao);return ci&&!ci.isLivre&&ci.pago;});
    if(jaPagaram.length&&!window.confirm(`Atenção: ${jaPagaram.join(", ")} já ${jaPagaram.length===1?"pagou ou está isento":"pagaram ou estão isentos"}.\n\nLançar mesmo assim para todos os seleccionados?`)) return;
    post("add_pagamento_contribuicao_bulk",{contribuicao_id:c.id,fracao_numeros:apts,data:form.data,valor_por_fracao:+form.valor});
  };

  const submitDespesa = ()=>{
    if(!form.data) return fail("Indique a data");
    if(!String(form.descricao||"").trim()) return fail("Indique a descrição");
    if(!form.categoria) return fail("Seleccione a categoria");
    if(!(+form.valor>0)) return fail("Indique um valor maior que zero");
    const d={data:form.data,valor:+form.valor,descricao:form.descricao.trim(),categoria:form.categoria,fornecedor:form.fornecedor||"",observacoes:form.observacoes||""};
    form._row ? post("edit_despesa",{...d,_row:form._row,_sig:form._sig}) : post("add_despesa",d);
  };
  const submitAviso = ()=>{
    if(!form.tipo) return fail("Seleccione o tipo");
    if(!String(form.titulo||"").trim()) return fail("Indique o título");
    if(!form.data) return fail("Indique a data");
    const d={tipo:form.tipo,titulo:form.titulo.trim(),conteudo:form.conteudo||"",data:form.data,autor:form.autor??config.gestorNome??""};
    form._row ? post("edit_aviso",{...d,_row:form._row,_sig:form._sig}) : post("add_aviso",d);
  };

  /* ── abrir formulários ── */
  const abrirFracao = (f)=> f
    ? om("fracao",{_row:f._row,_sig:f._sig,numero:f.numero,andar:f.andar||"",prop_nome:nomeApt(f),prop_telefone:f.prop_telefone||f.telefone||"",
        prop_email:f.prop_email||"",prop_nif:f.prop_nif||"",inq_nome:f.inq_nome||"",inq_telefone:f.inq_telefone||"",inq_email:f.inq_email||"",
        inq_inicio_contrato:f.inq_inicio_contrato||"",observacoes:f.observacoes||"",excluiQuota:!!f.excluiQuota})
    : om("fracao",{excluiQuota:false});
  const abrirQuota = ()=>om("pagQuota",{mesIni:mesAtual,anoIni:anoAtual,mesFim:mesAtual,anoFim:anoAtual,multi:false,valor:""});
  const escolherAptQuota = (num)=>{
    const f=aptByNum(num);
    const qi=f&&!f.excluiQuota?quotaInfo(f.id,pagamentosQuota,quotaMensal,anoBase,mesBase):null;
    const ini=qi?.mesesEmFalta[0], fim=qi?.mesesEmFalta[qi.mesesEmFalta.length-1];
    setForm(p=>({...p,fracaoNum:num,
      ...(ini?{mesIni:ini.mes,anoIni:ini.ano,mesFim:fim.mes,anoFim:fim.ano}:{mesIni:mesAtual,anoIni:anoAtual,mesFim:mesAtual,anoFim:anoAtual})}));
  };
  const abrirEditQuota = (p)=>{ const f=aptById(p.fracaoId); om("editQuota",{_row:p._row,_sig:p._sig,fracaoNum:f?.numero||"",mes:p.mes||mesAtual,ano:p.ano||anoAtual,data:p.data||today(),valor:p.valor,metodo:p.metodo||"",referencia:p.referencia||""}); };
  const abrirContrib = (c)=> c
    ? om("contrib",{_row:c._row,_sig:c._sig,id:c.id,titulo:c.titulo,descricao:c.descricao||"",valorPorFracao:c.valorPorFracao||"",valorTotal:c.valorTotal||"",
        dataVencimento:c.dataVencimento||"",categoria:c.categoria||"",estado:c.estado||"Aberto",excluidos:(c.excluidos||[]).map(id=>aptById(id)?.numero||id)})
    : om("contrib",{excluidos:[]});
  const abrirPagContrib = (p)=> p
    ? om("pagContrib",{_row:p._row,_sig:p._sig,contribId:p.contribuicaoId,fracaoNum:aptById(p.fracaoId)?.numero||"",data:p.data||today(),valor:p.valor,metodo:p.metodo||""})
    : om("pagContrib");
  const abrirDespesa = (d)=> d
    ? om("despesa",{_row:d._row,_sig:d._sig,data:d.data,descricao:d.descricao,categoria:d.categoria,valor:d.valor,fornecedor:d.fornecedor||"",observacoes:d.observacoes||""})
    : om("despesa");
  const abrirAviso = (a)=> a
    ? om("aviso",{_row:a._row,_sig:a._sig,tipo:a.tipo,titulo:a.titulo,conteudo:a.conteudo||"",data:a.data||today(),autor:a.autor||""})
    : om("aviso",{autor:config.gestorNome||""});

  const lembreteDireto = (f, qi, contribs)=>{
    const propTel=f.prop_telefone||f.telefone;
    if(propTel&&f.inq_telefone) return setDrillApt(f);
    if(propTel) return waAbrir(propTel,msgLembrete(f,nomeApt(f),qi,contribs,config));
    if(f.inq_telefone) return waAbrir(f.inq_telefone,msgLembrete(f,f.inq_nome,qi,contribs,config));
  };

  /* ── listas filtradas ── */
  const fracoesFilt = fracoes.filter(f=>{ const t=fApt.trim().toLowerCase(); return !t||[f.numero,f.prop_nome,f.inq_nome].some(x=>String(x||"").toLowerCase().includes(t)); });
  const quotasFilt = [...pagamentosQuota]
    .filter(p=>(!fQApt||aptById(p.fracaoId)?.numero===fQApt)&&(!fQAno||p.ano===+fQAno))
    .sort((a,b)=>(b.data||"").localeCompare(a.data||"")||(b.ano-a.ano)||(b.mes-a.mes));
  const despFilt = [...despesas]
    .filter(d=>(!fDAno||d.data?.startsWith(fDAno+"-"))&&(!fDCat||d.categoria===fDCat)&&(!fDTxt.trim()||[d.descricao,d.fornecedor,d.observacoes].some(x=>String(x||"").toLowerCase().includes(fDTxt.trim().toLowerCase()))))
    .sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  const catsDesp = [...new Set([...CATS,...despesas.map(d=>d.categoria).filter(Boolean)])];

  return (
    <div style={{minHeight:"100vh",background:"#F5F3EF"}}>
      {toast&&<div className={`toast status-bar ${toast.ok?"status-ok":"status-err"}`} onClick={()=>setToast(null)}>{toast.msg}</div>}
      <div style={{background:"#fff",borderBottom:"1px solid #E2DDD6",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:1100,margin:"0 auto",padding:"0 16px"}}>
          {/* Linha 1: nome + acções */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:50,gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
              <span className="serif" style={{fontSize:16,fontWeight:700,color:"#B5341A",whiteSpace:"nowrap"}}>{config.predio}</span>
              <span className="tag tag-blue">Gestor</span>
              {loading&&<span className="spinner"/>}
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
              <button className="btn btn-outline btn-sm" onClick={onReload} title="Actualizar">↻</button>
              <button onClick={()=>{const u=window.location.origin+window.location.pathname;const msg=`🏢 *${config.predio}*\n📋 Consulte o estado do condomínio:\n${u}`;window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");}} className="wa-btn" style={{padding:"6px 10px",fontSize:12}}><WaSvg s={13}/>Partilhar</button>
              <button className="btn btn-ghost btn-sm" title="Reconfigurar ligação" onClick={()=>{if(window.confirm("Reconfigurar o URL da API?"))window.location.href=window.location.pathname+"?setup";}}>⚙️</button>
              <button className="btn btn-ghost btn-sm" title="Terminar sessão" onClick={onLogout}>🔒</button>
              <button className="btn btn-ghost btn-sm" onClick={onBack}>← Sair</button>
            </div>
          </div>
          {/* Linha 2: tabs */}
          <div style={{display:"flex",gap:2,overflowX:"auto",paddingBottom:6,scrollbarWidth:"none"}}>
            {TABS.map(([k,l])=><button key={k} className={`nav-pill${tab===k?" on":""}`} onClick={()=>setTab(k)} style={{whiteSpace:"nowrap"}}>{l}</button>)}
          </div>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"28px 16px"}} className="anim">

        {/* ── DASHBOARD ── */}
        {tab==="dashboard"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
            <span className="section-hd">Dashboard Financeiro</span>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <select className="input" style={{width:"auto",fontSize:13}} value={relTipo} onChange={e=>setRelTipo(e.target.value)}>
                <option value="mensal">Relatório Mensal</option>
                <option value="anual">Relatório Anual</option>
              </select>
              {relTipo==="mensal"&&<select className="input" style={{width:"auto",fontSize:13}} value={relMes} onChange={e=>setRelMes(+e.target.value)}>{MESES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select>}
              <select className="input" style={{width:"auto",fontSize:13}} value={relAno} onChange={e=>setRelAno(+e.target.value)}>{anos.map(y=><option key={y} value={y}>{y}</option>)}</select>
              <button className="btn btn-red" onClick={()=>printReport(appData,relMes,relAno,relTipo==="anual")}>🖨️ Relatório</button>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
            {[{l:"Total Receitas",v:totalRec,c:"#1E7A4A"},{l:"Total Despesas",v:totalDesp,c:"#B5341A"},{l:"Saldo Global",v:saldo,c:saldo>=0?"#1E7A4A":"#B5341A"},{l:"Em Dívida",v:totalDivida,c:"#C96B15"}].map((s,i)=>(
              <div key={i} style={{background:"#fff",border:"1px solid #E2DDD6",borderRadius:12,padding:"16px 18px"}}>
                <div style={{fontSize:11,color:"#8A8278",textTransform:"uppercase",letterSpacing:.5,fontWeight:600,marginBottom:6}}>{s.l}</div>
                <div className="mono" style={{fontSize:20,fontWeight:700,color:s.c}}>{fmtKz(s.v)}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{marginBottom:16}}>
            <div style={{fontWeight:700,marginBottom:4}}>Receitas vs Despesas</div>
            <div style={{fontSize:11,color:"#8A8278",marginBottom:12}}>Receitas = quotas (pelo mês de referência) + contribuições (pela data de pagamento)</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={evolucao} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false}/>
                <XAxis dataKey="label" tick={{fill:"#8A8278",fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"#8A8278",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>Math.round(v/1000)+"k"}/>
                <Tooltip content={<TT/>}/><Legend wrapperStyle={{fontSize:12,color:"#8A8278"}}/>
                <Bar dataKey="Receitas" fill="#1E7A4A" radius={[4,4,0,0]}/>
                <Bar dataKey="Despesas" fill="#B5341A" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div style={{fontWeight:700,marginBottom:16}}>Saldo Mensal</div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false}/>
                <XAxis dataKey="label" tick={{fill:"#8A8278",fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"#8A8278",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>Math.round(v/1000)+"k"}/>
                <Tooltip content={<TT/>}/>
                <Line type="monotone" dataKey="Saldo" stroke="#B5341A" strokeWidth={2.5} dot={{fill:"#B5341A",r:4}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>}

        {/* ── APARTAMENTOS ── */}
        {tab==="fracoes"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
            <span className="section-hd">Apartamentos</span>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <input className="input" style={{width:200}} placeholder="🔎 Nº ou nome" value={fApt} onChange={e=>setFApt(e.target.value)}/>
              <button className="btn btn-red" onClick={()=>abrirFracao(null)}>+ Novo Apartamento</button>
            </div>
          </div>
          <div className="card" style={{overflowX:"auto"}}>
            <table><thead><tr><th>Nº</th><th>Proprietário</th><th>Inquilino</th><th>Quota</th><th>Dívida Total</th><th>Estado</th><th></th></tr></thead>
            <tbody>{fracoesFilt.map(f=>{
              const qi=f.excluiQuota?{divida:0,mesesAtraso:0,mesesEmFalta:[]}:quotaInfo(f.id,pagamentosQuota,quotaMensal,anoBase,mesBase);
              const contribs=contribuicoes.map(c=>({...c,...contribInfo(c,f.id,pagamentosContribuicao)})).filter(c=>c.divida>0);
              const divTotal=qi.divida+contribs.reduce((s,c)=>s+c.divida,0);
              const temTel=f.prop_telefone||f.telefone||f.inq_telefone;
              return <tr key={f.id}>
                <td><span className="serif" style={{fontWeight:700,color:"#B5341A"}}>{f.numero}</span>{f.excluiQuota&&<span className="tag tag-grey" style={{marginLeft:6,fontSize:9}}>Excl.</span>}</td>
                <td><div style={{fontWeight:600}}>{nomeApt(f)}</div><div style={{fontSize:11,color:"#8A8278"}}>{f.prop_telefone||f.telefone}</div></td>
                <td>{f.inq_nome?<><div style={{fontSize:13}}>{f.inq_nome}</div><span className="tag tag-teal" style={{fontSize:10}}>Inquilino</span></>:<span style={{color:"#C5C0B8",fontSize:12}}>—</span>}</td>
                <td>{f.excluiQuota?<span className="tag tag-grey">Excluído</span>:<span className="mono" style={{color:qi.divida>0?"#B5341A":"#1E7A4A",fontSize:12}}>{qi.mesesAtraso>0?`${qi.mesesAtraso}m atraso`:"Em dia"}</span>}</td>
                <td><span className="mono" style={{color:divTotal>0?"#B5341A":"#1E7A4A",fontWeight:700,fontSize:13}}>{fmtKz(divTotal)}</span></td>
                <td><span className={`tag ${divTotal>0?"tag-red":"tag-green"}`}>{divTotal>0?"Em dívida":"OK"}</span></td>
                <td>
                  <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                    {divTotal>0&&temTel&&<button className="wa-btn" style={{padding:"5px 9px"}} onClick={()=>lembreteDireto(f,qi,contribs)} title="Lembrete por WhatsApp"><WaSvg s={13}/></button>}
                    <button className="btn btn-outline btn-sm" onClick={()=>setDrillApt(f)} title="Ver detalhe">🔍</button>
                    <button className="btn btn-outline btn-sm" onClick={()=>abrirFracao(f)} title="Editar">✏️</button>
                  </div>
                </td>
              </tr>;
            })}</tbody></table>
            {fracoesFilt.length===0&&<div style={{textAlign:"center",padding:24,color:"#8A8278"}}>Nenhum apartamento encontrado.</div>}
          </div>
        </>}

        {/* ── QUOTAS ── */}
        {tab==="quotas"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
            <span className="section-hd">Pagamentos de Quotas</span>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-outline" onClick={()=>om("isentarMes",{mesIni:mesAtual,anoIni:anoAtual,mesFim:mesAtual,anoFim:anoAtual})}>🚫 Isentar Mês</button>
              <button className="btn btn-red" onClick={abrirQuota}>+ Registar</button>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            <select className="input" style={{width:"auto",fontSize:13}} value={fQApt} onChange={e=>setFQApt(e.target.value)}>
              <option value="">Todos os apartamentos</option>{fracoes.map(f=><option key={f.id} value={f.numero}>{f.numero} — {nomeApt(f)}</option>)}
            </select>
            <select className="input" style={{width:"auto",fontSize:13}} value={fQAno} onChange={e=>setFQAno(e.target.value)}>
              <option value="">Todos os anos</option>{anos.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <span style={{fontSize:13,color:"#8A8278"}}>{quotasFilt.length} registos · <b className="mono" style={{color:"#1E7A4A"}}>{fmtKz(quotasFilt.reduce((s,p)=>s+p.valor,0))}</b></span>
          </div>
          <div className="card" style={{overflowX:"auto"}}>
            <table><thead><tr><th>Data</th><th>Apt.</th><th>Proprietário</th><th>Mês</th><th>Valor</th><th>Método</th><th></th></tr></thead>
            <tbody>{quotasFilt.map(p=>{
              const f=aptById(p.fracaoId);
              return <tr key={p.id}>
                <td style={{color:"#8A8278",fontSize:12}}>{fmtDate(p.data)}</td>
                <td><span className="serif" style={{fontWeight:700,color:"#B5341A"}}>{f?.numero||"?"}</span></td>
                <td>{nomeApt(f)||"?"}</td>
                <td>{p.mes&&p.ano?<span className="tag tag-blue">{MESES_S[p.mes-1]} {p.ano}</span>:<span className="tag tag-red">Sem mês</span>}</td>
                <td><span className="mono" style={{color:"#1E7A4A",fontWeight:700}}>{fmtKz(p.valor)}</span></td>
                <td style={{color:"#8A8278",fontSize:12}}>{p.metodo==="Isento"?<span className="tag tag-grey" title={p.referencia}>Isento</span>:(p.metodo||"—")}</td>
                <td><RowActions onEdit={()=>abrirEditQuota(p)} onDelete={()=>apagar("delete_pagamento_quota",p,`o ${p.metodo==="Isento"?"registo de isenção":"pagamento"} do apt. ${f?.numero||"?"} (${p.mes?MESES_S[p.mes-1]:"?"} ${p.ano||""})`)}/></td>
              </tr>;
            })}</tbody></table>
            {quotasFilt.length===0&&<div style={{textAlign:"center",padding:24,color:"#8A8278"}}>Sem registos.</div>}
          </div>
        </>}

        {/* ── CONTRIBUIÇÕES ── */}
        {tab==="contribuicoes"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
            <span className="section-hd">Outras Contribuições</span>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button className="btn btn-outline" onClick={()=>abrirPagContrib(null)}>+ Registar Pgto.</button>
              <button className="btn btn-outline" onClick={()=>om("isentarContrib")} style={{color:"#C96B15",borderColor:"#C96B15"}}>🚫 Isentar Apt.</button>
              <button className="btn btn-blue" onClick={()=>om("pagContribBulk",{bulkApts:[]})}>⚡ Lançar para todos</button>
              <button className="btn btn-red" onClick={()=>abrirContrib(null)}>+ Nova Contribuição</button>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {contribuicoes.length===0&&<div className="card" style={{textAlign:"center",padding:"36px",color:"#8A8278"}}>Sem contribuições registadas.</div>}
            {contribuicoes.map(c=>{
              const isLivre=!c.valorPorFracao&&!c.valorTotal;
              const meta=c.valorTotal||(c.valorPorFracao*fracoes.filter(f=>!(c.excluidos||[]).includes(f.id)).length);
              const pcs=pagamentosContribuicao.filter(p=>p.contribuicaoId===c.id);
              const totalCob=pcs.reduce((s,p)=>s+p.valor,0);
              return <div key={c.id} className="card">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:15}}>{c.titulo} {c.estado&&c.estado!=="Aberto"&&<span className="tag tag-grey" style={{marginLeft:6}}>{c.estado}</span>}</div>
                    <div style={{fontSize:12,color:"#8A8278",marginTop:3}}>{c.descricao}</div>
                    {c.dataVencimento&&<div style={{fontSize:11,color:"#8A8278",marginTop:3}}>Prazo: {fmtDate(c.dataVencimento)}</div>}
                    {(c.excluidos||[]).length>0&&<div style={{fontSize:11,color:"#8A8278",marginTop:3}}>Excluídos: {c.excluidos.map(id=>aptById(id)?.numero||id).join(", ")}</div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    {isLivre?(
                      <><span className="tag tag-teal">Arrecadação livre</span><div className="mono" style={{fontWeight:700,fontSize:14,marginTop:6,color:"#1E7A4A"}}>{fmtKz(totalCob)} recebido</div></>
                    ):(
                      <><div className="mono" style={{fontWeight:700,fontSize:14,color:"#B5341A"}}>{fmtKz(totalCob)}<span style={{color:"#8A8278",fontWeight:400}}> / {fmtKz(meta)}</span></div>
                      {c.valorPorFracao>0&&<div style={{fontSize:11,color:"#8A8278"}}>{fmtKz(c.valorPorFracao)}/apt.</div>}</>
                    )}
                    <div style={{marginTop:8}}><RowActions onEdit={()=>abrirContrib(c)} onDelete={()=>pcs.length?fail("Esta contribuição tem pagamentos registados. Apague primeiro os pagamentos."):apagar("delete_contribuicao",c,`a contribuição "${c.titulo}"`,{id:c.id})}/></div>
                  </div>
                </div>
                {pcs.length>0&&<div style={{overflowX:"auto"}}><table style={{marginTop:8}}><thead><tr><th>Data</th><th>Apt.</th><th>Proprietário</th><th>Valor</th><th></th></tr></thead>
                <tbody>{pcs.map(p=>{const f=aptById(p.fracaoId);return<tr key={p.id}>
                  <td style={{fontSize:12,color:"#8A8278"}}>{fmtDate(p.data)}</td>
                  <td><span className="serif" style={{fontWeight:700,color:"#B5341A"}}>{f?.numero||"?"}</span></td>
                  <td>{nomeApt(f)}</td>
                  <td>{p.metodo==="Isento"?<span className="tag tag-grey" title={p.referencia}>Isento</span>:<span className="mono" style={{color:"#1E7A4A",fontWeight:700}}>{fmtKz(p.valor)}</span>}</td>
                  <td><RowActions onEdit={p.metodo==="Isento"?null:()=>abrirPagContrib(p)} onDelete={()=>apagar("delete_pagamento_contribuicao",p,`o ${p.metodo==="Isento"?"registo de isenção":"pagamento"} do apt. ${f?.numero||"?"} em "${c.titulo}"`)}/></td>
                </tr>;})}
                </tbody></table></div>}
              </div>;
            })}
          </div>
        </>}

        {/* ── DESPESAS ── */}
        {tab==="despesas"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <span className="section-hd">Despesas</span>
            <button className="btn btn-red" onClick={()=>abrirDespesa(null)}>+ Registar</button>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            <select className="input" style={{width:"auto",fontSize:13}} value={fDAno} onChange={e=>setFDAno(e.target.value)}>
              <option value="">Todos os anos</option>{anos.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <select className="input" style={{width:"auto",fontSize:13}} value={fDCat} onChange={e=>setFDCat(e.target.value)}>
              <option value="">Todas as categorias</option>{catsDesp.map(c=><option key={c}>{c}</option>)}
            </select>
            <input className="input" style={{width:200,fontSize:13}} placeholder="🔎 Procurar" value={fDTxt} onChange={e=>setFDTxt(e.target.value)}/>
            <span style={{fontSize:13,color:"#8A8278"}}>{despFilt.length} registos · <b className="mono" style={{color:"#B5341A"}}>{fmtKz(despFilt.reduce((s,d)=>s+d.valor,0))}</b></span>
          </div>
          <div className="card" style={{overflowX:"auto"}}>
            <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th className="hide-sm">Fornecedor</th><th className="hide-sm">Obs.</th><th></th></tr></thead>
            <tbody>{despFilt.map(d=>(
              <tr key={d.id}>
                <td style={{color:"#8A8278",fontSize:12}}>{fmtDate(d.data)}</td>
                <td>{d.descricao}</td>
                <td><span className="tag tag-amber">{d.categoria}</span></td>
                <td><span className="mono" style={{color:"#B5341A",fontWeight:700}}>{fmtKz(d.valor)}</span></td>
                <td className="hide-sm" style={{color:"#8A8278",fontSize:12}}>{d.fornecedor||"—"}</td>
                <td className="hide-sm" style={{color:"#8A8278",fontSize:12,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.observacoes||"—"}</td>
                <td><RowActions onEdit={()=>abrirDespesa(d)} onDelete={()=>apagar("delete_despesa",d,`a despesa "${d.descricao}" (${fmtKz(d.valor)})`)}/></td>
              </tr>
            ))}</tbody></table>
            {despFilt.length===0&&<div style={{textAlign:"center",padding:24,color:"#8A8278"}}>Sem registos.</div>}
          </div>
        </>}

        {/* ── AVISOS ── */}
        {tab==="avisos"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <span className="section-hd">Avisos, Notificações e Actas</span>
            <button className="btn btn-red" onClick={()=>abrirAviso(null)}>+ Publicar</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[...avisos].sort((a,b)=>(b.data||"").localeCompare(a.data||"")).map(a=>(
              <div key={a.id} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{flex:1}}><AvisoCard a={a}/></div>
                <div style={{paddingTop:12}}><RowActions onEdit={()=>abrirAviso(a)} onDelete={()=>apagar("delete_aviso",a,`o aviso "${a.titulo}"`)}/></div>
              </div>
            ))}
            {avisos.length===0&&<div className="card" style={{textAlign:"center",padding:"36px",color:"#8A8278"}}>Nenhum aviso publicado ainda.</div>}
          </div>
        </>}
      </div>

      {/* ── DRILL DOWN MODAL ── */}
      {drillApt&&<DrillModal fracao={drillApt} appData={appData} onClose={()=>setDrillApt(null)}/>}

      {/* ── APARTAMENTO (novo / editar) ── */}
      {modal==="fracao"&&<Modal title={form._row?`Editar Apt. ${form.numero}`:"Novo Apartamento"} onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Número *"><input className="input" placeholder="101" value={form.numero||""} onChange={e=>sf("numero")(e.target.value)}/></FG>
            <FG label="Andar"><input className="input" placeholder="1º Dto" value={form.andar||""} onChange={e=>sf("andar")(e.target.value)}/></FG>
          </div>
          <div style={{fontWeight:700,fontSize:13,color:"#1A4F8B"}}>👤 Proprietário</div>
          <FG label="Nome *"><input className="input" value={form.prop_nome||""} onChange={e=>sf("prop_nome")(e.target.value)}/></FG>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Telefone"><input className="input" placeholder="+244 9XX XXX XXX" value={form.prop_telefone||""} onChange={e=>sf("prop_telefone")(e.target.value)}/></FG>
            <FG label="NIF"><input className="input" value={form.prop_nif||""} onChange={e=>sf("prop_nif")(e.target.value)}/></FG>
          </div>
          <FG label="Email"><input className="input" type="email" value={form.prop_email||""} onChange={e=>sf("prop_email")(e.target.value)}/></FG>
          <div className="divider"/>
          <div style={{fontWeight:700,fontSize:13,color:"#1E7A4A"}}>🏠 Inquilino <span style={{fontWeight:400,color:"#8A8278"}}>(opcional)</span></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Nome"><input className="input" value={form.inq_nome||""} onChange={e=>sf("inq_nome")(e.target.value)}/></FG>
            <FG label="Telefone"><input className="input" value={form.inq_telefone||""} onChange={e=>sf("inq_telefone")(e.target.value)}/></FG>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Email"><input className="input" type="email" value={form.inq_email||""} onChange={e=>sf("inq_email")(e.target.value)}/></FG>
            <FG label="Início do contrato"><input className="input" type="date" value={form.inq_inicio_contrato||""} onChange={e=>sf("inq_inicio_contrato")(e.target.value)}/></FG>
          </div>
          <div className="divider"/>
          <FG label="Observações"><input className="input" value={form.observacoes||""} onChange={e=>sf("observacoes")(e.target.value)}/></FG>
          <CheckRow label="Excluir das quotas mensais (acordo especial com gestão)" checked={form.excluiQuota} onChange={sf("excluiQuota")}/>
          <ModalBtns onCancel={cm} onOk={submitFracao} saving={saving} label={form._row?"Guardar":"Criar"}/>
        </div>
      </Modal>}

      {/* ── REGISTAR QUOTA (um ou vários meses) ── */}
      {modal==="pagQuota"&&(()=>{
        const f=aptByNum(form.fracaoNum);
        const meses=quotaMeses();
        const dup=f?mesesJaPagos(f.id,meses):[];
        const total=form.valor===""||form.valor===undefined?quotaMensal*meses.length:Math.round(+form.valor)||0;
        const valores=repartir(total,meses.length);
        const qi=f&&!f.excluiQuota?quotaInfo(f.id,pagamentosQuota,quotaMensal,anoBase,mesBase):null;
        return <Modal title="Registar Pagamento de Quota" onClose={cm}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <FG label="Apartamento *"><AptSelect fracoes={fracoes} value={form.fracaoNum} onChange={escolherAptQuota}/></FG>
            {qi&&<div style={{fontSize:12,color:qi.mesesAtraso?"#B5341A":"#1E7A4A"}}>{qi.mesesAtraso?`${qi.mesesAtraso} ${qi.mesesAtraso===1?"mês":"meses"} em falta (${fmtKz(qi.divida)}) · primeiro: ${lblMes(qi.mesesEmFalta[0])}`:"✅ Quotas em dia"}</div>}
            {f?.excluiQuota&&<Warn>Este apartamento está excluído das quotas mensais.</Warn>}
            <CheckRow label="Pagamento de vários meses" checked={form.multi} onChange={sf("multi")}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FG label={form.multi?"Mês inicial":"Mês"}><MesSelect value={form.mesIni} onChange={sf("mesIni")}/></FG>
              <FG label={form.multi?"Ano inicial":"Ano"}><AnoSelect value={form.anoIni} onChange={sf("anoIni")} anos={anos}/></FG>
            </div>
            {form.multi&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FG label="Mês final"><MesSelect value={form.mesFim} onChange={sf("mesFim")}/></FG>
              <FG label="Ano final"><AnoSelect value={form.anoFim} onChange={sf("anoFim")} anos={anos}/></FG>
            </div>}
            <FG label="Data do pagamento *"><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
            <FG label={form.multi?"Valor total (Kz)":"Valor (Kz)"} hint={form.multi?`Vazio = ${meses.length} × ${fmtKz(quotaMensal)}`:`Vazio = ${fmtKz(quotaMensal)}`}>
              <input className="input" type="number" min="0" placeholder={String(quotaMensal*Math.max(meses.length,1))} value={form.valor??""} onChange={e=>sf("valor")(e.target.value)}/>
            </FG>
            {form.multi&&meses.length>0&&<div style={{background:"#F5F3EF",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#8A8278"}}>
              <b style={{color:"#1C1A16"}}>{meses.length} {meses.length===1?"mês":"meses"}</b> · {meses.length<=12?meses.map((m,i)=>`${lblMes(m)}: ${fmtKz(valores[i])}`).join(" · "):`${fmtKz(valores[0])} por mês`}
            </div>}
            {form.multi&&meses.length===0&&<Warn>O mês final tem de ser igual ou posterior ao inicial.</Warn>}
            {dup.length>0&&<Warn>⚠️ Já {dup.length===1?"está pago ou isento":"estão pagos ou isentos"}: <b>{dup.map(lblMes).join(", ")}</b></Warn>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FG label="Método"><select className="input" value={form.metodo||""} onChange={e=>sf("metodo")(e.target.value)}><option value="">—</option>{METODOS.map(m=><option key={m}>{m}</option>)}</select></FG>
              <FG label="Referência"><input className="input" placeholder="Nº transferência / recibo" value={form.referencia||""} onChange={e=>sf("referencia")(e.target.value)}/></FG>
            </div>
            <ModalBtns onCancel={cm} onOk={submitQuota} saving={saving} label="Registar"/>
          </div>
        </Modal>;
      })()}

      {/* ── EDITAR QUOTA ── */}
      {modal==="editQuota"&&<Modal title="Editar Pagamento de Quota" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <FG label="Apartamento *"><AptSelect fracoes={fracoes} value={form.fracaoNum} onChange={sf("fracaoNum")}/></FG>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Mês"><MesSelect value={form.mes} onChange={sf("mes")}/></FG>
            <FG label="Ano"><AnoSelect value={form.ano} onChange={sf("ano")} anos={anos}/></FG>
          </div>
          <FG label="Data *"><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
          <FG label="Valor (Kz)"><input className="input" type="number" min="0" value={form.valor??""} onChange={e=>sf("valor")(e.target.value)}/></FG>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Método"><select className="input" value={form.metodo||""} onChange={e=>sf("metodo")(e.target.value)}><option value="">—</option>{[...METODOS,"Isento"].map(m=><option key={m}>{m}</option>)}</select></FG>
            <FG label="Referência / motivo"><input className="input" value={form.referencia||""} onChange={e=>sf("referencia")(e.target.value)}/></FG>
          </div>
          <ModalBtns onCancel={cm} onOk={submitEditQuota} saving={saving} label="Guardar"/>
        </div>
      </Modal>}

      {/* ── ISENTAR INTERVALO DE QUOTAS ── */}
      {modal==="isentarMes"&&(()=>{
        const meses=intervaloMeses(+form.mesIni,+form.anoIni,+form.mesFim,+form.anoFim);
        return <Modal title="🚫 Isentar Meses de Quota" onClose={cm}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"#EBF1FA",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#1A4F8B"}}>
              Os meses seleccionados ficam isentos — o apartamento não aparecerá como devedor nesses períodos.<br/>
              Pode definir um único mês ou um intervalo (ex: apartamento abandonado durante anos).
            </div>
            <FG label="Apartamento *"><AptSelect fracoes={fracoes} value={form.fracaoNum} onChange={sf("fracaoNum")}/></FG>
            <div style={{fontWeight:600,fontSize:12,color:"#8A8278",textTransform:"uppercase",letterSpacing:.5}}>Início do período</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FG label="Mês início"><MesSelect value={form.mesIni} onChange={sf("mesIni")}/></FG>
              <FG label="Ano início"><AnoSelect value={form.anoIni} onChange={sf("anoIni")} anos={anos}/></FG>
            </div>
            <div style={{fontWeight:600,fontSize:12,color:"#8A8278",textTransform:"uppercase",letterSpacing:.5}}>Fim do período <span style={{fontWeight:400,textTransform:"none"}}>(igual ao início = apenas 1 mês)</span></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FG label="Mês fim"><MesSelect value={form.mesFim} onChange={sf("mesFim")}/></FG>
              <FG label="Ano fim"><AnoSelect value={form.anoFim} onChange={sf("anoFim")} anos={anos}/></FG>
            </div>
            {meses.length>0
              ? <div style={{background:"#F5F3EF",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#8A8278"}}>Total: <b style={{color:"#1C1A16"}}>{meses.length} {meses.length===1?"mês":"meses"} isentos</b></div>
              : <Warn>O mês final tem de ser igual ou posterior ao inicial.</Warn>}
            <FG label="Motivo (opcional)"><input className="input" placeholder="Ex: Apartamento abandonado" value={form.motivo||""} onChange={e=>sf("motivo")(e.target.value)}/></FG>
            <ModalBtns onCancel={cm} onOk={submitIsencao} saving={saving} label="Aplicar Isenções"/>
          </div>
        </Modal>;
      })()}

      {/* ── ISENTAR APARTAMENTO DE CONTRIBUIÇÃO ── */}
      {modal==="isentarContrib"&&<Modal title="🚫 Isentar Apartamento de Contribuição" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:"#FEF4E8",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#C96B15"}}>
            O apartamento ficará isento desta contribuição — não aparecerá como devedor na página pública.
          </div>
          <FG label="Contribuição *"><select className="input" value={form.contribId||""} onChange={e=>sf("contribId")(e.target.value)}>
            <option value="">Seleccione...</option>{contribuicoes.map(c=><option key={c.id} value={c.id}>{c.titulo}</option>)}
          </select></FG>
          <FG label="Apartamento *"><AptSelect fracoes={fracoes} value={form.fracaoNum} onChange={sf("fracaoNum")}/></FG>
          <FG label="Motivo (opcional)"><input className="input" placeholder="Ex: Acordo prévio com gestão" value={form.motivo||""} onChange={e=>sf("motivo")(e.target.value)}/></FG>
          <ModalBtns onCancel={cm} onOk={submitIsentarContrib} saving={saving} label="Aplicar Isenção"/>
        </div>
      </Modal>}

      {/* ── CONTRIBUIÇÃO (nova / editar) ── */}
      {modal==="contrib"&&<Modal title={form._row?"Editar Contribuição":"Nova Contribuição"} onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <FG label="Título *"><input className="input" value={form.titulo||""} onChange={e=>sf("titulo")(e.target.value)}/></FG>
          <FG label="Descrição"><input className="input" value={form.descricao||""} onChange={e=>sf("descricao")(e.target.value)}/></FG>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Valor por apt. (Kz)" hint="0 = sem valor fixo por apt."><input className="input" type="number" min="0" value={form.valorPorFracao||""} onChange={e=>sf("valorPorFracao")(e.target.value)}/></FG>
            <FG label="Valor Total (Kz)" hint="0 = sem limite total"><input className="input" type="number" min="0" value={form.valorTotal||""} onChange={e=>sf("valorTotal")(e.target.value)}/></FG>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Data Limite (opcional)"><input className="input" type="date" value={form.dataVencimento||""} onChange={e=>sf("dataVencimento")(e.target.value)}/></FG>
            <FG label="Categoria (opcional)"><input className="input" value={form.categoria||""} onChange={e=>sf("categoria")(e.target.value)}/></FG>
          </div>
          {form._row&&<FG label="Estado"><select className="input" value={form.estado||"Aberto"} onChange={e=>sf("estado")(e.target.value)}>{[...new Set([...ESTADOS_CONTRIB,form.estado||"Aberto"])].map(s=><option key={s}>{s}</option>)}</select></FG>}
          <FG label="Apartamentos EXCLUÍDOS desta contribuição" hint="Seleccione os apartamentos que não participam">
            <div style={{maxHeight:160,overflowY:"auto",border:"1.5px solid #E2DDD6",borderRadius:8,padding:8}}>
              {fracoes.map(f=>(
                <CheckRow key={f.id} label={`${f.numero} — ${nomeApt(f)}`}
                  checked={(form.excluidos||[]).includes(f.numero)}
                  onChange={v=>sf("excluidos")(v?[...(form.excluidos||[]),f.numero]:(form.excluidos||[]).filter(n=>n!==f.numero))}/>
              ))}
            </div>
          </FG>
          <ModalBtns onCancel={cm} onOk={submitContrib} saving={saving} label={form._row?"Guardar":"Criar"}/>
        </div>
      </Modal>}

      {/* ── PAGAMENTO DE CONTRIBUIÇÃO (registar / editar) ── */}
      {modal==="pagContrib"&&(()=>{
        const c=contribById(form.contribId), f=aptByNum(form.fracaoNum);
        const ci=c&&f?contribInfo(c,f.id,pagamentosContribuicao):null;
        const aviso=!form._row&&ci&&!ci.isLivre&&(ci.isento?"Este apartamento está isento desta contribuição.":ci.excluido?"Este apartamento está excluído desta contribuição.":ci.pago?`Este apartamento já pagou esta contribuição (${fmtKz(ci.totalPago)}).`:null);
        const sugerir=(cid,num)=>{ const cc=contribById(cid); if(!form._row&&cc?.valorPorFracao) sf("valor")(cc.valorPorFracao); };
        return <Modal title={form._row?"Editar Pagamento de Contribuição":"Registar Pagamento de Contribuição"} onClose={cm}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <FG label="Contribuição *"><select className="input" value={form.contribId||""} onChange={e=>{sf("contribId")(e.target.value);sugerir(e.target.value);}}>
              <option value="">Seleccione...</option>{contribuicoes.map(c=><option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select></FG>
            <FG label="Apartamento *"><AptSelect fracoes={fracoes} value={form.fracaoNum} onChange={sf("fracaoNum")}/></FG>
            {aviso&&<Warn>⚠️ {aviso}</Warn>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FG label="Data *"><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
              <FG label="Valor (Kz) *"><input className="input" type="number" min="0" value={form.valor??""} onChange={e=>sf("valor")(e.target.value)}/></FG>
            </div>
            <FG label="Método"><select className="input" value={form.metodo||""} onChange={e=>sf("metodo")(e.target.value)}><option value="">—</option>{METODOS.map(m=><option key={m}>{m}</option>)}</select></FG>
            <ModalBtns onCancel={cm} onOk={submitPagContrib} saving={saving} label={form._row?"Guardar":"Registar"}/>
          </div>
        </Modal>;
      })()}

      {/* ── LANÇAR PARA TODOS ── */}
      {modal==="pagContribBulk"&&(()=>{
        const c=contribById(form.contribId);
        const elegiveis=c?fracoes.filter(f=>{const ci=contribInfo(c,f.id,pagamentosContribuicao);return ci.isLivre||(!ci.excluido&&!ci.isento&&!ci.pago);}):fracoes;
        const sel=form.bulkApts||[];
        return <Modal title="⚡ Lançar Contribuição para Todos" onClose={cm} lg>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"#EBF1FA",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#1A4F8B"}}>
              ℹ️ Lança um pagamento para cada apartamento seleccionado, com o mesmo valor e data.
            </div>
            <FG label="Contribuição *"><select className="input" value={form.contribId||""} onChange={e=>{const cc=contribById(e.target.value);setForm(p=>({...p,contribId:e.target.value,bulkApts:[],...(cc?.valorPorFracao?{valor:cc.valorPorFracao}:{})}));}}>
              <option value="">Seleccione...</option>{contribuicoes.map(c=><option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select></FG>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FG label="Data *"><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
              <FG label="Valor por apt. (Kz) *"><input className="input" type="number" min="0" value={form.valor??""} onChange={e=>sf("valor")(e.target.value)}/></FG>
            </div>
            <FG label="Apartamentos a lançar">
              <div style={{maxHeight:200,overflowY:"auto",border:"1.5px solid #E2DDD6",borderRadius:8,padding:8}}>
                <CheckRow label={c?`Seleccionar os que faltam pagar (${elegiveis.length})`:"Seleccionar todos"} checked={sel.length>0&&sel.length===elegiveis.length&&elegiveis.every(f=>sel.includes(f.numero))} onChange={v=>sf("bulkApts")(v?elegiveis.map(f=>f.numero):[])}/>
                <div className="divider"/>
                {fracoes.map(f=>{
                  const ci=c?contribInfo(c,f.id,pagamentosContribuicao):null;
                  const nota=ci&&!ci.isLivre?(ci.excluido?" · excluído":ci.isento?" · isento":ci.pago?" · já pagou":""):"";
                  return <CheckRow key={f.id} label={`${f.numero} — ${nomeApt(f)}${nota}`}
                    checked={sel.includes(f.numero)}
                    onChange={v=>sf("bulkApts")(v?[...sel,f.numero]:sel.filter(n=>n!==f.numero))}/>;
                })}
              </div>
            </FG>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,color:"#8A8278"}}>{sel.length} apartamentos seleccionados</span>
              <ModalBtns onCancel={cm} onOk={submitBulk} saving={saving} cls="btn-blue" label={`⚡ Lançar para ${sel.length} apts.`}/>
            </div>
          </div>
        </Modal>;
      })()}

      {/* ── DESPESA (registar / editar) ── */}
      {modal==="despesa"&&<Modal title={form._row?"Editar Despesa":"Registar Despesa"} onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <FG label="Data *"><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
          <FG label="Descrição *"><input className="input" placeholder="Ex: Electricidade" value={form.descricao||""} onChange={e=>sf("descricao")(e.target.value)}/></FG>
          <FG label="Categoria *"><select className="input" value={form.categoria||""} onChange={e=>sf("categoria")(e.target.value)}><option value="">Seleccione...</option>{[...new Set([...CATS,form.categoria].filter(Boolean))].map(c=><option key={c}>{c}</option>)}</select></FG>
          <FG label="Valor (Kz) *"><input className="input" type="number" min="0" value={form.valor??""} onChange={e=>sf("valor")(e.target.value)}/></FG>
          <FG label="Fornecedor (opcional)"><input className="input" value={form.fornecedor||""} onChange={e=>sf("fornecedor")(e.target.value)}/></FG>
          <FG label="Observações (opcional)"><input className="input" value={form.observacoes||""} onChange={e=>sf("observacoes")(e.target.value)}/></FG>
          <ModalBtns onCancel={cm} onOk={submitDespesa} saving={saving} label={form._row?"Guardar":"Registar"}/>
        </div>
      </Modal>}

      {/* ── AVISO (publicar / editar) ── */}
      {modal==="aviso"&&<Modal title={form._row?"Editar Aviso":"Publicar Aviso / Acta"} onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <FG label="Tipo *"><select className="input" value={form.tipo||""} onChange={e=>sf("tipo")(e.target.value)}><option value="">Seleccione...</option>{AVISO_TIPOS.map(t=><option key={t}>{t}</option>)}</select></FG>
          <FG label="Título *"><input className="input" value={form.titulo||""} onChange={e=>sf("titulo")(e.target.value)}/></FG>
          <FG label="Conteúdo"><textarea className="input" value={form.conteudo||""} onChange={e=>sf("conteudo")(e.target.value)} rows={5}/></FG>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Data *"><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
            <FG label="Autor"><input className="input" value={form.autor??""} onChange={e=>sf("autor")(e.target.value)}/></FG>
          </div>
          <ModalBtns onCancel={cm} onOk={submitAviso} saving={saving} label={form._row?"Guardar":"Publicar"}/>
        </div>
      </Modal>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════ */
const Loading = ({msg}) => (
  <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#F5F3EF",gap:16}}>
    <div className="spinner" style={{width:32,height:32,borderWidth:3}}/>
    <div style={{color:"#8A8278",fontSize:14,fontFamily:"Nunito,sans-serif"}}>{msg}</div>
  </div>
);

export default function App() {
  const forceSetup = typeof window!=="undefined" && new URLSearchParams(window.location.search).has("setup");
  const [cfg,setCfg]=useState(()=>{
    if(forceSetup) return null;
    // Um URL configurado em ?setup só vale enquanto API_URL no código não mudar
    const saved=stGet("condo_cfg");
    if(saved?.apiUrl && saved.base===API_URL) return saved;
    return API_URL?{apiUrl:API_URL}:null;
  });
  const [view,setView]=useState("public");
  const [sessao,setSessao]=useState(()=>sessGet());
  const [gData,setGData]=useState(null);
  const [gLoading,setGLoading]=useState(false);

  const saveCfg = (newCfg)=>{
    if(newCfg) stSet("condo_cfg",{...newCfg,base:API_URL}); else { try{localStorage.removeItem("condo_cfg");}catch(_){} }
    setCfg(newCfg);
    if(forceSetup) window.history.replaceState({},"",window.location.pathname);
  };

  const {data,loading,error,reload} = usePublicData(cfg?.apiUrl||"");

  const terminarSessao = ()=>{ sessSet(null); setSessao(null); setGData(null); setView("public"); };
  const sessaoExpirada = ()=>{ sessSet(null); setSessao(null); setGData(null); setView("login"); };

  const loadGestor = useCallback(async(token)=>{
    if(!cfg?.apiUrl||!token) return;
    setGLoading(true);
    try { const d=await apiPost(cfg.apiUrl,"get_data",{},token); setGData(d); }
    catch(e){
      if(e.code==="AUTH") sessaoExpirada();
      else { window.alert("Erro ao carregar dados do gestor: "+e.message); if(!gData) setView("public"); }
    }
    setGLoading(false);
  },[cfg?.apiUrl]); // eslint-disable-line

  const entrar = (s)=>{ sessSet(s); setSessao(s); setView("gestor"); loadGestor(s.token); };
  const abrirGestor = ()=>{
    const s=sessGet();
    if(s){ setSessao(s); setView("gestor"); if(!gData) loadGestor(s.token); }
    else setView("login");
  };
  const recarregarTudo = ()=>{ if(sessao) loadGestor(sessao.token); reload(); };

  if(!cfg?.apiUrl) return <><Fonts/><G/><SetupScreen onSave={saveCfg}/></>;
  if(loading&&!data) return <><Fonts/><G/><Loading msg="A carregar dados do Google Sheets…"/></>;
  if(error&&!data) return <><Fonts/><G/><div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#F5F3EF",padding:24,gap:16}}><div style={{fontSize:40}}>⚠️</div><div style={{fontFamily:"'Lora',serif",fontSize:22,color:"#B5341A"}}>Erro de ligação</div><div style={{color:"#8A8278",fontSize:14,maxWidth:400,textAlign:"center"}}>{error}</div><button className="btn btn-red" style={{fontFamily:"Nunito,sans-serif"}} onClick={reload}>↻ Tentar novamente</button><button className="btn btn-ghost" style={{fontFamily:"Nunito,sans-serif"}} onClick={()=>saveCfg(null)}>⚙️ Reconfigurar</button></div></>;
  if(!data) return null;

  return (
    <><Fonts/><G/>
    {view==="public" &&<PublicView appData={data} offline={!!error} onGestor={abrirGestor}/>}
    {view==="login"  &&<GestorLogin apiUrl={cfg.apiUrl} onLogin={entrar} onBack={()=>setView("public")}/>}
    {view==="gestor" &&(gData
      ? <GestorDashboard appData={gData} apiUrl={cfg.apiUrl} token={sessao?.token} onBack={()=>setView("public")} onLogout={terminarSessao} onExpired={sessaoExpirada} onReload={recarregarTudo} loading={gLoading}/>
      : <Loading msg="A carregar dados do gestor…"/>)}
    </>
  );
}
