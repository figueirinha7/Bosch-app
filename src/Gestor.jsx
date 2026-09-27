import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { MESES, MESES_S, CATS, AVISO_TIPOS, METODOS, ESTADOS_CONTRIB, today, chaveMes, lblMes,
  fmtKz, fmtNum, fmtSinal, fmtDate, fmtDateCurta, nomeApt, apiPost, waAbrir, msgLembrete, msgAviso,
  quotaInfo, estadoMes, nivelAtraso, contribInfo, contribFechada, ordenarContribs, metaContrib, situacaoApt, intervaloMeses, alocar, resumoMeses,
  fluxoMensal, contaMes, serieMeses, cobrancaMes, rascunhoGet, rascunhoSet } from "./lib.js";
import { Icon, WaSvg, Modal, FG, CheckRow, Warn, Info, ModalBtns, RowActions, MesSelect, AnoSelect, Segmented,
  MesNav, Menu, AptCombo, ConfirmModal, Toast } from "./ui.jsx";
import { AvisoCard } from "./Publico.jsx";
import { CentroRelatorios, ReportPreview } from "./Relatorios.jsx";
import { relatorioExtracto } from "./relatoriosHtml.js";

const TABS = [["painel","Painel","chart"],["quotas","Quotas","calendar"],["fracoes","Apartamentos","building"],["contribuicoes","Contribuições","list"],
  ["despesas","Despesas","receipt"],["avisos","Avisos","megaphone"],["relatorios","Relatórios","file"]];
const TITULOS = { fracao:"apartamento", pagQuota:"pagamento de quota", editQuota:"pagamento de quota", isentarMes:"isenção de quota",
  isentarContrib:"isenção de contribuição", contrib:"contribuição", pagContrib:"pagamento de contribuição", pagContribBulk:"lançamento para vários apartamentos",
  despesa:"despesa", aviso:"aviso" };

const CEL_Q = {
  pago:     { background:"var(--ok-fill)", color:"#fff", border:"none" },
  parcial:  { background:"var(--warn-bg)", border:"2px solid var(--warn-line)", color:"#7A4109" },
  falta:    { background:"var(--divida-bg)", border:"2px solid var(--brand)", color:"var(--divida)" },
  isento:   { background:"var(--line-3)", color:"#3D3832", border:"none" },
  futuro:   { background:"transparent", border:"1.5px dashed #BFB8AE", color:"var(--ink-3)" },
  antes:    { background:"transparent", border:"1px solid var(--line-2)", color:"var(--ink-3)" },
  excluido: { background:"var(--line-2)", border:"none", color:"var(--ink-3)" },
};
const EST_LBL = { pago:"Pago", parcial:"Parcial", falta:"Em falta", isento:"Isento", futuro:"Por vencer", antes:"Antes do início", excluido:"Sem quota mensal" };
const numCmp = (a,b)=>String(a.numero).localeCompare(String(b.numero),"pt",{numeric:true});

function Kpi({label, valor, sub, cor, children}) {
  return (
    <div className="kpi">
      <span className="kpi-l">{label}</span>
      {valor!==undefined&&<span className="kpi-v" style={{color:cor}}>{valor}</span>}
      {children}
      {sub&&<span style={{fontSize:13,color:"#3D3832"}}>{sub}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DETALHE DE UM APARTAMENTO
═══════════════════════════════════════════════════════════════ */
function DrillModal({fracao, appData, onClose, onRegistar, onExtracto}) {
  const { config } = appData;
  const { qi, contribs, total } = situacaoApt(fracao, appData);
  const propTel = fracao.prop_telefone||fracao.telefone;
  const nv = nivelAtraso(qi.mesesAtraso);
  return (
    <Modal title={`Apartamento ${fracao.numero}`} onClose={onClose} lg>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
          <div style={{background:"var(--surface-2)",border:"1px solid var(--line)",borderRadius:12,padding:"12px 16px",display:"flex",flexDirection:"column",gap:2}}>
            <span className="kpi-l">Proprietário</span><b>{nomeApt(fracao)}</b><span className="muted" style={{fontSize:14}}>{propTel||"sem telefone"}</span>
            {fracao.inq_nome&&<><span className="kpi-l" style={{marginTop:8}}>Inquilino</span><b>{fracao.inq_nome}</b><span className="muted" style={{fontSize:14}}>{fracao.inq_telefone||"sem telefone"}</span></>}
          </div>
          <div style={{background:total?"var(--divida-bg)":"var(--ok-bg)",borderRadius:12,padding:"12px 16px",display:"flex",flexDirection:"column",gap:4}}>
            <span className="kpi-l">Dívida total</span>
            <span className="mono" style={{fontSize:24,color:total?"var(--divida)":"var(--ok)"}}>{fmtKz(total)}</span>
            {qi.mesesAtraso>0&&<span className={`tag ${nv.tag}`} style={{alignSelf:"flex-start"}}>{nv.label}</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {!fracao.excluiQuota&&<button className="btn btn-red" onClick={onRegistar}><Icon n="plus" s={16}/>Registar pagamento</button>}
          <button className="btn btn-outline" onClick={onExtracto}><Icon n="file" s={16}/>Extracto</button>
          {total>0&&propTel&&<button className="wa-btn" onClick={()=>waAbrir(propTel,msgLembrete(fracao,nomeApt(fracao),qi,contribs,config))}><WaSvg s={15}/>Lembrete ao proprietário</button>}
          {total>0&&fracao.inq_telefone&&<button className="wa-btn" onClick={()=>waAbrir(fracao.inq_telefone,msgLembrete(fracao,fracao.inq_nome,qi,contribs,config))}><WaSvg s={15}/>Lembrete ao inquilino</button>}
        </div>
        {qi.mesesEmFalta.length>0&&<div>
          <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>Quotas em falta ({qi.mesesAtraso})</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {qi.mesesEmFalta.map(m=>(
              <span key={m.key} style={{background:"var(--divida-bg)",borderRadius:8,padding:"5px 10px",fontSize:14}}>
                <b>{lblMes(m)}</b>{m.pago>0&&<span className="muted" style={{fontSize:12}}> (pago {fmtNum(m.pago)})</span>} <span className="mono" style={{color:"var(--divida)"}}>{fmtNum(m.emFalta)}</span>
              </span>
            ))}
          </div>
        </div>}
        {contribs.length>0&&<div>
          <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>Contribuições em dívida</div>
          {contribs.map(c=>(
            <div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:"var(--warn-bg)",borderRadius:8,marginBottom:6,fontSize:14}}>
              <span>{c.titulo}</span><span className="mono" style={{color:"var(--divida)"}}>{fmtKz(c.divida)}</span>
            </div>
          ))}
        </div>}
        {total===0&&<div style={{display:"flex",gap:8,alignItems:"center",color:"var(--ok)",fontWeight:700}}><Icon n="checkCircle" s={20}/>Sem dívidas registadas</div>}
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ÁREA DO GESTOR
═══════════════════════════════════════════════════════════════ */
export function GestorDashboard({appData, apiUrl, token, exp, onBack, onLogout, onExpired, onReload, onReconfig, loading}) {
  const now = new Date(), anoAtual = now.getFullYear(), mesAtual = now.getMonth()+1;
  const [tab,setTab]=useState("painel");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [errs,setErrs]=useState({});
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState(null);
  const [confirmar,setConfirmar]=useState(null);
  const [drillApt,setDrillApt]=useState(null);
  const [extracto,setExtracto]=useState(null);
  const [cel,setCel]=useState(null);
  const [restaurar,setRestaurar]=useState(()=>rascunhoGet());
  const [restante,setRestante]=useState(()=>exp?exp-Date.now():Infinity);
  // painel e filtros
  const [pm,setPm]=useState({ano:anoAtual, mes:mesAtual});
  const [qAno,setQAno]=useState(anoAtual);
  const [qTxt,setQTxt]=useState(""); const [qEst,setQEst]=useState("todos");
  const [hist,setHist]=useState(false);
  const [fApt,setFApt]=useState("");
  const [fDAno,setFDAno]=useState(""); const [fDCat,setFDCat]=useState(""); const [fDTxt,setFDTxt]=useState("");
  const [abertos,setAbertos]=useState({});

  const { config, fracoes, pagamentosQuota, contribuicoes, pagamentosContribuicao, despesas, avisos=[] } = appData;
  const { quotaMensal, anoBase, mesBase } = config;

  /* ── rascunho e sessão ── */
  useEffect(()=>{ if (modal) rascunhoSet({modal, form}); },[modal, form]);
  useEffect(()=>{
    if (!exp) return;
    const tick = ()=>{ const r = exp-Date.now(); setRestante(r); if (r<=0) onExpired(); };
    const t = setInterval(tick, 20000); tick();
    return ()=>clearInterval(t);
  },[exp]); // eslint-disable-line

  const sf = k=>v=>{ setForm(p=>({...p,[k]:v})); setErrs(e=>e[k]?{...e,[k]:undefined}:e); };
  const om = (type,d={})=>{ setModal(type); setForm({data:today(),...d}); setErrs({}); };
  const cm = ()=>{ setModal(null); setForm({}); setErrs({}); rascunhoSet(null); };
  const showToast = (t)=>{ setToast(t); setTimeout(()=>setToast(x=>x===t?null:x), t.action?8000:t.ok?3500:7000); };
  // Erro junto ao campo (e foco nele); sem campo, aviso em baixo
  const fail = (msg, campo)=>{
    if (campo) { setErrs({[campo]:msg}); setTimeout(()=>document.getElementById("f-"+campo)?.focus(), 30); }
    else showToast({ok:false,msg});
  };
  const ef = campo => ({ id:"f-"+campo, err:errs[campo] });

  const post = async(action, data, {close=true, msgOk="Guardado no Google Sheets", onDone, toastAction}={})=>{
    setSaving(true);
    try {
      const r = await apiPost(apiUrl,action,data,token);
      setSaving(false);
      showToast({ok:true,msg:msgOk,action:toastAction});
      if (close) cm();
      onDone?.(r);
      onReload();
      return true;
    } catch(e){
      setSaving(false);
      if (e.code==="AUTH"){ onExpired(); return false; }
      showToast({ok:false,msg:e.message});
      return false;
    }
  };
  // Apagar: confirma dentro da app e oferece "Anular" (volta a criar o registo)
  const apagar = (action, item, desc, desfazer, extra={})=>setConfirmar({
    title:"Apagar registo?", danger:true, okLabel:"Apagar",
    body:<>Vai apagar {desc}.<br/><span className="muted" style={{fontSize:14}}>Pode anular durante alguns segundos.</span></>,
    onOk:()=>post(action,{_row:item._row,_sig:item._sig,...extra},{close:false,msgOk:"Apagado",
      toastAction: desfazer ? {label:"Anular", fn:()=>post(desfazer.action, desfazer.data, {close:false, msgOk:"Registo reposto"})} : undefined}),
  });

  const aptById  = id=>fracoes.find(x=>x.id===id);
  const aptByNum = n=>fracoes.find(x=>String(x.numero)===String(n));
  const contribById = id=>contribuicoes.find(c=>c.id===id);

  const anos = useMemo(()=>{
    const ys=[anoBase,...pagamentosQuota.map(p=>p.ano),...despesas.map(d=>parseInt(d.data?.slice(0,4)||"0"))].filter(y=>y>2000&&y<=anoAtual+1);
    const r=[]; for(let y=Math.min(anoAtual,...ys);y<=anoAtual+1;y++) r.push(y); return r;
  },[anoBase,pagamentosQuota,despesas,anoAtual]);

  /* ── cálculos ── */
  const fluxo = useMemo(()=>fluxoMensal(appData),[appData]);
  const situ = useMemo(()=>{ const m={}; fracoes.forEach(f=>{ m[f.id]=situacaoApt(f,appData); }); return m; },[appData,fracoes]);
  const infoApt = f=>{ const s=situ[f.id]; if(!s) return null;
    if (f.excluiQuota) return {txt:s.total?fmtKz(s.total):"Sem quota",tone:s.total?"bad":""};
    return s.qi.mesesAtraso ? {txt:`${s.qi.mesesAtraso} ${s.qi.mesesAtraso===1?"mês":"meses"} · ${fmtNum(s.qi.divida)}`,tone:"bad"} : {txt:"Em dia",tone:"ok"}; };
  const totQ = fracoes.reduce((s,f)=>s+(situ[f.id]?.qi.divida||0),0);
  const totC = fracoes.reduce((s,f)=>s+(situ[f.id]?.contribs.reduce((a,c)=>a+c.divida,0)||0),0);

  /* ════ ABRIR FORMULÁRIOS ════ */
  const abrirFracao = (f)=> f
    ? om("fracao",{_row:f._row,_sig:f._sig,numero:f.numero,andar:f.andar||"",prop_nome:nomeApt(f),prop_telefone:f.prop_telefone||f.telefone||"",
        prop_email:f.prop_email||"",prop_nif:f.prop_nif||"",inq_nome:f.inq_nome||"",inq_telefone:f.inq_telefone||"",inq_email:f.inq_email||"",
        inq_inicio_contrato:f.inq_inicio_contrato||"",observacoes:f.observacoes||"",excluiQuota:!!f.excluiQuota})
    : om("fracao",{excluiQuota:false});
  const selDoApt = (num)=>{
    const f=aptByNum(num);
    const qi=f&&!f.excluiQuota?quotaInfo(f.id,pagamentosQuota,quotaMensal,anoBase,mesBase):null;
    const sel=(qi?.mesesEmFalta||[]).map(m=>chaveMes(m.ano,m.mes));
    return { fracaoNum:num, sel, anoVista: qi?.mesesEmFalta[0]?.ano || anoAtual, valor:"" };
  };
  const abrirQuota = (num, meses)=> om("pagQuota",{ metodo:"Transferência", anoVista:anoAtual, sel:[], valor:"",
    ...(num?selDoApt(num):{}), ...(meses?{sel:meses.map(m=>chaveMes(m.ano,m.mes)), anoVista:meses[0].ano}:{}) });
  const abrirEditQuota = (p)=>{ const f=aptById(p.fracaoId); om("editQuota",{_row:p._row,_sig:p._sig,fracaoNum:f?.numero||"",mes:p.mes||mesAtual,ano:p.ano||anoAtual,data:p.data||today(),valor:p.valor,metodo:p.metodo||"",referencia:p.referencia||""}); };
  const abrirIsencao = (num, m)=> om("isentarMes",{fracaoNum:num||"",mesIni:m?.mes||mesAtual,anoIni:m?.ano||anoAtual,mesFim:m?.mes||mesAtual,anoFim:m?.ano||anoAtual});
  const abrirContrib = (c)=> c
    ? om("contrib",{_row:c._row,_sig:c._sig,id:c.id,titulo:c.titulo,descricao:c.descricao||"",valorPorFracao:c.valorPorFracao||"",valorTotal:c.valorTotal||"",
        dataVencimento:c.dataVencimento||"",categoria:c.categoria||"",estado:c.estado||"Aberto",excluidos:(c.excluidos||[]).map(id=>aptById(id)?.numero||id)})
    : om("contrib",{excluidos:[]});
  const abrirPagContrib = (p, pre={})=> p
    ? om("pagContrib",{_row:p._row,_sig:p._sig,contribId:p.contribuicaoId,fracaoNum:aptById(p.fracaoId)?.numero||"",data:p.data||today(),valor:p.valor,metodo:p.metodo||""})
    : om("pagContrib",{metodo:"Transferência",...pre,...(pre.contribId&&contribById(pre.contribId)?.valorPorFracao?{valor:contribById(pre.contribId).valorPorFracao}:{})});
  const abrirBulk = (cid)=>{ const c=contribById(cid); om("pagContribBulk",{contribId:cid||"",bulkApts:[],metodo:"Transferência",...(c?.valorPorFracao?{valor:c.valorPorFracao}:{})}); };
  const abrirDespesa = (d)=> d
    ? om("despesa",{_row:d._row,_sig:d._sig,data:d.data,descricao:d.descricao,categoria:d.categoria,valor:d.valor,fornecedor:d.fornecedor||"",observacoes:d.observacoes||""})
    : om("despesa");
  const abrirAviso = (a)=> a
    ? om("aviso",{_row:a._row,_sig:a._sig,tipo:a.tipo,titulo:a.titulo,conteudo:a.conteudo||"",data:a.data||today(),autor:a.autor||""})
    : om("aviso",{autor:config.gestorNome||""});

  const lembreteDireto = (f)=>{
    const { qi, contribs } = situ[f.id];
    const propTel=f.prop_telefone||f.telefone;
    if(propTel&&f.inq_telefone) return setDrillApt(f);
    if(propTel) return waAbrir(propTel,msgLembrete(f,nomeApt(f),qi,contribs,config));
    if(f.inq_telefone) return waAbrir(f.inq_telefone,msgLembrete(f,f.inq_nome,qi,contribs,config));
  };
  const temTel = f=>!!(f.prop_telefone||f.telefone||f.inq_telefone);

  /* ════ SUBMITS ════ */
  const submitFracao = ()=>{
    const numero=String(form.numero||"").trim(), nome=String(form.prop_nome||"").trim();
    if(!numero) return fail("Indique o número do apartamento","numero");
    if(fracoes.some(f=>String(f.numero).trim().toLowerCase()===numero.toLowerCase()&&f._row!==form._row)) return fail(`Já existe o apartamento ${numero}`,"numero");
    if(!nome) return fail("Indique o nome do proprietário","prop_nome");
    const d={numero,andar:form.andar||"",prop_nome:nome,prop_telefone:form.prop_telefone||"",prop_email:form.prop_email||"",prop_nif:form.prop_nif||"",
      inq_nome:form.inq_nome||"",inq_telefone:form.inq_telefone||"",inq_email:form.inq_email||"",inq_inicio_contrato:form.inq_inicio_contrato||"",
      observacoes:form.observacoes||"",exclui_quota:form.excluiQuota?"Sim":"Não"};
    form._row ? post("edit_fracao",{...d,_row:form._row,_sig:form._sig}) : post("add_fracao",d);
  };

  // Registar pagamento: meses escolhidos em chips, valor repartido pelo que falta em cada mês
  const planoQuota = ()=>{
    const f=aptByNum(form.fracaoNum);
    const meses=(form.sel||[]).slice().sort().map(k=>({ano:+k.slice(0,4),mes:+k.slice(5,7)}));
    const alvos=meses.map(m=>{ const e=f?estadoMes(f,m.ano,m.mes,pagamentosQuota,config):null; return e&&e.k==="parcial"?e.emFalta:quotaMensal; });
    const sugerido=alvos.reduce((s,v)=>s+v,0);
    const total=form.valor===""||form.valor===undefined?sugerido:Math.round(+form.valor)||0;
    const valores=alocar(total,alvos);
    return { f, meses, alvos, sugerido, total, valores };
  };
  const submitQuota = (novo=false)=>{
    const { f, meses, total, valores } = planoQuota();
    if(!f) return fail("Escolha o apartamento","apt");
    if(f.excluiQuota) return fail("Este apartamento não paga quota mensal","apt");
    if(!meses.length) return fail("Escolha pelo menos um mês","meses");
    if(!(total>0)) return fail("Indique um valor maior que zero","valor");
    if(!form.data) return fail("Indique a data do pagamento","data");
    const linhas=meses.map((m,i)=>({...m,valor:valores[i]})).filter(m=>m.valor>0);
    const reset = ()=>setForm(p=>({data:p.data,metodo:p.metodo,sel:[],anoVista:p.anoVista,valor:"",fracaoNum:""}));
    post("add_pagamentos_quota",{fracao_numero:f.numero,data:form.data,metodo:form.metodo||"",referencia:form.referencia||"",meses:linhas},
      { close:!novo, msgOk:`Registado: ${f.numero} · ${resumoMeses(linhas)} · ${fmtKz(total)}`, onDone: novo?reset:undefined });
  };
  const submitEditQuota = ()=>{
    const f=aptByNum(form.fracaoNum);
    if(!f) return fail("Escolha o apartamento","apt");
    if(!form.data) return fail("Indique a data","data");
    if(form.valor===""||isNaN(+form.valor)||+form.valor<0) return fail("Indique um valor válido","valor");
    post("edit_pagamento_quota",{_row:form._row,_sig:form._sig,fracao_numero:f.numero,data:form.data,valor:+form.valor,mes:+form.mes,ano:+form.ano,metodo:form.metodo||"",referencia:form.referencia||""});
  };
  const submitIsencao = ()=>{
    if(!aptByNum(form.fracaoNum)) return fail("Escolha o apartamento","apt");
    const meses=intervaloMeses(+form.mesIni,+form.anoIni,+form.mesFim,+form.anoFim);
    if(!meses.length) return fail("O mês final tem de ser igual ou posterior ao inicial","mesFim");
    post("add_isencoes_quota",{fracao_numero:form.fracaoNum,meses,motivo:form.motivo||""});
  };
  const submitContrib = ()=>{
    const titulo=String(form.titulo||"").trim();
    if(!titulo) return fail("Indique o título","titulo");
    if(contribuicoes.some(c=>c.titulo.trim().toLowerCase()===titulo.toLowerCase()&&c.id!==form.id)) return fail("Já existe uma contribuição com esse título","titulo");
    const vpf=+form.valorPorFracao||0, vt=+form.valorTotal||0;
    if(vpf<0) return fail("O valor não pode ser negativo","valorPorFracao");
    if(vt<0) return fail("O valor não pode ser negativo","valorTotal");
    const d={titulo,valorPorFracao:vpf,valorTotal:vt,dataVencimento:form.dataVencimento||"",descricao:form.descricao||"",categoria:form.categoria||"",excluidos:(form.excluidos||[]).join(",")};
    form._row ? post("edit_contribuicao",{...d,estado:form.estado||"Aberto",id:form.id,_row:form._row,_sig:form._sig}) : post("add_contribuicao",d);
  };
  const submitPagContrib = ()=>{
    const c=contribById(form.contribId), f=aptByNum(form.fracaoNum);
    if(!c) return fail("Escolha a contribuição","contrib");
    if(!form._row&&contribFechada(c)) return fail("Esta contribuição está fechada e já não aceita pagamentos","contrib");
    if(!f) return fail("Escolha o apartamento","apt");
    if(!(+form.valor>0)) return fail("Indique um valor maior que zero","valor");
    if(!form.data) return fail("Indique a data","data");
    const d={contribuicao_id:c.id,fracao_numero:f.numero,data:form.data,valor:+form.valor,metodo:form.metodo||""};
    if(form._row) return post("edit_pagamento_contribuicao",{...d,_row:form._row,_sig:form._sig});
    const ci=contribInfo(c,f.id,pagamentosContribuicao);
    const motivo = ci.isLivre ? null : ci.isento ? "está isento desta contribuição" : ci.excluido ? "está excluído desta contribuição" : ci.pago ? `já pagou esta contribuição (${fmtKz(ci.totalPago)})` : null;
    if (motivo) return setConfirmar({ title:"Registar mesmo assim?", okLabel:"Registar", body:`O apartamento ${f.numero} ${motivo}.`, onOk:()=>post("add_pagamento_contribuicao",d) });
    post("add_pagamento_contribuicao",d);
  };
  const submitIsentarContrib = ()=>{
    const c=contribById(form.contribId), f=aptByNum(form.fracaoNum);
    if(!c) return fail("Escolha a contribuição","contrib");
    if(contribFechada(c)) return fail("Esta contribuição está fechada","contrib");
    if(!f) return fail("Escolha o apartamento","apt");
    post("add_pagamento_contribuicao",{contribuicao_id:c.id,fracao_numero:f.numero,data:today(),valor:0,metodo:"Isento",referencia:form.motivo||""});
  };
  const submitBulk = ()=>{
    const c=contribById(form.contribId), apts=form.bulkApts||[];
    if(!c) return fail("Escolha a contribuição","contrib");
    if(contribFechada(c)) return fail("Esta contribuição está fechada e já não aceita pagamentos","contrib");
    if(!(+form.valor>0)) return fail("Indique um valor maior que zero","valor");
    if(!form.data) return fail("Indique a data","data");
    if(!apts.length) return fail("Seleccione pelo menos um apartamento","bulk");
    const d={contribuicao_id:c.id,fracao_numeros:apts,data:form.data,valor_por_fracao:+form.valor,metodo:form.metodo||""};
    const jaPagaram=apts.filter(n=>{const f=aptByNum(n);const ci=f&&contribInfo(c,f.id,pagamentosContribuicao);return ci&&!ci.isLivre&&ci.pago;});
    if(jaPagaram.length) return setConfirmar({ title:"Lançar mesmo assim?", okLabel:`Lançar para ${apts.length}`,
      body:`${jaPagaram.join(", ")} já ${jaPagaram.length===1?"pagou ou está isento":"pagaram ou estão isentos"} desta contribuição.`, onOk:()=>post("add_pagamento_contribuicao_bulk",d) });
    post("add_pagamento_contribuicao_bulk",d);
  };
  const fecharContrib = c=>setConfirmar({ title:"Fechar contribuição?", okLabel:"Fechar",
    body:<>“{c.titulo}” deixa de aceitar pagamentos e o que falta pagar deixa de contar como dívida dos apartamentos.<br/><span className="muted" style={{fontSize:14}}>O histórico e os pagamentos feitos mantêm-se. Pode reabrir mais tarde.</span></>,
    onOk:()=>post("edit_contribuicao",{id:c.id,estado:"Fechado",_row:c._row,_sig:c._sig},{close:false,msgOk:"Contribuição fechada"}) });
  const reabrirContrib = c=>setConfirmar({ title:"Reabrir contribuição?", okLabel:"Reabrir",
    body:`“${c.titulo}” volta a aceitar pagamentos e o que falta pagar volta a contar como dívida dos apartamentos.`,
    onOk:()=>post("edit_contribuicao",{id:c.id,estado:"Aberto",_row:c._row,_sig:c._sig},{close:false,msgOk:"Contribuição reaberta"}) });
  const submitDespesa = ()=>{
    if(!form.data) return fail("Indique a data","data");
    if(!String(form.descricao||"").trim()) return fail("Indique a descrição","descricao");
    if(!form.categoria) return fail("Escolha a categoria","categoria");
    if(!(+form.valor>0)) return fail("Indique um valor maior que zero","valor");
    const d={data:form.data,valor:+form.valor,descricao:form.descricao.trim(),categoria:form.categoria,fornecedor:form.fornecedor||"",observacoes:form.observacoes||""};
    form._row ? post("edit_despesa",{...d,_row:form._row,_sig:form._sig}) : post("add_despesa",d);
  };
  const submitAviso = ()=>{
    if(!form.tipo) return fail("Escolha o tipo","tipo");
    if(!String(form.titulo||"").trim()) return fail("Indique o título","titulo");
    if(!form.data) return fail("Indique a data","data");
    const d={tipo:form.tipo,titulo:form.titulo.trim(),conteudo:form.conteudo||"",data:form.data,autor:form.autor??config.gestorNome??""};
    form._row ? post("edit_aviso",{...d,_row:form._row,_sig:form._sig})
      : post("add_aviso",d,{msgOk:"Aviso publicado",toastAction:{label:"Partilhar no WhatsApp",fn:()=>waAbrir("",msgAviso(d,config))}});
  };

  /* ── desfazer: dados para voltar a criar um registo apagado ── */
  const undoQuota = p=>({action:"add_pagamentos_quota",data:{fracao_numero:aptById(p.fracaoId)?.numero,data:p.data,metodo:p.metodo,referencia:p.referencia,observacoes:p.observacoes,meses:[{mes:p.mes,ano:p.ano,valor:p.valor}]}});
  const undoPagContrib = p=>({action:"add_pagamento_contribuicao",data:{contribuicao_id:p.contribuicaoId,fracao_numero:aptById(p.fracaoId)?.numero,data:p.data,valor:p.valor,metodo:p.metodo,referencia:p.referencia}});
  const undoDespesa = d=>({action:"add_despesa",data:{data:d.data,valor:d.valor,descricao:d.descricao,categoria:d.categoria,fornecedor:d.fornecedor,numFatura:d.numFatura,observacoes:d.observacoes}});
  const undoAviso = a=>({action:"add_aviso",data:{tipo:a.tipo,titulo:a.titulo,conteudo:a.conteudo,data:a.data,autor:a.autor}});
  const undoContrib = c=>({action:"add_contribuicao",data:{titulo:c.titulo,valorPorFracao:c.valorPorFracao,valorTotal:c.valorTotal,dataVencimento:c.dataVencimento,descricao:c.descricao,categoria:c.categoria,excluidos:(c.excluidos||[]).map(id=>aptById(id)?.numero||id).join(",")}});
  const apagarQuota = p=>{ const f=aptById(p.fracaoId); apagar("delete_pagamento_quota",p,`o ${p.metodo==="Isento"?"registo de isenção":"pagamento"} do apt. ${f?.numero||"?"} (${p.mes?MESES_S[p.mes-1]:"?"} ${p.ano||""}${p.metodo==="Isento"?"":", "+fmtKz(p.valor)})`,undoQuota(p)); };

  /* ── listas filtradas ── */
  const fracoesOrd = useMemo(()=>[...fracoes].sort(numCmp),[fracoes]);
  const fracoesFilt = fracoesOrd.filter(f=>{ const t=fApt.trim().toLowerCase(); return !t||[f.numero,f.prop_nome,f.inq_nome].some(x=>String(x||"").toLowerCase().includes(t)); });
  const despFilt = [...despesas]
    .filter(d=>(!fDAno||d.data?.startsWith(fDAno+"-"))&&(!fDCat||d.categoria===fDCat)&&(!fDTxt.trim()||[d.descricao,d.fornecedor,d.observacoes].some(x=>String(x||"").toLowerCase().includes(fDTxt.trim().toLowerCase()))))
    .sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  const catsDesp = [...new Set([...CATS,...despesas.map(d=>d.categoria).filter(Boolean)])];

  const irPara = k=>{ setTab(k); window.scrollTo({top:0}); };
  const partilharLink = ()=>{ const u=window.location.origin+window.location.pathname; waAbrir("",`🏢 *${config.predio}*\nConsulte o estado do condomínio:\n${u}`); };

  /* ═════════════════════ RENDER ═════════════════════ */
  return (
    <div style={{minHeight:"100vh",background:"var(--bg)"}}>
      <style>{`.gst-main{max-width:1180px;margin:0 auto;padding:24px 16px 40px}
        .painel-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:16px;align-items:start}
        .cob-row{display:grid;grid-template-columns:52px minmax(0,1fr) minmax(0,150px) 100px 190px;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-2)}
        .qm th,.qm td{padding:4px 3px;text-align:center;border-bottom:1px solid var(--line-2)}
        .qm td:first-child,.qm th:first-child{position:sticky;left:0;background:#fff;z-index:1;text-align:left;padding-left:0}
        .qm tbody tr:hover td{background:#fff}
        .qcel{width:40px;height:32px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;cursor:pointer;padding:0}
        .qcel:disabled{cursor:default}
        .qcur{background:#F3EFE9!important}
        .fab{display:none!important;position:fixed;right:16px;bottom:84px;z-index:90;min-height:56px;padding:0 22px;border-radius:28px;box-shadow:0 8px 24px rgba(181,52,26,.35);font-size:16px}
        .bnav{position:fixed;left:0;right:0;bottom:0;z-index:95;height:68px;background:#fff;border-top:1px solid var(--line);display:none;grid-template-columns:repeat(4,minmax(0,1fr))}
        .bnav>button,.bnav>div>button{width:100%;height:68px;border:none;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:700;color:var(--ink-2);cursor:pointer}
        .bnav>div{display:flex!important}
        .bnav .on{color:var(--brand);font-weight:800}
        @media(max-width:1000px){.painel-grid{grid-template-columns:1fr}}
        @media(max-width:700px){.fab{display:inline-flex!important}.bnav{display:grid}.kpis{grid-template-columns:1fr 1fr!important;gap:10px!important}.kpis .kpi{padding:12px 14px}.kpis .kpi:first-child,.kpis .kpi:last-child{grid-column:1/3}.qm-apt{min-width:56px!important}.kpis .kpi-v{font-size:18px}.gst-main{padding:16px 12px 150px}.cob-row{grid-template-columns:44px minmax(0,1fr) auto;row-gap:4px}.cob-row .cob-falta{grid-column:2/3}.cob-row .cob-val{grid-column:3/4;grid-row:1}.cob-row .cob-act{grid-column:1/4;justify-content:flex-start!important}}`}</style>

      {/* ── CABEÇALHO ── */}
      <header style={{background:"#fff",borderBottom:"1px solid var(--line)",position:"sticky",top:0,zIndex:60}}>
        <div style={{maxWidth:1180,margin:"0 auto",padding:"0 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",minHeight:58,gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
              <span className="serif" style={{fontSize:18,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{config.predio}</span>
              <span className="tag tag-blue">Gestor</span>
              {loading&&<span className="spinner" role="status" aria-label="A actualizar"/>}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
              <button className="btn btn-outline" onClick={onBack}><Icon n="eye" s={17}/><span className="hide-sm">Ver página pública</span></button>
              <Menu label="" icon="user" ariaLabel="Menu da conta" btnClass="btn btn-outline btn-icon" items={[
                {label:"Actualizar dados", icon:"refresh", onClick:onReload},
                {label:"Partilhar link da página", icon:"share", onClick:partilharLink},
                {label:"Configurar ligação", icon:"settings", onClick:()=>setConfirmar({title:"Configurar ligação?",okLabel:"Continuar",body:"Vai abrir o ecrã para mudar o endereço do Apps Script. Só é preciso se o script foi implementado de novo.",onOk:onReconfig})},
                {label:"Terminar sessão", icon:"logout", onClick:onLogout, danger:true},
              ]}/>
            </div>
          </div>
          <nav aria-label="Secções do gestor" className="hide-sm" style={{display:"flex",gap:2,overflowX:"auto",scrollbarWidth:"none"}}>
            {TABS.map(([k,l])=><button key={k} className={`nav-tab${tab===k?" on":""}`} aria-current={tab===k?"page":undefined} onClick={()=>irPara(k)}>{l}</button>)}
          </nav>
        </div>
      </header>

      <main className="gst-main anim" key={tab}>
        {/* avisos de sessão e rascunho */}
        {restante < 10*60*1000 && <div className="banner banner-warn" role="alert" style={{marginBottom:14}}>
          <Icon n="alert" s={18}/><span style={{flex:1}}>A sessão termina às {new Date(exp).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})}. O formulário aberto fica guardado e pode retomá-lo depois de entrar de novo.</span>
          <button className="btn btn-outline btn-sm" onClick={onExpired}>Entrar de novo</button>
        </div>}
        {restaurar&&restaurar.modal&&<div className="banner banner-info" style={{marginBottom:14}}>
          <Icon n="file" s={18}/><span style={{flex:1}}>Ficou por gravar: {TITULOS[restaurar.modal]||"um formulário"}.</span>
          <button className="btn btn-blue btn-sm" onClick={()=>{ setModal(restaurar.modal); setForm(restaurar.form||{}); setErrs({}); setRestaurar(null); }}>Retomar</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>{ rascunhoSet(null); setRestaurar(null); }}>Descartar</button>
        </div>}

        {tab==="painel"&&Painel()}
        {tab==="quotas"&&Quotas()}
        {tab==="fracoes"&&Apartamentos()}
        {tab==="contribuicoes"&&Contribuicoes()}
        {tab==="despesas"&&Despesas()}
        {tab==="avisos"&&Avisos()}
        {tab==="relatorios"&&<>
          <h1 className="section-hd" style={{marginBottom:16}}>Relatórios</h1>
          <CentroRelatorios appData={appData} anos={anos}/>
        </>}
      </main>

      {/* ── TELEMÓVEL: botão Registar e barra inferior ── */}
      {tab!=="relatorios"&&<button className="btn btn-red fab" onClick={()=>abrirQuota()}><Icon n="plus" s={20} w={2.6}/>Registar</button>}
      <nav aria-label="Secções do gestor" className="bnav">
        {TABS.slice(0,3).map(([k,l,i])=><button key={k} className={tab===k?"on":""} aria-current={tab===k?"page":undefined} onClick={()=>irPara(k)}><Icon n={i} s={22}/>{l}</button>)}
        <Menu label="Mais" icon="menu" chevron={false} up align="right" ariaLabel="Mais secções" btnClass={TABS.slice(3).some(([k])=>k===tab)?"on":""}
          items={TABS.slice(3).map(([k,l,i])=>({label:l,icon:i,onClick:()=>irPara(k)}))}/>
      </nav>

      <Toast t={toast} onClose={()=>setToast(null)}/>
      {confirmar&&<ConfirmModal c={confirmar} onClose={()=>setConfirmar(null)}/>}
      {drillApt&&<DrillModal fracao={drillApt} appData={appData} onClose={()=>setDrillApt(null)}
        onRegistar={()=>{ const n=drillApt.numero; setDrillApt(null); abrirQuota(n); }}
        onExtracto={()=>{ const f=drillApt; setDrillApt(null); setExtracto(f); }}/>}
      {extracto&&<Modal title={`Extracto — ${extracto.numero}`} onClose={()=>setExtracto(null)} lg>
        <ReportPreview html={relatorioExtracto(appData, extracto.id)} nome={`Extracto ${extracto.numero}`} altura="62vh"/>
      </Modal>}
      {cel&&CelModal()}
      {Formularios()}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════
     PAINEL DO MÊS
  ═══════════════════════════════════════════════════════════════ */
  function Painel() {
    const cob = cobrancaMes(appData, pm.ano, pm.mes);
    const conta = contaMes(fluxo, pm.ano, pm.mes);
    const k = chaveMes(pm.ano, pm.mes);
    const despMes = despesas.filter(d=>(d.data||"").startsWith(k));
    const porCat = {}; despMes.forEach(d=>{ porCat[d.categoria]=(porCat[d.categoria]||0)+d.valor; });
    const maior = Object.entries(porCat).sort((a,b)=>b[1]-a[1])[0];
    const pct = cob.elegiveis ? Math.round(cob.pagaram/cob.elegiveis*100) : 0;
    const aCobrar = fracoes.map(f=>({f,...situ[f.id]})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
    const serie = serieMeses(fluxo, pm.ano, pm.mes, 12);
    const mov = [
      ...pagamentosQuota.filter(p=>p.metodo!=="Isento"&&p.data).map(p=>({id:p.id,data:p.data,desc:`Quota ${p.mes?MESES_S[p.mes-1]+" "+p.ano:""} · ${aptById(p.fracaoId)?.numero||"?"}`,sub:p.metodo||"Quota",v:p.valor})),
      ...pagamentosContribuicao.filter(p=>p.metodo!=="Isento"&&p.data).map(p=>({id:p.id,data:p.data,desc:`${contribById(p.contribuicaoId)?.titulo||"Contribuição"} · ${aptById(p.fracaoId)?.numero||"?"}`,sub:p.metodo||"Contribuição",v:p.valor})),
      ...despesas.map(d=>({id:d.id,data:d.data,desc:d.descricao,sub:"Despesa",v:-d.valor})),
    ].sort((a,b)=>(b.data||"").localeCompare(a.data||"")).slice(0,6);
    const TT=({active,payload,label})=>!active||!payload?.length?null:(
      <div style={{background:"#fff",border:"1px solid var(--line)",borderRadius:8,padding:"8px 12px"}}>
        <div style={{fontSize:12,color:"var(--ink-2)",marginBottom:4}}>{label}</div>
        {payload.map((p,i)=><div key={i} className="mono" style={{fontSize:13}}>{p.name}: {fmtKz(p.value)}</div>)}
      </div>);
    return <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,marginBottom:16}}>
        <MesNav ano={pm.ano} mes={pm.mes} onChange={(ano,mes)=>setPm({ano,mes})} max={{ano:anoAtual,mes:mesAtual}} tamanho={26} h1/>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn btn-outline" onClick={()=>abrirDespesa(null)}><Icon n="plus" s={16}/>Despesa</button>
          <button className="btn btn-red hide-sm" onClick={()=>abrirQuota()}><Icon n="plus" s={16}/>Registar pagamento</button>
        </div>
      </div>

      <section className="kpis" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12,marginBottom:16}}>
        <Kpi label={`Cobrança de quotas · ${MESES[pm.mes-1]}`} sub={<><span className="mono">{fmtNum(cob.cobrado)}</span> de <span className="mono">{fmtKz(cob.esperado)}</span></>}>
          <div style={{display:"flex",alignItems:"baseline",gap:6}}><span className="serif" style={{fontSize:28,fontWeight:700,lineHeight:1}}>{cob.pagaram} / {cob.elegiveis}</span><span className="muted" style={{fontSize:14}}>apts pagaram</span></div>
          <div className="progress-bg" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Cobrança do mês"><div className="progress-fill" style={{width:`${pct}%`,background:"var(--ok-fill)"}}/></div>
        </Kpi>
        <Kpi label={pm.ano===anoAtual&&pm.mes===mesAtual?"Saldo em caixa":`Saldo no fim de ${MESES[pm.mes-1]}`} valor={fmtKz(conta.saldoFinal)}
          sub={<span style={{fontWeight:700,color:conta.saldoFinal-conta.saldoInicial>=0?"var(--ok)":"var(--divida)"}}>{fmtSinal(conta.saldoFinal-conta.saldoInicial)} Kz no mês</span>}/>
        <Kpi label="Despesas do mês" valor={fmtKz(conta.despesas)} sub={despMes.length?`${despMes.length} ${despMes.length===1?"lançamento":"lançamentos"}${maior?` · maior: ${maior[0]}`:""}`:"Sem despesas"}/>
        <Kpi label="Em dívida (total)" valor={fmtKz(totQ+totC)} cor={totQ+totC?"var(--divida)":"var(--ok)"} sub={`Quotas ${fmtNum(totQ)} · Contribuições ${fmtNum(totC)}`}/>
      </section>

      <div className="painel-grid">
        <section className="card" style={{padding:"18px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:8}}>
            <h2 className="h2">A cobrar {aCobrar.length>0&&<span className="muted" style={{fontFamily:"Nunito",fontSize:15}}>({aCobrar.length})</span>}</h2>
            <button className="btn btn-ghost btn-sm" onClick={()=>irPara("quotas")}>Mapa de quotas<Icon n="right" s={16}/></button>
          </div>
          {aCobrar.length===0 ? <div style={{display:"flex",gap:8,alignItems:"center",color:"var(--ok)",fontWeight:700,padding:"16px 0"}}><Icon n="checkCircle" s={20}/>Ninguém em dívida.</div> :
            aCobrar.slice(0,8).map(({f,qi,contribs,total})=>(
              <div key={f.id} className="cob-row">
                <span className="apt-num" style={{fontSize:17}}>{f.numero}</span>
                <span style={{display:"flex",flexDirection:"column",minWidth:0}}>
                  <span style={{fontSize:15,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nomeApt(f)}</span>
                  <span className="muted" style={{fontSize:13}}>{f.inq_nome?`inquilino: ${f.inq_nome}`:f.excluiQuota?"sem quota mensal":"proprietário"}</span>
                </span>
                <span className="cob-falta" style={{fontSize:13,color:"#3D3832"}}>{[qi.mesesAtraso?resumoMeses(qi.mesesEmFalta):"",...contribs.map(c=>c.titulo)].filter(Boolean).join(" · ")}</span>
                <span className="mono cob-val" style={{fontSize:15,color:"var(--divida)",textAlign:"right"}}>{fmtNum(total)}</span>
                <span className="cob-act" style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                  {temTel(f)&&<button className="wa-btn icon" onClick={()=>lembreteDireto(f)} aria-label={`Lembrete por WhatsApp ao ${f.numero}`} title="Lembrete por WhatsApp"><WaSvg s={17}/></button>}
                  <button className="btn btn-outline btn-icon" onClick={()=>setDrillApt(f)} aria-label={`Detalhe do ${f.numero}`} title="Detalhe"><Icon n="eye" s={17}/></button>
                  {qi.mesesAtraso>0&&<button className="btn btn-outline" onClick={()=>abrirQuota(f.numero)}>Registar</button>}
                </span>
              </div>
            ))}
          {aCobrar.length>8&&<button className="btn btn-ghost btn-sm" style={{marginTop:8}} onClick={()=>irPara("fracoes")}>Ver todos ({aCobrar.length})</button>}
        </section>

        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <section className="card" style={{padding:"18px 20px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
              <h2 className="h2">Saldo em caixa</h2><span className="muted" style={{fontSize:13}}>últimos 12 meses</span>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={serie} margin={{left:-8,right:8,top:8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false}/>
                <XAxis dataKey="label" tick={{fill:"#57514A",fontSize:11}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                <YAxis tick={{fill:"#57514A",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>Math.round(v/1000)+"k"} width={44} domain={[m=>Math.min(0,m),"auto"]}/>
                <Tooltip content={<TT/>}/>
                <Line type="monotone" dataKey="Saldo" stroke="#1A4F8B" strokeWidth={2.5} dot={false} activeDot={{r:5}}/>
              </LineChart>
            </ResponsiveContainer>
          </section>
          <section className="card" style={{padding:"18px 20px"}}>
            <h2 className="h2" style={{marginBottom:6}}>Últimos lançamentos</h2>
            {mov.length===0&&<div className="muted" style={{fontSize:14}}>Sem lançamentos.</div>}
            {mov.map(m=>(
              <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--line-2)"}}>
                <span style={{display:"flex",flexDirection:"column",minWidth:0}}><span style={{fontSize:14,fontWeight:700}}>{m.desc}</span><span className="muted" style={{fontSize:12}}>{fmtDateCurta(m.data)} · {m.sub}</span></span>
                <span className="mono" style={{fontSize:14,flexShrink:0,color:m.v>0?"var(--ok)":"var(--ink)"}}>{fmtSinal(m.v)}</span>
              </div>
            ))}
          </section>
        </div>
      </div>

      <section className="card" style={{marginTop:16}}>
        <h2 className="h2" style={{marginBottom:4}}>Entradas e despesas</h2>
        <div className="muted" style={{fontSize:13,marginBottom:12}}>Pela data em que o dinheiro entrou ou saiu · últimos 12 meses</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={serie} barGap={4} margin={{left:-8,right:8}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false}/>
            <XAxis dataKey="label" tick={{fill:"#57514A",fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:"#57514A",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>Math.round(v/1000)+"k"} width={44}/>
            <Tooltip content={<TT/>}/><Legend wrapperStyle={{fontSize:13,color:"#57514A"}}/>
            <Bar dataKey="Entradas" fill="#2E8B5A" radius={[4,4,0,0]}/>
            <Bar dataKey="Despesas" fill="#4A443D" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </section>
    </>;
  }

  /* ═══════════════════════════════════════════════════════════════
     MAPA DE QUOTAS (apartamentos × meses)
  ═══════════════════════════════════════════════════════════════ */
  function Quotas() {
    const t = qTxt.trim().toLowerCase();
    const comAtraso = fracoesOrd.filter(f=>situ[f.id]?.qi.mesesAtraso>0).length;
    const linhas = fracoesOrd.filter(f=>{
      if (t && ![f.numero,f.prop_nome,f.inq_nome].some(x=>String(x||"").toLowerCase().includes(t))) return false;
      const a = situ[f.id]?.qi.mesesAtraso||0;
      return qEst==="todos" || (qEst==="atraso" ? a>0 : a===0 && !f.excluiQuota);
    });
    const cur = qAno===anoAtual ? mesAtual : 0;
    const cobrado = MESES.map((_,i)=>pagamentosQuota.filter(p=>p.ano===qAno&&p.mes===i+1&&p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0));
    const histList = [...pagamentosQuota].filter(p=>p.ano===qAno||(!p.ano&&(p.data||"").startsWith(qAno+"-")))
      .filter(p=>!t||String(aptById(p.fracaoId)?.numero||"").toLowerCase().includes(t)||nomeApt(aptById(p.fracaoId)).toLowerCase().includes(t))
      .sort((a,b)=>(b.data||"").localeCompare(a.data||"")||(b.mes-a.mes));
    return <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <h1 className="section-hd">Quotas</h1>
          <MesNav ano={qAno} mes={1} anual onChange={a=>setQAno(a)} min={{ano:Math.min(anoBase,...anos),mes:1}} max={{ano:anoAtual+1,mes:1}} tamanho={24}/>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <Menu label="Mais" icon={null} items={[
            {label:"Isentar meses", icon:"ban", onClick:()=>abrirIsencao()},
            {label:hist?"Esconder histórico":"Ver histórico (lista)", icon:"list", onClick:()=>setHist(h=>!h)},
          ]}/>
          <button className="btn btn-red hide-sm" onClick={()=>abrirQuota()}><Icon n="plus" s={16}/>Registar pagamento</button>
        </div>
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:12,top:13,color:"var(--ink-2)"}}><Icon n="search" s={17}/></span>
          <input className="input" aria-label="Procurar apartamento ou nome" placeholder="Apt. ou nome" value={qTxt} onChange={e=>setQTxt(e.target.value)} style={{width:200,paddingLeft:38}}/>
        </div>
        <Segmented label="Filtrar" value={qEst} onChange={setQEst} options={[["todos","Todos"],["atraso",`Com atraso (${comAtraso})`],["dia","Em dia"]]}/>
      </div>

      <section className="card" style={{padding:"8px 16px 12px",overflowX:"auto"}}>
        <table className="qm" style={{minWidth:900}}>
          <thead><tr>
            <th className="qm-apt" style={{minWidth:190}}>Apartamento</th>
            {MESES_S.map((m,i)=><th key={m} className={i+1===cur?"qcur":""} style={{color:i+1===cur?"var(--ink)":undefined}}>{m}</th>)}
            <th style={{textAlign:"right",paddingRight:0}}>Dívida</th>
          </tr></thead>
          <tbody>
            {linhas.map(f=>{
              const s = situ[f.id];
              return <tr key={f.id} style={{opacity:f.excluiQuota?.75:1}}>
                <td><button className="btn btn-ghost" style={{justifyContent:"flex-start",padding:"4px 6px",minHeight:36,gap:8,maxWidth:200}} onClick={()=>setDrillApt(f)} aria-label={`Detalhe do apartamento ${f.numero}`}>
                  <span className="apt-num" style={{fontSize:15,minWidth:34,textAlign:"left"}}>{f.numero}</span>
                  <span className="hide-sm" style={{fontSize:13,fontWeight:600,color:"var(--ink)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nomeApt(f)}{f.excluiQuota&&<span className="muted" style={{fontWeight:400}}> · sem quota</span>}</span>
                </button></td>
                {MESES.map((nm,i)=>{
                  const e = estadoMes(f, qAno, i+1, pagamentosQuota, config);
                  return <td key={i} className={i+1===cur?"qcur":""}>
                    <button className="qcel" style={CEL_Q[e.k]} disabled={e.k==="excluido"} aria-label={`${f.numero}, ${nm} ${qAno}: ${EST_LBL[e.k]}${e.pago&&e.k!=="pago"?`, pago ${fmtNum(e.pago)}`:""}`}
                      title={`${nm}: ${EST_LBL[e.k]}${e.pago?` · ${fmtKz(e.pago)}`:""}`} onClick={()=>setCel({f, ano:qAno, mes:i+1})}>
                      {e.k==="pago"?<Icon n="check" s={14} w={3.2}/>:e.k==="parcial"?Math.round(e.pago/1000):e.k==="falta"?"–":e.k==="isento"?"I":e.k==="excluido"?"—":""}
                    </button>
                  </td>;
                })}
                <td className="mono" style={{textAlign:"right",paddingRight:0,fontSize:14,color:s.qi.divida?"var(--divida)":"var(--ink-3)"}}>{s.qi.divida?fmtNum(s.qi.divida):"—"}</td>
              </tr>;
            })}
            {linhas.length===0&&<tr><td colSpan={14} style={{textAlign:"center",padding:24,color:"var(--ink-2)",position:"static"}}>Nenhum apartamento.</td></tr>}
          </tbody>
          <tfoot><tr>
            <td style={{fontSize:12,fontWeight:800,paddingTop:10}}>Cobrado (mil Kz)</td>
            {cobrado.map((v,i)=><td key={i} className={`mono${i+1===cur?" qcur":""}`} style={{fontSize:12,paddingTop:10,fontWeight:i+1===cur?700:400}}>{v?Math.round(v/1000):"—"}</td>)}
            <td className="mono" style={{textAlign:"right",paddingRight:0,paddingTop:10,fontSize:14,color:totQ?"var(--divida)":"var(--ink-3)"}}>{fmtNum(totQ)}</td>
          </tr></tfoot>
        </table>
      </section>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:12}}>
        <div className="legend">
          <span><i className="sw" style={{...CEL_Q.pago,width:20,height:16}}/>Pago</span>
          <span><i className="sw" style={{...CEL_Q.parcial,width:20,height:16}}/>Parcial (mil Kz pagos)</span>
          <span><i className="sw" style={{...CEL_Q.falta,width:20,height:16}}/>Em falta</span>
          <span><i className="sw" style={{...CEL_Q.isento,width:20,height:16}}/>Isento</span>
          <span><i className="sw" style={{...CEL_Q.futuro,width:20,height:16}}/>Por vencer</span>
        </div>
        <span className="muted" style={{fontSize:13}}>Toque num mês para registar, isentar ou ver os pagamentos.</span>
      </div>

      {hist&&<section className="card" style={{marginTop:16,overflowX:"auto"}}>
        <h2 className="h2" style={{marginBottom:8}}>Histórico de pagamentos {qAno} <span className="muted" style={{fontFamily:"Nunito",fontSize:14}}>· {histList.length} registos · <span className="mono">{fmtKz(histList.reduce((s,p)=>s+p.valor,0))}</span></span></h2>
        <table><thead><tr><th>Data</th><th>Apt.</th><th className="hide-sm">Proprietário</th><th>Mês</th><th className="num">Valor</th><th className="hide-sm">Método</th><th></th></tr></thead>
        <tbody>{histList.map(p=>{ const f=aptById(p.fracaoId); return <tr key={p.id}>
          <td className="muted" style={{fontSize:13}}>{fmtDate(p.data)}</td>
          <td><span className="apt-num">{f?.numero||"?"}</span></td>
          <td className="hide-sm">{nomeApt(f)||"?"}</td>
          <td>{p.mes&&p.ano?<span className="tag tag-blue">{MESES_S[p.mes-1]} {p.ano}</span>:<span className="tag tag-red">Sem mês</span>}</td>
          <td className="num">{p.metodo==="Isento"?"—":fmtNum(p.valor)}</td>
          <td className="hide-sm muted" style={{fontSize:13}}>{p.metodo==="Isento"?<span className="tag tag-grey" title={p.referencia}>Isento</span>:(p.metodo||"—")}</td>
          <td><RowActions desc={`pagamento do ${f?.numero||""}`} onEdit={()=>abrirEditQuota(p)} onDelete={()=>apagarQuota(p)}/></td>
        </tr>; })}</tbody></table>
        {histList.length===0&&<div style={{textAlign:"center",padding:24,color:"var(--ink-2)"}}>Sem registos.</div>}
      </section>}
    </>;
  }

  function CelModal() {
    const { f, ano, mes } = cel;
    const e = estadoMes(f, ano, mes, pagamentosQuota, config);
    const fechar = ()=>setCel(null);
    return (
      <Modal title={`${f.numero} · ${MESES[mes-1]} ${ano}`} onClose={fechar}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <span className="tag" style={{...CEL_Q[e.k],border:"none"}}>{EST_LBL[e.k]}</span>
            <span style={{fontSize:15}}>{nomeApt(f)}</span>
          </div>
          {e.k==="falta"&&<div style={{fontSize:15,color:"var(--divida)",fontWeight:700}}>Em falta: {fmtKz(quotaMensal)}</div>}
          {e.k==="parcial"&&<div style={{fontSize:15}}>Pago {fmtKz(e.pago)} de {fmtKz(quotaMensal)} · <b style={{color:"var(--divida)"}}>faltam {fmtKz(e.emFalta)}</b></div>}
          {e.k==="antes"&&<div className="muted" style={{fontSize:15}}>Antes do início da cobrança ({MESES[mesBase-1]} {anoBase}).</div>}
          {e.regs.length>0&&<div style={{display:"flex",flexDirection:"column"}}>
            {e.regs.map(p=>(
              <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--line-2)"}}>
                <span style={{display:"flex",flexDirection:"column"}}>
                  <b style={{fontSize:14}}>{p.metodo==="Isento"?"Isenção":fmtKz(p.valor)}</b>
                  <span className="muted" style={{fontSize:13}}>{[fmtDate(p.data),p.metodo!=="Isento"&&p.metodo,p.referencia].filter(Boolean).join(" · ")}</span>
                </span>
                <RowActions desc="registo" onEdit={p.metodo==="Isento"?null:()=>{ fechar(); abrirEditQuota(p); }} onDelete={()=>{ fechar(); apagarQuota(p); }}/>
              </div>
            ))}
          </div>}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {(e.k==="falta"||e.k==="futuro"||e.k==="parcial")&&<button className="btn btn-outline" onClick={()=>{ fechar(); abrirIsencao(f.numero,{mes,ano}); }}><Icon n="ban" s={16}/>Isentar</button>}
            {(e.k==="falta"||e.k==="futuro"||e.k==="parcial")&&<button className="btn btn-red" onClick={()=>{ fechar(); abrirQuota(f.numero,[{mes,ano}]); }}><Icon n="plus" s={16}/>Registar pagamento</button>}
            {!(e.k==="falta"||e.k==="futuro"||e.k==="parcial")&&<button className="btn btn-outline" onClick={fechar}>Fechar</button>}
          </div>
        </div>
      </Modal>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     APARTAMENTOS
  ═══════════════════════════════════════════════════════════════ */
  function Apartamentos() {
    return <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <h1 className="section-hd">Apartamentos</h1>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <input className="input" style={{width:200}} aria-label="Procurar apartamento" placeholder="Nº ou nome" value={fApt} onChange={e=>setFApt(e.target.value)}/>
          <button className="btn btn-red" onClick={()=>abrirFracao(null)}><Icon n="plus" s={16}/>Novo apartamento</button>
        </div>
      </div>
      <section className="card hide-sm" style={{overflowX:"auto",padding:"8px 20px"}}>
        <table><thead><tr><th>Nº</th><th>Proprietário</th><th>Inquilino</th><th>Quotas</th><th className="num">Dívida total</th><th></th></tr></thead>
        <tbody>{fracoesFilt.map(f=>{ const s=situ[f.id], nv=nivelAtraso(s.qi.mesesAtraso); return <tr key={f.id}>
          <td><span className="apt-num" style={{fontSize:16}}>{f.numero}</span></td>
          <td><div style={{fontWeight:700}}>{nomeApt(f)}</div><div className="muted" style={{fontSize:13}}>{f.prop_telefone||f.telefone}</div></td>
          <td>{f.inq_nome?<><div>{f.inq_nome}</div><div className="muted" style={{fontSize:13}}>{f.inq_telefone}</div></>:<span className="muted">—</span>}</td>
          <td>{f.excluiQuota?<span className="tag tag-grey">Sem quota</span>:<span className={`tag ${nv.tag}`}>{s.qi.mesesAtraso?`${nv.label} · ${s.qi.mesesAtraso}m`:nv.label}</span>}</td>
          <td className="num" style={{color:s.total?"var(--divida)":"var(--ok)"}}>{fmtNum(s.total)}</td>
          <td><div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
            {s.total>0&&temTel(f)&&<button className="wa-btn icon" onClick={()=>lembreteDireto(f)} aria-label={`Lembrete por WhatsApp ao ${f.numero}`} title="Lembrete por WhatsApp"><WaSvg s={16}/></button>}
            <button className="btn btn-outline btn-icon" onClick={()=>setDrillApt(f)} aria-label={`Detalhe do ${f.numero}`} title="Detalhe"><Icon n="eye" s={17}/></button>
            <button className="btn btn-outline btn-icon" onClick={()=>abrirFracao(f)} aria-label={`Editar ${f.numero}`} title="Editar"><Icon n="edit" s={17}/></button>
          </div></td>
        </tr>; })}</tbody></table>
        {fracoesFilt.length===0&&<div style={{textAlign:"center",padding:24,color:"var(--ink-2)"}}>Nenhum apartamento encontrado.</div>}
      </section>
      <div className="show-sm" style={{flexDirection:"column",gap:10}}>
        {fracoesFilt.map(f=>{ const s=situ[f.id], nv=nivelAtraso(s.qi.mesesAtraso); return (
          <section key={f.id} className="card" style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <span className="apt-num" style={{fontSize:20,minWidth:40}}>{f.numero}</span>
              <span style={{display:"flex",flexDirection:"column",flex:1,minWidth:0}}>
                <b style={{fontSize:15}}>{nomeApt(f)}</b>
                {f.inq_nome&&<span className="muted" style={{fontSize:13}}>inquilino: {f.inq_nome}</span>}
              </span>
              <span style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                <span className="mono" style={{fontSize:15,color:s.total?"var(--divida)":"var(--ok)"}}>{fmtNum(s.total)}</span>
                {f.excluiQuota?<span className="tag tag-grey">Sem quota</span>:<span className={`tag ${nv.tag}`}>{nv.label}</span>}
              </span>
            </div>
            <div style={{display:"flex",gap:8}}>
              {s.total>0&&temTel(f)&&<button className="wa-btn icon" onClick={()=>lembreteDireto(f)} aria-label={`Lembrete por WhatsApp ao ${f.numero}`}><WaSvg s={17}/></button>}
              <button className="btn btn-outline" style={{flex:1}} onClick={()=>setDrillApt(f)}><Icon n="eye" s={17}/>Detalhe</button>
              <button className="btn btn-outline" style={{flex:1}} onClick={()=>abrirFracao(f)}><Icon n="edit" s={17}/>Editar</button>
            </div>
          </section>); })}
      </div>
    </>;
  }

  /* ═══════════════════════════════════════════════════════════════
     CONTRIBUIÇÕES — acções dentro de cada cartão
  ═══════════════════════════════════════════════════════════════ */
  function Contribuicoes() {
    return <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <h1 className="section-hd">Contribuições</h1>
        <button className="btn btn-red" onClick={()=>abrirContrib(null)}><Icon n="plus" s={16}/>Nova contribuição</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {contribuicoes.length===0&&<div className="card" style={{textAlign:"center",padding:36,color:"var(--ink-2)"}}>Sem contribuições registadas.</div>}
        {ordenarContribs(contribuicoes).map(c=>{
          const fechada=contribFechada(c);
          const isLivre=!(+c.valorPorFracao)&&!(+c.valorTotal);
          const meta=metaContrib(c,fracoes);
          const pcs=pagamentosContribuicao.filter(p=>p.contribuicaoId===c.id);
          const totalCob=pcs.filter(p=>p.metodo!=="Isento").reduce((s,p)=>s+p.valor,0);
          const pct=meta>0?Math.min(100,Math.round(totalCob/meta*100)):0;
          const apts=fracoesOrd.map(f=>({f,...contribInfo(c,f.id,pagamentosContribuicao)}));
          const porPagar=apts.filter(x=>x.divida>0);
          const aberto=!!abertos[c.id];
          return <section key={c.id} className="card" style={{display:"flex",flexDirection:"column",gap:14,...(fechada?{opacity:.65,background:"var(--grey-bg)"}:{})}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
              <div style={{display:"flex",flexDirection:"column",gap:3,minWidth:0}}>
                <h2 style={{fontWeight:800,fontSize:18}}>{c.titulo} {fechada?<span className="tag tag-grey" style={{marginLeft:4}}><Icon n="lock" s={12}/> Fechada</span>:c.estado&&c.estado!=="Aberto"&&<span className="tag tag-grey" style={{marginLeft:4}}>{c.estado}</span>}</h2>
                {c.descricao&&<div className="muted" style={{fontSize:14}}>{c.descricao}</div>}
                <div className="muted" style={{fontSize:13}}>{[c.valorPorFracao>0&&`${fmtKz(c.valorPorFracao)} por apt.`, c.dataVencimento&&`prazo ${fmtDate(c.dataVencimento)}`, (c.excluidos||[]).length&&`excluídos: ${c.excluidos.map(id=>aptById(id)?.numero||id).join(", ")}`].filter(Boolean).join(" · ")}</div>
              </div>
              <div style={{textAlign:"right"}}>
                {isLivre?<><span className="tag tag-teal">Arrecadação livre</span><div className="mono" style={{fontSize:15,marginTop:6}}>{fmtKz(totalCob)} recebido</div></>
                  :<div className="mono" style={{fontSize:15}}>{fmtNum(totalCob)} <span className="muted">/ {fmtKz(meta)}</span></div>}
              </div>
            </div>
            {!isLivre&&meta>0&&<div className="progress-bg" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.titulo}: ${pct}%`}><div className="progress-fill" style={{width:`${pct}%`,background:"var(--info)"}}/></div>}
            <div>
              <div style={{fontSize:13,fontWeight:800,marginBottom:6}}>{isLivre?"Contribuições por apartamento":fechada?`Fechada, já não é cobrada · pagaram ${apts.filter(x=>!x.excluido&&!x.isento&&x.pago).length} de ${apts.filter(x=>!x.excluido&&!x.isento).length}`:`Por pagar: ${porPagar.length} de ${apts.filter(x=>!x.excluido&&!x.isento).length}`}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {apts.map(x=>{
                  const k = x.excluido?"exc":x.isento?"ise":isLivre?(x.totalPago>0?"ok":"nada"):x.pago?"ok":fechada?"nada":"falta";
                  const st = {ok:{background:"var(--ok-bg)",color:"var(--ok)"},falta:{background:"var(--divida-bg)",color:"var(--divida)",border:"1.5px solid var(--brand)"},exc:{background:"var(--grey-bg)",color:"#4A443D"},ise:{background:"var(--grey-bg)",color:"#4A443D"},nada:{background:"#fff",color:"var(--ink-2)",border:"1.5px dashed var(--line-3)"}}[k];
                  const txt = k==="ok"?(isLivre?fmtNum(x.totalPago):"pago"):k==="falta"?fmtNum(x.divida):k==="exc"?"excluído":k==="ise"?"isento":fechada&&x.totalPago>0?fmtNum(x.totalPago):"—";
                  return <button key={x.f.id} className="btn btn-sm" style={{...st,gap:6,minHeight:36}} disabled={fechada||k==="exc"||k==="ise"}
                    aria-label={`${x.f.numero}: ${txt}${!fechada&&(k==="falta"||k==="nada")?", registar pagamento":""}`}
                    onClick={()=>abrirPagContrib(null,{contribId:c.id,fracaoNum:x.f.numero})}>
                    <b className="apt-num" style={{color:"inherit"}}>{x.f.numero}</b><span style={{fontSize:12}}>{txt}</span></button>;
                })}
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              {!fechada&&<button className="btn btn-red" onClick={()=>abrirPagContrib(null,{contribId:c.id})}><Icon n="plus" s={16}/>Registar pagamento</button>}
              {!fechada&&<button className="btn btn-outline" onClick={()=>abrirBulk(c.id)}><Icon n="zap" s={16}/>Lançar para vários</button>}
              <Menu label="Mais" icon={null} items={[
                ...(fechada?[]:[{label:"Isentar apartamento", icon:"ban", onClick:()=>om("isentarContrib",{contribId:c.id})}]),
                fechada?{label:"Reabrir contribuição", icon:"refresh", onClick:()=>reabrirContrib(c)}
                       :{label:"Fechar contribuição", icon:"lock", onClick:()=>fecharContrib(c)},
                {label:"Editar contribuição", icon:"edit", onClick:()=>abrirContrib(c)},
                {label:"Apagar contribuição", icon:"trash", danger:true, onClick:()=>pcs.length?fail("Esta contribuição tem pagamentos registados. Apague primeiro os pagamentos."):apagar("delete_contribuicao",c,`a contribuição “${c.titulo}”`,undoContrib(c),{id:c.id})},
              ]}/>
              {pcs.length>0&&<button className="btn btn-ghost" aria-expanded={aberto} onClick={()=>setAbertos(a=>({...a,[c.id]:!a[c.id]}))} style={{marginLeft:"auto"}}>
                <Icon n={aberto?"up":"down"} s={16}/>Pagamentos ({pcs.length})</button>}
            </div>
            {aberto&&<div style={{overflowX:"auto"}}><table><thead><tr><th>Data</th><th>Apt.</th><th className="hide-sm">Proprietário</th><th className="num">Valor</th><th></th></tr></thead>
              <tbody>{[...pcs].sort((a,b)=>(b.data||"").localeCompare(a.data||"")).map(p=>{const f=aptById(p.fracaoId);return<tr key={p.id}>
                <td className="muted" style={{fontSize:13}}>{fmtDate(p.data)}</td>
                <td><span className="apt-num">{f?.numero||"?"}</span></td>
                <td className="hide-sm">{nomeApt(f)}</td>
                <td className="num">{p.metodo==="Isento"?<span className="tag tag-grey" title={p.referencia}>Isento</span>:fmtNum(p.valor)}</td>
                <td><RowActions desc={`pagamento do ${f?.numero||""}`} onEdit={p.metodo==="Isento"?null:()=>abrirPagContrib(p)}
                  onDelete={()=>apagar("delete_pagamento_contribuicao",p,`o ${p.metodo==="Isento"?"registo de isenção":"pagamento"} do apt. ${f?.numero||"?"} em “${c.titulo}”`,undoPagContrib(p))}/></td>
              </tr>;})}</tbody></table></div>}
          </section>;
        })}
      </div>
    </>;
  }

  /* ═══════════════════════════════════════════════════════════════
     DESPESAS
  ═══════════════════════════════════════════════════════════════ */
  function Despesas() {
    const tot = despFilt.reduce((s,d)=>s+d.valor,0);
    const porCat = {}; despFilt.forEach(d=>{ porCat[d.categoria||"Outros"]=(porCat[d.categoria||"Outros"]||0)+d.valor; });
    const cats = Object.entries(porCat).sort((a,b)=>b[1]-a[1]);
    return <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:10,flexWrap:"wrap"}}>
        <h1 className="section-hd">Despesas</h1>
        <button className="btn btn-red" onClick={()=>abrirDespesa(null)}><Icon n="plus" s={16}/>Registar despesa</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <select className="input" aria-label="Ano" style={{width:"auto"}} value={fDAno} onChange={e=>setFDAno(e.target.value)}>
          <option value="">Todos os anos</option>{anos.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <select className="input" aria-label="Categoria" style={{width:"auto"}} value={fDCat} onChange={e=>setFDCat(e.target.value)}>
          <option value="">Todas as categorias</option>{catsDesp.map(c=><option key={c}>{c}</option>)}
        </select>
        <input className="input" aria-label="Procurar despesa" style={{width:200}} placeholder="Procurar" value={fDTxt} onChange={e=>setFDTxt(e.target.value)}/>
        <span className="muted" style={{fontSize:14}}>{despFilt.length} registos · <b className="mono" style={{color:"var(--ink)"}}>{fmtKz(tot)}</b></span>
      </div>
      {cats.length>0&&<section className="card" style={{marginBottom:14,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:"10px 28px"}}>
        {cats.map(([n,v])=>(
          <div key={n} style={{display:"flex",flexDirection:"column",gap:4}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:14}}><button className="btn btn-ghost btn-sm" style={{padding:0,minHeight:0,color:"var(--ink)",fontWeight:800}} onClick={()=>setFDCat(fDCat===n?"":n)} aria-pressed={fDCat===n}>{n}</button>
              <span className="mono">{fmtNum(v)} · {Math.round(v/tot*100)}%</span></div>
            <div style={{height:8,borderRadius:6,background:"var(--line-2)",overflow:"hidden"}}><div style={{height:"100%",background:"#4A443D",width:`${Math.round(v/cats[0][1]*100)}%`}}/></div>
          </div>
        ))}
      </section>}
      <section className="card hide-sm" style={{overflowX:"auto",padding:"8px 20px"}}>
        <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th><th>Fornecedor</th><th>Obs.</th><th></th></tr></thead>
        <tbody>{despFilt.map(d=>(
          <tr key={d.id}>
            <td className="muted" style={{fontSize:13,whiteSpace:"nowrap"}}>{fmtDate(d.data)}</td>
            <td>{d.descricao}</td>
            <td><span className="tag tag-grey">{d.categoria}</span></td>
            <td className="num">{fmtNum(d.valor)}</td>
            <td className="muted" style={{fontSize:13}}>{d.fornecedor||"—"}</td>
            <td className="muted" style={{fontSize:13,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={d.observacoes}>{d.observacoes||"—"}</td>
            <td><RowActions desc={`despesa ${d.descricao}`} onEdit={()=>abrirDespesa(d)} onDelete={()=>apagar("delete_despesa",d,`a despesa “${d.descricao}” (${fmtKz(d.valor)})`,undoDespesa(d))}/></td>
          </tr>
        ))}</tbody></table>
        {despFilt.length===0&&<div style={{textAlign:"center",padding:24,color:"var(--ink-2)"}}>Sem registos.</div>}
      </section>
      <div className="show-sm" style={{flexDirection:"column",gap:8}}>
        {despFilt.map(d=>(
          <section key={d.id} className="card" style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{display:"flex",flexDirection:"column",flex:1,minWidth:0}}>
              <b style={{fontSize:15}}>{d.descricao}</b>
              <span className="muted" style={{fontSize:13}}>{fmtDateCurta(d.data)} · {d.categoria}{d.fornecedor?` · ${d.fornecedor}`:""}</span>
            </span>
            <span className="mono" style={{fontSize:14}}>{fmtNum(d.valor)}</span>
            <Menu label="" icon="more" ariaLabel={`Acções da despesa ${d.descricao}`} btnClass="btn btn-ghost btn-icon" items={[
              {label:"Editar", icon:"edit", onClick:()=>abrirDespesa(d)},
              {label:"Apagar", icon:"trash", danger:true, onClick:()=>apagar("delete_despesa",d,`a despesa “${d.descricao}” (${fmtKz(d.valor)})`,undoDespesa(d))},
            ]}/>
          </section>
        ))}
        {despFilt.length===0&&<div className="card" style={{textAlign:"center",color:"var(--ink-2)"}}>Sem registos.</div>}
      </div>
    </>;
  }

  /* ═══════════════════════════════════════════════════════════════
     AVISOS
  ═══════════════════════════════════════════════════════════════ */
  function Avisos() {
    return <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:10,flexWrap:"wrap"}}>
        <h1 className="section-hd">Avisos, notificações e actas</h1>
        <button className="btn btn-red" onClick={()=>abrirAviso(null)}><Icon n="plus" s={16}/>Publicar</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[...avisos].sort((a,b)=>(b.data||"").localeCompare(a.data||"")).map(a=>(
          <AvisoCard key={a.id} a={a} extra={
            <div style={{display:"flex",gap:6}}>
              <button className="wa-btn icon" onClick={()=>waAbrir("",msgAviso(a,config))} aria-label={`Partilhar “${a.titulo}” no WhatsApp`} title="Partilhar no WhatsApp"><WaSvg s={16}/></button>
              <RowActions desc={`aviso ${a.titulo}`} onEdit={()=>abrirAviso(a)} onDelete={()=>apagar("delete_aviso",a,`o aviso “${a.titulo}”`,undoAviso(a))}/>
            </div>}/>
        ))}
        {avisos.length===0&&<div className="card" style={{textAlign:"center",padding:36,color:"var(--ink-2)"}}>Nenhum aviso publicado ainda.</div>}
      </div>
    </>;
  }

  /* ═══════════════════════════════════════════════════════════════
     FORMULÁRIOS
  ═══════════════════════════════════════════════════════════════ */
  function Formularios() {
    const aptInfo = infoApt;
    const metodoSeg = (extra=[]) => <FG label="Método" id="f-metodo">
      <Segmented grid cols={3} label="Método de pagamento" value={form.metodo||""} onChange={sf("metodo")} options={[...METODOS,...extra]}/>
    </FG>;

    if (modal==="fracao") return <Modal title={form._row?`Editar apartamento ${form.numero}`:"Novo apartamento"} onClose={cm}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FG label="Número" {...ef("numero")}><input className="input" placeholder="101" value={form.numero||""} onChange={e=>sf("numero")(e.target.value)}/></FG>
          <FG label="Andar" hint="Usado na grelha do prédio"><input className="input" placeholder="1º Dto" value={form.andar||""} onChange={e=>sf("andar")(e.target.value)}/></FG>
        </div>
        <h3 style={{fontWeight:800,fontSize:15,display:"flex",gap:8,alignItems:"center"}}><Icon n="user" s={18}/>Proprietário</h3>
        <FG label="Nome" {...ef("prop_nome")}><input className="input" value={form.prop_nome||""} onChange={e=>sf("prop_nome")(e.target.value)}/></FG>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FG label="Telefone"><input className="input" type="tel" placeholder="+244 9XX XXX XXX" value={form.prop_telefone||""} onChange={e=>sf("prop_telefone")(e.target.value)}/></FG>
          <FG label="NIF"><input className="input" value={form.prop_nif||""} onChange={e=>sf("prop_nif")(e.target.value)}/></FG>
        </div>
        <FG label="Email"><input className="input" type="email" value={form.prop_email||""} onChange={e=>sf("prop_email")(e.target.value)}/></FG>
        <div className="divider"/>
        <h3 style={{fontWeight:800,fontSize:15,display:"flex",gap:8,alignItems:"center"}}><Icon n="home" s={18}/>Inquilino <span className="muted" style={{fontWeight:400}}>(opcional)</span></h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FG label="Nome"><input className="input" value={form.inq_nome||""} onChange={e=>sf("inq_nome")(e.target.value)}/></FG>
          <FG label="Telefone"><input className="input" type="tel" value={form.inq_telefone||""} onChange={e=>sf("inq_telefone")(e.target.value)}/></FG>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FG label="Email"><input className="input" type="email" value={form.inq_email||""} onChange={e=>sf("inq_email")(e.target.value)}/></FG>
          <FG label="Início do contrato"><input className="input" type="date" value={form.inq_inicio_contrato||""} onChange={e=>sf("inq_inicio_contrato")(e.target.value)}/></FG>
        </div>
        <div className="divider"/>
        <FG label="Observações"><input className="input" value={form.observacoes||""} onChange={e=>sf("observacoes")(e.target.value)}/></FG>
        <CheckRow label="Não paga quota mensal (acordo especial com a administração)" checked={form.excluiQuota} onChange={sf("excluiQuota")}/>
        <ModalBtns onCancel={cm} onOk={submitFracao} saving={saving} label={form._row?"Guardar":"Criar apartamento"}/>
      </div>
    </Modal>;

    if (modal==="pagQuota") {
      const { f, meses, sugerido, total, valores } = planoQuota();
      const qi=f&&!f.excluiQuota?situ[f.id]?.qi:null;
      const av=form.anoVista||anoAtual;
      const sel=form.sel||[];
      const toggle=k=>{ sf("sel")(sel.includes(k)?sel.filter(x=>x!==k):[...sel,k]); sf("valor")(""); };
      const custom=!(form.valor===""||form.valor===undefined);
      return <Modal title="Registar pagamento de quota" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          <FG label="Apartamento" {...ef("apt")}>
            <AptCombo fracoes={fracoesOrd} value={form.fracaoNum} info={aptInfo} onChange={num=>{ setForm(p=>({...p,...selDoApt(num)})); setErrs({}); }}/>
          </FG>
          {qi&&<div style={{marginTop:-10,fontSize:14,fontWeight:700,display:"flex",gap:6,alignItems:"center",color:qi.mesesAtraso?"var(--divida)":"var(--ok)"}}>
            <Icon n={qi.mesesAtraso?"alert":"checkCircle"} s={16}/>{qi.mesesAtraso?`${qi.mesesAtraso} ${qi.mesesAtraso===1?"mês":"meses"} em falta · ${fmtKz(qi.divida)}`:"Quotas em dia"}</div>}
          {f?.excluiQuota&&<Warn>Este apartamento não paga quota mensal.</Warn>}

          {f&&!f.excluiQuota&&<fieldset style={{border:"none",display:"flex",flexDirection:"column",gap:10}} id="f-meses" tabIndex={-1} aria-describedby={errs.meses?"f-meses-e":undefined}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <legend className="lbl" style={{float:"left"}}>Meses a pagar</legend>
              <MesNav ano={av} mes={1} anual onChange={a=>sf("anoVista")(a)} min={{ano:anoBase,mes:1}} max={{ano:anoAtual+1,mes:1}} tamanho={15}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(6,minmax(0,1fr))",gap:8}}>
              {MESES_S.map((m,i)=>{
                const k=chaveMes(av,i+1), e=estadoMes(f,av,i+1,pagamentosQuota,config), on=sel.includes(k);
                const bloq = ["pago","isento","antes","excluido"].includes(e.k);
                const st = on ? {background:"var(--brand)",border:"2px solid var(--brand-dk)",color:"#fff"}
                  : e.k==="pago" ? {background:"var(--ok-bg)",border:"1.5px solid var(--ok-bg)",color:"var(--ok)"}
                  : e.k==="falta"||e.k==="parcial" ? {background:"#fff",border:"2px solid var(--brand)",color:"var(--divida)"}
                  : bloq ? {background:"var(--line-2)",border:"1.5px solid var(--line-2)",color:"var(--ink-3)"}
                  : {background:"#fff",border:"1.5px dashed #BFB8AE",color:"#3D3832"};
                const sub = on ? fmtNum(e.k==="parcial"?e.emFalta:quotaMensal) : e.k==="pago"?"pago":e.k==="isento"?"isento":e.k==="parcial"?"parcial":e.k==="falta"?"falta":"";
                return <button key={k} type="button" disabled={bloq} aria-pressed={on} onClick={()=>toggle(k)}
                  aria-label={`${MESES[i]} ${av}: ${on?"seleccionado":EST_LBL[e.k]}`}
                  style={{...st,minHeight:54,borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,fontFamily:"'Nunito',sans-serif",fontSize:14,fontWeight:800,cursor:bloq?"default":"pointer",padding:0}}>
                  <span>{m}</span><span style={{fontSize:11,fontWeight:700}}>{sub}</span>
                </button>;
              })}
            </div>
            {errs.meses?<span id="f-meses-e" className="fg-err" role="alert"><Icon n="alert" s={15}/>{errs.meses}</span>
              :<span className="fg-hint">{meses.length?<><b style={{color:"var(--ink)"}}>{meses.length} {meses.length===1?"mês":"meses"}:</b> {resumoMeses(meses)}</>:"Os meses em falta vêm já seleccionados. Toque num mês futuro para adiantar."}</span>}
          </fieldset>}

          {f&&!f.excluiQuota&&<>
            <FG label="Valor recebido (Kz)" {...ef("valor")} hint={meses.length?`${custom?"Sugerido":"Calculado"}: ${fmtKz(sugerido)}. Se for um pagamento parcial, escreva o valor — é repartido pelos meses por ordem.`:undefined}>
              <input className="input mono" type="number" inputMode="numeric" min="0" placeholder={String(sugerido)} value={form.valor??""} onChange={e=>sf("valor")(e.target.value)} style={{fontSize:17}}/>
            </FG>
            {custom&&meses.length>1&&<div className="fg-hint" style={{marginTop:-10}}>Repartição: {meses.map((m,i)=>`${lblMes(m)} ${fmtNum(valores[i])}`).join(" · ")}</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <FG label="Data do pagamento" {...ef("data")}><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
              <FG label="Referência (opcional)"><input className="input" placeholder="Nº transferência / recibo" value={form.referencia||""} onChange={e=>sf("referencia")(e.target.value)}/></FG>
            </div>
            {metodoSeg()}
          </>}
          <ModalBtns onCancel={cm} onOk={()=>submitQuota(false)} saving={saving}
            label={`Registar${f&&total>0?" "+fmtKz(total):""}`}
            extra={<button className="btn btn-outline" disabled={saving} onClick={()=>submitQuota(true)}>Registar e novo</button>}/>
        </div>
      </Modal>;
    }

    if (modal==="editQuota") return <Modal title="Editar pagamento de quota" onClose={cm}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <FG label="Apartamento" {...ef("apt")}><AptCombo fracoes={fracoesOrd} value={form.fracaoNum} info={aptInfo} onChange={sf("fracaoNum")}/></FG>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FG label="Mês"><MesSelect value={form.mes} onChange={sf("mes")}/></FG>
          <FG label="Ano"><AnoSelect value={form.ano} onChange={sf("ano")} anos={anos}/></FG>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FG label="Data" {...ef("data")}><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
          <FG label="Valor (Kz)" {...ef("valor")}><input className="input" type="number" min="0" value={form.valor??""} onChange={e=>sf("valor")(e.target.value)}/></FG>
        </div>
        {metodoSeg(["Isento"])}
        <FG label="Referência / motivo"><input className="input" value={form.referencia||""} onChange={e=>sf("referencia")(e.target.value)}/></FG>
        <ModalBtns onCancel={cm} onOk={submitEditQuota} saving={saving} label="Guardar"/>
      </div>
    </Modal>;

    if (modal==="isentarMes") {
      const meses=intervaloMeses(+form.mesIni,+form.anoIni,+form.mesFim,+form.anoFim);
      return <Modal title="Isentar meses de quota" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Info>Nos meses isentos o apartamento não aparece como devedor. Pode isentar um mês ou um intervalo (ex.: apartamento desocupado).</Info>
          <FG label="Apartamento" {...ef("apt")}><AptCombo fracoes={fracoesOrd} value={form.fracaoNum} info={aptInfo} onChange={sf("fracaoNum")}/></FG>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="De (mês)"><MesSelect value={form.mesIni} onChange={sf("mesIni")}/></FG>
            <FG label="Ano"><AnoSelect value={form.anoIni} onChange={sf("anoIni")} anos={anos}/></FG>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Até (mês)" {...ef("mesFim")}><MesSelect value={form.mesFim} onChange={sf("mesFim")}/></FG>
            <FG label="Ano"><AnoSelect value={form.anoFim} onChange={sf("anoFim")} anos={anos}/></FG>
          </div>
          {meses.length>0&&<div className="fg-hint"><b style={{color:"var(--ink)"}}>{meses.length} {meses.length===1?"mês isento":"meses isentos"}</b>: {resumoMeses(meses)}</div>}
          <FG label="Motivo (opcional)"><input className="input" placeholder="Ex.: apartamento desocupado" value={form.motivo||""} onChange={e=>sf("motivo")(e.target.value)}/></FG>
          <ModalBtns onCancel={cm} onOk={submitIsencao} saving={saving} cls="btn-dark" label="Aplicar isenção"/>
        </div>
      </Modal>;
    }

    const contribSelect = (onChange)=> <FG label="Contribuição" {...ef("contrib")}>
      <select className="input" value={form.contribId||""} onChange={e=>onChange(e.target.value)}>
        <option value="">Escolha…</option>{ordenarContribs(contribuicoes).filter(c=>!contribFechada(c)||(form._row&&c.id===form.contribId)).map(c=><option key={c.id} value={c.id}>{c.titulo}{contribFechada(c)?" (fechada)":""}</option>)}
      </select></FG>;
    const contribAptInfo = c => f => { if(!c) return aptInfo(f); const ci=contribInfo(c,f.id,pagamentosContribuicao);
      return ci.excluido?{txt:"excluído"}:ci.isento?{txt:"isento"}:ci.isLivre?(ci.totalPago?{txt:fmtNum(ci.totalPago),tone:"ok"}:null):ci.pago?{txt:"pago",tone:"ok"}:{txt:`falta ${fmtNum(ci.divida)}`,tone:"bad"}; };

    if (modal==="isentarContrib") {
      const c=contribById(form.contribId);
      return <Modal title="Isentar apartamento de contribuição" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Info>O apartamento fica isento desta contribuição e deixa de aparecer como devedor.</Info>
          {contribSelect(v=>sf("contribId")(v))}
          <FG label="Apartamento" {...ef("apt")}><AptCombo fracoes={fracoesOrd} value={form.fracaoNum} info={contribAptInfo(c)} onChange={sf("fracaoNum")}/></FG>
          <FG label="Motivo (opcional)"><input className="input" placeholder="Ex.: acordo com a administração" value={form.motivo||""} onChange={e=>sf("motivo")(e.target.value)}/></FG>
          <ModalBtns onCancel={cm} onOk={submitIsentarContrib} saving={saving} cls="btn-dark" label="Aplicar isenção"/>
        </div>
      </Modal>;
    }

    if (modal==="contrib") return <Modal title={form._row?"Editar contribuição":"Nova contribuição"} onClose={cm}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <FG label="Título" {...ef("titulo")}><input className="input" value={form.titulo||""} onChange={e=>sf("titulo")(e.target.value)}/></FG>
        <FG label="Descrição"><input className="input" value={form.descricao||""} onChange={e=>sf("descricao")(e.target.value)}/></FG>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FG label="Valor por apt. (Kz)" {...ef("valorPorFracao")} hint={errs.valorPorFracao?undefined:"Vazio = sem valor fixo"}><input className="input" type="number" min="0" value={form.valorPorFracao||""} onChange={e=>sf("valorPorFracao")(e.target.value)}/></FG>
          <FG label="Valor total (Kz)" {...ef("valorTotal")} hint={errs.valorTotal?undefined:"Vazio = sem limite"}><input className="input" type="number" min="0" value={form.valorTotal||""} onChange={e=>sf("valorTotal")(e.target.value)}/></FG>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FG label="Prazo (opcional)"><input className="input" type="date" value={form.dataVencimento||""} onChange={e=>sf("dataVencimento")(e.target.value)}/></FG>
          <FG label="Categoria (opcional)"><input className="input" value={form.categoria||""} onChange={e=>sf("categoria")(e.target.value)}/></FG>
        </div>
        {form._row&&<FG label="Estado"><select className="input" value={form.estado||"Aberto"} onChange={e=>sf("estado")(e.target.value)}>{[...new Set([...ESTADOS_CONTRIB,form.estado||"Aberto"])].map(s=><option key={s}>{s}</option>)}</select></FG>}
        <fieldset style={{border:"none"}}>
          <legend className="lbl" style={{marginBottom:6}}>Apartamentos que não participam</legend>
          <div style={{maxHeight:180,overflowY:"auto",border:"1.5px solid var(--line-3)",borderRadius:10,padding:"4px 10px"}}>
            {fracoesOrd.map(f=>(
              <CheckRow key={f.id} label={`${f.numero} — ${nomeApt(f)}`} checked={(form.excluidos||[]).includes(f.numero)}
                onChange={v=>sf("excluidos")(v?[...(form.excluidos||[]),f.numero]:(form.excluidos||[]).filter(n=>n!==f.numero))}/>
            ))}
          </div>
        </fieldset>
        <ModalBtns onCancel={cm} onOk={submitContrib} saving={saving} label={form._row?"Guardar":"Criar contribuição"}/>
      </div>
    </Modal>;

    if (modal==="pagContrib") {
      const c=contribById(form.contribId), f=aptByNum(form.fracaoNum);
      const ci=c&&f?contribInfo(c,f.id,pagamentosContribuicao):null;
      const aviso=!form._row&&ci&&!ci.isLivre&&(ci.isento?"Este apartamento está isento desta contribuição.":ci.excluido?"Este apartamento está excluído desta contribuição.":ci.pago?`Este apartamento já pagou esta contribuição (${fmtKz(ci.totalPago)}).`:null);
      return <Modal title={form._row?"Editar pagamento de contribuição":"Registar pagamento de contribuição"} onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {contribSelect(v=>{ const cc=contribById(v); setForm(p=>({...p,contribId:v,...(!p._row&&cc?.valorPorFracao?{valor:cc.valorPorFracao}:{})})); setErrs({}); })}
          <FG label="Apartamento" {...ef("apt")}><AptCombo fracoes={fracoesOrd} value={form.fracaoNum} info={contribAptInfo(c)} onChange={sf("fracaoNum")}/></FG>
          {aviso&&<Warn>{aviso}</Warn>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Valor (Kz)" {...ef("valor")}><input className="input" type="number" min="0" value={form.valor??""} onChange={e=>sf("valor")(e.target.value)}/></FG>
            <FG label="Data" {...ef("data")}><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
          </div>
          {metodoSeg()}
          <ModalBtns onCancel={cm} onOk={submitPagContrib} saving={saving} label={form._row?"Guardar":`Registar${+form.valor>0?" "+fmtKz(+form.valor):""}`}/>
        </div>
      </Modal>;
    }

    if (modal==="pagContribBulk") {
      const c=contribById(form.contribId);
      const elegiveis=c?fracoesOrd.filter(f=>{const ci=contribInfo(c,f.id,pagamentosContribuicao);return ci.isLivre||(!ci.excluido&&!ci.isento&&!ci.pago);}):fracoesOrd;
      const sel=form.bulkApts||[];
      return <Modal title="Lançar contribuição para vários apartamentos" onClose={cm} lg>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Info>Lança um pagamento para cada apartamento seleccionado, com o mesmo valor e data.</Info>
          {contribSelect(v=>{ const cc=contribById(v); setForm(p=>({...p,contribId:v,bulkApts:[],...(cc?.valorPorFracao?{valor:cc.valorPorFracao}:{})})); setErrs({}); })}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Valor por apt. (Kz)" {...ef("valor")}><input className="input" type="number" min="0" value={form.valor??""} onChange={e=>sf("valor")(e.target.value)}/></FG>
            <FG label="Data" {...ef("data")}><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
          </div>
          {metodoSeg()}
          <fieldset style={{border:"none"}} id="f-bulk" tabIndex={-1}>
            <legend className="lbl" style={{marginBottom:6}}>Apartamentos</legend>
            <div style={{maxHeight:220,overflowY:"auto",border:`1.5px solid ${errs.bulk?"var(--divida)":"var(--line-3)"}`,borderRadius:10,padding:"4px 10px"}}>
              <CheckRow label={c?`Seleccionar os que faltam pagar (${elegiveis.length})`:"Seleccionar todos"} checked={sel.length>0&&elegiveis.every(f=>sel.includes(f.numero))} onChange={v=>sf("bulkApts")(v?elegiveis.map(f=>f.numero):[])}/>
              <div className="divider" style={{margin:"4px 0"}}/>
              {fracoesOrd.map(f=>{
                const ci=c?contribInfo(c,f.id,pagamentosContribuicao):null;
                const nota=ci&&!ci.isLivre?(ci.excluido?" · excluído":ci.isento?" · isento":ci.pago?" · já pagou":""):"";
                return <CheckRow key={f.id} label={`${f.numero} — ${nomeApt(f)}${nota}`} checked={sel.includes(f.numero)} onChange={v=>sf("bulkApts")(v?[...sel,f.numero]:sel.filter(n=>n!==f.numero))}/>;
              })}
            </div>
            {errs.bulk&&<span className="fg-err" role="alert" style={{marginTop:6}}><Icon n="alert" s={15}/>{errs.bulk}</span>}
          </fieldset>
          <ModalBtns onCancel={cm} onOk={submitBulk} saving={saving} cls="btn-blue" label={`Lançar para ${sel.length} ${sel.length===1?"apartamento":"apartamentos"}`}/>
        </div>
      </Modal>;
    }

    if (modal==="despesa") return <Modal title={form._row?"Editar despesa":"Registar despesa"} onClose={cm}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <FG label="Descrição" {...ef("descricao")}><input className="input" placeholder="Ex.: Electricidade" value={form.descricao||""} onChange={e=>sf("descricao")(e.target.value)}/></FG>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FG label="Valor (Kz)" {...ef("valor")}><input className="input" type="number" min="0" value={form.valor??""} onChange={e=>sf("valor")(e.target.value)}/></FG>
          <FG label="Data" {...ef("data")}><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
        </div>
        <FG label="Categoria" {...ef("categoria")}><select className="input" value={form.categoria||""} onChange={e=>sf("categoria")(e.target.value)}><option value="">Escolha…</option>{[...new Set([...CATS,form.categoria].filter(Boolean))].map(c=><option key={c}>{c}</option>)}</select></FG>
        <FG label="Fornecedor (opcional)"><input className="input" value={form.fornecedor||""} onChange={e=>sf("fornecedor")(e.target.value)}/></FG>
        <FG label="Observações (opcional)"><input className="input" value={form.observacoes||""} onChange={e=>sf("observacoes")(e.target.value)}/></FG>
        <ModalBtns onCancel={cm} onOk={submitDespesa} saving={saving} label={form._row?"Guardar":`Registar${+form.valor>0?" "+fmtKz(+form.valor):""}`}/>
      </div>
    </Modal>;

    if (modal==="aviso") return <Modal title={form._row?"Editar aviso":"Publicar aviso ou acta"} onClose={cm}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <FG label="Tipo" id="f-tipo" err={errs.tipo}><Segmented grid cols={2} label="Tipo" value={form.tipo||""} onChange={sf("tipo")} options={AVISO_TIPOS}/></FG>
        <FG label="Título" {...ef("titulo")}><input className="input" value={form.titulo||""} onChange={e=>sf("titulo")(e.target.value)}/></FG>
        <FG label="Conteúdo"><textarea className="input" value={form.conteudo||""} onChange={e=>sf("conteudo")(e.target.value)} rows={5}/></FG>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FG label="Data" {...ef("data")}><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
          <FG label="Autor"><input className="input" value={form.autor??""} onChange={e=>sf("autor")(e.target.value)}/></FG>
        </div>
        <ModalBtns onCancel={cm} onOk={submitAviso} saving={saving} label={form._row?"Guardar":"Publicar"}/>
      </div>
    </Modal>;

    return null;
  }
}
