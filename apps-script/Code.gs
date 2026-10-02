// ═══════════════════════════════════════════════════════════════
//  CONDOMÍNIO — Google Apps Script API  v7.7
//  Cole este código em: script.google.com → projecto ligado ao Sheets
//  Depois: Implementar → Gerir implementações → editar → Nova versão
//          (Executar como: Eu · Acesso: Qualquer pessoa)
//
//  NOVO NA v7.7 — CONCILIAÇÃO COM O BANCO (fase 3)
//  • conciliar: grava de uma vez as propostas aceites pelo gestor — liga
//    registos existentes a um movimento do extracto (só as colunas de
//    reconciliação) e cria os registos em falta (quotas, pagamentos de
//    contribuições, despesas) já ligados. Verifica todas as linhas antes de
//    escrever e respeita o fecho de período nos registos novos.
//  • Lê a aba "🔗 NIBs" (chave, fracoes, nome, nota), se existir: completa o
//    livro de NIBs que a app aprende das ligações já feitas.
//
//  NOVO NA v7.6 — CONCILIAÇÃO COM O BANCO (fase 2)
//  • Nova aba "🏦 Extracto" (criada na primeira importação): um movimento
//    do banco por linha, identificado pelo NUM. DOC. (único; o NUM. OPER.
//    repete-se). Importar o mesmo extracto outra vez não duplica nada.
//  • converter_ids_movimento: troca os id_movimento antigos
//    (EXT-AAAAMMDD-NNN, que dependiam da ordem do ficheiro) pelo NUM. DOC.
//    nas abas de quotas, contribuições e despesas (e no referencia_doc
//    quando era igual ao id antigo). O id antigo fica na aba Extracto.
//
//  NOVO NA v7.5 — CONCILIAÇÃO COM O BANCO (fase 1)
//  • Lê as colunas de reconciliação das abas Quotas, Pgtos. Contribuições e
//    Despesas (id_movimento, data_extrato, descricao_extrato,
//    valor_movimento_kz, canal, confianca, nota_reconciliacao). Só seguem
//    para o gestor: as descrições têm NIBs e nomes.
//  • canal: Banco, Numerário, Gestor anterior, Isento, Acerto (os valores
//    antigos "Sebastião" e "Isento (app)" são lidos como Gestor anterior e
//    Isento). Pagamentos registados em Numerário ficam com canal Numerário.
//  • CORRECÇÃO: uma coluna que não existe na aba passa a ser criada no fim
//    (antes usava a posição por omissão, que podia ser outra coluna — ex.:
//    exclui_quota a escrever por cima de observacoes na aba Fracções).
//
//  NOVO NA v7
//  • Apartamentos inactivos (A2): fracao_ativa passa a poder ser editada
//    pela app (edit_fracao). "Não" = não paga quotas nem contribuições.
//  • Valor da quota ao longo do tempo (B1): nova aba "💲 Valor da Quota"
//    (ano, mes, valor_kz), criada automaticamente no primeiro registo.
//    Cada valor vale a partir desse mês. Sem linhas, usa quota_mensal_kz.
//  • Como pagar (C2): novas chaves opcionais na aba ⚙️ Configurações —
//      pagamento_iban, pagamento_titular, pagamento_banco,
//      pagamento_descritivo (ex.: "Quota apt {apt}"), pagamento_instrucoes,
//      comprovativo_telefone (WhatsApp para onde os moradores enviam o
//      comprovativo). São públicas: aparecem na página dos moradores.
//  • Registo de alterações (G1): cada gravação feita pela app fica na aba
//    "🗒️ Registo" (data/hora, acção, aba, linha, valores antes, dados).
//  • Cópias de segurança (G3): pasta "Cópias de segurança" ao lado da
//    folha. Execute UMA VEZ no editor a função instalarCopiaSemanal()
//    (autoriza o acesso ao Drive e cria a cópia automática de 2ª feira).
//    Ficam as últimas 12 cópias. ⚠️ Execute instalarCopiaSemanal ANTES de
//    publicar a Nova versão: a v7 precisa de autorizações novas (Drive).
//  • Fecho de período (G4): chave fechado_ate (aaaa-mm) na aba
//    Configurações, gerida pela app. Movimentos com data até esse mês
//    (quotas, contribuições, despesas) já não podem ser criados,
//    alterados nem apagados.
//
//  NOVO — CONTRIBUIÇÕES FECHADAS
//  • Uma contribuição com estado "Fechado" deixa de aceitar pagamentos
//    (add_pagamento_contribuicao e _bulk recusam). O histórico mantém-se
//    e os pagamentos antigos continuam a poder ser editados ou apagados.
//
//  NOVO NA v6 — PÁGINA PÚBLICA
//  • A leitura pública deixa de incluir nomes de proprietários e
//    inquilinos: a página do prédio mostra apenas o nº do apartamento.
//  • Inclui as despesas (data, descrição, categoria, valor) e os totais
//    mensais de entradas (quotas e contribuições, pela data de pagamento)
//    para o separador "Contas". As datas de cada pagamento continuam
//    privadas — só os totais do mês são públicos.
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

const VERSAO         = "v7.7";
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
  QVAL:     "💲 Valor da Quota",
  EXT:      "🏦 Extracto",
};

// Colunas de reconciliação com o extracto bancário (iguais nas três abas de movimentos)
const CAMPOS_REC = {
  idMov:        ["id_movimento", null],
  dataExtrato:  ["data_extrato", null],
  descExtrato:  ["descricao_extrato", null],
  valorMov:     ["valor_movimento_kz", null],
  canal:        ["canal", null],
  confianca:    ["confianca", null],
  notaRec:      ["nota_reconciliacao", null],
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
    ...CAMPOS_REC,
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
    ...CAMPOS_REC,
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
    ...CAMPOS_REC,
  }},
  AVISOS: { aba: ABA.AVISOS, hdr: 4, campos: {
    tipo:     ["tipo", 1],
    titulo:   ["titulo", 2],
    conteudo: ["conteudo", 3],
    data:     ["data", 4],
    autor:    ["autor", 5],
    id:       ["id", 6],
  }},
  QVAL: { aba: ABA.QVAL, hdr: 4, campos: {
    ano:   ["ano", 1],
    mes:   ["mes", 2],
    valor: ["valor_kz", 3],
  }},
};

// Campos gravados como número
const CAMPOS_NUM = ["valor", "mes", "ano", "valorPorFracao", "valorTotal", "valorMov"];

// Valores de canal: os antigos passam para a lista fixa
function normCanal(v) {
  const s = String(v || "").trim();
  const l = s.toLowerCase();
  if (!s) return "";
  if (l === "sebastião" || l === "sebastiao" || l === "gestor anterior") return "Gestor anterior";
  if (l.indexOf("isento") === 0) return "Isento";
  if (l === "numerário" || l === "numerario") return "Numerário";
  if (l === "banco") return "Banco";
  if (l === "acerto") return "Acerto";
  return s;
}
// Canal de um pagamento novo: Numerário fica logo marcado; os outros ficam "por conciliar"
function canalNovo(data) {
  if (data.canal) return normCanal(data.canal);
  return data.metodo === "Numerário" ? "Numerário" : undefined;
}
// Lê as colunas de reconciliação de uma linha (objecto de sheetToObjects)
function lerRec(o) {
  const vm = o["valor_movimento_kz"];
  return {
    idMov:       String(o["id_movimento"] || "").trim(),
    dataExtrato: o["data_extrato"] || "",
    descExtrato: o["descricao_extrato"] || "",
    valorMov:    vm === "" || vm === undefined ? null : num(vm),
    canal:       normCanal(o["canal"]),
    confianca:   o["confianca"] || "",
    notaRec:     o["nota_reconciliacao"] || "",
  };
}


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
    // Coluna em falta: cria-a no fim (nunca escreve na posição por omissão se lá estiver outra coluna)
    else if (criar) cols[k] = ensureColumn(sheet, esq.hdr, nome);
    else if (def && !headers[def - 1]) cols[k] = def;
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


// ── ABA VALOR DA QUOTA (cria se não existir) ─────────────────────
// ── ABA EXTRACTO (cria se não existir) ───────────────────────────
const EXT_COLS = ["num_doc", "data_mov", "data_valor", "pedido_num", "num_oper", "descricao", "valor_kz", "saldo_kz", "id_antigo", "importado_em"];
function ensureExtractoSheet() {
  let sheet = SS.getSheetByName(ABA.EXT);
  if (!sheet) {
    sheet = SS.insertSheet(ABA.EXT);
    sheet.getRange(1, 1).setValue("Movimentos do extracto bancário importados pela app (não editar à mão)").setFontWeight("bold");
    sheet.getRange(2, 1).setValue("Chave: num_doc (NUM. DOC. do banco). id_antigo = identificador usado antes (EXT-AAAAMMDD-NNN).");
    sheet.getRange(4, 1, 1, EXT_COLS.length).setValues([EXT_COLS]).setFontWeight("bold");
    sheet.getRange(5, 1, 1000, 5).setNumberFormat("@");   // num_doc, datas e números do banco como texto
  }
  return sheet;
}
function readExtracto() {
  return sheetToObjects(ABA.EXT).filter(m => m["num_doc"]).map(m => ({
    numDoc: String(m["num_doc"]).trim(), dataMov: m["data_mov"] || "", dataValor: m["data_valor"] || "",
    pedido: m["pedido_num"] || "", numOper: m["num_oper"] || "", descricao: m["descricao"] || "",
    valor: num(m["valor_kz"]), saldo: m["saldo_kz"] === "" ? null : num(m["saldo_kz"]), idAntigo: m["id_antigo"] || "",
  }));
}

function ensureQuotaSheet() {
  let sheet = SS.getSheetByName(ABA.QVAL);
  if (!sheet) {
    sheet = SS.insertSheet(ABA.QVAL);
    sheet.getRange(1, 1).setValue("Valor da quota mensal ao longo do tempo").setFontWeight("bold");
    sheet.getRange(2, 1).setValue("Cada linha vale a partir desse mês (ano, mês). Sem linhas, a app usa quota_mensal_kz das Configurações.");
    sheet.getRange(4, 1, 1, 3).setValues([["ano", "mes", "valor_kz"]]).setFontWeight("bold");
  }
  return sheet;
}

function readQuotaHistorico() {
  return sheetToObjects(ABA.QVAL)
    .map(h => ({ ano: parseInt(h["ano"]) || 0, mes: parseInt(h["mes"]) || 0, valor: num(h["valor_kz"]), _row: h._row, _sig: h._sig }))
    .filter(h => h.ano > 2000 && h.mes >= 1 && h.mes <= 12);
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
        ...lerRec(q),
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
        ...lerRec(p),
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
      ...lerRec(d),
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
      quotaHistorico: readQuotaHistorico(),
      fechadoAte:     fechoAte(),
      pagamento: {
        iban:       config["pagamento_iban"]       || "",
        titular:    config["pagamento_titular"]    || "",
        banco:      config["pagamento_banco"]      || "",
        descritivo: config["pagamento_descritivo"] || "",
        instrucoes: config["pagamento_instrucoes"] || "",
        telefone:   config["comprovativo_telefone"] || "",
      },
    },
    fracoes,
    pagamentosQuota:        quotasNorm,
    contribuicoes:          contribNorm,
    pagamentosContribuicao: pagContribNorm,
    despesas:               despesasNorm,
    avisos:                 avisosNorm,
    extracto:               readExtracto(),
    nibs:                   sheetToObjects("🔗 NIBs").filter(n => n["chave"]).map(n => ({ chave: String(n["chave"]).trim(), fracoes: String(n["fracoes"] || ""), nome: n["nome"] || "" })),
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
      quotaHistorico: d.config.quotaHistorico.map(h => ({ ano: h.ano, mes: h.mes, valor: h.valor })),
      pagamento:      d.config.pagamento,
    },
    // Sem nomes: a página pública mostra só o nº do apartamento (v6)
    fracoes: d.fracoes.map(f => ({
      id: f.id, numero: f.numero, andar: f.andar,
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
    despesas: d.despesas.map(x => ({
      id: x.id, data: x.data, valor: x.valor, descricao: x.descricao, categoria: x.categoria,
    })),
    entradasMensais: entradasMensais(d),
  };
}

// Totais de entradas por mês ("aaaa-mm"), pela data do pagamento.
// Quotas sem data usam o mês de referência. Isenções não contam.
function entradasMensais(d) {
  const m = {};
  const slot = k => (m[k] = m[k] || { mes: k, quotas: 0, contribuicoes: 0 });
  const chave = s => /^\d{4}-\d{2}/.test(String(s || "")) ? String(s).slice(0, 7) : "";
  d.pagamentosQuota.forEach(p => {
    if (p.metodo === "Isento") return;
    const k = chave(p.data) || (p.ano && p.mes ? p.ano + "-" + ("0" + p.mes).slice(-2) : "");
    if (k) slot(k).quotas += p.valor;
  });
  d.pagamentosContribuicao.forEach(p => {
    if (p.metodo === "Isento") return;
    const k = chave(p.data);
    if (k) slot(k).contribuicoes += p.valor;
  });
  return Object.keys(m).sort().map(k => m[k]);
}


// ════════════════════════════════════════════════════════════════
//  ESCRITA GENÉRICA
// ════════════════════════════════════════════════════════════════
// Acrescenta linhas. registos: [{campo: valor, ...}, ...]
function acrescentar(chave, registos) {
  if (!registos.length) return 0;
  const esq   = ESQUEMA[chave];
  const sheet = chave === "AVISOS" ? ensureAvisosSheet() : chave === "QVAL" ? ensureQuotaSheet() : getSheet(esq.aba);
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
  // Valores actuais da linha, por campo (para o registo e para o fecho de período)
  const cols  = resolverColunas(esq, sheet, false);
  const antes = {};
  Object.keys(cols).forEach(k => { if (cols[k] <= valores.length) antes[k] = normCell(valores[cols[k] - 1]); });
  LOG.antes = antes; LOG.aba = esq.aba; LOG.linha = row;
  return { sheet, row, esq, antes };
}

// Actualiza apenas os campos enviados, célula a célula (preserva fórmulas).
// validar(antes): verificação extra antes de gravar (ex.: período fechado).
function editar(chave, data, permitidos, validar) {
  const { sheet, row, esq, antes } = verificarLinha(chave, data._row, data._sig);
  if (validar) validar(antes);
  const cols = resolverColunas(esq, sheet, true);
  permitidos.forEach(k => {
    if (data[k] === undefined || !cols[k]) return;
    sheet.getRange(row, cols[k]).setValue(valorParaFolha(k, data[k]));
  });
  return row;
}

function apagar(chave, data, validar) {
  const { sheet, row, antes } = verificarLinha(chave, data._row, data._sig);
  if (validar) validar(antes);
  sheet.deleteRow(row);
  return row;
}

function exigir(cond, msg) { if (!cond) throw new Error(msg); }

function contribPorId(id) {
  const c = lerDados().contribuicoes.find(x => x.id === id);
  exigir(c, "Contribuição não encontrada. Actualize (↻) e tente de novo.");
  return c;
}

// Contribuição fechada: mantém o histórico, mas já não aceita novos pagamentos
function contribAberta(id) {
  const c = contribPorId(id);
  exigir(String(c.estado || "").trim().toLowerCase() !== "fechado",
    "A contribuição “" + c.titulo + "” está fechada e já não aceita pagamentos.");
  return c;
}

function numeroExiste(numero, excetoRow) {
  return readFracoes().some(f => String(f.numero).trim().toLowerCase() === String(numero).trim().toLowerCase()
                              && f._row !== parseInt(excetoRow));
}


// ════════════════════════════════════════════════════════════════
//  FECHO DE PERÍODO (G4)
// ════════════════════════════════════════════════════════════════
// Devolve "aaaa-mm" do último mês fechado, ou "".
function fechoAte() {
  const sheet = SS.getSheetByName(ABA.CONFIG);
  if (!sheet || sheet.getLastRow() < 5) return "";
  const data = sheet.getRange(5, 2, sheet.getLastRow() - 4, 2).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() !== "fechado_ate") continue;
    const v = data[i][1];
    if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM");
    const m = String(v || "").trim().match(/^(\d{4})-(\d{1,2})/);
    return m ? m[1] + "-" + ("0" + m[2]).slice(-2) : "";
  }
  return "";
}

function escreverConfig(chave, valor) {
  const sheet = getSheet(ABA.CONFIG);
  const last  = Math.max(sheet.getLastRow(), 4);
  if (last >= 5) {
    const ks = sheet.getRange(5, 2, last - 4, 1).getValues();
    for (let i = 0; i < ks.length; i++) {
      if (String(ks[i][0]).trim() === chave) { sheet.getRange(5 + i, 3).setValue(valor); return 5 + i; }
    }
  }
  sheet.getRange(last + 1, 2, 1, 2).setValues([[chave, valor]]);
  return last + 1;
}

// Mês de caixa de um registo (data do movimento; nas quotas sem data, o mês de referência)
function mesDoRegisto(o) {
  const d = String((o && o.data) || "");
  if (/^\d{4}-\d{2}/.test(d)) return d.slice(0, 7);
  if (o && parseInt(o.ano) > 2000 && parseInt(o.mes) >= 1) return o.ano + "-" + ("0" + parseInt(o.mes)).slice(-2);
  return "";
}

function exigirPeriodoAberto(k) {
  const f = fechoAte();
  if (!f || !k || k > f) return;
  const [a, m] = f.split("-");
  throw new Error("As contas estão fechadas até " + m + "/" + a + ". Este movimento é de " + k.slice(5, 7) + "/" + k.slice(0, 4) +
    " e já não pode ser alterado. Se for mesmo preciso, reabra o período em Gestão.");
}
// Para editar: a data antiga e a nova têm de estar em período aberto
function validarAberto(data) {
  return antes => { exigirPeriodoAberto(mesDoRegisto(antes)); if (data) exigirPeriodoAberto(mesDoRegisto(Object.assign({}, antes, data))); };
}


// ════════════════════════════════════════════════════════════════
//  REGISTO DE ALTERAÇÕES (G1)
// ════════════════════════════════════════════════════════════════
const LOG = { antes: null, aba: "", linha: "" };
const ABA_REGISTO = "🗒️ Registo";
const SEM_REGISTO = ["get_registo", "list_copias"];

// Troca valores numa coluna (por cabeçalho) de uma aba, de uma só vez. mapa: {antigo: novo}
function trocarNaColuna(nomeAba, hdr, cabecalho, mapa, soSeIgualA) {
  const sh = SS.getSheetByName(nomeAba);
  if (!sh || sh.getLastRow() <= hdr) return 0;
  const col = headersOf(sh, hdr).indexOf(cabecalho) + 1;
  if (!col) return 0;
  const n = sh.getLastRow() - hdr;
  const rg = sh.getRange(hdr + 1, col, n, 1);
  const v = rg.getValues();
  let mud = 0;
  for (let i = 0; i < n; i++) {
    const k = String(v[i][0]).trim();
    if (k && mapa[k] !== undefined) { v[i][0] = mapa[k]; mud++; }
  }
  if (mud) { rg.setNumberFormat("@"); rg.setValues(v); }
  return mud;
}

function registar(action, data, res) {
  try {
    let sheet = SS.getSheetByName(ABA_REGISTO);
    if (!sheet) {
      sheet = SS.insertSheet(ABA_REGISTO);
      sheet.getRange(1, 1).setValue("Registo de alterações feitas pela app (não editar)").setFontWeight("bold");
      sheet.getRange(4, 1, 1, 6).setValues([["data_hora", "accao", "aba", "linha", "antes", "dados"]]).setFontWeight("bold");
    }
    const limpo = {};
    Object.keys(data || {}).forEach(k => { if (k !== "_sig" && k !== "password") limpo[k] = data[k]; });
    // Importações grandes: no registo fica só o resumo
    if (Array.isArray(limpo.movimentos)) limpo.movimentos = limpo.movimentos.length + " movimentos";
    if (limpo.mapa && typeof limpo.mapa === "object") limpo.mapa = Object.keys(limpo.mapa).length + " identificadores";
    if (Array.isArray(limpo.ligar)) limpo.ligar = limpo.ligar.map(l => l.chave + " linha " + l._row + " → " + l.idMov);
    const corta = s => s.length > 40000 ? s.slice(0, 40000) + "…" : s;
    sheet.appendRow([
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
      action, LOG.aba || "", LOG.linha || (res && res.row) || "",
      LOG.antes ? corta(JSON.stringify(LOG.antes)) : "",
      corta(JSON.stringify(limpo)),
    ]);
  } catch (_) { /* o registo nunca impede a gravação */ }
}

function lerRegisto(n) {
  const sheet = SS.getSheetByName(ABA_REGISTO);
  if (!sheet || sheet.getLastRow() < 5) return [];
  const total = sheet.getLastRow() - 4, qtd = Math.min(n || 100, total);
  const vals = sheet.getRange(sheet.getLastRow() - qtd + 1, 1, qtd, 6).getValues();
  return vals.reverse().map(v => ({
    dataHora: v[0] instanceof Date ? Utilities.formatDate(v[0], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : String(v[0]),
    accao: String(v[1]), aba: String(v[2]), linha: String(v[3]), antes: String(v[4]), dados: String(v[5]),
  }));
}


// ════════════════════════════════════════════════════════════════
//  CÓPIAS DE SEGURANÇA (G3)
// ════════════════════════════════════════════════════════════════
const PASTA_COPIAS  = "Cópias de segurança";
const MANTER_COPIAS = 12;

function pastaCopias() {
  const pais = DriveApp.getFileById(SS.getId()).getParents();
  const pai  = pais.hasNext() ? pais.next() : DriveApp.getRootFolder();
  const it   = pai.getFoldersByName(PASTA_COPIAS);
  return it.hasNext() ? it.next() : pai.createFolder(PASTA_COPIAS);
}

function listarCopias() {
  const it = pastaCopias().getFiles();
  const r = [];
  while (it.hasNext()) { const f = it.next(); r.push({ nome: f.getName(), data: f.getDateCreated().toISOString(), url: f.getUrl(), id: f.getId() }); }
  return r.sort((a, b) => b.data.localeCompare(a.data));
}

// Também é chamada pelo accionador semanal (instalarCopiaSemanal)
function copiaSeguranca() {
  const pasta = pastaCopias();
  const nome  = SS.getName() + " — cópia " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH'h'mm");
  const f = DriveApp.getFileById(SS.getId()).makeCopy(nome, pasta);
  listarCopias().slice(MANTER_COPIAS).forEach(c => { try { DriveApp.getFileById(c.id).setTrashed(true); } catch (_) {} });
  PROPS.setProperty("ULTIMA_COPIA", new Date().toISOString());
  return { nome, url: f.getUrl() };
}

function copiaAutomaticaActiva() {
  return ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === "copiaSeguranca");
}

// Executar UMA VEZ no editor: autoriza o Drive e cria a cópia semanal (2ª feira, ~03h)
function instalarCopiaSemanal() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === "copiaSeguranca") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("copiaSeguranca").timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(3).create();
  Logger.log("✅ Cópia semanal activa. Primeira cópia: " + copiaSeguranca().nome);
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


// Executa a acção e guarda-a no registo de alterações (G1)
function executar(action, data) {
  LOG.antes = null; LOG.aba = ""; LOG.linha = "";
  const res = executarAccao(action, data);
  if (res && res.ok && SEM_REGISTO.indexOf(action) < 0) registar(action, data, res);
  return res;
}

function executarAccao(action, data) {
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
        fracao_ativa: data.fracao_ativa === "Não" ? "Não" : "Sim", exclui_quota: data.exclui_quota || "Não",
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
        "inq_nome", "inq_telefone", "inq_email", "inq_inicio_contrato", "fracao_ativa", "exclui_quota", "observacoes",
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
      exigirPeriodoAberto(String(data.data || hoje()).slice(0, 7));
      const row = acrescentar("QUOTAS", meses.map(m => ({
        fracao_numero: data.fracao_numero, data: data.data || hoje(), valor: m.valor,
        mes: m.mes, ano: m.ano, metodo: data.metodo || "",
        referencia: data.referencia || "", observacoes: data.observacoes || "",
        canal: canalNovo(data),
      })));
      return { ok: true, row, count: meses.length };
    }

    // Compatibilidade com a v4 (um só mês)
    case "add_pagamento_quota":
      return executarAccao("add_pagamentos_quota", {
        fracao_numero: data.fracao_numero, data: data.data, metodo: data.metodo,
        referencia: data.referencia, observacoes: data.observacoes,
        meses: [{ mes: parseInt(data.mes), ano: parseInt(data.ano), valor: data.valor }],
      });

    case "edit_pagamento_quota": {
      if (data.mes !== undefined) exigir(data.mes >= 1 && data.mes <= 12, "Mês inválido");
      const row = editar("QUOTAS", data, ["fracao_numero", "data", "valor", "mes", "ano", "metodo", "referencia", "observacoes", "canal", "idMov", "notaRec"], validarAberto(data));
      return { ok: true, row };
    }

    case "delete_pagamento_quota":
      return { ok: true, row: apagar("QUOTAS", data, validarAberto()) };

    case "add_isencoes_quota": {
      const meses = data.meses || [];
      exigir(data.fracao_numero, "Seleccione o apartamento");
      const row = acrescentar("QUOTAS", meses.map(m => ({
        fracao_numero: data.fracao_numero, data: hoje(), valor: 0,
        mes: m.mes, ano: m.ano, metodo: "Isento", referencia: data.motivo || "", observacoes: "",
      })));
      return { ok: true, row, count: meses.length };
    }

    // ── VALOR DA QUOTA (B1) ─────────────────────────────────────
    // valores = [{ano, mes, valor}, ...] — cada um vale a partir desse mês
    case "add_valor_quota": {
      const valores = data.valores || (data.ano ? [{ ano: data.ano, mes: data.mes, valor: data.valor }] : []);
      exigir(valores.length > 0, "Indique o valor e o mês");
      const existentes = readQuotaHistorico();
      valores.forEach(v => {
        exigir(parseInt(v.mes) >= 1 && parseInt(v.mes) <= 12 && parseInt(v.ano) > 2000, "Mês inválido");
        exigir(Number(v.valor) > 0, "O valor tem de ser maior que zero");
        exigirPeriodoAberto(parseInt(v.ano) + "-" + ("0" + parseInt(v.mes)).slice(-2));
        exigir(!existentes.some(h => h.ano === parseInt(v.ano) && h.mes === parseInt(v.mes)),
          "Já existe um valor para " + v.mes + "/" + v.ano);
      });
      const row = acrescentar("QVAL", valores.map(v => ({ ano: parseInt(v.ano), mes: parseInt(v.mes), valor: Number(v.valor) })));
      return { ok: true, row, count: valores.length };
    }

    case "delete_valor_quota":
      return { ok: true, row: apagar("QVAL", data, a => exigirPeriodoAberto(mesDoRegisto({ ano: a.ano, mes: a.mes }))) };

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
      const c = contribAberta(data.contribuicao_id);
      exigirPeriodoAberto(String(data.data || hoje()).slice(0, 7));
      const row = acrescentar("PGC", [{
        contribuicao_titulo: c.titulo, contribuicao_id: c.id,
        fracao_numero: data.fracao_numero, data: data.data || hoje(), valor: data.valor || 0,
        metodo: data.metodo || "", referencia: data.referencia || "", observacoes: data.observacoes || "",
        canal: canalNovo(data),
      }]);
      return { ok: true, row };
    }

    case "add_pagamento_contribuicao_bulk": {
      exigir(data.contribuicao_id, "Seleccione a contribuição");
      const c = contribAberta(data.contribuicao_id);
      const numeros = data.fracao_numeros || [];
      exigir(numeros.length > 0, "Seleccione pelo menos um apartamento");
      exigirPeriodoAberto(String(data.data || hoje()).slice(0, 7));
      const row = acrescentar("PGC", numeros.map(n => ({
        contribuicao_titulo: c.titulo, contribuicao_id: c.id,
        fracao_numero: n, data: data.data || hoje(), valor: data.valor_por_fracao || 0,
        metodo: data.metodo || "", referencia: "", observacoes: "",
        canal: canalNovo(data),
      })));
      return { ok: true, row, count: numeros.length };
    }

    case "edit_pagamento_contribuicao": {
      if (data.contribuicao_id !== undefined) data.contribuicao_titulo = contribPorId(data.contribuicao_id).titulo;
      const row = editar("PGC", data, ["contribuicao_id", "contribuicao_titulo", "fracao_numero", "data", "valor", "metodo", "referencia", "observacoes", "canal", "idMov", "notaRec"], validarAberto(data));
      return { ok: true, row };
    }

    case "delete_pagamento_contribuicao":
      return { ok: true, row: apagar("PGC", data, validarAberto()) };

    // ── DESPESAS ────────────────────────────────────────────────
    case "add_despesa": {
      exigir(data.data, "Indique a data");
      exigir(String(data.descricao || "").trim(), "Indique a descrição");
      exigirPeriodoAberto(String(data.data).slice(0, 7));
      const row = acrescentar("DESPESAS", [{
        data: data.data, valor: data.valor, descricao: data.descricao, categoria: data.categoria || "Outros",
        fornecedor: data.fornecedor || "", numFatura: data.numFatura || "",
        pagoPor: data.pagoPor || "", observacoes: data.observacoes || "",
        canal: data.canal ? normCanal(data.canal) : undefined,
      }]);
      return { ok: true, row };
    }

    case "edit_despesa":
      return { ok: true, row: editar("DESPESAS", data, ["data", "valor", "descricao", "categoria", "fornecedor", "numFatura", "observacoes", "canal", "idMov", "notaRec"], validarAberto(data)) };

    case "delete_despesa":
      return { ok: true, row: apagar("DESPESAS", data, validarAberto()) };

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

    // ── GESTÃO: fecho de período, registo, cópias (G1, G3, G4) ──
    // ── CONCILIAÇÃO: importar extracto (fase 2) ─────────────────
    // movimentos = [{numDoc, dataMov, dataValor, pedido, numOper, descricao, valor, saldo, idAntigo}]
    case "importar_extracto": {
      const movs = data.movimentos || [];
      exigir(movs.length > 0, "O ficheiro não tem movimentos");
      movs.forEach(m => exigir(String(m.numDoc || "").trim(), "Há movimentos sem NUM. DOC."));
      const sh = ensureExtractoSheet();
      const existentes = {};
      readExtracto().forEach(m => { existentes[m.numDoc] = true; });
      const agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
      const novos = movs.filter(m => !existentes[String(m.numDoc).trim()]);
      if (novos.length) {
        const linhas = novos.map(m => [String(m.numDoc).trim(), m.dataMov || "", m.dataValor || "", String(m.pedido || ""), String(m.numOper || ""),
          m.descricao || "", Number(m.valor) || 0, m.saldo === null || m.saldo === undefined ? "" : Number(m.saldo), m.idAntigo || "", agora]);
        const ini = nextEmptyRow(sh, 5);
        sh.getRange(ini, 1, linhas.length, 5).setNumberFormat("@");
        sh.getRange(ini, 1, linhas.length, EXT_COLS.length).setValues(linhas);
      }
      LOG.aba = ABA.EXT;
      return { ok: true, novos: novos.length, repetidos: movs.length - novos.length };
    }

    // Propostas aceites (fase 3)
    //   ligar: [{chave:"QUOTAS"|"PGC"|"DESPESAS", _row, _sig, idMov, dataExtrato, descExtrato, valorMov, canal, confianca, notaRec}]
    //   criar: {QUOTAS:[{fracao_numero, data, valor, mes, ano, ...rec}], PGC:[{contribuicao_id, fracao_numero, data, valor, ...rec}], DESPESAS:[{data, valor, descricao, categoria, ...rec}]}
    case "conciliar": {
      const REC = ["idMov", "dataExtrato", "descExtrato", "valorMov", "canal", "confianca", "notaRec"];
      const ligar = data.ligar || [], criar = data.criar || {};
      exigir(ligar.length || Object.keys(criar).some(k => (criar[k] || []).length), "Nada para gravar");
      // 1) verificar todas as linhas antes de escrever
      const alvo = ligar.map(l => {
        exigir(["QUOTAS", "PGC", "DESPESAS"].indexOf(l.chave) >= 0, "Tipo inválido");
        exigir(String(l.idMov || "").trim(), "Falta o movimento");
        const v = verificarLinha(l.chave, l._row, l._sig);
        return { l, v };
      });
      alvo.forEach(({ l, v }) => {
        const cols = resolverColunas(v.esq, v.sheet, true);
        REC.forEach(k => { if (l[k] !== undefined && cols[k]) v.sheet.getRange(v.row, cols[k]).setValue(valorParaFolha(k, k === "canal" ? normCanal(l[k]) : l[k])); });
      });
      // 2) criar os registos em falta (já ligados ao movimento)
      const q = criar.QUOTAS || [], pc = criar.PGC || [], de = criar.DESPESAS || [];
      [...q, ...pc, ...de].forEach(x => exigirPeriodoAberto(String(x.data || "").slice(0, 7)));
      q.forEach(x => exigir(x.fracao_numero && x.mes >= 1 && x.mes <= 12 && x.ano > 2000 && Number(x.valor) > 0, "Quota inválida"));
      if (q.length) acrescentar("QUOTAS", q.map(x => Object.assign({ metodo: "Transferência", referencia: x.idMov, observacoes: "" }, x, { canal: "Banco" })));
      if (pc.length) acrescentar("PGC", pc.map(x => {
        const c = contribAberta(x.contribuicao_id);
        return Object.assign({ metodo: "Transferência", referencia: x.idMov, observacoes: "" }, x, { contribuicao_titulo: c.titulo, canal: "Banco" });
      }));
      if (de.length) acrescentar("DESPESAS", de.map(x => Object.assign({ categoria: "Outros", fornecedor: "", numFatura: "", pagoPor: "", observacoes: "" }, x, { canal: "Banco" })));
      LOG.aba = "Conciliação";
      return { ok: true, ligados: alvo.length, criados: q.length + pc.length + de.length };
    }

    // mapa = {"EXT-20240919-002": "259282390", ...}
    case "converter_ids_movimento": {
      const mapa = data.mapa || {};
      exigir(Object.keys(mapa).length > 0, "Nada para converter");
      Object.keys(mapa).forEach(k => exigir(/^EXT-\d{8}-\d+$/.test(k) && String(mapa[k]).trim(), "Identificador inválido: " + k));
      const res = {};
      [[ABA.QUOTAS, 4], [ABA.PGC, 4], [ABA.DESPESAS, 4]].forEach(([aba, hdr]) => {
        res[aba] = trocarNaColuna(aba, hdr, "id_movimento", mapa) + trocarNaColuna(aba, hdr, "referencia_doc", mapa);
      });
      // Guarda o id antigo na aba Extracto
      const sh = SS.getSheetByName(ABA.EXT);
      if (sh && sh.getLastRow() >= 5) {
        const inv = {}; Object.keys(mapa).forEach(k => { inv[String(mapa[k]).trim()] = k; });
        const n = sh.getLastRow() - 4;
        const docs = sh.getRange(5, 1, n, 1).getValues(), ant = sh.getRange(5, 9, n, 1).getValues();
        let mud = false;
        for (let i = 0; i < n; i++) { const d = String(docs[i][0]).trim(); if (inv[d] && !ant[i][0]) { ant[i][0] = inv[d]; mud = true; } }
        if (mud) sh.getRange(5, 9, n, 1).setValues(ant);
      }
      LOG.antes = { convertidos: Object.keys(mapa).length };
      return { ok: true, linhas: res };
    }

    case "set_fecho": {
      const ate = String(data.ate || "").trim();
      exigir(!ate || /^\d{4}-\d{2}$/.test(ate), "Mês inválido");
      LOG.antes = { fechado_ate: fechoAte() }; LOG.aba = ABA.CONFIG;
      escreverConfig("fechado_ate", ate ? "'" + ate : "");
      return { ok: true, fechadoAte: ate };
    }

    case "get_registo":
      return { ok: true, registo: lerRegisto(parseInt(data.n) || 150) };

    case "list_copias":
      return { ok: true, copias: listarCopias(), ultima: PROPS.getProperty("ULTIMA_COPIA") || "", automatica: copiaAutomaticaActiva() };

    case "backup_agora":
      return Object.assign({ ok: true }, copiaSeguranca());

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

function testeCopias() {
  Logger.log(JSON.stringify({ copias: listarCopias().length, automatica: copiaAutomaticaActiva() }));
}

function testePassword() {
  Logger.log(getPassword() ? "✅ Palavra-passe configurada" : "❌ Falta GESTOR_PASSWORD nas Propriedades do script");
}
