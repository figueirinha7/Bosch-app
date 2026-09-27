import { useState, useEffect, useRef, useId, isValidElement, cloneElement } from "react";
import { MESES, nomeApt } from "./lib.js";

/* ── FONTS ── */
export const Fonts = () => <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Nunito:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />;

/* ═══════════════════════════════════════════════════════════════
   ESTILOS — cores e medidas em variáveis CSS (um só sítio)
   Contraste: texto secundário ≥ 4,5:1 sobre branco e sobre o fundo.
   O vermelho (--divida) fica reservado para valores em dívida.
═══════════════════════════════════════════════════════════════ */
export const G = () => <style>{`
  :root{
    --bg:#F5F3EF; --surface:#fff; --surface-2:#FBF9F7; --line:#E2DDD6; --line-2:#F0EDE8; --line-3:#D5CFC6;
    --ink:#1C1A16; --ink-2:#57514A; --ink-3:#6B645B;
    --brand:#B5341A; --brand-dk:#9B2C14; --brand-bg:#FAF0EE;
    --divida:#9E2D16; --divida-bg:#FAF0EE;
    --ok:#1E6B42; --ok-fill:#2E8B5A; --ok-bg:#EBF7F1;
    --warn:#8A4A0B; --warn-bg:#FEF4E8; --warn-line:#D98A2B;
    --info:#1A4F8B; --info-bg:#EBF1FA; --teal:#0F6660; --teal-bg:#E8F5F5;
    --grey-bg:#E9E5DF; --dark:#2D2926; --dark-ink:#D8D1C7;
    --radius:12px; --tap:44px;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);font-family:'Nunito',sans-serif;color:var(--ink)}
  ::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-thumb{background:var(--line-3);border-radius:3px}
  :focus-visible{outline:3px solid var(--info);outline-offset:2px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  .anim{animation:fadeUp .25s ease both}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:8px 16px;border-radius:10px;border:none;font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:background .15s,border-color .15s,color .15s;letter-spacing:.1px;text-decoration:none;white-space:nowrap}
  .btn:disabled{opacity:.55;cursor:not-allowed}
  .btn-red{background:var(--brand);color:#fff}.btn-red:hover:not(:disabled){background:var(--brand-dk)}
  .btn-outline{background:var(--surface);color:var(--ink);border:1.5px solid var(--line-3)}.btn-outline:hover:not(:disabled){border-color:var(--ink)}
  .btn-ghost{background:transparent;color:var(--ink-2)}.btn-ghost:hover:not(:disabled){color:var(--ink);background:var(--line-2)}
  .btn-green{background:var(--ok);color:#fff}.btn-green:hover:not(:disabled){background:#17553A}
  .btn-blue{background:var(--info);color:#fff}.btn-blue:hover:not(:disabled){background:#163F70}
  .btn-dark{background:var(--ink);color:#fff}
  .btn-sm{min-height:36px;padding:6px 12px;font-size:13px}
  .btn-icon{width:40px;min-height:40px;padding:0}
  .btn-icon.btn-sm{width:36px;min-height:36px}
  .input{width:100%;min-height:44px;padding:9px 13px;background:#fff;border:1.5px solid var(--line-3);border-radius:10px;color:var(--ink);font-size:15px;font-family:'Nunito',sans-serif;outline:none;transition:border-color .15s}
  .input:focus{border-color:var(--ink);outline:none}.input::placeholder{color:var(--ink-3)} select.input{cursor:pointer}
  .input-err,.input-err .input{border-color:var(--divida)!important;background:#FFFBFA}
  textarea.input{resize:vertical;min-height:100px;line-height:1.5}
  .fg{display:flex;flex-direction:column;gap:6px}
  label.lbl,.lbl{font-size:14px;font-weight:800;color:var(--ink)}
  .fg-hint{font-size:13px;color:var(--ink-2);line-height:1.45}
  .fg-err{font-size:13px;color:var(--divida);font-weight:700;display:flex;gap:6px;align-items:center}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px}
  .divider{height:1px;background:var(--line-2);margin:16px 0}
  table{width:100%;border-collapse:collapse}
  th{font-size:12px;color:var(--ink-2);font-weight:800;padding:10px 12px;border-bottom:1.5px solid var(--line);text-align:left;white-space:nowrap}
  td{padding:10px 12px;font-size:14px;border-bottom:1px solid var(--line-2);vertical-align:middle}
  tr:last-child td{border-bottom:none} tbody tr:hover td{background:var(--surface-2)}
  .num{text-align:right;font-family:'DM Mono',monospace;white-space:nowrap}
  .tag{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:800;white-space:nowrap}
  .tag-red{background:var(--divida-bg);color:var(--divida)}.tag-red-strong{background:var(--divida);color:#fff}
  .tag-green{background:var(--ok-bg);color:var(--ok)}
  .tag-amber{background:var(--warn-bg);color:var(--warn)}.tag-blue{background:var(--info-bg);color:var(--info)}
  .tag-teal{background:var(--teal-bg);color:var(--teal)}.tag-grey{background:var(--grey-bg);color:#4A443D}
  .modal-bg{position:fixed;inset:0;background:rgba(28,26,22,.55);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px}
  .modal{background:#fff;border-radius:16px;width:100%;max-width:540px;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:fadeUp .2s ease;display:flex;flex-direction:column;max-height:calc(100vh - 32px)}
  .modal-lg{max-width:700px}
  .modal-hd{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 12px 14px 24px;border-bottom:1px solid var(--line-2)}
  .modal-bd{padding:20px 24px 24px;overflow-y:auto}
  .nav-tab{min-height:44px;padding:0 14px;display:inline-flex;align-items:center;gap:6px;border:none;background:transparent;border-bottom:3px solid transparent;font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;color:var(--ink-2);cursor:pointer;white-space:nowrap}
  .nav-tab.on{color:var(--ink);font-weight:800;border-bottom-color:var(--brand)}
  .nav-tab:not(.on):hover{color:var(--ink)}
  .badge{min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:var(--brand);color:#fff;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center}
  .mono{font-family:'DM Mono',monospace}.serif{font-family:'Lora',serif}
  .section-hd{font-family:'Lora',serif;font-size:24px;font-weight:700}
  .h2{font-family:'Lora',serif;font-size:19px;font-weight:700}
  .muted{color:var(--ink-2)}
  .progress-bg{background:var(--grey-bg);border-radius:20px;height:8px;overflow:hidden}
  .progress-fill{height:100%;border-radius:20px;transition:width .5s ease}
  .spinner{width:20px;height:20px;border:2.5px solid var(--line);border-top-color:var(--brand);border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
  .apt-num{font-family:'Lora',serif;font-weight:700;color:var(--ink)}
  .wa-btn{background:var(--ok);color:#fff;border:none;border-radius:10px;min-height:40px;padding:8px 14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;white-space:nowrap}
  .wa-btn:hover{background:#17553A}
  .wa-btn.icon{width:40px;padding:0}
  .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:300;box-shadow:0 8px 30px rgba(0,0,0,.25);max-width:min(560px,calc(100vw - 32px));display:flex;align-items:center;gap:12px;padding:10px 10px 10px 16px;border-radius:12px;font-size:14px;font-weight:700;animation:fadeUp .2s ease}
  .toast-ok{background:var(--ink);color:#fff}.toast-err{background:var(--divida);color:#fff}
  .toast .btn{min-height:36px}
  .banner{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 14px;border-radius:12px;font-size:14px}
  .banner-warn{background:var(--warn-bg);color:var(--warn);border:1px solid #F0D2A6}
  .banner-info{background:var(--info-bg);color:var(--info);border:1px solid #C9DAF0}
  .checkbox-row{display:flex;align-items:center;gap:10px;min-height:40px;cursor:pointer;font-size:14px}
  .checkbox-row input{width:18px;height:18px;accent-color:var(--brand);cursor:pointer;flex-shrink:0}
  .seg{display:inline-flex;border:1.5px solid var(--line-3);border-radius:10px;overflow:hidden;background:#fff}
  .seg button{min-height:40px;padding:0 14px;border:none;border-left:1.5px solid var(--line-3);background:#fff;font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;color:var(--ink);cursor:pointer}
  .seg button:first-child{border-left:none}
  .seg button[aria-pressed=true]{background:var(--ink);color:#fff;font-weight:800}
  .seg-grid{display:grid;gap:8px}
  .seg-grid button{min-height:44px;border-radius:10px;border:1.5px solid var(--line-3);background:#fff;font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;color:var(--ink);cursor:pointer}
  .seg-grid button[aria-pressed=true]{border-color:var(--ink);background:var(--ink);color:#fff;font-weight:800}
  .menu{position:absolute;z-index:120;min-width:220px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(28,26,22,.18);padding:6px;display:flex;flex-direction:column}
  .menu button{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;border:none;background:transparent;border-radius:8px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;color:var(--ink);cursor:pointer;text-align:left}
  .menu button:hover,.menu button:focus-visible{background:var(--line-2)}
  .menu button.danger{color:var(--divida)}
  .combo-list{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:130;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(28,26,22,.18);max-height:280px;overflow-y:auto;padding:4px}
  .combo-opt{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:44px;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:14px}
  .combo-opt[aria-selected=true]{background:var(--line-2)}
  .skel{background:var(--grey-bg);border-radius:10px;animation:pulse 1.2s ease-in-out infinite}
  .legend{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:13px;color:var(--ink-2)}
  .legend span{display:inline-flex;align-items:center;gap:6px}
  .sw{width:14px;height:14px;border-radius:4px;display:inline-block;flex-shrink:0}
  .kpi{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:6px;min-width:0}
  .kpi-l{font-size:13px;font-weight:700;color:var(--ink-2)}
  .kpi-v{font-family:'DM Mono',monospace;font-size:24px;line-height:1.15}
  .show-sm{display:none!important}
  @media(max-width:700px){
    .hide-sm{display:none!important}.show-sm{display:flex!important}
    th,td{font-size:13px;padding:9px 8px}
    .btn,.btn-sm,.wa-btn,.input,.seg button{min-height:var(--tap)}
    .btn-icon,.btn-icon.btn-sm,.wa-btn.icon{width:var(--tap);min-height:var(--tap)}
    .modal-bg{align-items:flex-end;padding:0}
    .modal{border-radius:16px 16px 0 0;max-height:94vh}
    .modal-bd{padding:16px}
    .toast{bottom:84px}
  }
`}</style>;

/* ═══════════════════════════════════════════════════════════════
   ÍCONES (traço, estilo Lucide) — em vez de emojis
═══════════════════════════════════════════════════════════════ */
const P = {
  home:   <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>,
  check:  <path d="m5 12 5 5 9-10"/>,
  checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  alert:  <><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/></>,
  bell:   <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/></>,
  card:   <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></>,
  chart:  <path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>,
  copy:   <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></>,
  left:   <path d="m15 6-6 6 6 6"/>,
  right:  <path d="m9 6 6 6-6 6"/>,
  down:   <path d="m6 9 6 6 6-6"/>,
  up:     <path d="m6 15 6-6 6 6"/>,
  plus:   <path d="M12 5v14M5 12h14"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  printer:<><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/></>,
  download:<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>,
  share:  <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></>,
  file:   <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
  users:  <><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/></>,
  more:   <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  menu:   <path d="M4 6h16M4 12h16M4 18h16"/>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
  x:      <path d="M6 6l12 12M18 6 6 18"/>,
  refresh:<><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></>,
  eye:    <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  user:   <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  edit:   <><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></>,
  trash:  <><path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/></>,
  lock:   <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  logout: <><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 17l-5-5 5-5M5 12h11"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>,
  megaphone:<><path d="M3 11v2a1 1 0 0 0 1 1h3l6 5V5L7 10H4a1 1 0 0 0-1 1z"/><path d="M17 8a5 5 0 0 1 0 8"/></>,
  list:   <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>,
  ban:    <><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></>,
  receipt:<><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 14h2"/></>,
  zap:    <path d="M13 2 4 14h7l-1 8 9-12h-7z"/>,
  pie:    <><path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/></>,
};
export function Icon({ n, s=18, w=2, style, label }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden={label?undefined:true} role={label?"img":undefined} aria-label={label} style={{flexShrink:0,...style}}>{P[n]}</svg>;
}
const WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";
export const WaSvg = ({s=16}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{flexShrink:0}}><path d={WA_PATH}/></svg>;

/* ═══════════════════════════════════════════════════════════════
   MODAL — fecha com Esc, foco preso lá dentro, devolve o foco ao sair
═══════════════════════════════════════════════════════════════ */
const FOCAVEIS = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
export function Modal({title, onClose, children, lg=false}) {
  const ref = useRef(null); const tid = useId();
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(()=>{
    const prev = document.activeElement, el = ref.current;
    const first = el.querySelector('.modal-bd input:not([disabled]):not([type=hidden]):not([type=checkbox]),.modal-bd select,.modal-bd textarea') || el.querySelector(FOCAVEIS);
    first?.focus();
    const onKey = e=>{
      if (e.key==="Escape") { e.stopPropagation(); closeRef.current(); return; }
      if (e.key!=="Tab") return;
      const fs = [...el.querySelectorAll(FOCAVEIS)].filter(x=>x.offsetParent!==null);
      if (!fs.length) return;
      const a = fs[0], z = fs[fs.length-1];
      if (e.shiftKey && document.activeElement===a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement===z) { e.preventDefault(); a.focus(); }
    };
    el.addEventListener("keydown", onKey);
    const n = +(document.body.dataset.modais||0); document.body.dataset.modais = n+1; document.body.style.overflow = "hidden";
    return ()=>{
      el.removeEventListener("keydown", onKey);
      const m = +(document.body.dataset.modais||1)-1; document.body.dataset.modais = m; if (m<=0) document.body.style.overflow = "";
      if (prev && document.contains(prev)) prev.focus?.();
    };
  },[]);
  return (
    <div className="modal-bg" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
      <div ref={ref} className={`modal${lg?" modal-lg":""}`} role="dialog" aria-modal="true" aria-labelledby={tid}>
        <div className="modal-hd">
          <h2 id={tid} className="serif" style={{fontSize:19,fontWeight:700}}>{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fechar"><Icon n="x" s={20}/></button>
        </div>
        <div className="modal-bd">{children}</div>
      </div>
    </div>
  );
}

/* Campo de formulário: liga a <label> ao campo e mostra o erro por baixo */
export function FG({label, children, hint, err, id}) {
  const auto = useId(); const fid = id || auto;
  const child = isValidElement(children) && typeof children.type !== "symbol"
    ? cloneElement(children, { id: children.props.id || fid, "aria-invalid": err ? true : undefined,
        "aria-describedby": (err||hint) ? fid+"-d" : undefined, className: `${children.props.className||""}${err?" input-err":""}` })
    : children;
  return (
    <div className="fg">
      <label className="lbl" htmlFor={fid}>{label}</label>
      {child}
      {err ? <span id={fid+"-d"} className="fg-err" role="alert"><Icon n="alert" s={15}/>{err}</span>
           : hint && <span id={fid+"-d"} className="fg-hint">{hint}</span>}
    </div>
  );
}
export const CheckRow = ({label, checked, onChange}) => (
  <label className="checkbox-row">
    <input type="checkbox" checked={!!checked} onChange={e=>onChange(e.target.checked)}/>
    <span>{label}</span>
  </label>
);
export const Warn = ({children}) => (
  <div className="banner banner-warn" role="status"><Icon n="alert" s={17}/><div style={{flex:1}}>{children}</div></div>
);
export const Info = ({children}) => (
  <div className="banner banner-info"><div style={{flex:1}}>{children}</div></div>
);
export const ModalBtns = ({onCancel, onOk, saving, label, cls="btn-red", disabled=false, extra=null}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:6,flexWrap:"wrap"}}>
    <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
      {extra}
      <button className={`btn ${cls}`} disabled={saving||disabled} onClick={onOk}>{saving?<span className="spinner" style={{borderTopColor:"#fff"}}/>:label}</button>
    </div>
  </div>
);
export const RowActions = ({onEdit, onDelete, desc=""}) => (
  <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
    {onEdit&&<button className="btn btn-outline btn-icon btn-sm" onClick={onEdit} aria-label={`Editar ${desc}`} title="Editar"><Icon n="edit" s={16}/></button>}
    {onDelete&&<button className="btn btn-ghost btn-icon btn-sm" onClick={onDelete} aria-label={`Apagar ${desc}`} title="Apagar" style={{color:"var(--divida)"}}><Icon n="trash" s={16}/></button>}
  </div>
);
export const MesSelect = ({value, onChange, id}) => (
  <select id={id} className="input" value={value} onChange={e=>onChange(+e.target.value)}>{MESES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select>
);
export const AnoSelect = ({value, onChange, anos, id}) => (
  <select id={id} className="input" value={value} onChange={e=>onChange(+e.target.value)}>{anos.map(y=><option key={y} value={y}>{y}</option>)}</select>
);
export function Segmented({value, onChange, options, label, grid=false, cols}) {
  return (
    <div role="group" aria-label={label} className={grid?"seg-grid":"seg"} style={grid?{gridTemplateColumns:`repeat(${cols||options.length},minmax(0,1fr))`}:undefined}>
      {options.map(o=>{ const [v,l] = Array.isArray(o)?o:[o,o];
        return <button key={v} type="button" aria-pressed={value===v} onClick={()=>onChange(v)}>{l}</button>; })}
    </div>
  );
}

/* Selector de mês com setas ‹ › */
export function MesNav({ano, mes, onChange, min, max, anual=false, tamanho=24, h1=false}) {
  const val = ano*12 + (anual?0:mes-1);
  const minV = min ? min.ano*12 + (anual?0:min.mes-1) : -Infinity;
  const maxV = max ? max.ano*12 + (anual?0:max.mes-1) : Infinity;
  const go = d => { const v = val + (anual?12*d:d); onChange(Math.floor(v/12), v%12+1); };
  const T = h1 ? "h1" : "span";
  return (
    <div style={{display:"flex",alignItems:"center",gap:2}}>
      <button className="btn btn-ghost btn-icon" onClick={()=>go(-1)} disabled={val-(anual?12:1)<minV} aria-label={anual?"Ano anterior":"Mês anterior"}><Icon n="left" s={20}/></button>
      <T className="serif" style={{fontSize:tamanho,fontWeight:700,minWidth:anual?70:0,textAlign:"center"}} aria-live="polite">{anual?ano:`${MESES[mes-1]} ${ano}`}</T>
      <button className="btn btn-ghost btn-icon" onClick={()=>go(1)} disabled={val+(anual?12:1)>maxV} aria-label={anual?"Ano seguinte":"Mês seguinte"}><Icon n="right" s={20}/></button>
    </div>
  );
}

/* Menu de acções (botão + lista) — fecha com Esc ou clique fora */
export function Menu({label, icon="more", items, align="right", btnClass="btn btn-outline", ariaLabel, up=false, chevron=true}) {
  const [open,setOpen] = useState(false);
  const ref = useRef(null); const mid = useId();
  useEffect(()=>{
    if (!open) return;
    const out = e=>{ if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = e=>{ if (e.key==="Escape") { e.stopPropagation(); setOpen(false); ref.current?.querySelector("button")?.focus(); } };
    document.addEventListener("mousedown", out); ref.current?.addEventListener("keydown", key);
    ref.current?.querySelector(".menu button")?.focus();
    const el = ref.current;
    return ()=>{ document.removeEventListener("mousedown", out); el?.removeEventListener("keydown", key); };
  },[open]);
  return (
    <div ref={ref} style={{position:"relative",display:"inline-flex"}}>
      <button className={btnClass} aria-haspopup="menu" aria-expanded={open} aria-controls={mid} aria-label={ariaLabel} onClick={()=>setOpen(o=>!o)}>
        {icon&&<Icon n={icon} s={chevron?18:22}/>}{label}{label&&chevron&&<Icon n="down" s={14} w={2.4}/>}
      </button>
      {open&&<div id={mid} role="menu" className="menu" style={{[align]:0,...(up?{bottom:"calc(100% + 6px)"}:{top:"calc(100% + 6px)"})}}>
        {items.filter(Boolean).map((it,i)=>(
          <button key={i} role="menuitem" className={it.danger?"danger":""} onClick={()=>{ setOpen(false); it.onClick(); }}>
            {it.icon&&<Icon n={it.icon} s={18}/>}{it.label}
          </button>
        ))}
      </div>}
    </div>
  );
}

/* Escolher apartamento com pesquisa (nº ou nome) e a situação ao lado */
export function AptCombo({fracoes, value, onChange, info, id, placeholder="Nº ou nome do apartamento"}) {
  const sel = fracoes.find(f=>String(f.numero)===String(value));
  const label = f => f ? `${f.numero}${nomeApt(f)?" — "+nomeApt(f):""}` : "";
  const [q,setQ] = useState(null); const [open,setOpen] = useState(false); const [act,setAct] = useState(0);
  const lid = useId();
  const termo = (q??"").trim().toLowerCase();
  const lista = !termo ? fracoes : fracoes.filter(f=>String(f.numero).toLowerCase().startsWith(termo) || [f.prop_nome,f.inq_nome].some(x=>String(x||"").toLowerCase().includes(termo)));
  const escolher = f => { onChange(f.numero); setQ(null); setOpen(false); };
  const onKey = e=>{
    if (e.key==="ArrowDown") { e.preventDefault(); setOpen(true); setAct(a=>Math.min(a+1, lista.length-1)); }
    else if (e.key==="ArrowUp") { e.preventDefault(); setAct(a=>Math.max(a-1,0)); }
    else if (e.key==="Enter" && open && lista[act]) { e.preventDefault(); escolher(lista[act]); }
    else if (e.key==="Escape" && open) { e.stopPropagation(); setOpen(false); setQ(null); }
  };
  return (
    <div style={{position:"relative"}}>
      <input id={id} className="input" role="combobox" aria-expanded={open} aria-controls={lid} aria-autocomplete="list"
        aria-activedescendant={open&&lista[act]?`${lid}-${act}`:undefined}
        value={q ?? label(sel)} placeholder={placeholder} autoComplete="off"
        onFocus={e=>e.target.select()}
        onClick={()=>{ setOpen(true); setAct(0); }}
        onChange={e=>{ setQ(e.target.value); setOpen(true); setAct(0); }}
        onBlur={()=>{ setOpen(false); setQ(null); }}
        onKeyDown={onKey} style={{paddingRight:40,fontWeight:sel&&q===null?700:400}}/>
      <span style={{position:"absolute",right:12,top:13,color:"var(--ink-2)",pointerEvents:"none"}}><Icon n="search" s={18}/></span>
      {open&&<div id={lid} role="listbox" className="combo-list">
        {lista.length===0&&<div className="combo-opt muted">Nenhum apartamento encontrado</div>}
        {lista.map((f,i)=>{ const inf = info?info(f):null; return (
          <div key={f.id} id={`${lid}-${i}`} role="option" aria-selected={i===act} className="combo-opt"
            onMouseDown={e=>{ e.preventDefault(); escolher(f); }} onMouseEnter={()=>setAct(i)}>
            <span style={{minWidth:0}}><b className="apt-num">{f.numero}</b> <span className="muted">{nomeApt(f)}</span></span>
            {inf&&<span style={{fontSize:13,fontWeight:700,color:inf.tone==="bad"?"var(--divida)":inf.tone==="ok"?"var(--ok)":"var(--ink-2)",whiteSpace:"nowrap"}}>{inf.txt}</span>}
          </div>); })}
      </div>}
    </div>
  );
}

/* Confirmação dentro da app (substitui window.confirm) */
export function ConfirmModal({c, onClose}) {
  const [busy,setBusy] = useState(false);
  return (
    <Modal title={c.title} onClose={onClose}>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{fontSize:15,lineHeight:1.55,color:"var(--ink)"}}>{c.body}</div>
        <ModalBtns onCancel={onClose} saving={busy} cls={c.danger?"btn-red":"btn-dark"} label={c.okLabel||"Confirmar"}
          onOk={async()=>{ setBusy(true); try { await c.onOk(); } finally { setBusy(false); onClose(); } }}/>
      </div>
    </Modal>
  );
}

export function Toast({t, onClose}) {
  if (!t) return null;
  return (
    <div className={`toast ${t.ok?"toast-ok":"toast-err"}`} role={t.ok?"status":"alert"} aria-live="polite">
      <Icon n={t.ok?"checkCircle":"alert"} s={18}/>
      <span style={{flex:1}}>{t.msg}</span>
      {t.action&&<button className="btn btn-sm" style={{background:"#fff",color:"var(--ink)"}} onClick={()=>{ t.action.fn(); onClose(); }}>{t.action.label}</button>}
      <button className="btn btn-sm btn-icon" style={{background:"transparent",color:"#fff"}} onClick={onClose} aria-label="Fechar aviso"><Icon n="x" s={16}/></button>
    </div>
  );
}

/* Carregamento: estrutura da página com blocos cinzentos */
export const Skel = ({h=16, w="100%", r, style}) => <div className="skel" style={{height:h,width:w,borderRadius:r,...style}}/>;
export function Loading({msg, gestor=false}) {
  return (
    <div style={{minHeight:"100vh",background:"var(--bg)"}} aria-busy="true">
      <div style={{background:gestor?"#fff":"var(--dark)",height:gestor?104:108,borderBottom:"1px solid var(--line)"}}/>
      <div style={{maxWidth:gestor?1180:840,margin:"0 auto",padding:"24px 16px",display:"flex",flexDirection:"column",gap:16}}>
        <div role="status" className="muted" style={{fontSize:14,display:"flex",gap:10,alignItems:"center"}}><span className="spinner"/>{msg}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
          {[0,1,2,3].slice(0,gestor?4:2).map(i=><Skel key={i} h={96} r={14}/>)}
        </div>
        <Skel h={320} r={14}/>
      </div>
    </div>
  );
}
