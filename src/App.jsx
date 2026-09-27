import { useState, useEffect, useCallback } from "react";
import { API_URL, APP_VERSAO, apiGet, apiPost, stGet, stSet, stDel, sessGet, sessSet } from "./lib.js";
import { Fonts, G, Icon, FG, Loading } from "./ui.jsx";
import { PublicView } from "./Publico.jsx";
import { GestorDashboard } from "./Gestor.jsx";

/* ════════════════════════════════════════════════════════════════
   ⚙️  CONFIGURAÇÃO — v6
   O URL da Aplicação Web do Apps Script está em lib.js (API_URL).
   Não há chave secreta no site: as gravações usam a sessão do gestor.
════════════════════════════════════════════════════════════════ */


// "Failed to fetch" (Chrome), "Load failed" (Safari), "NetworkError" (Firefox):
// o browser não conseguiu ler a resposta do Apps Script — normalmente a
// implementação pede login (acesso não é "Qualquer pessoa") ou o URL é o de teste (/dev).
const erroDeRede = (msg) => /failed to fetch|load failed|networkerror/i.test(String(msg||""));
function AjudaLigacao({url}) {
  return (
    <div style={{fontSize:14,lineHeight:1.6,color:"#3D3832",textAlign:"left",maxWidth:460}}>
      <p style={{marginBottom:8}}>O browser não conseguiu ler a resposta do Apps Script. Causas mais comuns:</p>
      <ol style={{paddingLeft:20,marginBottom:10}}>
        <li>A implementação não tem acesso <b>Qualquer pessoa</b> (em Implementar → Gerir implementações).</li>
        <li>O URL é o de teste (termina em <b>/dev</b>) em vez do da aplicação web (termina em <b>/exec</b>).</li>
        <li>O código foi colado mas não foi criada uma <b>Nova versão</b> da implementação.</li>
      </ol>
      {url&&<p>Para confirmar, abra <a href={url} target="_blank" rel="noreferrer" style={{color:"var(--info)",fontWeight:700,wordBreak:"break-all"}}>o endereço do Apps Script</a> numa janela privada: deve aparecer texto a começar por <code>{'{"ok":true'}</code>. Se aparecer uma página de login ou de erro do Google, o problema está na implementação.</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SETUP SCREEN
═══════════════════════════════════════════════════════════════ */
function SetupScreen({onSave}) {
  const [url,setUrl]=useState("");
  const [testing,setTest]=useState(false); const [result,setResult]=useState(null);
  const test = async()=>{ if(!url)return; setTest(true); setResult(null);
    try{ const d=await apiGet(url); setResult(d.ok?{ok:true,msg:`Ligação com sucesso. Prédio: "${d.config?.predio}"${d.versao?` · script ${d.versao}`:""}`}:{ok:false,msg:d.error}); }
    catch(e){ setResult({ok:false,msg:"Erro: "+e.message}); } setTest(false); };
  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <main style={{width:"100%",maxWidth:560}} className="anim">
        <div style={{textAlign:"center",marginBottom:28}}>
          <Icon n="settings" s={40} style={{color:"var(--ink-2)",marginBottom:10}}/>
          <h1 className="serif" style={{fontSize:26,fontWeight:700,marginBottom:8}}>Configurar ligação</h1>
          <p className="muted" style={{fontSize:15,lineHeight:1.6}}>Cole o URL da Aplicação Web do Google Apps Script.<br/>Este passo faz-se apenas uma vez.</p>
        </div>
        <div className="card" style={{marginBottom:16,display:"flex",flexDirection:"column",gap:16}}>
          <FG label="URL do Google Apps Script"><input className="input" type="url" value={url} placeholder="https://script.google.com/macros/s/.../exec" onChange={e=>setUrl(e.target.value.trim())}/></FG>
          {result&&<div role="status" className={`banner ${result.ok?"":"banner-warn"}`} style={result.ok?{background:"var(--ok-bg)",color:"var(--ok)"}:undefined}>
            <Icon n={result.ok?"checkCircle":"alert"} s={18}/>{result.msg}</div>}
          {result&&!result.ok&&erroDeRede(result.msg)&&<AjudaLigacao url={url}/>}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap"}}>
            <button className="btn btn-outline" onClick={test} disabled={!url||testing}>{testing?<span className="spinner"/>:"Testar ligação"}</button>
            <button className="btn btn-red" onClick={()=>onSave({apiUrl:url})} disabled={!url}>Guardar e continuar<Icon n="right" s={16}/></button>
          </div>
        </div>
        <div className="card" style={{background:"var(--warn-bg)",border:"1px solid #F0D2A6"}}>
          <h2 style={{fontWeight:800,color:"var(--warn)",marginBottom:8,fontSize:15}}>Como obter o URL</h2>
          <ol style={{paddingLeft:18,fontSize:14,color:"#3D3832",lineHeight:1.9}}>
            <li>Google Sheets → <b>Extensões → Apps Script</b></li>
            <li>Cole o conteúdo do <b>Code.gs</b> ({APP_VERSAO})</li>
            <li>Definições do projecto → Propriedades do script → <b>GESTOR_PASSWORD</b></li>
            <li><b>Implementar → Nova implementação → Aplicação Web</b></li>
            <li>Acesso: <b>Qualquer pessoa</b> → copie o URL</li>
          </ol>
        </div>
      </main>
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
   GESTOR LOGIN — a palavra-passe é validada no Apps Script
═══════════════════════════════════════════════════════════════ */
function GestorLogin({apiUrl,onLogin,onBack}) {
  const [v,setV]=useState(""); const [err,setErr]=useState(null); const [busy,setBusy]=useState(false);
  const go=async(e)=>{
    e?.preventDefault();
    if(!v||busy) return;
    setBusy(true); setErr(null);
    try { const r=await apiPost(apiUrl,"login",{password:v}); onLogin({token:r.token,exp:r.exp}); }
    catch(e){ setErr(e.message); setV(""); }
    setBusy(false);
  };
  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <main style={{width:"100%",maxWidth:380}}>
        <button onClick={onBack} className="btn btn-ghost" style={{marginBottom:20}}><Icon n="left" s={18}/>Voltar à página do prédio</button>
        <form className="card anim" onSubmit={go} style={{display:"flex",flexDirection:"column",gap:18}}>
          <div style={{textAlign:"center"}}>
            <Icon n="lock" s={36} style={{color:"var(--ink-2)",marginBottom:8}}/>
            <h1 className="serif" style={{fontSize:24,fontWeight:700}}>Área do gestor</h1>
          </div>
          <FG label="Palavra-passe" err={err}><input className="input" type="password" autoComplete="current-password" value={v} onChange={e=>setV(e.target.value)} autoFocus/></FG>
          <button type="submit" className="btn btn-red" disabled={busy||!v} style={{minHeight:48}}>{busy?<span className="spinner" style={{borderTopColor:"#fff"}}/>:"Entrar"}</button>
        </form>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════ */
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
  const [gErro,setGErro]=useState(null);

  const saveCfg = (newCfg)=>{
    if(newCfg) stSet("condo_cfg",{...newCfg,base:API_URL}); else stDel("condo_cfg");
    setCfg(newCfg);
    if(forceSetup) window.history.replaceState({},"",window.location.pathname);
  };

  const {data,loading,error,reload} = usePublicData(cfg?.apiUrl||"");

  const terminarSessao = ()=>{ sessSet(null); setSessao(null); setGData(null); setView("public"); };
  const sessaoExpirada = ()=>{ sessSet(null); setSessao(null); setGData(null); setView("login"); };

  const loadGestor = useCallback(async(token)=>{
    if(!cfg?.apiUrl||!token) return;
    setGLoading(true); setGErro(null);
    try { const d=await apiPost(cfg.apiUrl,"get_data",{},token); setGData(d); }
    catch(e){
      if(e.code==="AUTH") sessaoExpirada();
      else setGErro(e.message);
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
  if(error&&!data) return <><Fonts/><G/>
    <main style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"var(--bg)",padding:24,gap:14,textAlign:"center"}}>
      <Icon n="alert" s={40} style={{color:"var(--divida)"}}/>
      <h1 className="serif" style={{fontSize:22}}>Erro de ligação</h1>
      {erroDeRede(error) ? <AjudaLigacao url={cfg.apiUrl}/> : <p className="muted" style={{fontSize:15,maxWidth:400}}>{error}</p>}
      <button className="btn btn-red" onClick={reload}><Icon n="refresh" s={16}/>Tentar novamente</button>
      <button className="btn btn-ghost" onClick={()=>saveCfg(null)}><Icon n="settings" s={16}/>Configurar ligação</button>
    </main></>;
  if(!data) return null;

  return (
    <><Fonts/><G/>
    {view==="public" &&<PublicView appData={data} offline={!!error} onGestor={abrirGestor}/>}
    {view==="login"  &&<GestorLogin apiUrl={cfg.apiUrl} onLogin={entrar} onBack={()=>setView("public")}/>}
    {view==="gestor" &&(gData
      ? <GestorDashboard appData={gData} apiUrl={cfg.apiUrl} token={sessao?.token} exp={sessao?.exp}
          onBack={()=>setView("public")} onLogout={terminarSessao} onExpired={sessaoExpirada} onReload={recarregarTudo}
          onReconfig={()=>{ window.location.href=window.location.pathname+"?setup"; }} loading={gLoading}/>
      : gErro
        ? <main style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,padding:24,textAlign:"center"}}>
            <Icon n="alert" s={40} style={{color:"var(--divida)"}}/>
            <h1 className="serif" style={{fontSize:22}}>Não foi possível carregar os dados do gestor</h1>
            <p className="muted" style={{maxWidth:420}}>{gErro}</p>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-red" onClick={()=>loadGestor(sessao?.token)}><Icon n="refresh" s={16}/>Tentar novamente</button>
              <button className="btn btn-outline" onClick={()=>setView("public")}>Voltar</button>
            </div>
          </main>
        : <Loading gestor msg="A carregar dados do gestor…"/>)}
    </>
  );
}
