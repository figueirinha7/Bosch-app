import { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

/* ════════════════════════════════════════════════════════════════
   ⚙️  CONFIGURAÇÃO — altere estas duas linhas antes do deploy
   Obtenha o API_URL no Passo 2.6 do guia de instalação
════════════════════════════════════════════════════════════════ */
const API_URL    = "";  // → cole aqui o URL do Google Apps Script
const API_SECRET = "";  // → cole aqui a chave secreta (API_SECRET do Code.gs)

/* ── FONTS ── */
const Fonts = () => <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Nunito:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />;

/* ── CONSTANTS ── */
const MESES   = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_S = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const CATS    = ["Utilities","Limpeza","Manutenção","Seguros","Administração","Obras","Outros"];
const uid     = () => Math.random().toString(36).slice(2,10);
const today   = () => new Date().toISOString().slice(0,10);

/* ── FORMAT ── */
const fmtKz   = (v) => Math.round(v||0).toLocaleString("pt-PT") + "\u00a0Kz";
const fmtDate = (d) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-PT",{day:"2-digit",month:"short",year:"numeric"}) : "";

/* ── STORAGE ──────────────────────────────────────────────────
   Usa window.storage no Claude.ai, localStorage noutros browsers
   (Vercel, Chrome, Safari, etc.) para a configuracao persistir
--------------------------------------------------------------- */
const inClaude = typeof window !== "undefined" && typeof window.storage?.get === "function";

async function stGet(key) {
  try {
    if (inClaude) {
      const r = await window.storage.get(key);
      return r?.value ? JSON.parse(r.value) : null;
    }
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch(_) { return null; }
}

async function stSet(key, val) {
  try {
    const s = JSON.stringify(val);
    if (inClaude) { await window.storage.set(key, s); }
    else          { localStorage.setItem(key, s); }
  } catch(_) {}
}

/* ── API CLIENT ──────────────────────────────────────────────────
   Todas as chamadas passam por aqui.
   apiUrl  = URL da aplicação web do Apps Script
   secret  = chave secreta definida no Code.gs
─────────────────────────────────────────────────────────────────*/
async function apiGet(apiUrl) {
  const r = await fetch(apiUrl, { redirect: "follow" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

async function apiPost(apiUrl, secret, action, data) {
  const r = await fetch(apiUrl, {
    method:  "POST",
    redirect:"follow",
    headers: { "Content-Type": "text/plain" }, // Apps Script exige text/plain para evitar preflight
    body: JSON.stringify({ secret, action, data }),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

/* ── CALC ── */
function quotaInfo(fracaoId, pags, quotaMensal, anoBase, mesBase) {
  const now = new Date();
  const [ny, nm] = [now.getFullYear(), now.getMonth()+1];
  let months = 0, y = anoBase, m = mesBase;
  while (y < ny || (y===ny && m<=nm)) { months++; m++; if(m>12){m=1;y++;} }
  const totalPago = pags.filter(p=>p.fracaoId===fracaoId).reduce((s,p)=>s+p.valor,0);
  const totalEsp  = months * quotaMensal;
  const divida    = Math.max(0, totalEsp - totalPago);
  return { totalPago, totalEsp, divida, mesesAtraso: Math.floor(divida/quotaMensal), mesesTotal: months };
}
function contribInfo(cId, fId, pagsCont, valorPF) {
  const total = pagsCont.filter(p=>p.contribuicaoId===cId&&p.fracaoId===fId).reduce((s,p)=>s+p.valor,0);
  return { totalPago: total, divida: Math.max(0, valorPF-total), pago: total>=valorPF };
}

/* ── MONTHLY REPORT ── */
function printReport(appData, mes, ano) {
  const { config, fracoes, pagamentosQuota, contribuicoes, pagamentosContribuicao, despesas } = appData;
  const { predio, endereco, gestorNome, quotaMensal } = config;
  const pad = (n) => String(n).padStart(2,"0");
  const pqMes   = pagamentosQuota.filter(p=>p.mes===mes&&p.ano===ano);
  const despMes = despesas.filter(d=>d.data?.startsWith(`${ano}-${pad(mes)}`));
  const pcMes   = pagamentosContribuicao.filter(p=>p.data?.startsWith(`${ano}-${pad(mes)}`));
  const totalRec   = pqMes.reduce((s,p)=>s+p.valor,0) + pcMes.reduce((s,p)=>s+p.valor,0);
  const totalDesp  = despMes.reduce((s,d)=>s+d.valor,0);
  const saldo      = totalRec - totalDesp;
  const quotaEsp   = fracoes.length * quotaMensal;
  const pagaram    = fracoes.filter(f => pqMes.some(p=>p.fracaoId===f.id));
  const naoPageram = fracoes.filter(f => !pqMes.some(p=>p.fracaoId===f.id));
  const taxaCob    = quotaEsp>0 ? Math.round((pqMes.reduce((s,p)=>s+p.valor,0)/quotaEsp)*100) : 0;
  const fmtR = v => Math.round(v||0).toLocaleString("pt-PT")+" Kz";

  const html = `<!DOCTYPE html><html lang="pt"><head>
<meta charset="UTF-8"><title>Relatório ${MESES[mes-1]} ${ano}</title>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Nunito:wght@400;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0} body{font-family:'Nunito',sans-serif;color:#1C1A16;background:#fff;padding:28px;max-width:800px;margin:0 auto;font-size:13px}
  h1{font-family:'Lora',serif;font-size:26px;font-weight:700} h2{font-family:'Lora',serif;font-size:15px;font-weight:700;color:#B5341A;border-bottom:2px solid #B5341A;padding-bottom:5px;margin:22px 0 10px}
  .hdr{border-bottom:3px solid #B5341A;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start}
  .meta{font-size:12px;color:#8A8278;margin-top:6px} .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
  .stat{background:#F5F3EF;border-radius:8px;padding:12px 14px} .sl{font-size:10px;color:#8A8278;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
  .sv{font-size:16px;font-weight:700} .g{color:#1E7A4A} .r{color:#B5341A}
  table{width:100%;border-collapse:collapse;margin-bottom:16px} th{font-size:10px;color:#8A8278;text-transform:uppercase;letter-spacing:.4px;padding:7px 9px;border-bottom:1.5px solid #E2DDD6;text-align:left}
  td{padding:8px 9px;font-size:12px;border-bottom:1px solid #F0EDE8} .tag{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700}
  .tg{background:#EBF7F1;color:#1E7A4A} .tr{background:#FAF0EE;color:#B5341A}
  .pb{background:#E2DDD6;border-radius:20px;height:8px;overflow:hidden;margin:6px 0} .pf{height:100%;border-radius:20px}
  .foot{margin-top:28px;padding-top:12px;border-top:1px solid #E2DDD6;font-size:11px;color:#8A8278;display:flex;justify-content:space-between}
  @media print{body{padding:16px}}
</style></head><body>
<div class="hdr">
  <div><h1>${predio}</h1><div class="meta">${endereco}</div>
  <div class="meta">📅 ${MESES[mes-1]} ${ano} &nbsp;·&nbsp; 👤 ${gestorNome} &nbsp;·&nbsp; 🖨️ ${new Date().toLocaleDateString("pt-PT")}</div></div>
  <div style="font-family:'Lora',serif;font-size:20px;font-weight:700;color:#B5341A;text-align:right">Relatório<br>Mensal</div>
</div>
<h2>Resumo</h2>
<div class="grid">
  <div class="stat"><div class="sl">Cobrado</div><div class="sv g">${fmtR(totalRec)}</div></div>
  <div class="stat"><div class="sl">Despesas</div><div class="sv r">${fmtR(totalDesp)}</div></div>
  <div class="stat"><div class="sl">Saldo</div><div class="sv ${saldo>=0?'g':'r'}">${fmtR(saldo)}</div></div>
  <div class="stat"><div class="sl">Taxa cobrança</div><div class="sv ${taxaCob>=80?'g':taxaCob>=50?'':'r'}">${taxaCob}%</div></div>
</div>
<div style="font-size:11px;color:#8A8278">${pagaram.length} de ${fracoes.length} apartamentos pagaram · esperado ${fmtR(quotaEsp)}</div>
<div class="pb"><div class="pf" style="width:${taxaCob}%;background:${taxaCob>=80?'#1E7A4A':taxaCob>=50?'#C96B15':'#B5341A'}"></div></div>
${naoPageram.length>0?`<h2>Em Atraso</h2><table><thead><tr><th>Apartamento</th><th>Proprietário</th><th>Residente</th></tr></thead><tbody>
${naoPageram.map(f=>`<tr><td><b>${f.numero}</b></td><td>${f.prop_nome||f.proprietario}</td><td>${f.inq_nome||"—"}</td></tr>`).join("")}
</tbody></table>`:""}
${pagaram.length>0?`<h2>Pagamentos Recebidos</h2><table><thead><tr><th>Apartamento</th><th>Proprietário</th><th>Data</th><th>Valor</th></tr></thead><tbody>
${pagaram.map(f=>{const p=pqMes.find(x=>x.fracaoId===f.id);return`<tr><td><b>${f.numero}</b></td><td>${f.prop_nome||f.proprietario}</td><td>${fmtDate(p?.data)}</td><td><b>${fmtR(p?.valor)}</b></td></tr>`;}).join("")}
</tbody></table>`:""}
${despMes.length>0?`<h2>Despesas</h2><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>
${despMes.map(d=>`<tr><td>${fmtDate(d.data)}</td><td>${d.descricao}</td><td><span class="tag" style="background:#FEF4E8;color:#C96B15">${d.categoria}</span></td><td><b>${fmtR(d.valor)}</b></td></tr>`).join("")}
<tr style="background:#FEF4E8"><td colspan="3"><b>Total</b></td><td><b>${fmtR(totalDesp)}</b></td></tr>
</tbody></table>`:""}
<h2>Balanço Final</h2>
<table><tbody>
<tr><td>Total cobrado</td><td class="g"><b>${fmtR(totalRec)}</b></td></tr>
<tr><td>Total despesas</td><td class="r"><b>${fmtR(totalDesp)}</b></td></tr>
<tr style="background:${saldo>=0?'#EBF7F1':'#FAF0EE'}"><td><b>Saldo Líquido</b></td><td><b style="font-size:15px;color:${saldo>=0?'#1E7A4A':'#B5341A'}">${fmtR(saldo)}</b></td></tr>
</tbody></table>
<div class="foot"><div>${predio} · ${endereco}</div><div>Gerado automaticamente · ${new Date().toLocaleString("pt-PT")}</div></div>
</body></html>`;
  const w = window.open("","_blank"); w.document.write(html); w.document.close(); w.onload=()=>w.print();
}

/* ════════════════════════════════════════════════════════════════
   STYLES
════════════════════════════════════════════════════════════════ */
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
  .btn-sm{padding:6px 12px;font-size:12px}
  .input{width:100%;padding:9px 13px;background:#fff;border:1.5px solid #E2DDD6;border-radius:8px;color:#1C1A16;font-size:14px;font-family:'Nunito',sans-serif;outline:none;transition:border-color .18s}
  .input:focus{border-color:#B5341A}.input::placeholder{color:#C5C0B8} select.input{cursor:pointer}
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
  .tag-teal{background:#E8F5F5;color:#0F766E}
  .modal-bg{position:fixed;inset:0;background:#0006;backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px}
  .modal{background:#fff;border-radius:16px;width:100%;max-width:500px;box-shadow:0 20px 60px #0003;animation:fadeUp .25s ease}
  .nav-pill{padding:7px 14px;border-radius:8px;border:none;background:transparent;font-size:13px;font-weight:600;color:#8A8278;cursor:pointer;transition:all .15s;font-family:'Nunito',sans-serif}
  .nav-pill.on{background:#FAF0EE;color:#B5341A}.nav-pill:not(.on):hover{color:#1C1A16;background:#F0EDE8}
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
  .status-loading{background:#EBF1FA;color:#1A4F8B}
  @media(max-width:640px){th,td{font-size:12px;padding:9px 8px}.hide-sm{display:none!important}.btn{padding:8px 14px;font-size:12px}}
`}</style>;

/* ── HELPERS ── */
function Modal({title, onClose, children}) {
  return (
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 24px",borderBottom:"1px solid #F0EDE8"}}>
          <span className="serif" style={{fontSize:19,fontWeight:700}}>{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{padding:"24px",maxHeight:"70vh",overflowY:"auto"}}>{children}</div>
      </div>
    </div>
  );
}
const FG = ({label, children}) => (
  <div style={{display:"flex",flexDirection:"column",gap:6}}>
    <label className="lbl">{label}</label>{children}
  </div>
);

/* ════════════════════════════════════════════════════════════════
   SETUP SCREEN — primeira configuração
════════════════════════════════════════════════════════════════ */
function SetupScreen({onSave}) {
  const [url, setUrl]       = useState("");
  const [secret, setSecret] = useState("cond_segredo_2025");
  const [testing, setTest]  = useState(false);
  const [result, setResult] = useState(null);

  const test = async () => {
    if (!url) return;
    setTest(true); setResult(null);
    try {
      const data = await apiGet(url);
      if (data.ok) {
        setResult({ ok: true, msg: `✅ Ligação com sucesso! Prédio: "${data.config?.predio}"` });
      } else {
        setResult({ ok: false, msg: "❌ API respondeu com erro: " + data.error });
      }
    } catch(e) {
      setResult({ ok: false, msg: "❌ Erro de ligação: " + e.message });
    }
    setTest(false);
  };

  const save = () => {
    if (!url) return;
    onSave({ apiUrl: url, apiSecret: secret });
  };

  return (
    <div style={{minHeight:"100vh",background:"#F5F3EF",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:560}} className="anim">
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:42,marginBottom:12}}>🔗</div>
          <div className="serif" style={{fontSize:26,fontWeight:700,color:"#B5341A",marginBottom:8}}>Configurar Ligação</div>
          <div style={{color:"#8A8278",fontSize:14,lineHeight:1.6}}>
            Cole aqui o URL da sua Aplicação Web do Google Apps Script.<br/>
            Este passo faz-se apenas uma vez.
          </div>
        </div>

        <div className="card" style={{marginBottom:16}}>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <FG label="URL do Google Apps Script">
              <input className="input" type="url" value={url}
                placeholder="https://script.google.com/macros/s/.../exec"
                onChange={e=>setUrl(e.target.value)}/>
            </FG>
            <FG label="Chave Secreta API (definida no Code.gs)">
              <input className="input" type="text" value={secret}
                placeholder="cond_segredo_2025"
                onChange={e=>setSecret(e.target.value)}/>
              <span style={{fontSize:11,color:"#8A8278"}}>Deve coincidir com a constante API_SECRET no script</span>
            </FG>

            {result && (
              <div style={{background: result.ok?"#EBF7F1":"#FAF0EE", border:`1px solid ${result.ok?"#A8DFC6":"#F5C9BF"}`,borderRadius:8,padding:"10px 14px",fontSize:13,color:result.ok?"#1E7A4A":"#B5341A"}}>
                {result.msg}
              </div>
            )}

            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:4}}>
              <button className="btn btn-outline" onClick={test} disabled={!url||testing}>
                {testing ? <span className="spinner"/> : "🧪 Testar ligação"}
              </button>
              <button className="btn btn-red" onClick={save} disabled={!url}>
                Guardar e continuar →
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{background:"#FEF4E8",border:"1px solid #F7D9A8"}}>
          <div style={{fontWeight:700,color:"#C96B15",marginBottom:8}}>📌 Como obter o URL</div>
          <ol style={{paddingLeft:18,fontSize:13,color:"#8A8278",lineHeight:2}}>
            <li>Abra o Google Sheets com os dados</li>
            <li>Menu: <b>Extensões → Apps Script</b></li>
            <li>Cole o conteúdo do ficheiro <b>Code.gs</b></li>
            <li>Altere a constante <b>API_SECRET</b></li>
            <li><b>Implementar → Nova implementação</b></li>
            <li>Tipo: <b>Aplicação Web</b> · Acesso: <b>Qualquer pessoa</b></li>
            <li>Copie o URL e cole aqui</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   HOOK: usa API + cache local
════════════════════════════════════════════════════════════════ */
function useAppData(apiUrl) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const load = useCallback(async (force=false) => {
    setLoading(true); setError(null);
    try {
      // Tenta cache primeiro (se não forçar)
      if (!force) {
        const cached = await stGet("condo_cache");
        if (cached) { setData(cached); setLoading(false); }
      }
      // Vai à API
      const fresh = await apiGet(apiUrl);
      if (!fresh.ok) throw new Error(fresh.error || "Erro na API");
      // Normaliza IDs: usa indice baseado em número de apartamento
      const numToId = {};
      fresh.fracoes.forEach(f => { numToId[f.numero] = f.id; });
      // Re-mapeia fracaoId nos pagamentos (a API já faz, mas garantimos)
      const norm = { ...fresh, numToId };
      setData(norm);
      setLastSync(new Date());
      await stSet("condo_cache", norm);
    } catch(e) {
      setError(e.message);
      // Mantém cache se existir
      const cached = await stGet("condo_cache");
      if (cached && !data) setData(cached);
    }
    setLoading(false);
  }, [apiUrl]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: () => load(true), lastSync };
}

/* ════════════════════════════════════════════════════════════════
   PUBLIC VIEW
════════════════════════════════════════════════════════════════ */
function PublicView({appData, onGestor, apiUrl}) {
  const { config, fracoes, pagamentosQuota, contribuicoes, pagamentosContribuicao } = appData;
  const { predio, endereco, quotaMensal, anoBase, mesBase } = config;
  const url = typeof window !== "undefined" ? window.location.href : apiUrl;

  const devedores = useMemo(() =>
    fracoes.map(f=>({...f,...quotaInfo(f.id,pagamentosQuota,quotaMensal,anoBase,mesBase)}))
           .filter(f=>f.divida>0).sort((a,b)=>b.mesesAtraso-a.mesesAtraso),
    [fracoes,pagamentosQuota,quotaMensal,anoBase,mesBase]);

  const emDia = fracoes.filter(f=>!devedores.find(d=>d.id===f.id));
  const totalDivida = devedores.reduce((s,f)=>s+f.divida,0);

  const contribStatus = useMemo(() =>
    contribuicoes.map(c=>({...c, fracoes: fracoes.map(f=>({...f,...contribInfo(c.id,f.id,pagamentosContribuicao,c.valorPorFracao)}))})),
    [contribuicoes,fracoes,pagamentosContribuicao]);

  const shareWA = () => {
    const msg = `🏢 *${predio}*\n📋 Consulte o estado do condomínio:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div style={{minHeight:"100vh",background:"#F5F3EF"}}>
      {/* HEADER */}
      <div style={{background:"#fff",borderBottom:"1px solid #E2DDD6",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:840,margin:"0 auto",padding:"0 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:58}}>
            <div>
              <div className="serif" style={{fontSize:17,fontWeight:700,color:"#B5341A",lineHeight:1}}>{predio}</div>
              <div className="hide-sm" style={{fontSize:11,color:"#8A8278",marginTop:2}}>{endereco}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={onGestor} className="btn btn-outline btn-sm">🔐 Gestores</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:840,margin:"0 auto",padding:"24px 16px"}}>
        {/* Hero */}
        <div className="anim" style={{background:"linear-gradient(135deg,#2D2926 0%,#B5341A 100%)",borderRadius:16,padding:24,color:"#fff",marginBottom:24,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",right:-20,top:-20,width:140,height:140,border:"28px solid #ffffff10",borderRadius:"50%"}}/>
          <div style={{fontSize:12,fontWeight:600,letterSpacing:1,opacity:.7,textTransform:"uppercase",marginBottom:8}}>Estado do Condomínio</div>
          <div className="serif" style={{fontSize:22,fontWeight:700,marginBottom:3}}>{predio}</div>
          <div style={{fontSize:12,opacity:.6,marginBottom:20}}>{endereco}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {[
              {l:"Em atraso", v:`${devedores.length} / ${fracoes.length}`, s:"apartamentos"},
              {l:"Total em dívida", v:fmtKz(totalDivida), s:"quotas mensais"},
              {l:"Actualizado", v:new Date().toLocaleDateString("pt-PT",{day:"2-digit",month:"short"}), s:new Date().getFullYear(), small:true},
            ].map((s,i)=>(
              <div key={i} style={{background:"#ffffff15",borderRadius:10,padding:s.small?"6px 10px":"12px 14px",opacity:s.small?.75:1}}>
                <div style={{fontSize:s.small?8:11,opacity:.7,textTransform:"uppercase",letterSpacing:.5,marginBottom:s.small?1:4}}>{s.l}</div>
                <div className="mono" style={{fontSize:s.small?11:15,fontWeight:700}}>{s.v}</div>
                <div style={{fontSize:s.small?9:11,opacity:.5,marginTop:2}}>{s.s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quotas em atraso */}
        <div className="anim card" style={{marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span className="section-hd">Taxas de Condomínio em Atraso</span>
              {devedores.length>0 && <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,borderRadius:"50%",background:"#B5341A",color:"#fff",fontSize:11,fontWeight:700}}>{devedores.length}</span>}
            </div>
            <span style={{fontSize:12,color:"#8A8278"}} className="mono">{fmtKz(quotaMensal)}/mês</span>
          </div>

          {devedores.length===0 ? (
            <div style={{textAlign:"center",padding:"28px 0",color:"#1E7A4A"}}>
              <div style={{fontSize:32,marginBottom:8}}>✅</div>
              <div style={{fontWeight:600}}>Todos os apartamentos em dia!</div>
            </div>
          ) : (
            <>
              {devedores.map(f=>(
                <div key={f.id} className="arrear-row">
                  <div className="frac-badge" style={{background:"#FAF0EE",color:"#B5341A"}}>{f.numero}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:14,marginBottom:1}}>{f.prop_nome || f.proprietario}</div>
                    {f.inq_nome && <div style={{fontSize:12,color:"#1A4F8B"}}>👤 Inquilino: {f.inq_nome}</div>}
                    <div style={{fontSize:12,color:"#8A8278"}}>{f.mesesAtraso} {f.mesesAtraso===1?"mês":"meses"} em atraso</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div className="mono" style={{fontWeight:700,color:"#B5341A",fontSize:15}}>{fmtKz(f.divida)}</div>
                    <span className={`tag ${f.mesesAtraso>2?"tag-red":"tag-amber"}`}>
                      {f.mesesAtraso>3?"Grande atraso":f.mesesAtraso>1?"Em atraso":"Pendente"}
                    </span>
                  </div>
                </div>
              ))}
              {emDia.length>0 && (
                <>
                  <div className="divider"/>
                  <div style={{fontSize:12,color:"#8A8278",marginBottom:10,fontWeight:600}}>EM DIA ({emDia.length})</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {emDia.map(f=>(
                      <div key={f.id} style={{display:"flex",alignItems:"center",gap:6,background:"#EBF7F1",borderRadius:8,padding:"6px 10px"}}>
                        <span style={{fontFamily:"'Lora',serif",fontWeight:700,color:"#1E7A4A",fontSize:13}}>{f.numero}</span>
                        <span style={{fontSize:12,color:"#1E7A4A"}}>{(f.prop_nome||f.proprietario).split(" ")[0]}</span>
                        <span style={{color:"#1E7A4A",fontSize:12}}>✓</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Contribuições */}
        {contribStatus.length>0 && (
          <div className="anim" style={{marginBottom:20}}>
            <div className="section-hd" style={{marginBottom:12}}>Outras Contribuições</div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {contribStatus.map(c=>{
                const devedoresC = c.fracoes.filter(f=>f.divida>0);
                const pagaram    = c.fracoes.filter(f=>f.pago);
                const totalCob   = c.fracoes.reduce((s,f)=>s+f.totalPago,0);
                const totalTot   = c.fracoes.length * c.valorPorFracao;
                const pct = totalTot>0 ? Math.round((totalCob/totalTot)*100) : 0;
                const vencido = c.dataVencimento < today();
                return (
                  <div key={c.id} className="card">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:15,marginBottom:3}}>{c.titulo}</div>
                        <div style={{fontSize:12,color:"#8A8278"}}>{c.descricao}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div className="mono" style={{fontWeight:700,fontSize:14}}>{fmtKz(c.valorPorFracao)}<span style={{fontSize:11,color:"#8A8278"}}>/apartamento</span></div>
                        <div style={{fontSize:11,color:vencido?"#B5341A":"#8A8278"}}>
                          {vencido?"⚠ Vencido: ":"Prazo: "}{fmtDate(c.dataVencimento)}
                        </div>
                      </div>
                    </div>
                    <div style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#8A8278",marginBottom:5}}>
                        <span>{pagaram.length} de {c.fracoes.length} pagaram</span>
                        <span className="mono">{fmtKz(totalCob)} / {fmtKz(totalTot)}</span>
                      </div>
                      <div className="progress-bg">
                        <div className="progress-fill" style={{width:`${pct}%`,background:pct>=80?"#1E7A4A":pct>=50?"#C96B15":"#B5341A"}}/>
                      </div>
                    </div>
                    {devedoresC.length>0 && (
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {devedoresC.map(f=>(
                          <div key={f.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:"#FBF9F7",borderRadius:8}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span className="serif" style={{fontWeight:700,color:"#B5341A",fontSize:13}}>{f.numero}</span>
                              <div>
                                <div style={{fontSize:13}}>{f.prop_nome||f.proprietario}</div>
                                {f.inq_nome && <div style={{fontSize:11,color:"#1A4F8B"}}>Inquilino: {f.inq_nome}</div>}
                              </div>
                            </div>
                            <span className="mono" style={{fontSize:13,color:"#B5341A",fontWeight:700}}>{fmtKz(f.divida)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{textAlign:"center",padding:"20px 0",color:"#C5C0B8",fontSize:12}}>
          Portal do Condomínio · {predio} · {new Date().toLocaleDateString("pt-PT")}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   GESTOR LOGIN
════════════════════════════════════════════════════════════════ */
function GestorLogin({pwd, onLogin, onBack}) {
  const [v, setV] = useState(""); const [err, setErr] = useState(false);
  const go = () => { if(v===pwd){onLogin()}else{setErr(true);setV("");setTimeout(()=>setErr(false),2000)}};
  return (
    <div style={{minHeight:"100vh",background:"#F5F3EF",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:360}}>
        <button onClick={onBack} className="btn btn-ghost btn-sm" style={{marginBottom:24}}>← Voltar</button>
        <div className="card anim" style={{border:`1.5px solid ${err?"#B5341A":"#E2DDD6"}`}}>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontSize:38,marginBottom:12}}>🔐</div>
            <div className="serif" style={{fontSize:24,fontWeight:700}}>Área de Gestores</div>
          </div>
          {err && <div style={{background:"#FAF0EE",borderRadius:8,padding:"9px 14px",color:"#B5341A",fontSize:13,marginBottom:16,textAlign:"center"}}>Palavra-passe incorrecta</div>}
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <FG label="Palavra-passe">
              <input className="input" type="password" value={v} placeholder="••••••••" onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} autoFocus/>
            </FG>
            <button className="btn btn-red" style={{justifyContent:"center"}} onClick={go}>Entrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   GESTOR DASHBOARD
════════════════════════════════════════════════════════════════ */
function GestorDashboard({appData, apiUrl, apiSecret, onBack, onReload, loading}) {
  const [tab,  setTab]  = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [form, setForm]  = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [relMes, setRelMes] = useState(new Date().getMonth()+1);
  const [relAno, setRelAno] = useState(new Date().getFullYear());

  const { config, fracoes, pagamentosQuota, contribuicoes, pagamentosContribuicao, despesas } = appData;
  const { quotaMensal, anoBase, mesBase } = config;

  const sf = k => v => setForm(p=>({...p,[k]:v}));
  const om = (type, d={}) => { setModal(type); setForm({data:today(),...d}); };
  const cm = () => { setModal(null); setForm({}); };

  /* ── API write helper ── */
  const post = async (action, data) => {
    setSaving(true); setSaveMsg(null);
    try {
      const res = await apiPost(apiUrl, apiSecret, action, data);
      if (!res.ok) throw new Error(res.error || "Erro");
      setSaveMsg({ ok:true, msg:"✅ Guardado no Google Sheets" });
      setTimeout(()=>{setSaveMsg(null); onReload();}, 1800);
      cm();
    } catch(e) {
      setSaveMsg({ ok:false, msg:"❌ Erro ao guardar: " + e.message });
    }
    setSaving(false);
  };

  /* ── Stats ── */
  const totalRec  = pagamentosQuota.reduce((s,p)=>s+p.valor,0) + pagamentosContribuicao.reduce((s,p)=>s+p.valor,0);
  const totalDesp = despesas.reduce((s,d)=>s+d.valor,0);
  const saldo     = totalRec - totalDesp;
  const devedores = useMemo(()=>fracoes.map(f=>({...f,...quotaInfo(f.id,pagamentosQuota,quotaMensal,anoBase,mesBase)})).sort((a,b)=>b.divida-a.divida),[fracoes,pagamentosQuota,quotaMensal,anoBase,mesBase]);

  const evolucao = useMemo(()=>{
    const map={};
    pagamentosQuota.forEach(p=>{const k=`${p.ano}-${String(p.mes).padStart(2,"0")}`;if(!map[k])map[k]={rec:0,desp:0};map[k].rec+=p.valor;});
    despesas.forEach(d=>{const k=d.data?.slice(0,7)||"";if(!map[k])map[k]={rec:0,desp:0};map[k].desp+=d.valor;});
    return Object.entries(map).sort().map(([k,v])=>({mes:MESES_S[parseInt(k.split("-")[1])-1],Receitas:v.rec,Despesas:v.desp,Saldo:v.rec-v.desp}));
  },[pagamentosQuota,despesas]);

  const TT=({active,payload,label})=>{if(!active||!payload?.length)return null;return<div style={{background:"#fff",border:"1px solid #E2DDD6",borderRadius:8,padding:"10px 14px"}}><div style={{fontSize:12,color:"#8A8278",marginBottom:6}}>{label}</div>{payload.map((p,i)=><div key={i} className="mono" style={{fontSize:13,color:p.color}}>{p.name}: {fmtKz(p.value)}</div>)}</div>};

  const TABS=[["dashboard","📊 Dashboard"],["fracoes","🏠 Apartamentos"],["quotas","💳 Quotas"],["contribuicoes","📋 Contribuições"],["despesas","🧾 Despesas"]];

  return (
    <div style={{minHeight:"100vh",background:"#F5F3EF"}}>
      <div style={{background:"#fff",borderBottom:"1px solid #E2DDD6",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:1100,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:58}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span className="serif" style={{fontSize:17,fontWeight:700,color:"#B5341A"}}>{config.predio}</span>
            <span className="tag tag-blue">Gestor</span>
            {loading && <span className="spinner"/>}
          </div>
          <div style={{display:"flex",gap:2,flexWrap:"wrap",alignItems:"center"}}>
            {TABS.map(([k,l])=><button key={k} className={`nav-pill${tab===k?" on":""}`} onClick={()=>setTab(k)}>{l}</button>)}
            <button className="btn btn-outline btn-sm" onClick={onReload} style={{marginLeft:4}}>↻</button>
            <button onClick={()=>{ const u=window.location.href; const msg=`🏢 *${config.predio}*
📋 Consulte o estado do condomínio:
${u}`; window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank'); }} className="wa-btn" style={{padding:"6px 12px",fontSize:12}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              Partilhar
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>← Sair</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"28px 16px"}} className="anim">
        {saveMsg && (
          <div className={`status-bar ${saveMsg.ok?"status-ok":"status-err"}`} style={{marginBottom:16}}>
            {saveMsg.msg}
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {tab==="dashboard" && <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
            <span className="section-hd">Dashboard Financeiro</span>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <select className="input" style={{width:"auto",fontSize:13}} value={relMes} onChange={e=>setRelMes(+e.target.value)}>
                {MESES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
              </select>
              <select className="input" style={{width:"auto",fontSize:13}} value={relAno} onChange={e=>setRelAno(+e.target.value)}>
                {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <button className="btn btn-red" onClick={()=>printReport(appData,relMes,relAno)}>🖨️ Relatório</button>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
            {[{l:"Total Receitas",v:totalRec,c:"#1E7A4A"},{l:"Total Despesas",v:totalDesp,c:"#B5341A"},{l:"Saldo Global",v:saldo,c:saldo>=0?"#1E7A4A":"#B5341A"},{l:"Em Dívida",v:devedores.reduce((s,f)=>s+f.divida,0),c:"#C96B15"}].map((s,i)=>(
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
                <XAxis dataKey="mes" tick={{fill:"#8A8278",fontSize:12}} axisLine={false} tickLine={false}/>
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
                <XAxis dataKey="mes" tick={{fill:"#8A8278",fontSize:12}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"#8A8278",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>Math.round(v/1000)+"k"}/>
                <Tooltip content={<TT/>}/>
                <Line type="monotone" dataKey="Saldo" stroke="#B5341A" strokeWidth={2.5} dot={{fill:"#B5341A",r:4}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>}

        {/* ── FRACÇÕES ── */}
        {tab==="fracoes" && <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <span className="section-hd">Apartamentos</span>
            <button className="btn btn-red" onClick={()=>om("fracao")}>+ Novo Apartamento</button>
          </div>
          <div className="card">
            <table><thead><tr><th>Nº</th><th>Proprietário</th><th>Telefone</th><th>Inquilino</th><th>Tel. Inquilino</th><th>Pago</th><th>Dívida</th><th>Estado</th></tr></thead>
            <tbody>{fracoes.map(f=>{
              const {totalPago,divida,mesesAtraso}=quotaInfo(f.id,pagamentosQuota,quotaMensal,anoBase,mesBase);
              return <tr key={f.id}>
                <td><span className="serif" style={{fontWeight:700,color:"#B5341A"}}>{f.numero}</span></td>
                <td><div style={{fontWeight:600}}>{f.prop_nome||f.proprietario}</div><div style={{fontSize:11,color:"#8A8278"}}>{f.prop_telefone||f.telefone}</div></td>
                <td style={{color:"#8A8278",fontSize:12}} className="hide-sm">{f.prop_telefone||f.telefone}</td>
                <td>{f.inq_nome ? <><div style={{fontSize:13}}>{f.inq_nome}</div><span className="tag tag-teal" style={{fontSize:10}}>Inquilino</span></> : <span style={{color:"#C5C0B8",fontSize:12}}>—</span>}</td>
                <td style={{color:"#8A8278",fontSize:12}} className="hide-sm">{f.inq_telefone||"—"}</td>
                <td><span className="mono" style={{color:"#1E7A4A",fontSize:12}}>{fmtKz(totalPago)}</span></td>
                <td><span className="mono" style={{color:divida>0?"#B5341A":"#1E7A4A",fontWeight:700,fontSize:12}}>{fmtKz(divida)}</span></td>
                <td><span className={`tag ${mesesAtraso>2?"tag-red":mesesAtraso>0?"tag-amber":"tag-green"}`}>{mesesAtraso>2?"Em atraso":mesesAtraso>0?`${mesesAtraso}m atraso`:"Em dia"}</span></td>
              </tr>;
            })}</tbody></table>
          </div>
        </>}

        {/* ── QUOTAS ── */}
        {tab==="quotas" && <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <span className="section-hd">Pagamentos de Quotas</span>
            <button className="btn btn-red" onClick={()=>om("pagQuota")}>+ Registar</button>
          </div>
          <div className="card">
            <table><thead><tr><th>Data</th><th>Apartamento</th><th>Proprietário</th><th>Mês</th><th>Valor</th><th>Método</th></tr></thead>
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
        {tab==="contribuicoes" && <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
            <span className="section-hd">Outras Contribuições</span>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-outline" onClick={()=>om("pagContrib")}>+ Registar Pagamento</button>
              <button className="btn btn-red" onClick={()=>om("contrib")}>+ Nova Contribuição</button>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {contribuicoes.map(c=>{
              const pcs=pagamentosContribuicao.filter(p=>p.contribuicaoId===c.id);
              return <div key={c.id} className="card">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
                  <div><div style={{fontWeight:700,fontSize:15}}>{c.titulo}</div><div style={{fontSize:12,color:"#8A8278",marginTop:3}}>{c.descricao} · Prazo: {fmtDate(c.dataVencimento)}</div></div>
                  <span className="mono" style={{fontWeight:700,color:"#B5341A"}}>{fmtKz(c.valorPorFracao)}/apto.</span>
                </div>
                {pcs.length>0&&<table><thead><tr><th>Data</th><th>Apartamento</th><th>Proprietário</th><th>Valor</th></tr></thead>
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
        {tab==="despesas" && <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <span className="section-hd">Despesas</span>
            <button className="btn btn-red" onClick={()=>om("despesa")}>+ Registar</button>
          </div>
          <div className="card">
            <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Fornecedor</th></tr></thead>
            <tbody>{[...despesas].sort((a,b)=>(b.data||"").localeCompare(a.data||"")).map(d=>(
              <tr key={d.id}>
                <td style={{color:"#8A8278",fontSize:12}}>{fmtDate(d.data)}</td>
                <td>{d.descricao}</td>
                <td><span className="tag tag-amber">{d.categoria}</span></td>
                <td><span className="mono" style={{color:"#B5341A",fontWeight:700}}>{fmtKz(d.valor)}</span></td>
                <td style={{color:"#8A8278",fontSize:12}}>{d.fornecedor||"—"}</td>
              </tr>
            ))}</tbody></table>
          </div>
        </>}
      </div>

      {/* ── MODALS ── */}
      {modal==="fracao" && <Modal title="Novo Apartamento" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Número *"><input className="input" placeholder="ex: 101" value={form.numero||""} onChange={e=>sf("numero")(e.target.value)}/></FG>
            <FG label="Andar"><input className="input" placeholder="ex: 1º Dto" value={form.andar||""} onChange={e=>sf("andar")(e.target.value)}/></FG>
          </div>
          <div style={{fontWeight:700,fontSize:13,color:"#1A4F8B",paddingTop:4}}>👤 Proprietário</div>
          <FG label="Nome *"><input className="input" value={form.prop_nome||""} onChange={e=>sf("prop_nome")(e.target.value)}/></FG>
          <FG label="Telefone *"><input className="input" placeholder="+244 9XX XXX XXX" value={form.prop_telefone||""} onChange={e=>sf("prop_telefone")(e.target.value)}/></FG>
          <div className="divider"/>
          <div style={{fontWeight:700,fontSize:13,color:"#1E7A4A"}}>🏠 Inquilino <span style={{fontWeight:400,color:"#8A8278"}}>(opcional)</span></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Nome do Inquilino"><input className="input" value={form.inq_nome||""} onChange={e=>sf("inq_nome")(e.target.value)}/></FG>
            <FG label="Telefone do Inquilino"><input className="input" value={form.inq_telefone||""} onChange={e=>sf("inq_telefone")(e.target.value)}/></FG>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button className="btn btn-outline" onClick={cm}>Cancelar</button>
            <button className="btn btn-red" disabled={saving} onClick={()=>post("add_fracao",{numero:form.numero,andar:form.andar||"",prop_nome:form.prop_nome,prop_telefone:form.prop_telefone,inq_nome:form.inq_nome||"",inq_telefone:form.inq_telefone||""})}>
              {saving?<span className="spinner"/>:"Criar"}
            </button>
          </div>
        </div>
      </Modal>}

      {modal==="pagQuota" && <Modal title="Registar Pagamento de Quota" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <FG label="Apartamento">
            <select className="input" value={form.fracaoNum||""} onChange={e=>sf("fracaoNum")(e.target.value)}>
              <option value="">Seleccione...</option>
              {fracoes.map(f=><option key={f.id} value={f.numero}>{f.numero} — {f.prop_nome||f.proprietario}</option>)}
            </select>
          </FG>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FG label="Mês"><select className="input" value={form.mes||new Date().getMonth()+1} onChange={e=>sf("mes")(e.target.value)}>{MESES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select></FG>
            <FG label="Ano"><select className="input" value={form.ano||2025} onChange={e=>sf("ano")(e.target.value)}>{[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}</select></FG>
          </div>
          <FG label="Data de Pagamento"><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
          <FG label="Valor (Kz)"><input className="input" type="number" placeholder={quotaMensal} value={form.valor||""} onChange={e=>sf("valor")(e.target.value)}/></FG>
          <FG label="Método"><select className="input" value={form.metodo||""} onChange={e=>sf("metodo")(e.target.value)}><option value="">—</option>{["Transferência","Numerário","Cheque","TPA","Outro"].map(m=><option key={m} value={m}>{m}</option>)}</select></FG>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button className="btn btn-outline" onClick={cm}>Cancelar</button>
            <button className="btn btn-red" disabled={saving} onClick={()=>post("add_pagamento_quota",{fracao_numero:form.fracaoNum,data:form.data,valor:+form.valor||quotaMensal,mes:+form.mes,ano:+form.ano,metodo:form.metodo||""})}>
              {saving?<span className="spinner"/>:"Registar"}
            </button>
          </div>
        </div>
      </Modal>}

      {modal==="despesa" && <Modal title="Registar Despesa" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <FG label="Data"><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
          <FG label="Descrição"><input className="input" placeholder="Ex: Electricidade" value={form.descricao||""} onChange={e=>sf("descricao")(e.target.value)}/></FG>
          <FG label="Categoria"><select className="input" value={form.categoria||""} onChange={e=>sf("categoria")(e.target.value)}><option value="">Seleccione...</option>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></FG>
          <FG label="Valor (Kz)"><input className="input" type="number" value={form.valor||""} onChange={e=>sf("valor")(e.target.value)}/></FG>
          <FG label="Fornecedor (opcional)"><input className="input" value={form.fornecedor||""} onChange={e=>sf("fornecedor")(e.target.value)}/></FG>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button className="btn btn-outline" onClick={cm}>Cancelar</button>
            <button className="btn btn-red" disabled={saving} onClick={()=>post("add_despesa",{data:form.data,valor:+form.valor,descricao:form.descricao,categoria:form.categoria,fornecedor:form.fornecedor||""})}>
              {saving?<span className="spinner"/>:"Registar"}
            </button>
          </div>
        </div>
      </Modal>}

      {modal==="contrib" && <Modal title="Nova Contribuição" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <FG label="Título"><input className="input" value={form.titulo||""} onChange={e=>sf("titulo")(e.target.value)}/></FG>
          <FG label="Descrição"><input className="input" value={form.descricao||""} onChange={e=>sf("descricao")(e.target.value)}/></FG>
          <FG label="Valor por apartamento (Kz)"><input className="input" type="number" value={form.valorPorFracao||""} onChange={e=>sf("valorPorFracao")(e.target.value)}/></FG>
          <FG label="Data Limite"><input className="input" type="date" value={form.dataVencimento||""} onChange={e=>sf("dataVencimento")(e.target.value)}/></FG>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button className="btn btn-outline" onClick={cm}>Cancelar</button>
            <button className="btn btn-red" disabled={saving} onClick={()=>post("add_contribuicao",{titulo:form.titulo,valorPorFracao:+form.valorPorFracao,dataVencimento:form.dataVencimento,descricao:form.descricao||""})}>
              {saving?<span className="spinner"/>:"Criar"}
            </button>
          </div>
        </div>
      </Modal>}

      {modal==="pagContrib" && <Modal title="Registar Pagamento de Contribuição" onClose={cm}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <FG label="Contribuição"><select className="input" value={form.contribTitulo||""} onChange={e=>sf("contribTitulo")(e.target.value)}><option value="">Seleccione...</option>{contribuicoes.map(c=><option key={c.id} value={c.titulo}>{c.titulo}</option>)}</select></FG>
          <FG label="Apartamento"><select className="input" value={form.fracaoNum||""} onChange={e=>sf("fracaoNum")(e.target.value)}><option value="">Seleccione...</option>{fracoes.map(f=><option key={f.id} value={f.numero}>{f.numero} — {f.prop_nome||f.proprietario}</option>)}</select></FG>
          <FG label="Data"><input className="input" type="date" value={form.data||""} onChange={e=>sf("data")(e.target.value)}/></FG>
          <FG label="Valor (Kz)"><input className="input" type="number" value={form.valor||""} onChange={e=>sf("valor")(e.target.value)}/></FG>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button className="btn btn-outline" onClick={cm}>Cancelar</button>
            <button className="btn btn-red" disabled={saving} onClick={()=>post("add_pagamento_contribuicao",{contribuicao_titulo:form.contribTitulo,fracao_numero:form.fracaoNum,data:form.data,valor:+form.valor})}>
              {saving?<span className="spinner"/>:"Registar"}
            </button>
          </div>
        </div>
      </Modal>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ROOT APP
════════════════════════════════════════════════════════════════ */
export default function App() {
  // Usa as constantes do topo do ficheiro.
  // Se estiver vazio, mostra o ecrã de configuração (util para testes).
  const [cfg, setCfg] = useState(
    API_URL ? { apiUrl: API_URL, apiSecret: API_SECRET } : null
  );
  const [view, setView] = useState("public");
  const [auth, setAuth] = useState(false);

  const saveCfg = async (newCfg) => {
    await stSet("condo_cfg", newCfg);
    setCfg(newCfg);
  };

  const { data, loading, error, reload } = useAppData(cfg?.apiUrl || "");

  if (!cfg?.apiUrl) return (
    <>
      <Fonts/><G/>
      <SetupScreen onSave={saveCfg}/>
    </>
  );

  if (loading && !data) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#F5F3EF",gap:16}}>
      <div className="spinner" style={{width:32,height:32,borderWidth:3}}/>
      <div style={{color:"#8A8278",fontSize:14,fontFamily:"Nunito,sans-serif"}}>A carregar dados do Google Sheets…</div>
    </div>
  );

  if (error && !data) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#F5F3EF",padding:24,gap:16}}>
      <div style={{fontSize:40}}>⚠️</div>
      <div style={{fontFamily:"'Lora',serif",fontSize:22,color:"#B5341A"}}>Erro de ligação</div>
      <div style={{color:"#8A8278",fontSize:14,maxWidth:400,textAlign:"center"}}>{error}</div>
      <button className="btn btn-red" style={{fontFamily:"Nunito,sans-serif"}} onClick={reload}>↻ Tentar novamente</button>
      <button className="btn btn-ghost" style={{fontFamily:"Nunito,sans-serif"}} onClick={()=>saveCfg(null)}>⚙️ Reconfigurar URL</button>
    </div>
  );

  if (!data) return null;

  const password = data.config?.gestorPassword || "admin2025";

  return (
    <>
      <Fonts/><G/>
      {view==="public"  && <PublicView  appData={data} onGestor={()=>auth?setView("gestor"):setView("login")} apiUrl={cfg.apiUrl}/>}
      {view==="login"   && <GestorLogin pwd={password} onLogin={()=>{setAuth(true);setView("gestor");}} onBack={()=>setView("public")}/>}
      {view==="gestor"  && <GestorDashboard appData={data} apiUrl={cfg.apiUrl} apiSecret={cfg.apiSecret||"cond_segredo_2025"} onBack={()=>setView("public")} onReload={reload} loading={loading}/>}
    </>
  );
}
