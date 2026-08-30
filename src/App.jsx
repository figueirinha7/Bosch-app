import { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

/* ════════════════════════════════════════════════════════════════
   ⚙️  CONFIGURAÇÃO — altere estas duas linhas antes do deploy
════════════════════════════════════════════════════════════════ */
const API_URL    = "https://script.google.com/macros/s/AKfycbzEzULjCGbEOiCZ7wBZGsDkyphY7cKtxQtNJFIRNF1HH15CzdSX6pC9yxufQdGmu6XFtw/exec";
const API_SECRET = "12345678";

/* ── FONTS ── */
const Fonts = () => <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Nunito:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />;

/* ── CONSTANTS ── */
const MESES   = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_S = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const CATS    = ["Utilities","Limpeza","Manutenção","Seguros","Administração","Obras","Outros"];
const AVISO_TIPOS = ["Aviso","Notificação","Acta de Reunião","Comunicado"];
const today   = () => new Date().toISOString().slice(0,10);

/* ── FORMAT ── */
const fmtKz   = (v) => Math.round(v||0).toLocaleString("pt-PT") + "\u00a0Kz";
const fmtDate = (d) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-PT",{day:"2-digit",month:"short",year:"numeric"}) : "";
const pad2    = (n) => String(n).padStart(2,"0");

/* ── STORAGE ── */
const inClaude = typeof window !== "undefined" && typeof window.storage?.get === "function";
async function stGet(key) {
  try {
    if (inClaude) { const r = await window.storage.get(key); return r?.value ? JSON.parse(r.value) : null; }
    const v = localStorage.getItem(key); return v ? JSON.parse(v) : null;
  } catch(_) { return null; }
}
async function stSet(key, val) {
  try {
    const s = JSON.stringify(val);
    if (inClaude) await window.storage.set(key, s); else localStorage.setItem(key, s);
  } catch(_) {}
}

/* ── API ── */
async function apiGet(apiUrl) {
  const r = await fetch(apiUrl, { redirect:"follow" });
  if (!r.ok) throw new Error("HTTP "+r.status);
  return r.json();
}
async function apiPost(apiUrl, secret, action, data) {
  const r = await fetch(apiUrl, { method:"POST", redirect:"follow", headers:{"Content-Type":"text/plain"}, body:JSON.stringify({secret,action,data}) });
  if (!r.ok) throw new Error("HTTP "+r.status);
  return r.json();
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

/* ═══════════════════════════════════════════════════════════════
   SETUP SCREEN
═══════════════════════════════════════════════════════════════ */
function SetupScreen({onSave}) {
  const [url,setUrl]=useState(""); const [secret,setSecret]=useState("cond_segredo_2025");
  const [testing,setTest]=useState(false); const [result,setResult]=useState(null);
  const test = async()=>{ if(!url)return; setTest(true); setResult(null);
    try{ const d=await apiGet(url); setResult(d.ok?{ok:true,msg:`✅ Ligação com sucesso! Prédio: "${d.config?.predio}"`}:{ok:false,msg:"❌ "+d.error}); }
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
            <FG label="URL do Google Apps Script"><input className="input" type="url" value={url} placeholder="https://script.google.com/macros/s/.../exec" onChange={e=>setUrl(e.target.value)}/></FG>
            <FG label="Chave Secreta API" hint="Deve coincidir com API_SECRET no Code.gs"><input className="input" value={secret} onChange={e=>setSecret(e.target.value)}/></FG>
            {result && <div style={{background:result.ok?"#EBF7F1":"#FAF0EE",border:`1px solid ${result.ok?"#A8DFC6":"#F5C9BF"}`,borderRadius:8,padding:"10px 14px",fontSize:13,color:result.ok?"#1E7A4A":"#B5341A"}}>{result.msg}</div>}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button className="btn btn-outline" onClick={test} disabled={!url||testing}>{testing?<span className="spinner"/>:"🧪 Testar"}</button>
              <button className="btn btn-red" onClick={()=>onSave({apiUrl:url,apiSecret:secret})} disabled={!url}>Guardar e continuar →</button>
            </div>
          </div>
        </div>
        <div className="card" style={{background:"#FEF4E8",border:"1px solid #F7D9A8"}}>
          <div style={{fontWeight:700,color:"#C96B15",marginBottom:8}}>📌 Como obter o URL</div>
          <ol style={{paddingLeft:18,fontSize:13,color:"#8A8278",lineHeight:2}}>
            <li>Google Sheets → <b>Extensões → Apps Script</b></li>
            <li>Cole o conteúdo do <b>Code.gs</b> e altere <b>API_SECRET</b></li>
            <li><b>Implementar → Nova implementação → Aplicação Web</b></li>
            <li>Acesso: <b>Qualquer pessoa</b> → copie o URL</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DATA HOOK
═══════════════════════════════════════════════════════════════ */
function useAppData(apiUrl) {
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null); const [lastSync,setLastSync]=useState(null);
  const load = useCallback(async(force=false)=>{
    setLoading(true); setError(null);
    try {
      if(!force){ const c=await stGet("condo_cache"); if(c){setData(c);setLoading(false);} }
      const fresh=await apiGet(apiUrl);
      if(!fresh.ok) throw new Error(fresh.error||"Erro na API");
      const norm={...fresh}; setData(norm); setLastSync(new Date());
      await stSet("condo_cache",norm);
    } catch(e) {
      setError(e.message);
      const c=await stGet("condo_cache"); if(c&&!data)setData(c);
    }
    setLoading(false);
  },[apiUrl]);
  useEffect(()=>{load();},[load]);
  return {data,loading,error,reload:()=>load(true),lastSync};
}

/* ═══════════════════════════════════════════════════════════════
   AVISO CARD (public)
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
   PUBLIC VIEW
═══════════════════════════════════════════════════════════════ */
function PublicView({appData, onGestor}) {
  const [tab,setTab]=useState("quotas");
  const { config, fracoes, pagamentosQuota, contribuicoes, pagamentosContribuicao, avisos=[] } = appData;
  const { predio, endereco, quotaMensal, anoBase, mesBase } = config;
  const url = typeof window!=="undefined"?window.location.href:"";

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
  const shareWA = ()=>{ const msg=`🏢 *${predio}*\n📋 Consulte o estado do condomínio:\n${url}`; window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank"); };

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
              <span style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>Actualizado {new Date().toLocaleDateString("pt-PT",{day:"2-digit",month:"short",year:"numeric"})}</span>
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
                      <div style={{fontWeight:600,fontSize:14,marginBottom:1}}>{f.prop_nome||f.proprietario}</div>
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
                        <span style={{fontSize:12,color:"#1E7A4A"}}>{(f.prop_nome||f.proprietario).split(" ")[0]} ✓</span>
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
                                <div><div style={{fontSize:13}}>{f.prop_nome||f.proprietario}</div>
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
                                <div><div style={{fontSize:13}}>{f.prop_nome||f.proprietario}</div>
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
          Portal do Condomínio · {predio}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GESTOR LOGIN
═══════════════════════════════════════════════════════════════ */
function GestorLogin({pwd,onLogin,onBack}) {
  const [v,setV]=useState(""); const [err,setErr]=useState(false);
  const go=()=>{ if(v===pwd){onLogin();}else{setErr(true);setV("");setTimeout(()=>setErr(false),2000);}};
  return (
    <div style={{minHeight:"100vh",background:"#F5F3EF",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:360}}>
        <button onClick={onBack} className="btn btn-ghost btn-sm" style={{marginBottom:24}}>← Voltar</button>
        <div className="card anim" style={{border:`1.5px solid ${err?"#B5341A":"#E2DDD6"}`}}>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontSize:38,marginBottom:12}}>🔐</div>
            <div className="serif" style={{fontSize:24,fontWeight:700}}>Área de Gestores</div>
          </div>
          {err&&<div style={{background:"#FAF0EE",borderRadius:8,padding:"9px 14px",color:"#B5341A",fontSize:13,marginBottom:16,textAlign:"center"}}>Palavra-passe incorrecta</div>}
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <FG label="Palavra-passe"><input className="input" type="password" value={v} placeholder="••••••••" onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} autoFocus/></FG>
            <button className="btn btn-red" style={{justifyContent:"center"}} onClick={go}>Entrar</button>
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
  const qi = quotaInfo(fracao.id, pagamentosQuota, quotaMensal, anoBase, mesBase);
  const contribs = contribuicoes.map(c=>({...c,...contribInfo(c,fracao.id,pagamentosContribuicao)})).filter(c=>c.divida>0);
  const totalDivida = qi.divida + contribs.reduce((s,c)=>s+c.divida,0);
  return (
    <Modal title={`Apt. ${fracao.numero} — Detalhe da Dívida`} onClose={onClose} lg>
      <div style={{marginBottom:16,display:"flex",gap:10,flexWrap:"wrap"}}>
        <div style={{flex:1,background:"#FAF0EE",borderRadius:10,padding:"12px 16px"}}>
          <div style={{fontSize:10,color:"#8A8278",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Proprietário</div>
          <div style={{fontWeight:700}}>{fracao.prop_nome||fracao.proprietario}</div>
          <div style={{fontSize:12,color:"#8A8278"}}>{fracao.prop_telefone||fracao.telefone}</div>
        </div>
        <div style={{flex:1,background:"#FAF0EE",borderRadius:10,padding:"12px 16px"}}>
          <div style={{fontSize:10,color:"#8A8278",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Dívida Total</div>
          <div className="mono" style={{fontSize:22,fontWeight:700,color:"#B5341A"}}>{fmtKz(totalDivida)}</div>
        </div>
      </div>

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
function GestorDashboard({appData, apiUrl, apiSecret, onBack, onReload, loading}) {
  const [tab,setTab]=useState("dashboard");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState(null);
  const [relMes,setRelMes]=useState(new Date().getMonth()+1);
  const [relAno,setRelAno]=useState(new Date().getFullYear());
  const [relTipo,setRelTipo]=useState("mensal");
  const [drillApt,setDrillApt]=useState(null);

  const { config, fracoes, pagamentosQuota, contribuicoes, pagamentosContribuicao, despesas, avisos=[] } = appData;
  const { quotaMensal, anoBase, mesBase } = config;

  const sf = k=>v=>setForm(p=>({...p,[k]:v}));
  const om = (type,d={})=>{ setModal(type); setForm({data:today(),...d}); };
  const cm = ()=>{ setModal(null); setForm({}); };

  const post = async(action,data)=>{
    setSaving(true); setSaveMsg(null);
    try {
      const res=await apiPost(apiUrl,apiSecret,action,data);
      if(!res.ok) throw new Error(res.error||"Erro");
      setSaveMsg({ok:true,msg:"✅ Guardado no Google Sheets"});
      setTimeout(()=>{setSaveMsg(null);onReload();},1800); cm();
    } catch(e){ setSaveMsg({ok:false,msg:"❌ "+e.message}); }
    setSaving(false);
  };

  /* stats */
  const totalRec  = pagamentosQuota.reduce((s,p)=>s+p.valor,0)+pagamentosContribuicao.reduce((s,p)=>s+p.valor,0);
  const totalDesp = despesas.reduce((s,d)=>s+d.valor,0);
  const saldo     = totalRec-totalDesp;
  const totalDivida = useMemo(()=>
    fracoes.filter(f=>!f.excluiQuota).reduce((s,f)=>s+quotaInfo(f.id,pagamentosQuota,quotaMensal,anoBase,mesBase).divida,0)+
    fracoes.reduce((s,f)=>s+contribuicoes.reduce((ss,c)=>ss+contribInfo(c,f.id,pagamentosContribuicao).divida,0),0),
    [fracoes,pagamentosQuota,contribuicoes,pagamentosContribuicao,quotaMensal,anoBase,mesBase]);

  /* chart — inclui ano no label */
  const evolucao = useMemo(()=>{
    const map={};
    pagamentosQuota.forEach(p=>{ const k=`${p.ano}-${pad2(p.mes)}`; if(!map[k])map[k]={label:`${MESES_S[p.mes-1]} '${String(p.ano).slice(2)}`,ano:p.ano,Receitas:0,Despesas:0,Saldo:0}; map[k].Receitas+=p.valor; });
    despesas.forEach(d=>{ const k=d.data?.slice(0,7)||""; if(!map[k])map[k]={label:k,ano:parseInt(k),Receitas:0,Despesas:0,Saldo:0}; map[k].Despesas+=d.valor; });
    return Object.entries(map).sort().map(([,v])=>({...v,Saldo:v.Receitas-v.Despesas}));
  },[pagamentosQuota,despesas]);

  const TT=({active,payload,label})=>{
    if(!active||!payload?.length)return null;
    const entry=evolucao.find(e=>e.label===label)||{};
    return <div style={{background:"#fff",border:"1px solid #E2DDD6",borderRadius:8,padding:"10px 14px"}}>
      <div style={{fontSize:12,color:"#8A8278",marginBottom:6}}>{label}{entry.ano?` (${entry.ano})`:""}</div>
      {payload.map((p,i)=><div key={i} className="mono" style={{fontSize:13,color:p.color}}>{p.name}: {fmtKz(p.value)}</div>)}
    </div>;
  };

  const TABS=[["dashboard","📊 Dashboard"],["fracoes","🏠 Apartamentos"],["quotas","💳 Quotas"],["contribuicoes","📋 Contribuições"],["despesas","🧾 Despesas"],["avisos","📢 Avisos"]];
  const anos = [...new Set([...pagamentosQuota.map(p=>p.ano),...despesas.map(d=>parseInt(d.data?.slice(0,4)||"0")).filter(Boolean),new Date().getFullYear()])].sort();

  return (
    <div style={{minHeight:"100vh",background:"#F5F3EF"}}>
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
              <button onClick={()=>{const u=window.location.href;const msg=`🏢 *${config.predio}*\n📋 Consulte o estado do condomínio:\n${u}`;window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");}} className="wa-btn" style={{padding:"6px 10px",fontSize:12}}><WaSvg s={13}/>Partilhar</button>
              <button className="btn btn-ghost btn-sm" title="Reconfigurar" onClick={()=>{if(window.confirm("Reconfigurar URL e chave da API?"))window.location.href=window.location.pathname+"?setup";}}>⚙️</button>
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
        {saveMsg&&<div className={`status-bar ${saveMsg.ok?"status-ok":"status-err"}`}>{saveMsg.msg}</div>}

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
            <div style={{fontWeight:700,marginBottom:16}}>Receitas vs Despesas</div>
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
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <span className="section-hd">Apartamentos</span>
            <button className="btn btn-red" onClick={()=>om("fracao")}>+ Novo Apartamento</button>
          </div>
          <div className="card">
            <table><thead><tr><th>Nº</th><th>Proprietário</th><th>Inquilino</th><th>Quota</th><th>Dívida Total</th><th>Estado</th><th></th></tr></thead>
            <tbody>{fracoes.map(f=>{
              const qi=quotaInfo(f.id,pagamentosQuota,quotaMensal,anoBase,mesBase);
              const divContrib=contribuicoes.reduce((s,c)=>s+contribInfo(c,f.id,pagamentosContribuicao).divida,0);
              const divTotal=qi.divida+divContrib;
              return <tr key={f.id}>
                <td><span className="serif" style={{fontWeight:700,color:"#B5341A"}}>{f.numero}</span>{f.excluiQuota&&<span className="tag tag-grey" style={{marginLeft:6,fontSize:9}}>Excl.</span>}</td>
                <td><div style={{fontWeight:600}}>{f.prop_nome||f.proprietario}</div><div style={{fontSize:11,color:"#8A8278"}}>{f.prop_telefone||f.telefone}</div></td>
                <td>{f.inq_nome?<><div style={{fontSize:13}}>{f.inq_nome}</div><span className="tag tag-teal" style={{fontSize:10}}>Inquilino</span></>:<span style={{color:"#C5C0B8",fontSize:12}}>—</span>}</td>
                <td>{f.excluiQuota?<span className="tag tag-grey">Excluído</span>:<span className="mono" style={{color:qi.divida>0?"#B5341A":"#1E7A4A",fontSize:12}}>{qi.mesesAtraso>0?`${qi.mesesAtraso}m atraso`:"Em dia"}</span>}</td>
                <td><span className="mono" style={{color:divTotal>0?"#B5341A":"#1E7A4A",fontWeight:700,fontSize:13}}>{fmtKz(divTotal)}</span></td>
                <td><span className={`tag ${divTotal>0?"tag-red":"tag-green"}`}>{divTotal>0?"Em dívida":"OK"}</span></td>
                <td>
                  <div style={{display:"flex",gap:4}}>
                    <button className="btn btn-outline btn-sm" onClick={()=>setDrillApt(f)} title="Ver detalhe">🔍</button>
                    <button className="btn btn-outline btn-sm" onClick={()=>om("editFracao",{
                      _row:f._row,numero:f.numero,andar:f.andar||"",
                      prop_nome:f.prop_nome||f.proprietario,prop_telefone:f.prop_telefone||f.telefone,prop_email:f.prop_email||"",
                      inq_nome:f.inq_nome||"",inq_telefone:f.inq_telefone||"",
                      excluiQuota:f.excluiQuota?"true":"false",
                    })} title="Editar">✏️</button>
                  </div>
                </td>
              </tr>;
            })}</tbody></table>
          </div>
        </>}

        {/* ── QUOTAS ── */}
        {tab==="quotas"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
            <span className="section-hd">Pagamentos de Quotas</span>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-outline" onClick={()=>om("isentarMes")}>🚫 Isentar Mês</button>
              <button className="btn btn-red" onClick={()=>om("pagQuota")}>+ Registar</button>
            </div>
          </div>
          <div className="card">
            <table><thead><tr><th>Data</th><th>Apt.</th><th>Proprietário</th><th>Mês</th><th>Valor</th><th>Método</th></tr></thead>
            <tbody>{[...pagamentosQuota].sort((a,b)=>(b.data||"").localeCompare(a.data||"")).map(p=>{
              const f=fracoes.find(x=>x.id===p.fracaoId);
              return <tr key={p.id}>
                <td style={{color:"#8A8278",fontSize:12}}>{fmtDate(p.data)}</td>
                <td><span className="serif" style={{fontWeight:700,color:"#B5341A"}}>{f?.numero||"?"}</span></td>
                <td>{f?.prop_nome||f?.proprietario||"?"}</td>
                <td><span className="tag tag-blue">{MESES_S[(p.mes||1)-1]} {p.ano}</span></td>
                <td><span className="mono" style={{color:"#1E7A4A",fontWeight:700}}>{fmtKz(p.valor)}</span></td>
                <td style={{color:"#8A8278",fontSize:12}}>{p.metodo||"—"}</td>
              </tr>;
            })}</tbody></table>
          </div>
        </>}

        {/* ── CONTRIBUIÇÕES ── */}
        {tab==="contribuicoes"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
            <span className="section-hd">Outras Contribuições</span>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button className="btn btn-outline" onClick={()=>om("pagContrib")}>+ Registar Pgto.</button>
              <button className="btn btn-outline" onClick={()=>om("isentarContrib")} style={{color:"#C96B15",borderColor:"#C96B15"}}>🚫 Isentar Apt.</button>
              <button className="btn btn-blue" onClick={()=>om("pagContribBulk")}>⚡ Lançar para todos</button>
              <button className="btn btn-red" onClick={()=>om("contrib")}>+ Nova Contribuição</button>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {contribuicoes.map(c=>{
              const isLivre=!c.valorPorFracao&&!c.valorTotal;
              const meta=c.valorTotal||(c.valorPorFracao*fracoes.filter(f=>!(c.excluidos||[]).includes(f.id)).length);
              const totalCob=pagamentosContribuicao.filter(p=>p.contribuicaoId===c.id).reduce((s,p)=>s+p.valor,0);
              const pcs=pagamentosContribuicao.filter(p=>p.contribuicaoId===c.id);
              return <div key={c.id} className="card">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:15}}>{c.titulo}</div>
                    <div style={{fontSize:12,color:"#8A8278",marginTop:3}}>{c.descricao}</div>
                    {c.dataVencimento&&<div style={{fontSize:11,color:"#8A8278",marginTop:3}}>Prazo: {fmtDate(c.dataVencimento)}</div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    {isLivre?(
                      <><span className="tag tag-teal">Arrecadação livre</span><div className="mono" style={{fontWeight:700,fontSize:14,marginTop:6,color:"#1E7A4A"}}>{fmtKz(totalCob)} recebido</div></>
                    ):(
                      <><div className="mono" style={{fontWeight:700,fontSize:14,color:"#B5341A"}}>{fmtKz(totalCob)}<span style={{color:"#8A8278",fontWeight:400}}> / {fmtKz(meta)}</span></div>
                      {c.valorPorFracao>0&&<div style={{fontSize:11,color:"#8A8278"}}>{fmtKz(c.valorPorFracao)}/apt.</div>}</>
                    )}
                  </div>
                </div>
                {pcs.length>0&&<table style={{marginTop:8}}><thead><tr><th>Data</th><th>Apt.</th><th>Proprietário</th><th>Valor</th></tr></thead>
                <tbody>{pcs.map(p=>{const f=fracoes.find(x=>x.id===p.fracaoId);return<tr key={p.id}>
                  <td style={{fontSize:12,color:"#8A8278"}}>{fmtDate(p.data)}</td>
                  <td><span className="serif" style={{fontWeight:700,color:"#B5341A"}}>{f?.numero}</span></td>
                  <td>{f?.prop_nome||f?.proprietario}</td>
                  <td><span className="mono" style={{color:"#1E7A4A",fontWeight:700}}>{fmtKz(p.valor)}</span></td>
                </tr>;})}
                </tbody></table>}
              </div>;
            })}
          </div>
        </>}

        {/* ── DESPESAS ── */}
        {tab==="despesas"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <span className="section-hd">Despesas</span>
            <button className="btn btn-red" onClick={()=>om("despesa")}>+ Registar</button>
          </div>
          <div className="card">
            <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th className="hide-sm">Fornecedor</th><th className="hide-sm">Obs.</th></tr></thead>
            <tbody>{[...despesas].sort((a,b)=>(b.data||"").localeCompare(a.data||"")).map(d=>(
              <tr key={d.id}>
                <td style={{color:"#8A8278",fontSize:12}}>{fmtDate(d.data)}</td>
                <td>{d.descricao}</td>
                <td><span className="tag tag-amber">{d.categoria}</span></td>
                <td><span className="mono" style={{color:"#B5341A",fontWeight:700}}>{fmtKz(d.valor)}</span></td>
                <td className="hide-sm" style={{color:"#8A8278",fontSize:12}}>{d.fornecedor||"—"}</td>
                <td className="hide-sm" style={{color:"#8A8278",fontSize:12,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.observacoes||"—"}</td>
              </tr>
            ))}</tbody></table>
          </div>
        </>}

        {/* ── AVISOS ── */}
        {tab==="avisos"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <span className="section-hd">Avisos, Notificações e Actas</span>
            <button className="btn btn-red" onClick={()=>om("aviso")}>+ Publicar</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[...avisos].sort((a,b)=>(b.data||"").localeCompare(a.data||"")).map(a=>(
              <div key={a.id} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{flex:1}}><AvisoCard a={a}/></div>
              </div>
            ))}
            {avisos.length===0&&<div className="card" style={{textAlign:"center",padding:"36px",color:"#8A8278"}}>Nenhum aviso publicado ainda.</div>}
          </div>
        </>}
      </div>

      {/* ── DRILL DOWN MODAL ── */}
      {drillApt&&<DrillModal fracao={drillApt} appData={appData} onClose={()=>setDrillApt(null)}/>}

      {/* ── NOVO APARTAMENTO ── */}
      {modal==="fracao"&&<Modal title="Novo Apartamento" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Número *"><input className="input" placeholder="101" value={form.numero||""} onChange={e=>sf("numero")(e.target.value)}/></FG>
            <FG label="Andar"><input className="input" placeholder="1º Dto" value={form.andar||""} onChange={e=>sf("andar")(e.target.value)}/></FG>
          </div>
          <div style={{fontWeight:700,fontSize:13,color:"#1A4F8B"}}>👤 Proprietário</div>
          <FG label="Nome *"><input className="input" value={form.prop_nome||""} onChange={e=>sf("prop_nome")(e.target.value)}/></FG>
          <FG label="Telefone *"><input className="input" placeholder="+244 9XX XXX XXX" value={form.prop_telefone||""} onChange={e=>sf("prop_telefone")(e.target.value)}/></FG>
          <div className="divider"/>
          <div style={{fontWeight:700,fontSize:13,color:"#1E7A4A"}}>🏠 Inquilino <span style={{fontWeight:400,color:"#8A8278"}}>(opcional)</span></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Nome"><input className="input" value={form.inq_nome||""} onChange={e=>sf("inq_nome")(e.target.value)}/></FG>
            <FG label="Telefone"><input className="input" value={form.inq_telefone||""} onChange={e=>sf("inq_telefone")(e.target.value)}/></FG>
          </div>
          <CheckRow label="Excluir das quotas mensais (acordo especial com gestão)" checked={form.excluiQuota==="true"} onChange={v=>sf("excluiQuota")(v?"true":"false")}/>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
            <button className="btn btn-outline" onClick={cm}>Cancelar</button>
            <button className="btn btn-red" disabled={saving} onClick={()=>post("add_fracao",{numero:form.numero,andar:form.andar||"",prop_nome:form.prop_nome,prop_telefone:form.prop_telefone,inq_nome:form.inq_nome||"",inq_telefone:form.inq_telefone||"",exclui_quota:form.excluiQuota==="true"?"Sim":"Não"})}>
              {saving?<span className="spinner"/>:"Criar"}
            </button>
          </div>
        </div>
      </Modal>}

      {/* ── EDITAR APARTAMENTO ── */}
      {modal==="editFracao"&&<Modal title={`Editar Apt. ${form.numero}`} onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Número"><input className="input" value={form.numero||""} onChange={e=>sf("numero")(e.target.value)}/></FG>
            <FG label="Andar"><input className="input" value={form.andar||""} onChange={e=>sf("andar")(e.target.value)}/></FG>
          </div>
          <div style={{fontWeight:700,fontSize:13,color:"#1A4F8B"}}>👤 Proprietário</div>
          <FG label="Nome *"><input className="input" value={form.prop_nome||""} onChange={e=>sf("prop_nome")(e.target.value)}/></FG>
          <FG label="Telefone"><input className="input" value={form.prop_telefone||""} onChange={e=>sf("prop_telefone")(e.target.value)}/></FG>
          <div className="divider"/>
          <div style={{fontWeight:700,fontSize:13,color:"#1E7A4A"}}>🏠 Inquilino</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Nome"><input className="input" value={form.inq_nome||""} onChange={e=>sf("inq_nome")(e.target.value)}/></FG>
            <FG label="Telefone"><input className="input" value={form.inq_telefone||""} onChange={e=>sf("inq_telefone")(e.target.value)}/></FG>
          </div>
          <CheckRow label="Excluir das quotas mensais" checked={form.excluiQuota==="true"} onChange={v=>sf("excluiQuota")(v?"true":"false")}/>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
            <button className="btn btn-outline" onClick={cm}>Cancelar</button>
            <button className="btn btn-red" disabled={saving} onClick={()=>post("edit_fracao",{_row:form._row,numero:form.numero,andar:form.andar||"",prop_nome:form.prop_nome,prop_telefone:form.prop_telefone||"",inq_nome:form.inq_nome||"",inq_telefone:form.inq_telefone||"",exclui_quota:form.excluiQuota==="true"?"Sim":"Não"})}>
              {saving?<span className="spinner"/>:"Guardar"}
            </button>
          </div>
        </div>
      </Modal>}

      {/* ── REGISTAR QUOTA ── */}
      {modal==="pagQuota"&&<Modal title="Registar Pagamento de Quota" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <FG label="Apartamento"><select className="input" value={form.fracaoNum||""} onChange={e=>sf("fracaoNum")(e.target.value)}>
            <option value="">Seleccione...</option>{fracoes.map(f=><option key={f.id} value={f.numero}>{f.numero} — {f.prop_nome||f.proprietario}</option>)}
          </select></FG>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Mês"><select className="input" value={form.mes||new Date().getMonth()+1} onChange={e=>sf("mes")(e.target.value)}>{MESES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select></FG>
            <FG label="Ano"><select className="input" value={form.ano||new Date().getFullYear()} onChange={e=>sf("ano")(e.target.value)}>{anos.map(y=><option key={y} value={y}>{y}</option>)}</select></FG>
          </div>
          <FG label="Data"><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
          <FG label="Valor (Kz)"><input className="input" type="number" placeholder={quotaMensal} value={form.valor||""} onChange={e=>sf("valor")(e.target.value)}/></FG>
          <FG label="Método"><select className="input" value={form.metodo||""} onChange={e=>sf("metodo")(e.target.value)}><option value="">—</option>{["Transferência","Numerário","Cheque","TPA","Outro"].map(m=><option key={m}>{m}</option>)}</select></FG>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button className="btn btn-outline" onClick={cm}>Cancelar</button>
            <button className="btn btn-red" disabled={saving} onClick={()=>post("add_pagamento_quota",{fracao_numero:form.fracaoNum,data:form.data,valor:+form.valor||quotaMensal,mes:+form.mes,ano:+form.ano,metodo:form.metodo||""})}>
              {saving?<span className="spinner"/>:"Registar"}
            </button>
          </div>
        </div>
      </Modal>}

      {/* ── ISENTAR INTERVALO DE QUOTAS ── */}
      {modal==="isentarMes"&&<Modal title="🚫 Isentar Meses de Quota" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:"#EBF1FA",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#1A4F8B"}}>
            Os meses seleccionados ficam isentos — o apartamento não aparecerá como devedor nesses períodos.<br/>
            Pode definir um único mês ou um intervalo (ex: apartamento abandonado durante anos).
          </div>
          <FG label="Apartamento"><select className="input" value={form.fracaoNum||""} onChange={e=>sf("fracaoNum")(e.target.value)}>
            <option value="">Seleccione...</option>{fracoes.map(f=><option key={f.id} value={f.numero}>{f.numero} — {f.prop_nome||f.proprietario}</option>)}
          </select></FG>
          <div style={{fontWeight:600,fontSize:12,color:"#8A8278",textTransform:"uppercase",letterSpacing:.5}}>Início do período</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Mês início"><select className="input" value={form.mesIni||1} onChange={e=>sf("mesIni")(+e.target.value)}>{MESES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select></FG>
            <FG label="Ano início"><select className="input" value={form.anoIni||new Date().getFullYear()} onChange={e=>sf("anoIni")(+e.target.value)}>{anos.map(y=><option key={y} value={y}>{y}</option>)}</select></FG>
          </div>
          <div style={{fontWeight:600,fontSize:12,color:"#8A8278",textTransform:"uppercase",letterSpacing:.5}}>Fim do período <span style={{fontWeight:400,textTransform:"none"}}>(igual ao início = apenas 1 mês)</span></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Mês fim"><select className="input" value={form.mesFim||form.mesIni||1} onChange={e=>sf("mesFim")(+e.target.value)}>{MESES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select></FG>
            <FG label="Ano fim"><select className="input" value={form.anoFim||form.anoIni||new Date().getFullYear()} onChange={e=>sf("anoFim")(+e.target.value)}>{anos.map(y=><option key={y} value={y}>{y}</option>)}</select></FG>
          </div>
          {(()=>{
            const mi=+form.mesIni||1, ai=+form.anoIni||new Date().getFullYear();
            const mf=+form.mesFim||mi, af=+form.anoFim||ai;
            let count=0, y=ai, m=mi;
            while(y<af||(y===af&&m<=mf)){count++;m++;if(m>12){m=1;y++;}}
            return <div style={{background:"#F5F3EF",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#8A8278"}}>
              Total: <b style={{color:"#1C1A16"}}>{count} {count===1?"mês":"meses"} isentos</b>
            </div>;
          })()}
          <FG label="Motivo (opcional)"><input className="input" placeholder="Ex: Apartamento abandonado" value={form.motivo||""} onChange={e=>sf("motivo")(e.target.value)}/></FG>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button className="btn btn-outline" onClick={cm}>Cancelar</button>
            <button className="btn btn-red" disabled={saving||!form.fracaoNum} onClick={()=>{
              const mi=+form.mesIni||1, ai=+form.anoIni||new Date().getFullYear();
              const mf=+form.mesFim||mi, af=+form.anoFim||ai;
              const meses=[]; let y=ai, m=mi;
              while(y<af||(y===af&&m<=mf)){meses.push({mes:m,ano:y});m++;if(m>12){m=1;y++;}}
              post("add_isencoes_quota",{fracao_numero:form.fracaoNum,meses,motivo:form.motivo||""});
            }}>
              {saving?<span className="spinner"/>:"Aplicar Isenções"}
            </button>
          </div>
        </div>
      </Modal>}

      {/* ── ISENTAR APARTAMENTO DE CONTRIBUIÇÃO ── */}
      {modal==="isentarContrib"&&<Modal title="🚫 Isentar Apartamento de Contribuição" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:"#FEF4E8",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#C96B15"}}>
            O apartamento ficará isento desta contribuição — não aparecerá como devedor na página pública.
          </div>
          <FG label="Contribuição"><select className="input" value={form.contribTitulo||""} onChange={e=>sf("contribTitulo")(e.target.value)}>
            <option value="">Seleccione...</option>{contribuicoes.map(c=><option key={c.id} value={c.titulo}>{c.titulo}</option>)}
          </select></FG>
          <FG label="Apartamento"><select className="input" value={form.fracaoNum||""} onChange={e=>sf("fracaoNum")(e.target.value)}>
            <option value="">Seleccione...</option>{fracoes.map(f=><option key={f.id} value={f.numero}>{f.numero} — {f.prop_nome||f.proprietario}</option>)}
          </select></FG>
          <FG label="Motivo (opcional)"><input className="input" placeholder="Ex: Acordo prévio com gestão" value={form.motivo||""} onChange={e=>sf("motivo")(e.target.value)}/></FG>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button className="btn btn-outline" onClick={cm}>Cancelar</button>
            <button className="btn btn-red" disabled={saving||!form.contribTitulo||!form.fracaoNum}
              onClick={()=>post("add_pagamento_contribuicao",{contribuicao_titulo:form.contribTitulo,fracao_numero:form.fracaoNum,data:form.data||today(),valor:0,metodo:"Isento",referencia:form.motivo||""})}>
              {saving?<span className="spinner"/>:"Aplicar Isenção"}
            </button>
          </div>
        </div>
      </Modal>}

      {/* ── NOVA CONTRIBUIÇÃO ── */}
      {modal==="contrib"&&<Modal title="Nova Contribuição" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <FG label="Título"><input className="input" value={form.titulo||""} onChange={e=>sf("titulo")(e.target.value)}/></FG>
          <FG label="Descrição"><input className="input" value={form.descricao||""} onChange={e=>sf("descricao")(e.target.value)}/></FG>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Valor por apt. (Kz)" hint="0 = sem valor fixo por apt."><input className="input" type="number" min="0" value={form.valorPorFracao||""} onChange={e=>sf("valorPorFracao")(e.target.value)}/></FG>
            <FG label="Valor Total (Kz)" hint="0 = sem limite total"><input className="input" type="number" min="0" value={form.valorTotal||""} onChange={e=>sf("valorTotal")(e.target.value)}/></FG>
          </div>
          <FG label="Data Limite (opcional)"><input className="input" type="date" value={form.dataVencimento||""} onChange={e=>sf("dataVencimento")(e.target.value)}/></FG>
          <FG label="Apartamentos EXCLUÍDOS desta contribuição" hint="Seleccione os apartamentos que não participam">
            <div style={{maxHeight:160,overflowY:"auto",border:"1.5px solid #E2DDD6",borderRadius:8,padding:8}}>
              {fracoes.map(f=>(
                <CheckRow key={f.id} label={`${f.numero} — ${f.prop_nome||f.proprietario}`}
                  checked={(form.excluidos||[]).includes(f.numero)}
                  onChange={v=>sf("excluidos")(v?[...(form.excluidos||[]),f.numero]:(form.excluidos||[]).filter(n=>n!==f.numero))}/>
              ))}
            </div>
          </FG>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button className="btn btn-outline" onClick={cm}>Cancelar</button>
            <button className="btn btn-red" disabled={saving} onClick={()=>post("add_contribuicao",{titulo:form.titulo,valorPorFracao:+form.valorPorFracao||0,valorTotal:+form.valorTotal||0,dataVencimento:form.dataVencimento||"",descricao:form.descricao||"",excluidos:(form.excluidos||[]).join(",")})}>
              {saving?<span className="spinner"/>:"Criar"}
            </button>
          </div>
        </div>
      </Modal>}

      {/* ── REGISTAR PGTO CONTRIB ── */}
      {modal==="pagContrib"&&<Modal title="Registar Pagamento de Contribuição" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <FG label="Contribuição"><select className="input" value={form.contribTitulo||""} onChange={e=>sf("contribTitulo")(e.target.value)}><option value="">Seleccione...</option>{contribuicoes.map(c=><option key={c.id} value={c.titulo}>{c.titulo}</option>)}</select></FG>
          <FG label="Apartamento"><select className="input" value={form.fracaoNum||""} onChange={e=>{sf("fracaoNum")(e.target.value);const c=contribuicoes.find(x=>x.titulo===form.contribTitulo);if(c?.valorPorFracao)sf("valor")(c.valorPorFracao);}}>
            <option value="">Seleccione...</option>{fracoes.map(f=><option key={f.id} value={f.numero}>{f.numero} — {f.prop_nome||f.proprietario}</option>)}
          </select></FG>
          <FG label="Data"><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
          <FG label="Valor (Kz)"><input className="input" type="number" value={form.valor||""} onChange={e=>sf("valor")(e.target.value)}/></FG>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button className="btn btn-outline" onClick={cm}>Cancelar</button>
            <button className="btn btn-red" disabled={saving} onClick={()=>post("add_pagamento_contribuicao",{contribuicao_titulo:form.contribTitulo,fracao_numero:form.fracaoNum,data:form.data,valor:+form.valor})}>
              {saving?<span className="spinner"/>:"Registar"}
            </button>
          </div>
        </div>
      </Modal>}

      {/* ── LANÇAR PARA TODOS ── */}
      {modal==="pagContribBulk"&&<Modal title="⚡ Lançar Contribuição para Todos" onClose={cm} lg>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:"#EBF1FA",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#1A4F8B"}}>
            ℹ️ Lança um pagamento para cada apartamento seleccionado, com o mesmo valor e data.
          </div>
          <FG label="Contribuição"><select className="input" value={form.contribTitulo||""} onChange={e=>{sf("contribTitulo")(e.target.value);const c=contribuicoes.find(x=>x.titulo===e.target.value);if(c?.valorPorFracao)sf("valor")(c.valorPorFracao);}}>
            <option value="">Seleccione...</option>{contribuicoes.map(c=><option key={c.id} value={c.titulo}>{c.titulo}</option>)}
          </select></FG>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Data"><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
            <FG label="Valor por apt. (Kz)"><input className="input" type="number" value={form.valor||""} onChange={e=>sf("valor")(e.target.value)}/></FG>
          </div>
          <FG label="Apartamentos a lançar">
            <div style={{maxHeight:200,overflowY:"auto",border:"1.5px solid #E2DDD6",borderRadius:8,padding:8}}>
              <CheckRow label="Seleccionar todos" checked={(form.bulkApts||[]).length===fracoes.length} onChange={v=>sf("bulkApts")(v?fracoes.map(f=>f.numero):[])}/>
              <div className="divider"/>
              {fracoes.map(f=>(
                <CheckRow key={f.id} label={`${f.numero} — ${f.prop_nome||f.proprietario}`}
                  checked={(form.bulkApts||[]).includes(f.numero)}
                  onChange={v=>sf("bulkApts")(v?[...(form.bulkApts||[]),f.numero]:(form.bulkApts||[]).filter(n=>n!==f.numero))}/>
              ))}
            </div>
          </FG>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,color:"#8A8278"}}>{(form.bulkApts||[]).length} apartamentos seleccionados</span>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-outline" onClick={cm}>Cancelar</button>
              <button className="btn btn-blue" disabled={saving||!form.contribTitulo||!form.valor||(form.bulkApts||[]).length===0}
                onClick={()=>post("add_pagamento_contribuicao_bulk",{contribuicao_titulo:form.contribTitulo,fracao_numeros:form.bulkApts,data:form.data,valor_por_fracao:+form.valor})}>
                {saving?<span className="spinner"/>:`⚡ Lançar para ${(form.bulkApts||[]).length} apts.`}
              </button>
            </div>
          </div>
        </div>
      </Modal>}

      {/* ── REGISTAR DESPESA ── */}
      {modal==="despesa"&&<Modal title="Registar Despesa" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <FG label="Data"><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
          <FG label="Descrição"><input className="input" placeholder="Ex: Electricidade" value={form.descricao||""} onChange={e=>sf("descricao")(e.target.value)}/></FG>
          <FG label="Categoria"><select className="input" value={form.categoria||""} onChange={e=>sf("categoria")(e.target.value)}><option value="">Seleccione...</option>{CATS.map(c=><option key={c}>{c}</option>)}</select></FG>
          <FG label="Valor (Kz)"><input className="input" type="number" value={form.valor||""} onChange={e=>sf("valor")(e.target.value)}/></FG>
          <FG label="Fornecedor (opcional)"><input className="input" value={form.fornecedor||""} onChange={e=>sf("fornecedor")(e.target.value)}/></FG>
          <FG label="Observações (opcional)"><input className="input" value={form.observacoes||""} onChange={e=>sf("observacoes")(e.target.value)}/></FG>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button className="btn btn-outline" onClick={cm}>Cancelar</button>
            <button className="btn btn-red" disabled={saving} onClick={()=>post("add_despesa",{data:form.data,valor:+form.valor,descricao:form.descricao,categoria:form.categoria,fornecedor:form.fornecedor||"",observacoes:form.observacoes||""})}>
              {saving?<span className="spinner"/>:"Registar"}
            </button>
          </div>
        </div>
      </Modal>}

      {/* ── PUBLICAR AVISO ── */}
      {modal==="aviso"&&<Modal title="Publicar Aviso / Acta" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <FG label="Tipo"><select className="input" value={form.tipo||""} onChange={e=>sf("tipo")(e.target.value)}><option value="">Seleccione...</option>{AVISO_TIPOS.map(t=><option key={t}>{t}</option>)}</select></FG>
          <FG label="Título"><input className="input" value={form.titulo||""} onChange={e=>sf("titulo")(e.target.value)}/></FG>
          <FG label="Conteúdo"><textarea className="input" value={form.conteudo||""} onChange={e=>sf("conteudo")(e.target.value)} rows={5}/></FG>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Data"><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
            <FG label="Autor"><input className="input" value={form.autor||config.gestorNome||""} onChange={e=>sf("autor")(e.target.value)}/></FG>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button className="btn btn-outline" onClick={cm}>Cancelar</button>
            <button className="btn btn-red" disabled={saving} onClick={()=>post("add_aviso",{tipo:form.tipo,titulo:form.titulo,conteudo:form.conteudo||"",data:form.data,autor:form.autor||""})}>
              {saving?<span className="spinner"/>:"Publicar"}
            </button>
          </div>
        </div>
      </Modal>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════ */
export default function App() {
  const forceSetup = typeof window!=="undefined" && new URLSearchParams(window.location.search).has("setup");
  const [cfg,setCfg]=useState(!forceSetup&&API_URL?{apiUrl:API_URL,apiSecret:API_SECRET}:null);
  const [view,setView]=useState("public");
  const [auth,setAuth]=useState(false);

  const saveCfg = async(newCfg)=>{
    await stSet("condo_cfg",newCfg); setCfg(newCfg);
    if(forceSetup) window.history.replaceState({},"",window.location.pathname);
  };

  const {data,loading,error,reload} = useAppData(cfg?.apiUrl||"");

  if(!cfg?.apiUrl) return <><Fonts/><G/><SetupScreen onSave={saveCfg}/></>;
  if(loading&&!data) return <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#F5F3EF",gap:16}}><div className="spinner" style={{width:32,height:32,borderWidth:3}}/><div style={{color:"#8A8278",fontSize:14,fontFamily:"Nunito,sans-serif"}}>A carregar dados do Google Sheets…</div></div>;
  if(error&&!data) return <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#F5F3EF",padding:24,gap:16}}><div style={{fontSize:40}}>⚠️</div><div style={{fontFamily:"'Lora',serif",fontSize:22,color:"#B5341A"}}>Erro de ligação</div><div style={{color:"#8A8278",fontSize:14,maxWidth:400,textAlign:"center"}}>{error}</div><button className="btn btn-red" style={{fontFamily:"Nunito,sans-serif"}} onClick={reload}>↻ Tentar novamente</button><button className="btn btn-ghost" style={{fontFamily:"Nunito,sans-serif"}} onClick={()=>saveCfg(null)}>⚙️ Reconfigurar</button></div>;
  if(!data) return null;

  const password = data.config?.gestorPassword||"admin2025";
  return (
    <><Fonts/><G/>
    {view==="public" &&<PublicView  appData={data} onGestor={()=>auth?setView("gestor"):setView("login")}/>}
    {view==="login"  &&<GestorLogin pwd={password} onLogin={()=>{setAuth(true);setView("gestor");}} onBack={()=>setView("public")}/>}
    {view==="gestor" &&<GestorDashboard appData={data} apiUrl={cfg.apiUrl} apiSecret={cfg.apiSecret||"cond_segredo_2025"} onBack={()=>setView("public")} onReload={reload} loading={loading}/>}
    </>
  );
}
