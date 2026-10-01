import { useState, useMemo, useRef } from "react";
import { MESES, nomeApt, situacaoApt, fmtKz, inativa } from "./lib.js";
import { relatorioMensal, relatorioAnual, relatorioExtracto, relatorioAtrasos, descarregarHtml } from "./relatoriosHtml.js";
import { Icon, FG, CheckRow, MesSelect, AnoSelect, AptCombo } from "./ui.jsx";

/* Pré-visualização: a página fica visível antes de imprimir ou guardar em PDF */
export function ReportPreview({html, nome, altura="72vh"}) {
  const ref = useRef(null);
  const imprimir = ()=>{ const w = ref.current?.contentWindow; if (w) { w.focus(); w.print(); } };
  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:0,border:"1px solid var(--line)",borderRadius:14,overflow:"hidden",background:"#EFEBE5"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",padding:"10px 14px",borderBottom:"1px solid var(--line-3)"}}>
        <span style={{fontSize:13,color:"var(--ink-2)"}}><b style={{color:"var(--ink)"}}>Pré-visualização</b> · para PDF escolha “Guardar como PDF” ao imprimir</span>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn btn-outline btn-sm" onClick={()=>descarregarHtml(html, nome)}><Icon n="download" s={16}/>Descarregar</button>
          <button className="btn btn-red btn-sm" onClick={imprimir}><Icon n="printer" s={16}/>Imprimir / PDF</button>
        </div>
      </div>
      <iframe ref={ref} title={`Pré-visualização: ${nome}`} srcDoc={html} style={{width:"100%",height:altura,border:"none",background:"#E6E1DA"}}/>
    </div>
  );
}

const TIPOS = [
  ["mensal","Mensal","Conta do mês, cobrança, entradas, saídas e atrasos"],
  ["anual","Anual","Acumulado do ano, mês a mês, categorias e contribuições"],
  ["extracto","Extracto por apartamento","Pagamentos e valores em falta de um apartamento"],
  ["atrasos","Lista de atrasos","Só apartamentos com valores em falta"],
];

export function CentroRelatorios({appData, anos}) {
  const now = new Date();
  const [tipo,setTipo] = useState("mensal");
  const [mes,setMes] = useState(now.getMonth()+1);
  const [ano,setAno] = useState(now.getFullYear());
  const [apt,setApt] = useState("");
  const [nomes,setNomes] = useState(true);
  const [detalhe,setDetalhe] = useState(true);
  const [aprovacao,setAprovacao] = useState(true);
  const [corte,setCorte] = useState(0);   // anual: 0 = ano completo; 3/6/9 = até ao fim do trimestre; 1–12 = até ao mês
  const f = appData.fracoes.find(x=>String(x.numero)===String(apt));

  const { html, nome } = useMemo(()=>{
    if (tipo==="mensal")  return { html: relatorioMensal(appData, ano, mes, { nomes, detalhe, aprovacao }), nome:`Relatorio ${MESES[mes-1]} ${ano}` };
    if (tipo==="anual")   return { html: relatorioAnual(appData, ano, { nomes, aprovacao, ateMes: corte||undefined }),
      nome:`Relatorio anual ${ano}${corte?` ate ${MESES[corte-1]}`:""}` };
    if (tipo==="extracto") return { html: relatorioExtracto(appData, f?.id), nome:`Extracto ${f?.numero||""}` };
    return { html: relatorioAtrasos(appData, { nomes }), nome:"Valores em atraso" };
  },[appData,tipo,mes,ano,f,nomes,detalhe,aprovacao,corte]);

  return (
    <div className="rel-grid">
      <style>{`.rel-grid{display:grid;grid-template-columns:340px minmax(0,1fr);gap:20px;align-items:start}
        @media(max-width:900px){.rel-grid{grid-template-columns:1fr}}`}</style>
      <div className="card" style={{display:"flex",flexDirection:"column",gap:18}}>
        <fieldset style={{border:"none",display:"flex",flexDirection:"column",gap:8}}>
          <legend className="lbl" style={{paddingBottom:8}}>Tipo de relatório</legend>
          {TIPOS.map(([k,l,d])=>(
            <label key={k} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 12px",borderRadius:10,cursor:"pointer",
              border:tipo===k?"2px solid var(--ink)":"1.5px solid var(--line)",background:tipo===k?"var(--surface-2)":"#fff"}}>
              <input type="radio" name="tipo-rel" checked={tipo===k} onChange={()=>setTipo(k)} style={{width:18,height:18,marginTop:2,accentColor:"var(--brand)"}}/>
              <span style={{display:"flex",flexDirection:"column"}}><b style={{fontSize:15}}>{l}</b><span className="muted" style={{fontSize:13}}>{d}</span></span>
            </label>
          ))}
        </fieldset>
        {(tipo==="mensal"||tipo==="anual")&&<div style={{display:"grid",gridTemplateColumns:tipo==="mensal"?"1.4fr 1fr":"1fr",gap:10}}>
          {tipo==="mensal"&&<FG label="Mês"><MesSelect value={mes} onChange={setMes}/></FG>}
          <FG label="Ano"><AnoSelect value={ano} onChange={setAno} anos={anos}/></FG>
          {tipo==="anual"&&<FG label="Período">
            <select className="input" value={corte} onChange={e=>setCorte(+e.target.value)}>
              <option value={0}>Ano completo</option>
              <option value={3}>Até Março (1.º trimestre)</option>
              <option value={6}>Até Junho (2.º trimestre)</option>
              <option value={9}>Até Setembro (3.º trimestre)</option>
              <optgroup label="Até ao fim do mês">
                {MESES.map((m,i)=>![2,5,8,11].includes(i)&&<option key={i} value={i+1}>Até {m}</option>)}
              </optgroup>
            </select>
          </FG>}
        </div>}
        {tipo==="extracto"&&<FG label="Apartamento">
          <AptCombo fracoes={appData.fracoes} value={apt} onChange={setApt}
            info={x=>{ if (inativa(x)) return {txt:"Inactivo"}; const s=situacaoApt(x,appData); return s.total>0?{txt:fmtKz(s.total),tone:"bad"}:x.excluiQuota?{txt:"Sem quota"}:{txt:"Em dia",tone:"ok"}; }}/>
        </FG>}
        {tipo!=="extracto"&&<div>
          <div className="lbl" style={{marginBottom:4}}>Incluir</div>
          <CheckRow label="Nomes na lista de atrasos" checked={nomes} onChange={setNomes}/>
          {tipo==="mensal"&&<CheckRow label="Cada pagamento em linha própria" checked={detalhe} onChange={setDetalhe}/>}
          {tipo!=="atrasos"&&<CheckRow label="Bloco de aprovação em assembleia" checked={aprovacao} onChange={setAprovacao}/>}
        </div>}
        {tipo==="extracto"&&f&&<div className="fg-hint">Extracto de {f.numero}{nomeApt(f)?` — ${nomeApt(f)}`:""}. Pode enviá-lo ao proprietário depois de guardar em PDF.</div>}
      </div>
      <ReportPreview html={html} nome={nome}/>
    </div>
  );
}
