import { useState, useMemo, useRef } from "react";
import { MESES, nomeApt, situacaoApt, fmtKz, inativa } from "./lib.js";
import { relatorioMensal, relatorioAnual, relatorioExtracto, relatorioAtrasos, descarregarHtml } from "./relatoriosHtml.js";
import { Icon, FG, CheckRow, MesSelect, AnoSelect, AptCombo } from "./ui.jsx";

/* ── D3: PDF gerado no telemóvel/computador, para partilhar directamente ──
   Captura a própria pré-visualização (com os estilos do relatório) e corta-a
   em páginas A4 sem partir linhas de tabela nem caixas a meio.
   As bibliotecas (html2canvas, jsPDF) só são carregadas quando se carrega no botão. */
const nomeFicheiro = n => String(n||"relatorio").replace(/[^\w\-. ]+/g,"_").trim() || "relatorio";
const A4 = { w:210, h:297, mx:14, mt:12, mb:16 };   // mm
const LARGURA_PX = 688;                              // largura útil (182 mm) em px de ecrã
async function pdfDoRelatorio(doc, nome) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  try { await doc.fonts?.ready; } catch(_) {}
  const st = doc.createElement("style");
  st.textContent = `body{background:#fff!important}.pg{box-shadow:none!important;margin:0!important;padding:0!important;max-width:none!important;width:${LARGURA_PX}px!important}`;
  doc.head.appendChild(st);
  try {
    const el = doc.querySelector(".pg") || doc.body;
    const top0 = el.getBoundingClientRect().top;
    const total = el.scrollHeight;
    const pxPorMm = LARGURA_PX / (A4.w - 2*A4.mx);
    const altPag = (A4.h - A4.mt - A4.mb) * pxPorMm;
    // Pontos onde se pode mudar de página: antes de cada bloco ou linha de tabela
    const blocos = [...el.querySelectorAll("tr,h2,p,.conta,.dois,.aprov,.cats,.bar,.caixa,.chk,.foot,.hdr,.nota,table,.ass")];
    const proibidos = [...el.querySelectorAll("h2")].map(h=>{ const r=h.getBoundingClientRect(); return [r.top-top0, r.bottom-top0+48]; });
    // Também não se corta a seguir a um cabeçalho de tabela, nem dentro de caixas (conta, assinaturas…)
    el.querySelectorAll("thead").forEach(t=>{ const r=t.getBoundingClientRect(); proibidos.push([r.top-top0+1, r.bottom-top0+2]); });
    el.querySelectorAll(".aprov,.conta,.dois,.caixa,.cats,.hdr").forEach(t=>{ const r=t.getBoundingClientRect(); proibidos.push([r.top-top0, r.bottom-top0-1]); });
    const cortes = [...new Set(blocos.map(b=>Math.round(b.getBoundingClientRect().top-top0)))]
      .filter(y=>y>0 && !proibidos.some(([a,b])=>y>a&&y<=b)).sort((a,b)=>a-b);
    const paginas = [];
    let ini = 0;
    while (ini < total - 2) {
      let fim = ini + altPag;
      if (fim >= total) fim = total;
      else { const c = cortes.filter(y=>y>ini+altPag*0.4 && y<=fim).pop(); if (c) fim = c; }
      paginas.push([ini, fim]); ini = fim;
    }
    const escala = 2;
    const canvas = await html2canvas(el, { scale: escala, backgroundColor: "#ffffff", windowWidth: 794, useCORS: true });
    const pdf = new jsPDF({ unit:"mm", format:"a4", orientation:"portrait", compress:true });
    paginas.forEach(([a,b], i)=>{
      if (i) pdf.addPage();
      const c = document.createElement("canvas");
      c.width = canvas.width; c.height = Math.ceil((b-a)*escala);
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0,0,c.width,c.height);
      ctx.drawImage(canvas, 0, Math.floor(a*escala), canvas.width, c.height, 0, 0, canvas.width, c.height);
      pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", A4.mx, A4.mt, A4.w-2*A4.mx, (b-a)/pxPorMm);
      pdf.setFontSize(8); pdf.setTextColor(90);
      pdf.text(`Página ${i+1} de ${paginas.length}`, A4.w-A4.mx, A4.h-8, { align:"right" });
    });
    return new File([pdf.output("blob")], nomeFicheiro(nome) + ".pdf", { type: "application/pdf" });
  } finally { st.remove(); }
}
// Partilhar ficheiros só existe em alguns browsers (sobretudo telemóveis); nos outros, descarrega
const podePartilhar = () => { try { return !!navigator.canShare?.({ files: [new File([""], "x.pdf", { type: "application/pdf" })] }); } catch(_) { return false; } };

/* Pré-visualização: a página fica visível antes de imprimir ou guardar em PDF */
export function ReportPreview({html, nome, altura="72vh"}) {
  const ref = useRef(null);
  const [aGerar,setAGerar] = useState(false);
  const [erro,setErro] = useState("");
  const partilha = useMemo(podePartilhar, []);
  const imprimir = ()=>{ const w = ref.current?.contentWindow; if (w) { w.focus(); w.print(); } };
  const pdf = async()=>{
    const doc = ref.current?.contentDocument; if (!doc) return;
    setAGerar(true); setErro("");
    try {
      const f = await pdfDoRelatorio(doc, nome);
      if (partilha) {
        try { await navigator.share({ files:[f], title: nome }); }
        catch(e) { if (e?.name !== "AbortError") throw e; }
      } else {
        const url = URL.createObjectURL(f), a = document.createElement("a");
        a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(url), 4000);
      }
    } catch(e) { setErro("Não foi possível criar o PDF. Use “Imprimir / PDF”."); }
    setAGerar(false);
  };
  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:0,border:"1px solid var(--line)",borderRadius:14,overflow:"hidden",background:"#EFEBE5"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",padding:"10px 14px",borderBottom:"1px solid var(--line-3)"}}>
        <span style={{fontSize:13,color:"var(--ink-2)"}}><b style={{color:"var(--ink)"}}>Pré-visualização</b></span>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn btn-blue btn-sm" onClick={pdf} disabled={aGerar}>{aGerar?<span className="spinner"/>:<Icon n={partilha?"share":"download"} s={16}/>}{partilha?"Partilhar PDF":"Descarregar PDF"}</button>
          <button className="btn btn-outline btn-sm" onClick={imprimir}><Icon n="printer" s={16}/>Imprimir</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>descarregarHtml(html, nome)} title="Descarregar como página HTML"><Icon n="file" s={16}/>HTML</button>
        </div>
      </div>
      {erro&&<div role="alert" className="banner banner-warn" style={{margin:"8px 14px 0"}}><Icon n="alert" s={16}/>{erro}</div>}
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
