// ═══════════════════════════════════════════════════════════════
//  CONDOMÍNIO — Google Apps Script API  v5
//  Cole este código em: script.google.com → projecto ligado ao Sheets
//  Depois: Implementar → Nova implementação → Aplicação Web
//          (Executar como: Eu · Acesso: Qualquer pessoa)
//
//  NOVO NA v5 — SEGURANÇA
//  • Já não existe API_SECRET. As gravações exigem uma sessão de gestor,
//    obtida com a palavra-passe (acção "login").
//  • A palavra-passe fica nas Propriedades do Script:
//      Definições do projecto (⚙️) → Propriedades do script →
//      Adicionar: GESTOR_PASSWORD = <a sua palavra-passe>
//    (enquanto não existir, usa gestor_password da aba ⚙️ Configurações;
//     depois de a definir aqui, apague-a da folha)
//  • A leitura pública (doGet) já não inclui telefones, emails, NIF,
//    datas/referências de pagamentos nem a palavra-passe.
//  • Mudar a palavra-passe termina todas as sessões abertas.
//
//  NOVO NA v5 — DADOS
//  • Contribuições passam a ter uma coluna "id" e os pagamentos uma coluna
//    "contribuicao_id" (criadas e preenchidas automaticamente). Mudar o
//    título de uma contribuição já não desliga os pagamentos.
//  • Editar e apagar lançamentos (quotas, contribuições, despesas, avisos).
// ═══════════════════════════════════════════════════════════════

const VERSAO         = "v5";
const SS             = SpreadsheetApp.getActiveSpreadsheet();
const PROPS          = PropertiesService.getScriptProperties();
const SESSAO_HORAS   = 8;   // duração de uma sessão de gestor
const MAX_TENTATIVAS = 5;   // tentativas erradas antes de bloquear
const BLOQUEIO_MIN   = 10;  // minutos de bloqueio

const ABA = {
  CONFIG:   "⚙️ Configurações",
  FRACOES:  "🏠 Fracções",
  QUOTAS:   "💳 Quotas Mensais",
  CONTRIB:  "📋 Contribuições",
  PGC:      "✅ Pgtos. Contribuições",
  DESPESAS: "🧾 Despesas",
  AVISOS:   "📢 Avisos",
};

// Esquema de colunas de cada aba: campo → [cabeçalho, coluna por omissão].
// A coluna é procurada pelo nome do cabeçalho (com ou sem *); se não existir
// usa a posição por omissão. Coluna null = criada no fim quando necessária.
const ESQUEMA = {
  FRACOES: { aba: ABA.FRACOES, hdr: 5, campos: {
    numero:              ["fracao_numero", 1],
    andar:               ["andar", 2],
    prop_nome:           ["prop_nome", 3],
    prop_telefone:       ["prop_telefone", 4],
    prop_email:          ["prop_email", 5],
    prop_nif:            ["prop_nif", 6],
    inq_nome:            ["inq_nome", 7],
    inq_telefone:        ["inq_telefone", 8],
    inq_email:           ["inq_email", 9],
    inq_inicio_contrato: ["inq_inicio_contrato", 10],
    fracao_ativa:        ["fracao_ativa", 11],
    exclui_quota:        ["exclui_quota", 12],
    observacoes:         ["observacoes", 13],
  }},
  QUOTAS: { aba: ABA.QUOTAS, hdr: 4, campos: {
    fracao_numero: ["fracao_numero", 1],
    data:          ["data_pagamento", 2],
    valor:         ["valor_kz", 3],
    mes:           ["mes_referencia", 4],
    ano:           ["ano_referencia", 5],
    metodo:        ["metodo_pagamento", 6],
    referencia:    ["referencia_doc", 7],
    observacoes:   ["observacoes", 8],
  }},
  CONTRIB: { aba: ABA.CONTRIB, hdr: 4, campos: {
    titulo:         ["titulo", 1],
    valorPorFracao: ["valor_por_fracao_kz", 2],
    dataVencimento: ["data_vencimento", 3],
    descricao:      ["descricao", 4],
    categoria:      ["categoria", 5],
    estado:         ["estado", 6],
    valorTotal:     ["valor_total_kz", 7],
    excluidos:      ["excluidos", 8],
    id:             ["id", null],
  }},
  PGC: { aba: ABA.PGC, hdr: 4, campos: {
    contribuicao_titulo: ["contribuicao_titulo", 1],
    fracao_numero:       ["fracao_numero", 2],
    data:                ["data_pagamento", 3],
    valor:               ["valor_kz", 4],
    metodo:              ["metodo_pagamento", 5],
    referencia:          ["referencia_doc", 6],
    observacoes:         ["observacoes", 7],
    contribuicao_id:     ["contribuicao_id", null],
  }},
  DESPESAS: { aba: ABA.DESPESAS, hdr: 4, campos: {
    data:        ["data", 1],
    valor:       ["valor_kz", 2],
    descricao:   ["descricao", 3],
    categoria:   ["categoria", 4],
    fornecedor:  ["fornecedor", 5],
    numFatura:   ["num_fatura", 6],
    pagoPor:     ["pago_por", 7],
    observacoes: ["observacoes", 8],
  }},
  AVISOS: { aba: ABA.AVISOS, hdr: 4, campos: {
    tipo:     ["tipo", 1],
    titulo:   ["titulo", 2],
    conteudo: ["conteudo", 3],
    data:     ["data", 4],
    autor:    ["autor", 5],
    id:       ["id", 6],
  }},
};

// Campos gravados como número
const CAMPOS_NUM = ["valor", "mes", "ano", "valorPorFracao", "valorTotal"];


// ── RESPOSTA JSON ────────────────────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// ── UTILITÁRIOS ──────────────────────────────────────────────────
function normHeader(h) { return String(h || "").replace(/\*/g, "").trim().toLowerCase(); }

function normCell(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return v === null || v === undefined ? "" : String(v);
}

function num(v) {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}

// Assinatura de uma linha — permite confirmar, antes de editar ou apagar,
// que a linha não mudou desde que a app a leu.
function rowSig(values) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, JSON.stringify(values.map(normCell)), Utilities.Charset.UTF_8);
  return bytes.map(b => ((b + 256) % 256).toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function novoId(prefixo) {
  return prefixo + Utilities.getUuid().replace(/-/g, "").slice(0, 8);
}

function hoje() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function getSheet(nome) {
  const sheet = SS.getSheetByName(nome);
  if (!sheet) throw new Error("Aba não encontrada: " + nome);
  return sheet;
}

function headersOf(sheet, headerRow) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0].map(normHeader);
}

// Devolve o nº da coluna com esse cabeçalho; cria-a no fim se não existir.
function ensureColumn(sheet, headerRow, nome) {
  const headers = headersOf(sheet, headerRow);
  const idx = headers.indexOf(normHeader(nome));
  if (idx >= 0) return idx + 1;
  let ultima = 0;
  headers.forEach((h, i) => { if (h) ultima = i + 1; });
  const col = ultima + 1;
  sheet.getRange(headerRow, col).setValue(nome).setFontWeight("bold");
  return col;
}

// Resolve o nº de coluna de cada campo do esquema.
function resolverColunas(esq, sheet, criar) {
  const headers = headersOf(sheet, esq.hdr);
  const cols = {};
  Object.keys(esq.campos).forEach(k => {
    const [nome, def] = esq.campos[k];
    const i = headers.indexOf(nome);
    if (i >= 0) cols[k] = i + 1;
    else if (def) cols[k] = def;
    else if (criar) cols[k] = ensureColumn(sheet, esq.hdr, nome);
  });
  return cols;
}

function valorParaFolha(campo, v) {
  if (v === undefined || v === null) return "";
  return CAMPOS_NUM.includes(campo) ? (Number(v) || 0) : v;
}


// ── LEITURA GENÉRICA ─────────────────────────────────────────────
// headerRow: linha dos cabeçalhos (por omissão 4).
// A aba Fracções usa headerRow=5 porque a linha 4 tem grupos visuais.
function sheetToObjects(sheetName, headerRow) {
  headerRow = headerRow || 4;
  const sheet = SS.getSheetByName(sheetName);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < headerRow || lastCol < 1) return [];
  const dataStartRow = headerRow + 1;
  const headers  = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  const dataRows = lastRow >= dataStartRow
    ? sheet.getRange(dataStartRow, 1, lastRow - headerRow, lastCol).getValues()
    : [];
  const results = [];
  dataRows.forEach((row, idx) => {
    if (row.every(cell => cell === "" || cell === null)) return;
    const obj = { _row: idx + dataStartRow, _sig: rowSig(row) };
    headers.forEach((h, i) => {
      if (!h) return;
      obj[h] = normCell(row[i]);
    });
    results.push(obj);
  });
  return results;
}


// ── LÊ CONFIGURAÇÕES ─────────────────────────────────────────────
function readConfig() {
  const sheet = SS.getSheetByName(ABA.CONFIG);
  if (!sheet) return {};
  const lastRow = sheet.getLastRow();
  const config  = {};
  if (lastRow < 5) return config;
  const data = sheet.getRange(5, 2, lastRow - 4, 2).getValues();
  data.forEach(row => {
    const key = String(row[0]).trim();
    const val = String(row[1]).trim();
    if (key) config[key] = val;
  });
  return config;
}


// ── ABA AVISOS (cria se não existir) ─────────────────────────────
function ensureAvisosSheet() {
  let sheet = SS.getSheetByName(ABA.AVISOS);
  if (!sheet) {
    sheet = SS.insertSheet(ABA.AVISOS);
    sheet.setTabColor("#1A4F8B");
    sheet.getRange(4, 1, 1, 6).setValues([["tipo","titulo","conteudo","data","autor","id"]]);
    sheet.getRange(4, 1, 1, 6).setFontWeight("bold");
  }
  return sheet;
}


// ── PRÓXIMA LINHA VAZIA ──────────────────────────────────────────
function nextEmptyRow(sheet, minDataRow) {
  minDataRow = minDataRow || 5;
  const lastRow = sheet.getLastRow();
  return lastRow < minDataRow ? minDataRow : lastRow + 1;
}


// ════════════════════════════════════════════════════════════════
//  SESSÃO DO GESTOR
// ════════════════════════════════════════════════════════════════
function getPassword() {
  return PROPS.getProperty("GESTOR_PASSWORD") || readConfig()["gestor_password"] || "";
}

// A chave inclui a palavra-passe: mudá-la invalida todas as sessões.
function chaveSessao() {
  let k = PROPS.getProperty("TOKEN_SECRET");
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); PROPS.setProperty("TOKEN_SECRET", k); }
  return k + "|" + getPassword();
}

function assinar(texto) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(texto, chaveSessao()));
}

function criarSessao() {
  const exp = Date.now() + SESSAO_HORAS * 3600 * 1000;
  return { token: exp + "." + assinar(String(exp)), exp };
}

function sessaoValida(token) {
  if (!token || typeof token !== "string") return false;
  const partes = token.split(".");
  if (partes.length !== 2) return false;
  if (assinar(partes[0]) !== partes[1]) return false;
  return parseInt(partes[0]) > Date.now();
}

function login(password) {
  const cache  = CacheService.getScriptCache();
  const falhas = parseInt(cache.get("login_falhas") || "0");
  if (falhas >= MAX_TENTATIVAS) {
    return { ok: false, code: "LOCKED", error: "Demasiadas tentativas erradas. Aguarde " + BLOQUEIO_MIN + " minutos." };
  }
  const real = getPassword();
  if (!real) return { ok: false, error: "Palavra-passe do gestor não configurada no script (GESTOR_PASSWORD)." };
  if (String(password || "") !== real) {
    cache.put("login_falhas", String(falhas + 1), BLOQUEIO_MIN * 60);
    Utilities.sleep(800);
    return { ok: false, code: "BADPWD", error: "Palavra-passe incorrecta" };
  }
  cache.remove("login_falhas");
  const s = criarSessao();
  return { ok: true, token: s.token, exp: s.exp };
}


// ════════════════════════════════════════════════════════════════
//  IDs DAS CONTRIBUIÇÕES (P5)
//  Garante que cada contribuição tem "id" e que cada pagamento tem
//  "contribuicao_id". Linhas escritas à mão na folha (só com o título)
//  são ligadas automaticamente pelo título na primeira leitura.
// ════════════════════════════════════════════════════════════════
function garantirIds() {
  const shC = SS.getSheetByName(ABA.CONTRIB);
  if (!shC || shC.getLastRow() < 5) return;
  const colTitC = headersOf(shC, 4).indexOf("titulo") + 1;
  if (!colTitC) return;
  const colIdC = ensureColumn(shC, 4, "id");
  const nC     = shC.getLastRow() - 4;
  const tits   = shC.getRange(5, colTitC, nC, 1).getValues();
  const ids    = shC.getRange(5, colIdC, nC, 1).getValues();
  const titToId = {};
  let mudou = false;
  for (let i = 0; i < nC; i++) {
    const t = String(tits[i][0]).trim();
    if (!t) continue;
    if (!String(ids[i][0]).trim()) { ids[i][0] = novoId("c"); mudou = true; }
    titToId[t] = String(ids[i][0]).trim();
  }
  if (mudou) shC.getRange(5, colIdC, nC, 1).setValues(ids);

  const shP = SS.getSheetByName(ABA.PGC);
  if (!shP || shP.getLastRow() < 5) return;
  const colTitP = headersOf(shP, 4).indexOf("contribuicao_titulo") + 1;
  if (!colTitP) return;
  const colIdP = ensureColumn(shP, 4, "contribuicao_id");
  const nP     = shP.getLastRow() - 4;
  const titsP  = shP.getRange(5, colTitP, nP, 1).getValues();
  const idsP   = shP.getRange(5, colIdP, nP, 1).getValues();
  let mudouP = false;
  for (let i = 0; i < nP; i++) {
    const t = String(titsP[i][0]).trim();
    if (!t || String(idsP[i][0]).trim()) continue;
    if (titToId[t]) { idsP[i][0] = titToId[t]; mudouP = true; }
  }
  if (mudouP) shP.getRange(5, colIdP, nP, 1).setValues(idsP);
}

function garantirIdsSeguro() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try { garantirIds(); } finally { lock.releaseLock(); }
}


// ════════════════════════════════════════════════════════════════
//  LEITURA COMPLETA (gestor)
// ════════════════════════════════════════════════════════════════
function readFracoes() {
  const raw = sheetToObjects(ABA.FRACOES, 5);
  return raw
    .filter(f => f["fracao_numero*"] || f["fracao_numero"])
    .map((f, i) => ({
      id:            "f" + (i + 1),
      numero:        f["fracao_numero*"] || f["fracao_numero"] || "",
      andar:         f["andar"] || "",
      prop_nome:     f["prop_nome*"] || f["prop_nome"] || "",
      prop_telefone: f["prop_telefone*"] || f["prop_telefone"] || "",
      prop_email:    f["prop_email"] || "",
      prop_nif:      f["prop_nif"] || "",
      inq_nome:      f["inq_nome"] || "",
      inq_telefone:  f["inq_telefone"] || "",
      inq_email:     f["inq_email"] || "",
      inq_inicio_contrato: f["inq_inicio_contrato"] || "",
      proprietario:  f["prop_nome*"] || f["prop_nome"] || "",
      telefone:      f["prop_telefone*"] || f["prop_telefone"] || "",
      excluiQuota:   (f["exclui_quota"] || "").toLowerCase() === "sim",
      ativa:         (f["fracao_ativa"] || "Sim").toLowerCase() !== "não",
      observacoes:   f["observacoes"] || "",
      _row:          f._row,
      _sig:          f._sig,
    }));
}

function lerDados() {
  const config        = readConfig();
  const fracoes       = readFracoes();
  const quotas        = sheetToObjects(ABA.QUOTAS);
  const contribuicoes = sheetToObjects(ABA.CONTRIB);
  const pagContrib    = sheetToObjects(ABA.PGC);
  const despesas      = sheetToObjects(ABA.DESPESAS);
  const avisosRaw     = sheetToObjects(ABA.AVISOS);

  const numToId = {};
  fracoes.forEach(f => { numToId[f.numero] = f.id; });

  const quotasNorm = quotas
    .filter(q => q["fracao_numero*"] || q["fracao_numero"])
    .map((q, i) => {
      const n = q["fracao_numero*"] || q["fracao_numero"] || "";
      return {
        id:          "pq" + (i + 1),
        fracaoId:    numToId[n] || n,
        data:        q["data_pagamento*"] || q["data_pagamento"] || "",
        valor:       num(q["valor_kz*"] || q["valor_kz"]),
        mes:         parseInt(q["mes_referencia*"] || q["mes_referencia"] || "0") || 0,
        ano:         parseInt(q["ano_referencia*"] || q["ano_referencia"] || "0") || 0,
        metodo:      q["metodo_pagamento"] || "",
        referencia:  q["referencia_doc"] || "",
        observacoes: q["observacoes"] || "",
        _row:        q._row,
        _sig:        q._sig,
      };
    });

  const titToId = {};
  const contribNorm = contribuicoes
    .filter(c => c["titulo*"] || c["titulo"])
    .map((c, i) => {
      const titulo = c["titulo*"] || c["titulo"] || "";
      const id     = c["id"] || ("c" + (i + 1));
      titToId[titulo] = id;
      const excStr = c["excluidos"] || "";
      const excluidos = excStr ? excStr.split(",").map(x => x.trim()).filter(Boolean) : [];
      return {
        id,
        titulo,
        valorPorFracao: num(c["valor_por_fracao_kz*"] || c["valor_por_fracao_kz"]),
        valorTotal:     num(c["valor_total_kz"]),
        dataVencimento: c["data_vencimento*"] || c["data_vencimento"] || "",
        descricao:      c["descricao"] || "",
        categoria:      c["categoria"] || "",
        estado:         c["estado"] || "Aberto",
        excluidos:      excluidos.map(n => numToId[n] || n),
        _row:           c._row,
        _sig:           c._sig,
      };
    });

  const pagContribNorm = pagContrib
    .filter(p => p["contribuicao_titulo*"] || p["contribuicao_titulo"] || p["contribuicao_id"])
    .map((p, i) => {
      const tit = p["contribuicao_titulo*"] || p["contribuicao_titulo"] || "";
      const n   = p["fracao_numero*"] || p["fracao_numero"] || "";
      return {
        id:             "pc" + (i + 1),
        contribuicaoId: p["contribuicao_id"] || titToId[tit] || tit,
        fracaoId:       numToId[n] || n,
        data:           p["data_pagamento*"] || p["data_pagamento"] || "",
        valor:          num(p["valor_kz*"] || p["valor_kz"]),
        metodo:         p["metodo_pagamento"] || "",
        referencia:     p["referencia_doc"] || "",
        _row:           p._row,
        _sig:           p._sig,
      };
    });

  const despesasNorm = despesas
    .filter(d => d["data*"] || d["data"])
    .map((d, i) => ({
      id:          "d" + (i + 1),
      data:        d["data*"] || d["data"] || "",
      valor:       num(d["valor_kz*"] || d["valor_kz"]),
      descricao:   d["descricao*"] || d["descricao"] || "",
      categoria:   d["categoria*"] || d["categoria"] || "Outros",
      fornecedor:  d["fornecedor"] || "",
      numFatura:   d["num_fatura"] || "",
      observacoes: d["observacoes"] || "",
      _row:        d._row,
      _sig:        d._sig,
    }));

  const avisosNorm = avisosRaw
    .filter(a => a["titulo"] || a["tipo"])
    .map((a, i) => ({
      id:       a["id"] || "av" + (i + 1),
      tipo:     a["tipo"] || "Aviso",
      titulo:   a["titulo"] || "",
      conteudo: a["conteudo"] || "",
      data:     a["data"] || "",
      autor:    a["autor"] || "",
      _row:     a._row,
      _sig:     a._sig,
    }));

  return {
    ok: true,
    versao: VERSAO,
    timestamp: new Date().toISOString(),
    config: {
      predio:         config["predio_nome"]     || "Edifício",
      endereco:       config["predio_endereco"] || "",
      gestorNome:     config["gestor_nome"]     || "Gestor",
      gestorTelefone: config["gestor_telefone"] || "",
      quotaMensal:    num(config["quota_mensal_kz"]),
      anoBase:        parseInt(config["ano_inicio"] || "2025") || 2025,
      mesBase:        parseInt(config["mes_inicio"] || "1")    || 1,
      multaAtraso:    num(config["multa_atraso_pct"]),
    },
    fracoes,
    pagamentosQuota:        quotasNorm,
    contribuicoes:          contribNorm,
    pagamentosContribuicao: pagContribNorm,
    despesas:               despesasNorm,
    avisos:                 avisosNorm,
  };
}

// Versão pública: só o que a página pública mostra, sem dados pessoais.
function dadosPublicos(d) {
  return {
    ok: true,
    versao: d.versao,
    timestamp: d.timestamp,
    config: {
      predio:      d.config.predio,
      endereco:    d.config.endereco,
      gestorNome:  d.config.gestorNome,
      quotaMensal: d.config.quotaMensal,
      anoBase:     d.config.anoBase,
      mesBase:     d.config.mesBase,
    },
    fracoes: d.fracoes.map(f => ({
      id: f.id, numero: f.numero, andar: f.andar,
      prop_nome: f.prop_nome, proprietario: f.proprietario, inq_nome: f.inq_nome,
      excluiQuota: f.excluiQuota, ativa: f.ativa,
    })),
    pagamentosQuota: d.pagamentosQuota.map(p => ({
      id: p.id, fracaoId: p.fracaoId, valor: p.valor, mes: p.mes, ano: p.ano,
      metodo: p.metodo === "Isento" ? "Isento" : "",
    })),
    contribuicoes: d.contribuicoes.map(c => ({
      id: c.id, titulo: c.titulo, valorPorFracao: c.valorPorFracao, valorTotal: c.valorTotal,
      dataVencimento: c.dataVencimento, descricao: c.descricao, categoria: c.categoria,
      estado: c.estado, excluidos: c.excluidos,
    })),
    pagamentosContribuicao: d.pagamentosContribuicao.map(p => ({
      id: p.id, contribuicaoId: p.contribuicaoId, fracaoId: p.fracaoId, valor: p.valor,
      metodo: p.metodo === "Isento" ? "Isento" : "",
    })),
    avisos: d.avisos.map(a => ({
      id: a.id, tipo: a.tipo, titulo: a.titulo, conteudo: a.conteudo, data: a.data, autor: a.autor,
    })),
  };
}


// ════════════════════════════════════════════════════════════════
//  ESCRITA GENÉRICA
// ════════════════════════════════════════════════════════════════
// Acrescenta linhas. registos: [{campo: valor, ...}, ...]
function acrescentar(chave, registos) {
  if (!registos.length) return 0;
  const esq   = ESQUEMA[chave];
  const sheet = chave === "AVISOS" ? ensureAvisosSheet() : getSheet(esq.aba);
  const campos = Object.keys(esq.campos).filter(k => registos.some(r => r[k] !== undefined));
  const cols  = resolverColunas(esq, sheet, true);
  const largura = Math.max.apply(null, campos.map(k => cols[k]).concat([1]));
  const linhas = registos.map(r => {
    const linha = new Array(largura).fill("");
    campos.forEach(k => { linha[cols[k] - 1] = valorParaFolha(k, r[k]); });
    return linha;
  });
  const inicio = nextEmptyRow(sheet, esq.hdr + 1);
  sheet.getRange(inicio, 1, linhas.length, largura).setValues(linhas);
  return inicio;
}

// Confirma que a linha é a mesma que a app leu.
function verificarLinha(chave, rowNum, sig) {
  const esq   = ESQUEMA[chave];
  const sheet = getSheet(esq.aba);
  const row   = parseInt(rowNum);
  if (!row || row <= esq.hdr || row > sheet.getLastRow()) throw new Error("Linha inválida");
  const valores = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (!sig || rowSig(valores) !== sig) {
    throw new Error("Este registo foi alterado entretanto na folha. Actualize (↻) e tente de novo.");
  }
  return { sheet, row, esq };
}

// Actualiza apenas os campos enviados, célula a célula (preserva fórmulas).
function editar(chave, data, permitidos) {
  const { sheet, row, esq } = verificarLinha(chave, data._row, data._sig);
  const cols = resolverColunas(esq, sheet, true);
  permitidos.forEach(k => {
    if (data[k] === undefined || !cols[k]) return;
    sheet.getRange(row, cols[k]).setValue(valorParaFolha(k, data[k]));
  });
  return row;
}

function apagar(chave, data) {
  const { sheet, row } = verificarLinha(chave, data._row, data._sig);
  sheet.deleteRow(row);
  return row;
}

function exigir(cond, msg) { if (!cond) throw new Error(msg); }

function contribPorId(id) {
  const c = lerDados().contribuicoes.find(x => x.id === id);
  exigir(c, "Contribuição não encontrada. Actualize (↻) e tente de novo.");
  return c;
}

function numeroExiste(numero, excetoRow) {
  return readFracoes().some(f => String(f.numero).trim().toLowerCase() === String(numero).trim().toLowerCase()
                              && f._row !== parseInt(excetoRow));
}


// ════════════════════════════════════════════════════════════════
//  doGet — leitura pública
// ════════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    garantirIdsSeguro();
    return jsonResponse(dadosPublicos(lerDados()));
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}


// ════════════════════════════════════════════════════════════════
//  doPost — login, leitura completa e escrita (requer sessão)
// ════════════════════════════════════════════════════════════════
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (_) { return jsonResponse({ ok: false, error: "Pedido inválido" }); }

  const action = body.action || "";
  const data   = body.data   || {};

  try {
    if (action === "login") return jsonResponse(login(data.password));

    if (!sessaoValida(body.token)) {
      return jsonResponse({ ok: false, code: "AUTH", error: "Sessão expirada. Entre novamente." });
    }

    if (action === "get_data") {
      garantirIdsSeguro();
      return jsonResponse(lerDados());
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      return jsonResponse(executar(action, data));
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}


function executar(action, data) {
  switch (action) {

    // ── APARTAMENTOS ────────────────────────────────────────────
    case "add_fracao": {
      exigir(String(data.numero || "").trim(), "Indique o número do apartamento");
      exigir(String(data.prop_nome || "").trim(), "Indique o nome do proprietário");
      exigir(!numeroExiste(data.numero), "Já existe um apartamento com o número " + data.numero);
      const row = acrescentar("FRACOES", [{
        numero: data.numero, andar: data.andar || "",
        prop_nome: data.prop_nome, prop_telefone: data.prop_telefone || "",
        prop_email: data.prop_email || "", prop_nif: data.prop_nif || "",
        inq_nome: data.inq_nome || "", inq_telefone: data.inq_telefone || "",
        inq_email: data.inq_email || "", inq_inicio_contrato: data.inq_inicio_contrato || "",
        fracao_ativa: "Sim", exclui_quota: data.exclui_quota || "Não",
        observacoes: data.observacoes || "",
      }]);
      return { ok: true, row };
    }

    case "edit_fracao": {
      if (data.numero !== undefined) {
        exigir(String(data.numero).trim(), "O número do apartamento não pode ficar vazio");
        exigir(!numeroExiste(data.numero, data._row), "Já existe um apartamento com o número " + data.numero);
      }
      if (data.prop_nome !== undefined) exigir(String(data.prop_nome).trim(), "O nome do proprietário não pode ficar vazio");
      const row = editar("FRACOES", data, [
        "numero", "andar", "prop_nome", "prop_telefone", "prop_email", "prop_nif",
        "inq_nome", "inq_telefone", "inq_email", "inq_inicio_contrato", "exclui_quota", "observacoes",
      ]);
      return { ok: true, row };
    }

    // ── QUOTAS ──────────────────────────────────────────────────
    // Um ou vários meses: meses = [{mes, ano, valor}, ...]
    case "add_pagamentos_quota": {
      const meses = data.meses || [];
      exigir(data.fracao_numero, "Seleccione o apartamento");
      exigir(meses.length > 0, "Indique pelo menos um mês");
      meses.forEach(m => exigir(m.mes >= 1 && m.mes <= 12 && m.ano > 2000, "Mês de referência inválido"));
      const row = acrescentar("QUOTAS", meses.map(m => ({
        fracao_numero: data.fracao_numero, data: data.data || hoje(), valor: m.valor,
        mes: m.mes, ano: m.ano, metodo: data.metodo || "",
        referencia: data.referencia || "", observacoes: data.observacoes || "",
      })));
      return { ok: true, row, count: meses.length };
    }

    // Compatibilidade com a v4 (um só mês)
    case "add_pagamento_quota":
      return executar("add_pagamentos_quota", {
        fracao_numero: data.fracao_numero, data: data.data, metodo: data.metodo,
        referencia: data.referencia, observacoes: data.observacoes,
        meses: [{ mes: parseInt(data.mes), ano: parseInt(data.ano), valor: data.valor }],
      });

    case "edit_pagamento_quota": {
      if (data.mes !== undefined) exigir(data.mes >= 1 && data.mes <= 12, "Mês inválido");
      const row = editar("QUOTAS", data, ["fracao_numero", "data", "valor", "mes", "ano", "metodo", "referencia", "observacoes"]);
      return { ok: true, row };
    }

    case "delete_pagamento_quota":
      return { ok: true, row: apagar("QUOTAS", data) };

    case "add_isencoes_quota": {
      const meses = data.meses || [];
      exigir(data.fracao_numero, "Seleccione o apartamento");
      const row = acrescentar("QUOTAS", meses.map(m => ({
        fracao_numero: data.fracao_numero, data: hoje(), valor: 0,
        mes: m.mes, ano: m.ano, metodo: "Isento", referencia: data.motivo || "", observacoes: "",
      })));
      return { ok: true, row, count: meses.length };
    }

    // ── CONTRIBUIÇÕES ───────────────────────────────────────────
    case "add_contribuicao": {
      exigir(String(data.titulo || "").trim(), "Indique o título");
      const id  = novoId("c");
      const row = acrescentar("CONTRIB", [{
        titulo: data.titulo, valorPorFracao: data.valorPorFracao || 0,
        dataVencimento: data.dataVencimento || "", descricao: data.descricao || "",
        categoria: data.categoria || "Outro", estado: "Aberto",
        valorTotal: data.valorTotal || 0, excluidos: data.excluidos || "", id,
      }]);
      return { ok: true, row, id };
    }

    case "edit_contribuicao": {
      if (data.titulo !== undefined) exigir(String(data.titulo).trim(), "O título não pode ficar vazio");
      const row = editar("CONTRIB", data, ["titulo", "valorPorFracao", "valorTotal", "dataVencimento", "descricao", "categoria", "estado", "excluidos"]);
      // Mantém o título legível nos pagamentos (a ligação é pelo id)
      if (data.titulo !== undefined && data.id) {
        const sh = SS.getSheetByName(ABA.PGC);
        if (sh && sh.getLastRow() >= 5) {
          const cols = resolverColunas(ESQUEMA.PGC, sh, true);
          const n    = sh.getLastRow() - 4;
          const ids  = sh.getRange(5, cols.contribuicao_id, n, 1).getValues();
          const tits = sh.getRange(5, cols.contribuicao_titulo, n, 1).getValues();
          let mudou = false;
          for (let i = 0; i < n; i++) {
            if (String(ids[i][0]).trim() === data.id && tits[i][0] !== data.titulo) { tits[i][0] = data.titulo; mudou = true; }
          }
          if (mudou) sh.getRange(5, cols.contribuicao_titulo, n, 1).setValues(tits);
        }
      }
      return { ok: true, row };
    }

    case "delete_contribuicao": {
      const temPags = lerDados().pagamentosContribuicao.some(p => p.contribuicaoId === data.id);
      exigir(!temPags, "Esta contribuição tem pagamentos registados. Apague primeiro os pagamentos.");
      return { ok: true, row: apagar("CONTRIB", data) };
    }

    case "add_pagamento_contribuicao": {
      exigir(data.contribuicao_id, "Seleccione a contribuição");
      exigir(data.fracao_numero, "Seleccione o apartamento");
      const c = contribPorId(data.contribuicao_id);
      const row = acrescentar("PGC", [{
        contribuicao_titulo: c.titulo, contribuicao_id: c.id,
        fracao_numero: data.fracao_numero, data: data.data || hoje(), valor: data.valor || 0,
        metodo: data.metodo || "", referencia: data.referencia || "", observacoes: data.observacoes || "",
      }]);
      return { ok: true, row };
    }

    case "add_pagamento_contribuicao_bulk": {
      exigir(data.contribuicao_id, "Seleccione a contribuição");
      const c = contribPorId(data.contribuicao_id);
      const numeros = data.fracao_numeros || [];
      exigir(numeros.length > 0, "Seleccione pelo menos um apartamento");
      const row = acrescentar("PGC", numeros.map(n => ({
        contribuicao_titulo: c.titulo, contribuicao_id: c.id,
        fracao_numero: n, data: data.data || hoje(), valor: data.valor_por_fracao || 0,
        metodo: data.metodo || "", referencia: "", observacoes: "",
      })));
      return { ok: true, row, count: numeros.length };
    }

    case "edit_pagamento_contribuicao": {
      if (data.contribuicao_id !== undefined) data.contribuicao_titulo = contribPorId(data.contribuicao_id).titulo;
      const row = editar("PGC", data, ["contribuicao_id", "contribuicao_titulo", "fracao_numero", "data", "valor", "metodo", "referencia", "observacoes"]);
      return { ok: true, row };
    }

    case "delete_pagamento_contribuicao":
      return { ok: true, row: apagar("PGC", data) };

    // ── DESPESAS ────────────────────────────────────────────────
    case "add_despesa": {
      exigir(data.data, "Indique a data");
      exigir(String(data.descricao || "").trim(), "Indique a descrição");
      const row = acrescentar("DESPESAS", [{
        data: data.data, valor: data.valor, descricao: data.descricao, categoria: data.categoria || "Outros",
        fornecedor: data.fornecedor || "", numFatura: data.numFatura || "",
        pagoPor: data.pagoPor || "", observacoes: data.observacoes || "",
      }]);
      return { ok: true, row };
    }

    case "edit_despesa":
      return { ok: true, row: editar("DESPESAS", data, ["data", "valor", "descricao", "categoria", "fornecedor", "numFatura", "observacoes"]) };

    case "delete_despesa":
      return { ok: true, row: apagar("DESPESAS", data) };

    // ── AVISOS ──────────────────────────────────────────────────
    case "add_aviso": {
      exigir(String(data.titulo || "").trim(), "Indique o título");
      const id  = "av_" + new Date().getTime();
      const row = acrescentar("AVISOS", [{
        tipo: data.tipo || "Aviso", titulo: data.titulo || "",
        conteudo: data.conteudo || "", data: data.data || hoje(),
        autor: data.autor || "", id,
      }]);
      return { ok: true, row, id };
    }

    case "edit_aviso":
      return { ok: true, row: editar("AVISOS", data, ["tipo", "titulo", "conteudo", "data", "autor"]) };

    case "delete_aviso":
      return { ok: true, row: apagar("AVISOS", data) };

    default:
      return { ok: false, error: "Acção desconhecida: " + action };
  }
}


// ════════════════════════════════════════════════════════════════
//  TESTES — Executar no editor
// ════════════════════════════════════════════════════════════════
function testeLeitura() {
  Logger.log(doGet({}).getContent());
}

function testePassword() {
  Logger.log(getPassword() ? "✅ Palavra-passe configurada" : "❌ Falta GESTOR_PASSWORD nas Propriedades do script");
}
