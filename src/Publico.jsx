import { useState, useMemo } from "react";
import { APP_VERSAO, MESES, fmtKz, fmtNum, fmtSinal, fmtDate, fmtDateCurta, fmtDateTime, today, chaveMes,
  quotaInfo, contribInfo, metaContrib, situacaoApt, nivelAtraso, resumoMeses, andarDe, nomeAndar,
  fluxoMensal, contaMes, primeiroMes, temContas } from "./lib.js";
import { relatorioMensal } from "./relatoriosHtml.js";
import { Icon, Modal, MesNav } from "./ui.jsx";
import { ReportPreview } from "./Relatorios.jsx";

const TIPO_TAG = { "Notificação":"tag-blue", "Acta de Reunião":"tag-green", "Comunicado":"tag-amber" };
const dias30 = () => { const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); };

/* ═══════════════════════════════════════════════════════════════
   AVISO
═══════════════════════════════════════════════════════════════ */
export function AvisoCard({a, extra}) {
  const [open,setOpen] = useState(false);
  const longo = (a.conteudo||"").length >= 160;
  const novo = (a.data||"") >= dias30();
  return (
    <article className="card" style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {novo&&<span className="tag" style={{background:"var(--info)",color:"#fff"}}>Novo</span>}
          <span className={`tag ${TIPO_TAG[a.tipo]||"tag-red"}`}>{a.tipo}</span>
          <span style={{fontSize:13,color:"var(--ink-2)"}}>{fmtDate(a.data)}{a.autor?` · ${a.autor}`:""}</span>
        </div>
        {extra}
      </div>
      <h3 style={{fontWeight:800,fontSize:16,lineHeight:1.35}}>{a.titulo}</h3>
      {a.conteudo&&(!longo||open)&&<p style={{fontSize:15,color:"#3D3832",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{a.conteudo}</p>}
      {longo&&<button className="btn btn-ghost btn-sm" style={{alignSelf:"flex-start",paddingLeft:0,color:"var(--info)"}} aria-expanded={open} onClick={()=>setOpen(o=>!o)}>
        <Icon n={open?"up":"down"} s={16}/>{open?"Mostrar menos":"Ler aviso completo"}</button>}
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VER O MEU APARTAMENTO (pesquisa pelo número)
═══════════════════════════════════════════════════════════════ */
function MeuApartamento({appData}) {
  const [q,setQ] = useState("");
  const { fracoes } = appData;
  const termo = q.trim().toLowerCase();
  const f = termo ? (fracoes.find(x=>String(x.numero).trim().toLowerCase()===termo)
                  || (()=>{ const c=fracoes.filter(x=>String(x.numero).trim().toLowerCase().startsWith(termo)); return c.length===1?c[0]:null; })()) : null;
  const s = f ? situacaoApt(f, appData) : null;
  return (
    <section className="card anim" style={{marginBottom:16}} aria-label="Ver o meu apartamento">
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <label htmlFor="meu-apt" style={{fontWeight:800,fontSize:15,display:"flex",gap:8,alignItems:"center"}}><Icon n="search" s={18}/>Ver o meu apartamento</label>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <input id="meu-apt" className="input" style={{width:170}} placeholder="Nº do apartamento" value={q} onChange={e=>setQ(e.target.value)}/>
          {q&&<button className="btn btn-ghost btn-icon" onClick={()=>setQ("")} aria-label="Limpar"><Icon n="x" s={18}/></button>}
        </div>
      </div>
      {termo&&!f&&<div style={{marginTop:12,fontSize:14,color:"var(--ink-2)"}}>Apartamento não encontrado.</div>}
      {f&&(
        <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:12}} aria-live="polite">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <span className="serif" style={{fontWeight:700,fontSize:22}}>Apartamento {f.numero}</span>
            <span className={`tag ${s.total>0?"tag-red":"tag-green"}`}>{s.total>0?`Em dívida: ${fmtKz(s.total)}`:"Tudo em dia"}</span>
          </div>
          {f.excluiQuota&&<div style={{fontSize:14,color:"var(--ink-2)"}}>Este apartamento não paga quota mensal (acordo com a administração).</div>}
          {s.qi.mesesEmFalta.length>0&&(
            <div>
              <div style={{fontSize:14,fontWeight:800,marginBottom:6}}>Quotas em falta ({s.qi.mesesAtraso})</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {s.qi.mesesEmFalta.map(m=>(
                  <span key={m.key} style={{background:"var(--divida-bg)",borderRadius:8,padding:"5px 10px",fontSize:13}}>
                    <b>{MESES[m.mes-1].slice(0,3)} {m.ano}</b> <span className="mono" style={{color:"var(--divida)"}}>{fmtNum(m.emFalta)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {s.contribs.length>0&&(
            <div>
              <div style={{fontSize:14,fontWeight:800,marginBottom:6}}>Contribuições em dívida</div>
              {s.contribs.map(c=>(
                <div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:"var(--warn-bg)",borderRadius:8,marginBottom:4,fontSize:14}}>
                  <span>{c.titulo}</span><span className="mono" style={{color:"var(--divida)"}}>{fmtKz(c.divida)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   QUOTAS — grelha do prédio por andar, só com o nº do apartamento
═══════════════════════════════════════════════════════════════ */
const CEL = {
  ok:  { background:"var(--ok-bg)", border:"1.5px solid var(--ok-bg)", color:"var(--ok)" },
  um:  { background:"var(--warn-bg)", border:"2px solid var(--warn-line)", color:"#7A4109" },
  mau: { background:"var(--divida-bg)", border:"2px solid var(--brand)", color:"var(--divida)" },
  exc: { background:"var(--grey-bg)", border:"1.5px solid var(--grey-bg)", color:"#4A443D" },
};
const numCmp = (a,b)=>String(a.numero).localeCompare(String(b.numero),"pt",{numeric:true});

function PredioQuotas({appData}) {
  const { fracoes, pagamentosQuota, config } = appData;
  const [sel,setSel] = useState(null);
  const infos = useMemo(()=>fracoes.map(f=>({ f, qi: f.excluiQuota ? null : quotaInfo(f.id,pagamentosQuota,config.quotaMensal,config.anoBase,config.mesBase) })),
    [fracoes,pagamentosQuota,config]);
  const pagam = infos.filter(x=>x.qi);
  const emDia = pagam.filter(x=>x.qi.mesesAtraso===0).length;
  const um = pagam.filter(x=>x.qi.mesesAtraso===1).length;
  const mau = pagam.filter(x=>x.qi.mesesAtraso>=2).length;
  const totalDivida = pagam.reduce((s,x)=>s+x.qi.divida,0);
  const andares = useMemo(()=>{
    const g = new Map();
    infos.forEach(x=>{ const a = andarDe(x.f); if(!g.has(a)) g.set(a,[]); g.get(a).push(x); });
    return [...g.entries()].sort((a,b)=> a[0]===null ? 1 : b[0]===null ? -1 : b[0]-a[0]).map(([a,xs])=>[a, xs.sort((p,q)=>numCmp(p.f,q.f))]);
  },[infos]);
  const cols = Math.min(4, Math.max(...andares.map(([,xs])=>xs.length), 1));
  const x = sel && infos.find(i=>i.f.id===sel);
  const estilo = i => !i.qi ? CEL.exc : i.qi.mesesAtraso===0 ? CEL.ok : i.qi.mesesAtraso===1 ? CEL.um : CEL.mau;
  const txt = i => !i.qi ? "Sem quota" : i.qi.mesesAtraso===0 ? "Em dia" : i.qi.mesesAtraso===1 ? "1 mês" : `${i.qi.mesesAtraso} meses`;

  return (
    <div className="anim" style={{display:"flex",flexDirection:"column",gap:16}}>
      <section className="card" style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--ink-2)"}}>Quotas · situação a {fmtDate(today())}</div>
        <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
          <span className="serif" style={{fontSize:32,fontWeight:700,lineHeight:1}}>{emDia} de {pagam.length}</span>
          <span style={{fontSize:15,color:"#3D3832"}}>apartamentos com as quotas em dia</span>
        </div>
        {pagam.length>0&&<div style={{display:"flex",height:12,borderRadius:8,overflow:"hidden",gap:2}} aria-hidden="true">
          {emDia>0&&<div style={{flexGrow:emDia,background:"var(--ok-fill)"}}/>}
          {um>0&&<div style={{flexGrow:um,background:"var(--warn-line)"}}/>}
          {mau>0&&<div style={{flexGrow:mau,background:"var(--brand)"}}/>}
        </div>}
        <div style={{display:"flex",justifyContent:"space-between",fontSize:15,gap:12,flexWrap:"wrap"}}>
          <span style={{color:"#3D3832"}}>Total em dívida (quotas) · {fmtKz(config.quotaMensal)}/mês</span>
          <span className="mono" style={{color:totalDivida?"var(--divida)":"var(--ok)"}}>{fmtKz(totalDivida)}</span>
        </div>
      </section>

      <section className="card" style={{display:"flex",flexDirection:"column",gap:12}}>
        <h2 className="h2">Por andar</h2>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {andares.map(([a,xs])=>(
            <div key={String(a)} style={{display:"grid",gridTemplateColumns:`44px repeat(${cols},minmax(0,1fr))`,gap:8,alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:800,color:"var(--ink-2)"}}>{nomeAndar(a)}</span>
              {xs.map(i=>(
                <button key={i.f.id} onClick={()=>setSel(s=>s===i.f.id?null:i.f.id)} aria-pressed={sel===i.f.id}
                  aria-label={`Apartamento ${i.f.numero}: ${txt(i)}`}
                  style={{...estilo(i),minHeight:64,borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,cursor:"pointer",fontFamily:"'Nunito',sans-serif",
                    ...(sel===i.f.id?{boxShadow:"0 0 0 3px var(--bg), 0 0 0 5px var(--ink)"}:{})}}>
                  <span className="serif" style={{fontSize:18,fontWeight:700,lineHeight:1}}>{i.f.numero}</span>
                  <span style={{fontSize:12,fontWeight:800}}>{txt(i)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="legend" style={{paddingTop:4}}>
          <span><i className="sw" style={{background:"#CFEBDD"}}/>Em dia</span>
          <span><i className="sw" style={{background:"var(--warn-bg)",border:"2px solid var(--warn-line)"}}/>1 mês</span>
          <span><i className="sw" style={{background:"var(--divida-bg)",border:"2px solid var(--brand)"}}/>2 ou mais meses</span>
          <span><i className="sw" style={{background:"var(--grey-bg)"}}/>Não paga quota</span>
        </div>
      </section>

      {x&&(
        <section className="card anim" aria-live="polite" style={{border:"2px solid var(--ink)",display:"flex",flexDirection:"column",gap:6}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
            <span className="serif" style={{fontSize:20,fontWeight:700}}>Apartamento {x.f.numero}</span>
            <button className="btn btn-ghost btn-icon" onClick={()=>setSel(null)} aria-label="Fechar detalhe"><Icon n="x" s={18}/></button>
          </div>
          {!x.qi ? <div style={{fontSize:15,color:"#3D3832"}}>Não paga quota mensal (acordo com a administração).</div>
          : x.qi.mesesAtraso===0 ? <div style={{fontSize:15,color:"var(--ok)",fontWeight:700,display:"flex",gap:8,alignItems:"center"}}><Icon n="checkCircle" s={18}/>Quotas em dia</div>
          : <>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <span className={`tag ${nivelAtraso(x.qi.mesesAtraso).tag}`}>{nivelAtraso(x.qi.mesesAtraso).label}</span>
                <span style={{fontSize:15,color:"#3D3832"}}>{x.qi.mesesAtraso} {x.qi.mesesAtraso===1?"quota":"quotas"} em falta: {resumoMeses(x.qi.mesesEmFalta)}</span>
              </div>
              <div className="mono" style={{fontSize:18,color:"var(--divida)"}}>{fmtKz(x.qi.divida)}</div>
            </>}
        </section>
      )}

      <div style={{display:"flex",gap:10,alignItems:"flex-start",padding:"0 4px",fontSize:13,lineHeight:1.5,color:"var(--ink-2)"}}>
        <Icon n="lock" s={18} style={{marginTop:1}}/>
        <span>Por decisão da administração, esta página mostra apenas o número do apartamento. Use “Ver o meu apartamento” para o detalhe.</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONTRIBUIÇÕES (sem nomes)
═══════════════════════════════════════════════════════════════ */
function PublicContribuicoes({appData}) {
  const { fracoes, contribuicoes, pagamentosContribuicao } = appData;
  if (!contribuicoes.length) return <div className="card anim" style={{textAlign:"center",padding:"36px 0",color:"var(--ink-2)"}}>Sem contribuições registadas.</div>;
  return (
    <div className="anim" style={{display:"flex",flexDirection:"column",gap:14}}>
      {contribuicoes.map(c=>{
        const apts = fracoes.map(f=>({ f, ...contribInfo(c,f.id,pagamentosContribuicao) })).sort((a,b)=>numCmp(a.f,b.f));
        const totalCob = pagamentosContribuicao.filter(p=>p.contribuicaoId===c.id&&p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0);
        const isLivre = !(parseFloat(c.valorPorFracao)||0) && !(parseFloat(c.valorTotal)||0);
        const meta = metaContrib(c, fracoes);
        const pct = meta>0 ? Math.min(100,Math.round(totalCob/meta*100)) : 0;
        const devedores = apts.filter(x=>x.divida>0);
        const contribuiram = apts.filter(x=>x.totalPago>0);
        const devedoresN = apts.filter(x=>x.divida>0).length;
        const vencido = c.dataVencimento && c.dataVencimento<today() && devedoresN>0;
        return (
          <section key={c.id} className="card" style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                <h2 style={{fontWeight:800,fontSize:17}}>{c.titulo} {c.estado&&c.estado!=="Aberto"&&<span className="tag tag-grey" style={{marginLeft:4}}>{c.estado}</span>}</h2>
                {c.descricao&&<div style={{fontSize:14,color:"var(--ink-2)"}}>{c.descricao}</div>}
                {c.dataVencimento&&<div style={{fontSize:13,color:vencido?"var(--divida)":"var(--ink-2)",fontWeight:vencido?700:400}}>{vencido?"Prazo terminado: ":"Prazo: "}{fmtDate(c.dataVencimento)}</div>}
                {c.valorPorFracao>0&&<div style={{fontSize:13,color:"var(--ink-2)"}}>{fmtKz(c.valorPorFracao)} por apartamento</div>}
              </div>
              {isLivre&&<span className="tag tag-teal">Arrecadação livre</span>}
            </div>
            {!isLivre&&meta>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:14}}>
                  <span><span className="mono">{fmtNum(totalCob)}</span> de <span className="mono">{fmtKz(meta)}</span></span>
                  <b className="mono">{pct}%</b>
                </div>
                <div className="progress-bg" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.titulo}: ${pct}% recebido`}>
                  <div className="progress-fill" style={{width:`${pct}%`,background:"var(--info)"}}/></div>
              </div>
            )}
            {isLivre&&<div style={{fontSize:14}}>Recebido até agora: <b className="mono">{fmtKz(totalCob)}</b></div>}
            {!isLivre&&devedores.length>0&&<div>
              <div style={{fontSize:13,fontWeight:800,marginBottom:6}}>Por pagar ({devedores.length})</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {devedores.map(x=><span key={x.f.id} style={{background:"var(--divida-bg)",borderRadius:8,padding:"5px 10px",fontSize:13}}>
                  <b className="apt-num">{x.f.numero}</b> <span className="mono" style={{color:"var(--divida)"}}>{fmtNum(x.divida)}</span></span>)}
              </div>
            </div>}
            {isLivre&&contribuiram.length>0&&<div>
              <div style={{fontSize:13,fontWeight:800,marginBottom:6}}>Já contribuíram ({contribuiram.length})</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {contribuiram.map(x=><span key={x.f.id} style={{background:"var(--ok-bg)",borderRadius:8,padding:"5px 10px",fontSize:13}}><b className="apt-num">{x.f.numero}</b></span>)}
              </div>
            </div>}
          </section>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONTAS — saldo em caixa e para onde foi o dinheiro
═══════════════════════════════════════════════════════════════ */
function Contas({appData}) {
  const { config, despesas=[] } = appData;
  const fluxo = useMemo(()=>fluxoMensal(appData),[appData]);
  const now = new Date();
  const hoje = { ano:now.getFullYear(), mes:now.getMonth()+1 };
  const [sel,setSel] = useState(hoje);
  const [rel,setRel] = useState(false);
  if (!temContas(appData)) return (
    <div className="card anim" style={{textAlign:"center",padding:"36px 20px",color:"var(--ink-2)",lineHeight:1.6}}>
      As contas do prédio ficam disponíveis depois de o gestor actualizar o Apps Script para a versão {APP_VERSAO}.
    </div>
  );
  const c = contaMes(fluxo, sel.ano, sel.mes);
  const k = chaveMes(sel.ano, sel.mes);
  const despMes = despesas.filter(d=>(d.data||"").startsWith(k)).sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  const cats = {}; despMes.forEach(d=>{ cats[d.categoria||"Outros"]=(cats[d.categoria||"Outros"]||0)+d.valor; });
  const catList = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const maxCat = catList[0]?.[1]||1;
  const actual = sel.ano===hoje.ano && sel.mes===hoje.mes;
  const ultimo = new Date(sel.ano, sel.mes, 0).getDate();
  return (
    <div className="anim" style={{display:"flex",flexDirection:"column",gap:16}}>
      <div className="card" style={{padding:"4px 8px",display:"flex",justifyContent:"center"}}>
        <MesNav ano={sel.ano} mes={sel.mes} onChange={(ano,mes)=>setSel({ano,mes})} min={primeiroMes(fluxo,config)} max={hoje} tamanho={17}/>
      </div>

      <section style={{background:"var(--dark)",color:"#fff",borderRadius:16,padding:20,display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",flexDirection:"column",gap:2}}>
          <span style={{fontSize:13,fontWeight:700,color:"var(--dark-ink)"}}>{actual?"Saldo em caixa":`Saldo em ${ultimo} ${MESES[sel.mes-1].slice(0,3)} ${sel.ano}`}</span>
          <span className="mono" style={{fontSize:32,letterSpacing:-.5}}>{fmtKz(c.saldoFinal)}</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,fontSize:14,borderTop:"1px solid #4A443F",paddingTop:12}}>
          <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--dark-ink)"}}>Saldo em 1 {MESES[sel.mes-1].slice(0,3)}</span><span className="mono">{fmtNum(c.saldoInicial)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",gap:12}}>
            <span style={{color:"var(--dark-ink)",display:"flex",flexDirection:"column"}}>+ Entradas<span style={{fontSize:12}}>quotas {fmtNum(c.quotas)} · contribuições {fmtNum(c.contribuicoes)}</span></span>
            <span className="mono" style={{color:"#9BDDB8",whiteSpace:"nowrap"}}>{fmtSinal(c.entradas)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--dark-ink)"}}>− Despesas</span><span className="mono" style={{color:"#F5B3A3"}}>{fmtSinal(-c.despesas)}</span></div>
        </div>
      </section>

      <section className="card" style={{display:"flex",flexDirection:"column",gap:14}}>
        <h2 className="h2">Para onde foi o dinheiro</h2>
        {catList.length===0 ? <div style={{fontSize:14,color:"var(--ink-2)"}}>Sem despesas neste mês.</div> :
          catList.map(([n,v])=>(
            <div key={n} style={{display:"flex",flexDirection:"column",gap:5}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:14}}><b>{n}</b><span className="mono">{fmtKz(v)}</span></div>
              <div style={{height:10,borderRadius:6,background:"var(--line-2)",overflow:"hidden"}}><div style={{height:"100%",borderRadius:6,background:"var(--info)",width:`${Math.round(v/maxCat*100)}%`}}/></div>
            </div>
          ))}
      </section>

      {despMes.length>0&&<section className="card" style={{display:"flex",flexDirection:"column"}}>
        <h2 className="h2" style={{marginBottom:6}}>Despesas do mês</h2>
        {despMes.map(d=>(
          <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--line-2)"}}>
            <div style={{display:"flex",flexDirection:"column",gap:2,minWidth:0}}>
              <span style={{fontSize:15,fontWeight:700}}>{d.descricao}</span>
              <span style={{fontSize:13,color:"var(--ink-2)"}}>{fmtDateCurta(d.data)} · {d.categoria}</span>
            </div>
            <span className="mono" style={{fontSize:14,flexShrink:0}}>{fmtKz(d.valor)}</span>
          </div>
        ))}
      </section>}

      <button className="card" onClick={()=>setRel(true)} style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left",font:"inherit",color:"inherit",minHeight:56}}>
        <Icon n="file" s={22} style={{color:"var(--info)"}}/>
        <span style={{display:"flex",flexDirection:"column",flexGrow:1}}><b style={{fontSize:15}}>Relatório de {MESES[sel.mes-1]} {sel.ano}</b><span style={{fontSize:13,color:"var(--ink-2)"}}>Ver, imprimir ou guardar em PDF</span></span>
        <Icon n="right" s={20} style={{color:"var(--ink-2)"}}/>
      </button>
      {rel&&<Modal title={`Relatório de ${MESES[sel.mes-1]} ${sel.ano}`} onClose={()=>setRel(false)} lg>
        <ReportPreview html={relatorioMensal(appData, sel.ano, sel.mes, { publico:true })} nome={`Relatorio ${MESES[sel.mes-1]} ${sel.ano}`} altura="62vh"/>
      </Modal>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PÁGINA PÚBLICA
═══════════════════════════════════════════════════════════════ */
export function PublicView({appData, offline, onGestor}) {
  const [tab,setTab] = useState("quotas");
  const { config, avisos=[] } = appData;
  const avisosSorted = [...avisos].sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  // O contador conta os avisos recentes de todos os tipos — os mesmos que o separador marca como "Novo"
  const novos = avisosSorted.filter(a=>(a.data||"")>=dias30()).length;
  const TABS = [["quotas","Quotas"],["contribuicoes","Contribuições"],["contas","Contas"],["avisos","Avisos"]];

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)"}}>
      <header style={{background:"var(--dark)",color:"#fff"}}>
        <div style={{maxWidth:840,margin:"0 auto",padding:"14px 16px 12px",display:"flex",flexDirection:"column",gap:2}}>
          <div className="serif" style={{fontSize:19,fontWeight:700}}>{config.predio}</div>
          {config.endereco&&<div style={{fontSize:13,color:"var(--dark-ink)"}}>{config.endereco}</div>}
          <div style={{fontSize:13,color:offline?"#FFD2C4":"var(--dark-ink)",fontWeight:offline?800:400,display:"flex",gap:6,alignItems:"center",marginTop:2}} role={offline?"alert":undefined}>
            {offline&&<Icon n="alert" s={15}/>}{offline?"Sem ligação · dados de ":"Actualizado "}{fmtDateTime(appData.timestamp)}
          </div>
        </div>
      </header>
      <nav aria-label="Secções" style={{background:"#fff",borderBottom:"1px solid var(--line)",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:840,margin:"0 auto",display:"grid",gridTemplateColumns:`repeat(${TABS.length},minmax(0,1fr))`}}>
          {TABS.map(([k,l])=>(
            <button key={k} className={`nav-tab${tab===k?" on":""}`} style={{justifyContent:"center",padding:"0 4px"}} aria-current={tab===k?"page":undefined} onClick={()=>setTab(k)}>
              {l}{k==="avisos"&&novos>0&&<span className="badge" aria-label={`${novos} novos`}>{novos}</span>}
            </button>
          ))}
        </div>
      </nav>

      <main style={{maxWidth:840,margin:"0 auto",padding:"16px 16px 8px"}}>
        {tab!=="contas"&&tab!=="avisos"&&<MeuApartamento appData={appData}/>}
        {tab==="quotas"&&<PredioQuotas appData={appData}/>}
        {tab==="contribuicoes"&&<PublicContribuicoes appData={appData}/>}
        {tab==="contas"&&<Contas appData={appData}/>}
        {tab==="avisos"&&<div className="anim" style={{display:"flex",flexDirection:"column",gap:10}}>
          {avisosSorted.length===0 ? <div className="card" style={{textAlign:"center",padding:"36px 0",color:"var(--ink-2)"}}>Sem avisos publicados.</div>
            : avisosSorted.map(a=><AvisoCard key={a.id} a={a}/>)}
        </div>}
      </main>

      <footer style={{maxWidth:840,margin:"0 auto",padding:"8px 16px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,fontSize:13,color:"var(--ink-2)"}}>
        <span>Portal do Condomínio · {APP_VERSAO}</span>
        <button className="btn btn-ghost" onClick={onGestor} style={{color:"var(--info)"}}><Icon n="lock" s={16}/>Área do gestor</button>
      </footer>
    </div>
  );
}
