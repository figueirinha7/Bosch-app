/* ════════════════════════════════════════════════════════════════
   RELATÓRIOS — cada função devolve uma página HTML completa,
   mostrada na pré-visualização e impressa / guardada em PDF a partir dela.
   Regras: sem emojis, sinais + / − além da cor, cabeçalho de tabela
   repetido em cada página, linhas nunca cortadas a meio, nº de página.
════════════════════════════════════════════════════════════════ */
import { MESES, MESES_S, pad2, chaveMes, fmtNum, fmtSinal, fmtDateNum, fmtDateCurta, nomeApt, lblMes,
  fluxoMensal, contaMes, cobrancaMes, situacaoApt, contribInfo, metaContrib, mesCaixaQuota, resumoMeses, today } from "./lib.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const kz  = v => fmtNum(v);

function pagina(titulo, subtitulo, corpo, config, opts={}) {
  const { predio="", endereco="", gestorNome="" } = config;
  const emitido = fmtDateNum(today());
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@600;700&family=Nunito:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  @page{size:A4;margin:16mm 15mm 18mm;
    @bottom-left{content:"${esc(predio).replace(/"/g,"")} · ${esc(titulo).replace(/"/g,"")}";font:10px Nunito,sans-serif;color:#4A443D}
    @bottom-right{content:"Página " counter(page) " de " counter(pages);font:10px Nunito,sans-serif;color:#4A443D}}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Nunito',sans-serif;color:#1C1A16;font-size:13px;line-height:1.5;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pg{max-width:794px;margin:0 auto;padding:40px 44px}
  @media screen{body{background:#E6E1DA}.pg{background:#fff;margin:24px auto;box-shadow:0 6px 24px rgba(28,26,22,.14);padding:56px 60px}}
  @media print{.pg{padding:0;max-width:none}}
  .hdr{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border-bottom:3px solid #1C1A16;padding-bottom:12px;margin-bottom:22px}
  .over{font-size:12px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#9E2D16}
  h1{font-family:'Lora',serif;font-size:24px;line-height:1.2;font-weight:700;margin:3px 0 4px}
  .meta{font-size:12px;color:#4A443D}
  h2{font-family:'Lora',serif;font-size:16px;font-weight:700;margin:24px 0 8px;break-after:avoid;page-break-after:avoid}
  p{margin:0 0 6px}
  .nota{font-size:12px;color:#4A443D}
  table{width:100%;border-collapse:collapse;margin:4px 0 6px;font-size:12.5px}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  th{font-size:11px;font-weight:800;text-align:left;padding:6px 8px;border-bottom:1.5px solid #1C1A16;white-space:nowrap}
  td{padding:5px 8px;border-bottom:1px solid #D5CFC6;vertical-align:top}
  th:first-child,td:first-child{padding-left:0} th:last-child,td:last-child{padding-right:0}
  tfoot td{border-bottom:none;border-top:1.5px solid #1C1A16;font-weight:800}
  .n{text-align:right;font-family:'DM Mono',monospace;white-space:nowrap}
  .b{font-weight:800}
  .pos{color:#1E6B42}.neg{color:#9E2D16}.mut{color:#6B645B}
  .conta{display:grid;grid-template-columns:repeat(4,1fr);border:1.5px solid #1C1A16;border-radius:8px;overflow:hidden;break-inside:avoid}
  .conta div{padding:10px 12px;border-right:1px solid #BFB8AE;display:flex;flex-direction:column;gap:2px}
  .conta div:last-child{border-right:none;background:#F3EFE9}
  .conta span{font-size:11px;font-weight:700;color:#4A443D}.conta b{font-family:'DM Mono',monospace;font-weight:500;font-size:15px}
  .dois{display:grid;grid-template-columns:1fr 1fr;gap:14px;break-inside:avoid}
  .caixa{border:1px solid #BFB8AE;border-radius:8px;padding:10px 12px}
  .caixa .t{font-size:11px;font-weight:800;color:#4A443D;margin-bottom:4px}
  .linha{display:flex;justify-content:space-between;gap:12px;padding:3px 0}
  .bar{height:12px;border:1px solid #1C1A16;border-radius:3px;overflow:hidden;display:flex;break-inside:avoid}
  .bar i{display:block;height:100%;background:#2E8B5A}
  .cats{display:grid;grid-template-columns:150px 1fr 120px;gap:4px 12px;align-items:center;font-size:12px;margin-top:6px;break-inside:avoid}
  .cats .bar{height:9px;border-radius:2px}.cats .bar i{background:#4A443D}
  .chk{display:flex;gap:8px;align-items:center;font-size:12px;color:#4A443D;margin-top:8px}
  .chk i{width:12px;height:12px;border:1.5px solid #1C1A16;border-radius:2px;display:inline-block}
  .aprov{margin-top:30px;padding-top:14px;border-top:1.5px solid #1C1A16;break-inside:avoid}
  .ass{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:44px}
  .ass div{border-top:1px solid #1C1A16;padding-top:5px;font-size:12px;color:#4A443D}
  .foot{margin-top:26px;padding-top:10px;border-top:1px solid #BFB8AE;font-size:11px;color:#4A443D}
  .ok{color:#1E6B42;font-weight:700}
</style></head><body><div class="pg">
<div class="hdr"><div><div class="over">${esc(predio)}</div><h1>${esc(titulo)}</h1>
<div class="meta">${[endereco, gestorNome?`Gestor: ${gestorNome}`:"", `Emitido a ${emitido}`].filter(Boolean).map(esc).join(" · ")}</div></div>
${subtitulo?`<div class="meta" style="text-align:right">${subtitulo}</div>`:""}</div>
${corpo}
${opts.aprovacao?`<div class="aprov"><p>Apresentado em assembleia de ____ / ____ / ________.</p><div class="ass"><div>O gestor</div><div>Pelos condóminos</div></div></div>`:""}
<div class="foot">${esc(predio)} · Relatório gerado pela app do condomínio a partir dos registos existentes a ${emitido}.</div>
</div></body></html>`;
}

function tabelaCategorias(despesas) {
  const tot = despesas.reduce((s,d)=>s+d.valor,0);
  if (!tot) return "";
  const m = {}; despesas.forEach(d=>{ m[d.categoria||"Outros"] = (m[d.categoria||"Outros"]||0) + d.valor; });
  const rows = Object.entries(m).sort((a,b)=>b[1]-a[1]);
  const max = rows[0][1];
  return `<div class="cats">${rows.map(([c,v])=>`<span>${esc(c)}</span><span class="bar"><i style="width:${Math.round(v/max*100)}%"></i></span><span class="n">${kz(v)} · ${Math.round(v/tot*100)}%</span>`).join("")}</div>`;
}

function tabelaAtrasos(appData, { nomes=true, publico=false }) {
  const linhas = appData.fracoes.map(f=>({ f, ...situacaoApt(f, appData) })).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  if (!linhas.length) return `<p class="ok">Sem valores em atraso.</p>`;
  const tq = linhas.reduce((s,x)=>s+x.qi.divida,0), tc = linhas.reduce((s,x)=>s+x.contribs.reduce((a,c)=>a+c.divida,0),0);
  const comNomes = nomes && !publico;
  return `<table><thead><tr><th>Apt.</th>${comNomes?"<th>Proprietário (inquilino)</th>":""}<th>Quotas em falta</th><th>Contribuições</th><th class="n">Total (Kz)</th></tr></thead><tbody>
${linhas.map(({f,qi,contribs,total})=>`<tr><td class="b">${esc(f.numero)}</td>${comNomes?`<td>${esc(nomeApt(f))}${f.inq_nome?` <span class="mut">(${esc(f.inq_nome)})</span>`:""}</td>`:""}
<td>${qi.mesesAtraso?`${esc(resumoMeses(qi.mesesEmFalta))} · ${kz(qi.divida)}`:"—"}</td>
<td>${contribs.length?contribs.map(c=>`${esc(c.titulo)} · ${kz(c.divida)}`).join("<br>"):"—"}</td>
<td class="n">${kz(total)}</td></tr>`).join("")}
</tbody><tfoot><tr><td colspan="${comNomes?4:3}">Quotas ${kz(tq)} · Contribuições ${kz(tc)}</td><td class="n">${kz(tq+tc)}</td></tr></tfoot></table>`;
}

/* ── ENTRADAS DE UM MÊS (pela data do pagamento) ── */
function entradasDoMes(appData, k, detalhe) {
  const { fracoes, pagamentosQuota, pagamentosContribuicao, contribuicoes } = appData;
  const apt = id => fracoes.find(f=>f.id===id);
  const tit = id => contribuicoes.find(c=>c.id===id)?.titulo || "Contribuição";
  const rows = [];
  pagamentosQuota.forEach(p=>{
    if (p.metodo==="Isento" || mesCaixaQuota(p)!==k) return;
    rows.push({ data:p.data||"", apt:apt(p.fracaoId)?.numero||"?", tipo:"q", meses:[{mes:p.mes,ano:p.ano}], desc: p.mes?`Quota ${MESES[p.mes-1]} ${p.ano}`:"Quota (sem mês)", metodo:p.metodo, valor:p.valor });
  });
  pagamentosContribuicao.forEach(p=>{
    if (p.metodo==="Isento" || !(p.data||"").startsWith(k)) return;
    rows.push({ data:p.data, apt:apt(p.fracaoId)?.numero||"?", tipo:"c"+p.contribuicaoId, desc: tit(p.contribuicaoId), metodo:p.metodo, valor:p.valor });
  });
  rows.sort((a,b)=>(a.data||"").localeCompare(b.data||"") || String(a.apt).localeCompare(String(b.apt)));
  if (detalhe) return rows;
  // Agrupado por apartamento e tipo (uma linha por apt. para as quotas)
  const g = {};
  rows.forEach(r=>{
    const key = r.apt+"|"+r.tipo;
    if (!g[key]) g[key] = { ...r, meses:[...(r.meses||[])], n:1 };
    else { g[key].valor += r.valor; g[key].n++; g[key].meses.push(...(r.meses||[])); if (r.metodo!==g[key].metodo) g[key].metodo = "Vários"; g[key].data = r.data; }
  });
  return Object.values(g).map(r=> r.tipo==="q" && r.meses.length ? { ...r, desc: `Quotas ${resumoMeses(r.meses.filter(m=>m.mes))}${r.n>1?` (${r.n} pagamentos)`:""}` } : r);
}

/* ═══════════════════════════════════════════════════════════════
   MENSAL
═══════════════════════════════════════════════════════════════ */
export function relatorioMensal(appData, ano, mes, opts={}) {
  const { nomes=true, detalhe=true, aprovacao=true, publico=false } = opts;
  const { config, despesas=[] } = appData;
  const k = chaveMes(ano, mes), nomeMes = `${MESES[mes-1]} ${ano}`;
  const fluxo = fluxoMensal(appData);
  const c = contaMes(fluxo, ano, mes);
  const cob = cobrancaMes(appData, ano, mes);
  const pct = cob.elegiveis ? Math.round(cob.pagaram/cob.elegiveis*100) : 0;
  const despMes = despesas.filter(d=>(d.data||"").startsWith(k)).sort((a,b)=>(a.data||"").localeCompare(b.data||""));
  const ultimoDia = new Date(ano, mes, 0).getDate();

  let entradasHtml;
  if (publico) {
    entradasHtml = `<table><tbody><tr><td>Quotas</td><td class="n">${kz(c.quotas)}</td></tr><tr><td>Contribuições</td><td class="n">${kz(c.contribuicoes)}</td></tr></tbody>
<tfoot><tr><td>Total de entradas</td><td class="n">${fmtSinal(c.entradas)}</td></tr></tfoot></table>`;
  } else {
    const ent = entradasDoMes(appData, k, detalhe);
    entradasHtml = ent.length ? `<table><thead><tr><th>Data</th><th>Apt.</th><th>Descrição</th><th>Método</th><th class="n">Valor (Kz)</th></tr></thead><tbody>
${ent.map(r=>`<tr><td>${esc(fmtDateCurta(r.data))||"—"}</td><td class="b">${esc(r.apt)}</td><td>${esc(r.desc)}</td><td class="mut">${esc(r.metodo||"—")}</td><td class="n">${kz(r.valor)}</td></tr>`).join("")}
</tbody><tfoot><tr><td colspan="4">Quotas ${kz(c.quotas)} · Contribuições ${kz(c.contribuicoes)}</td><td class="n">${fmtSinal(c.entradas)}</td></tr></tfoot></table>
${detalhe?`<p class="nota">Cada pagamento aparece na sua linha, incluindo pagamentos parciais.</p>`:""}` : `<p class="mut">Sem entradas registadas neste mês.</p>`;
  }

  const saidasHtml = despMes.length ? `<table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th>${publico?"":"<th>Fornecedor</th>"}<th class="n">Valor (Kz)</th></tr></thead><tbody>
${despMes.map(d=>`<tr><td>${esc(fmtDateCurta(d.data))}</td><td>${esc(d.descricao)}</td><td class="mut">${esc(d.categoria)}</td>${publico?"":`<td class="mut">${esc(d.fornecedor||"—")}</td>`}<td class="n">${kz(d.valor)}</td></tr>`).join("")}
</tbody><tfoot><tr><td colspan="${publico?3:4}">${despMes.length} ${despMes.length===1?"despesa":"despesas"}</td><td class="n">${fmtSinal(-c.despesas)}</td></tr></tfoot></table>
${tabelaCategorias(despMes)}` : `<p class="mut">Sem despesas registadas neste mês.</p>`;

  const corpo = `
<h2>1. Conta do mês</h2>
<div class="conta">
  <div><span>Saldo em 1 ${MESES_S[mes-1]}</span><b>${kz(c.saldoInicial)}</b></div>
  <div><span>+ Entradas</span><b class="pos">${fmtSinal(c.entradas)}</b></div>
  <div><span>− Saídas</span><b class="neg">${fmtSinal(-c.despesas)}</b></div>
  <div><span style="color:#1C1A16">= Saldo em ${ultimoDia} ${MESES_S[mes-1]}</span><b>${kz(c.saldoFinal)} Kz</b></div>
</div>
${publico?"":`<div class="chk"><i></i>Confere com o extracto bancário de ${pad2(ultimoDia)}/${pad2(mes)}/${ano}</div>`}

<h2>2. Cobrança das quotas de ${esc(nomeMes)}</h2>
<p>${cob.pagaram} de ${cob.elegiveis} apartamentos pagaram a quota do mês (${pct}%): <b>${kz(cob.cobrado)}</b> de ${kz(cob.esperado)} Kz.
${cob.isentos?` ${cob.isentos} ${cob.isentos===1?"apartamento isento":"apartamentos isentos"} neste mês.`:""}
${cob.excluidos.length?` ${cob.excluidos.length===1?"O apartamento":"Os apartamentos"} ${cob.excluidos.map(f=>esc(f.numero)).join(", ")} não ${cob.excluidos.length===1?"paga":"pagam"} quota mensal (acordo com a administração).`:""}</p>
<div class="bar"><i style="width:${pct}%"></i></div>
${cob.emFalta.length?`<p class="nota" style="margin-top:6px">Por pagar: ${cob.emFalta.map(x=>esc(x.f.numero)+(x.k==="parcial"?` (parcial, pagou ${kz(x.pago)})`:"")).join(", ")}.</p>`:""}
<p class="nota">A cobrança conta pelo mês a que a quota se refere; as entradas abaixo contam pela data em que o dinheiro entrou.</p>

<h2>3. Entradas</h2>
${entradasHtml}

<h2>4. Saídas</h2>
${saidasHtml}

<h2>5. Valores em atraso (acumulado à data de emissão)</h2>
${tabelaAtrasos(appData, { nomes, publico })}`;
  return pagina(`Relatório mensal — ${nomeMes}`, "", corpo, config, { aprovacao: aprovacao && !publico });
}

/* ═══════════════════════════════════════════════════════════════
   ANUAL
═══════════════════════════════════════════════════════════════ */
export function relatorioAnual(appData, ano, opts={}) {
  const { nomes=true, aprovacao=true } = opts;
  const { config, fracoes, contribuicoes, pagamentosContribuicao, despesas=[] } = appData;
  const fluxo = fluxoMensal(appData);
  let recAnte=0, despAnte=0, recAno=0, despAno=0;
  Object.entries(fluxo).forEach(([k,v])=>{
    const r = v.quotas+v.contribuicoes;
    if (k < `${ano}-01`) { recAnte+=r; despAnte+=v.despesas; }
    else if (k.startsWith(`${ano}-`)) { recAno+=r; despAno+=v.despesas; }
  });
  const transitado = recAnte-despAnte, saldoAno = recAno-despAno, saldoFinal = transitado+saldoAno;
  const now = new Date(), fimMes = ano < now.getFullYear() ? 12 : ano > now.getFullYear() ? 0 : now.getMonth()+1;

  const linhasMes = MESES.map((nm,i)=>{
    const m=i+1, c = contaMes(fluxo, ano, m), vazio = !c.entradas && !c.despesas;
    const cob = m<=fimMes ? cobrancaMes(appData, ano, m) : null;
    return `<tr class="${vazio?"mut":""}"><td>${nm}</td><td class="n">${c.entradas?kz(c.entradas):"—"}</td><td class="n">${c.despesas?kz(c.despesas):"—"}</td>
<td class="n ${c.entradas-c.despesas<0?"neg":""}">${vazio?"—":fmtSinal(c.entradas-c.despesas)}</td><td class="n">${m<=fimMes?kz(c.saldoFinal):"—"}</td>
<td class="n">${cob&&cob.elegiveis?`${cob.pagaram}/${cob.elegiveis}`:"—"}</td></tr>`;
  }).join("");

  const despAnoList = despesas.filter(d=>(d.data||"").startsWith(`${ano}-`)).sort((a,b)=>(a.data||"").localeCompare(b.data||""));

  const contribRows = contribuicoes.map(c=>{
    const meta = metaContrib(c, fracoes);
    const rec = pagamentosContribuicao.filter(p=>p.contribuicaoId===c.id&&p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0);
    const falta = fracoes.reduce((s,f)=>s+contribInfo(c,f.id,pagamentosContribuicao).divida,0);
    return `<tr><td>${esc(c.titulo)}${c.dataVencimento?` <span class="mut">· prazo ${esc(fmtDateNum(c.dataVencimento))}</span>`:""}</td><td class="n">${meta?kz(meta):"livre"}</td><td class="n">${kz(rec)}</td><td class="n">${falta?kz(falta):"—"}</td><td>${esc(c.estado||"Aberto")}</td></tr>`;
  }).join("");

  const corpo = `
<h2>1. Acumulado do ano</h2>
<div class="dois">
  <div class="caixa"><div class="t">Anos anteriores</div>
    <div class="linha"><span>Receitas acumuladas</span><span class="n">${kz(recAnte)}</span></div>
    <div class="linha"><span>Despesas acumuladas</span><span class="n">${fmtSinal(-despAnte)}</span></div>
    <div class="linha b"><span>Saldo transitado</span><span class="n">${kz(transitado)}</span></div></div>
  <div class="caixa"><div class="t">${ano}</div>
    <div class="linha"><span>Receitas do ano</span><span class="n pos">${fmtSinal(recAno)}</span></div>
    <div class="linha"><span>Despesas do ano</span><span class="n neg">${fmtSinal(-despAno)}</span></div>
    <div class="linha b"><span>Saldo do ano</span><span class="n">${fmtSinal(saldoAno)}</span></div></div>
</div>
<div class="conta" style="grid-template-columns:1fr auto;margin-top:12px"><div><span style="color:#1C1A16">Saldo final (transitado + ${ano})</span></div><div><b>${kz(saldoFinal)} Kz</b></div></div>

<h2>2. Mês a mês</h2>
<table><thead><tr><th>Mês</th><th class="n">Entradas</th><th class="n">Despesas</th><th class="n">Saldo do mês</th><th class="n">Saldo em caixa</th><th class="n">Quotas pagas</th></tr></thead>
<tbody>${linhasMes}</tbody>
<tfoot><tr><td>Total ${ano}</td><td class="n">${kz(recAno)}</td><td class="n">${kz(despAno)}</td><td class="n">${fmtSinal(saldoAno)}</td><td class="n">${kz(saldoFinal)}</td><td></td></tr></tfoot></table>
<p class="nota">Entradas e despesas pela data em que o dinheiro entrou ou saiu. “Quotas pagas” conta os apartamentos com a quota desse mês paga.</p>

<h2>3. Despesas por categoria</h2>
${despAnoList.length?tabelaCategorias(despAnoList):`<p class="mut">Sem despesas em ${ano}.</p>`}

${contribuicoes.length?`<h2>4. Contribuições</h2>
<table><thead><tr><th>Contribuição</th><th class="n">Meta</th><th class="n">Recebido</th><th class="n">Em falta</th><th>Estado</th></tr></thead><tbody>${contribRows}</tbody></table>`:""}

<h2>${contribuicoes.length?5:4}. Valores em atraso (acumulado)</h2>
${tabelaAtrasos(appData, { nomes })}

${despAnoList.length?`<h2>${contribuicoes.length?6:5}. Detalhe das despesas de ${ano}</h2>
<table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Fornecedor</th><th class="n">Valor (Kz)</th></tr></thead><tbody>
${despAnoList.map(d=>`<tr><td>${esc(fmtDateNum(d.data))}</td><td>${esc(d.descricao)}</td><td class="mut">${esc(d.categoria)}</td><td class="mut">${esc(d.fornecedor||"—")}</td><td class="n">${kz(d.valor)}</td></tr>`).join("")}
</tbody><tfoot><tr><td colspan="4">Total</td><td class="n">${kz(despAno)}</td></tr></tfoot></table>`:""}`;
  return pagina(`Relatório anual ${ano}`, "", corpo, config, { aprovacao });
}

/* ═══════════════════════════════════════════════════════════════
   EXTRACTO POR APARTAMENTO
═══════════════════════════════════════════════════════════════ */
export function relatorioExtracto(appData, fracaoId) {
  const { config, fracoes, pagamentosQuota, pagamentosContribuicao, contribuicoes } = appData;
  const f = fracoes.find(x=>x.id===fracaoId);
  if (!f) return pagina("Extracto de conta", "", `<p>Seleccione um apartamento.</p>`, config);
  const { qi, contribs, total } = situacaoApt(f, appData);
  const tit = id => contribuicoes.find(c=>c.id===id)?.titulo || "Contribuição";

  // Pagamentos de vários meses no mesmo dia ficam numa só linha
  const grupos = {};
  pagamentosQuota.filter(p=>p.fracaoId===f.id).forEach(p=>{
    const key = [p.data, p.metodo, p.referencia].join("|");
    (grupos[key] ||= { data:p.data, metodo:p.metodo, isento:p.metodo==="Isento", meses:[], valor:0 });
    grupos[key].meses.push({mes:p.mes, ano:p.ano}); grupos[key].valor += p.valor;
  });
  const mov = Object.values(grupos).map(g=>({ data:g.data, desc:`${g.isento?"Isenção de quota":g.meses.length>1?"Quotas":"Quota"} ${resumoMeses(g.meses.filter(m=>m.mes))}`, metodo:g.isento?"—":g.metodo, valor:g.isento?null:g.valor }));
  pagamentosContribuicao.filter(p=>p.fracaoId===f.id).forEach(p=>{
    mov.push({ data:p.data, desc:(p.metodo==="Isento"?"Isenção: ":"")+tit(p.contribuicaoId), metodo:p.metodo==="Isento"?"—":p.metodo, valor:p.metodo==="Isento"?null:p.valor });
  });
  mov.sort((a,b)=>(a.data||"").localeCompare(b.data||""));
  const totalPago = mov.reduce((s,m)=>s+(m.valor||0),0);

  const corpo = `
<p>${nomeApt(f)?`Proprietário: <b>${esc(nomeApt(f))}</b>`:""}${f.inq_nome?` · Inquilino: ${esc(f.inq_nome)}`:""}${f.andar?` · Andar: ${esc(f.andar)}`:""}</p>
<div class="conta" style="grid-template-columns:repeat(3,1fr);margin-top:10px">
  <div><span>Pago (todos os registos)</span><b>${kz(totalPago)} Kz</b></div>
  <div style="background:#fff"><span style="color:#9E2D16">Em dívida</span><b class="neg">${kz(total)} Kz</b></div>
  <div style="background:#fff"><span>Quota mensal</span><b>${f.excluiQuota?"Não paga":kz(config.quotaMensal)+" Kz"}</b></div>
</div>

<h2>Pagamentos registados</h2>
${mov.length?`<table><thead><tr><th>Data</th><th>Referente a</th><th>Método</th><th class="n">Valor (Kz)</th></tr></thead><tbody>
${mov.map(m=>`<tr><td>${esc(fmtDateNum(m.data))||"—"}</td><td>${esc(m.desc)}</td><td class="mut">${esc(m.metodo||"—")}</td><td class="n">${m.valor===null?"isento":kz(m.valor)}</td></tr>`).join("")}
</tbody><tfoot><tr><td colspan="3">Total pago</td><td class="n">${kz(totalPago)}</td></tr></tfoot></table>`:`<p class="mut">Sem pagamentos registados.</p>`}

<h2>Em falta a ${fmtDateNum(today())}</h2>
${total?`<table><thead><tr><th>Referente a</th><th>Vencimento</th><th class="n">Valor (Kz)</th></tr></thead><tbody>
${qi.mesesEmFalta.map(m=>`<tr><td>Quota ${MESES[m.mes-1]} ${m.ano}${m.pago?` <span class="mut">(pago ${kz(m.pago)})</span>`:""}</td><td class="mut">${lblMes(m)}</td><td class="n">${kz(m.emFalta)}</td></tr>`).join("")}
${contribs.map(c=>`<tr><td>${esc(c.titulo)}</td><td class="mut">${c.dataVencimento?esc(fmtDateNum(c.dataVencimento)):"—"}</td><td class="n">${kz(c.divida)}</td></tr>`).join("")}
</tbody><tfoot><tr><td colspan="2" class="neg">Total em dívida</td><td class="n neg">${kz(total)}</td></tr></tfoot></table>`:`<p class="ok">Sem valores em falta. O apartamento tem as quotas e contribuições em dia.</p>`}

<p class="nota" style="margin-top:18px">Documento emitido a partir dos registos do condomínio. Se encontrar algum erro, contacte o gestor${config.gestorNome?` (${esc(config.gestorNome)}${config.gestorTelefone?`, ${esc(config.gestorTelefone)}`:""})`:""}.</p>`;
  return pagina(`Extracto de conta — Apartamento ${f.numero}`, "", corpo, config);
}

/* ═══════════════════════════════════════════════════════════════
   LISTA DE ATRASOS
═══════════════════════════════════════════════════════════════ */
export function relatorioAtrasos(appData, opts={}) {
  const { nomes=true } = opts;
  return pagina("Valores em atraso", "", `<p class="nota">Quotas e contribuições em falta à data de emissão, do maior para o menor valor.</p>${tabelaAtrasos(appData, { nomes })}`, appData.config);
}

/* ── Guardar como ficheiro ── */
export function descarregarHtml(html, nome) {
  const url = URL.createObjectURL(new Blob([html], { type:"text/html;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = nome.replace(/[^\w\-. ]+/g,"_") + ".html";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
