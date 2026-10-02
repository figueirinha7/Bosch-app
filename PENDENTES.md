# Condomínio — Pendentes e histórico

Lista de trabalho da app (Vercel, endereço oficial: bosch-app.vercel.app) e do Apps Script
(`apps-script/Code.gs`). Actualizar sempre que uma versão for publicada.

## 🧪 v7.7 (branch `beta`, ainda não no `main`) — conciliação com o banco, fase 3

**Mexe no Apps Script:** colar o novo `Code.gs` e publicar *Nova versão*.

- *Gestão → Conciliação → Propor correspondências*: para cada movimento do extracto ainda sem ligação, a app propõe:
  - **Ligar** a pagamentos ou despesas já registados sem movimento, que somem o valor ao kwanza (registos do mesmo dia primeiro, até 10 dias de diferença);
  - **Criar** os registos em falta quando sabe de que apartamento é: quotas em falta mais antigas, depois contribuições abertas, depois adiantamento de quotas;
  - **Despesas**: ligar a despesas sem movimento (também saídas divididas em várias despesas) ou criar uma nova (com categoria);
  - **Manual**: quando não sabe quem pagou (ex.: "Transferência" sem NIB), o gestor escolhe o apartamento e a app refaz a proposta.
- Confiança: *Confirmado* (NIB conhecido, ≤3 dias), *Alta*, *Média*. Vêm marcadas só as de confiança alta; nada é gravado até "Gravar seleccionadas".
- **Livro de NIBs aprendido** das ligações já feitas (NIB, ou nome do ordenante quando não há NIB; grupos como 0/6/8/9 incluídos). Lê também a aba **"🔗 NIBs"** (cabeçalho na linha 4: `chave` = NIB de 21 dígitos ou `NOME:…`, `fracoes` = ex. `6,8,9`, `nome`), se existir — para completar com o `Etapa2_Livro_de_IBANs_v3.xlsx`.
- Apps Script: acção `conciliar` grava tudo de uma vez (verifica todas as linhas antes; registos novos respeitam o fecho de período e só em contribuições abertas).
- Testado com a folha beta e o extracto: 44 de 45 ligações propostas correctas; a outra (movimento sem NIB conhecido) ficou como *Média*, desmarcada.

## 🧪 v7.6 (branch `beta`, ainda não no `main`) — conciliação com o banco, fase 2

**Mexe no Apps Script:** colar o novo `Code.gs` e publicar *Nova versão*.

- *Gestão → Conciliação → Importar extracto (.xlsx)*: lê o ficheiro "Movimentos" do banco no próprio navegador, mostra um resumo (movimentos novos, já importados, período, saldo final) e só grava ao confirmar.
- Nova aba **"🏦 Extracto"** (criada na primeira importação): um movimento por linha, chave `num_doc` (NUM. DOC. do banco). Importar o mesmo ficheiro outra vez não duplica.
- Na primeira importação, os `id_movimento` antigos (`EXT-AAAAMMDD-NNN`) passam a `NUM. DOC.` nas três abas (e no `referencia_doc` quando era igual); só quando a data do id coincide com a do movimento nessa posição. O id antigo fica guardado na aba Extracto (`id_antigo`).
- Comparação com o **SALDO do extracto**: aviso no topo (igual / diferença) e coluna "Extracto" na tabela mês a mês.
- Lista de **movimentos do extracto por identificar** (sem registo da app ligado). Para ligar à mão: editar o pagamento/despesa e escrever o NUM. DOC. em "Movimento do banco".
- Nova dependência `read-excel-file` (0 vulnerabilidades), carregada só ao importar.
- Testado com o extracto (407 movimentos, 407 ids convertíveis, saldo final 352 390) e a folha beta.

## 🧪 v7.5 (branch `beta`, ainda não no `main`) — conciliação com o banco, fase 1

**Mexe no Apps Script:** colar o novo `Code.gs` na folha e publicar *Nova versão* (beta primeiro; real só antes do merge).

- Lê as colunas de reconciliação (`id_movimento`, `data_extrato`, `descricao_extrato`, `valor_movimento_kz`, `canal`, `confianca`, `nota_reconciliacao`) das abas de quotas, pagamentos de contribuições e despesas. **Só para o gestor** (as descrições têm NIBs e nomes); a página pública não as recebe.
- `canal`: Banco, Numerário, Gestor anterior, Isento, Acerto ("Sebastião" e "Isento (app)" são lidos como Gestor anterior e Isento). Pagamentos registados em Numerário ficam logo com canal Numerário.
- Estado de cada registo: **no banco** (tem movimento), **fora do banco** (numerário, gestor anterior, acerto), **por conciliar**, isento. Sinal no histórico de quotas (com filtro), no detalhe de cada mês, nos pagamentos de contribuições e nas despesas; ponto laranja no mapa de quotas nos meses por conciliar.
- Editar um pagamento ou despesa permite mudar o canal, o movimento do banco e a nota.
- *Gestão → Conciliação com o banco*: saldo no banco pelos movimentos ligados + entradas/despesas sem movimento + movimentos partilhados = saldo da app; comparação mês a mês (últimos 12 meses); lista do que está sem movimento.
- **Correcção:** uma coluna que não existe numa aba passa a ser criada no fim, em vez de se usar a posição por omissão. Na folha beta a aba Fracções não tem `exclui_quota` e a app escrevia por cima de `observacoes`. **Confirmar se a folha real tem a coluna `exclui_quota`.**
- Verificado com a folha beta e o extracto: 407 movimentos ligados; saldo do banco reconstruído = 352 390 (igual ao extracto, também em Dez/2025 e Ago/2026); diferença de 35 000 = quotas da fracção 32 em numerário.

## 🧪 v7.4 (branch `beta`, ainda não no `main`) — nome do responsável pelo pagamento

- Nos ecrãs de cobrança aparece o **responsável**: o inquilino, se existir; senão, o proprietário. Painel (A cobrar e detalhes), Quotas (mapa, histórico, detalhe do mês), escolha do apartamento ao registar, Contribuições (pagamentos, lançar para vários, quem não participa), recibo e lista de atrasos.
- Continuam a mostrar os dois: Apartamentos, detalhe do apartamento, extracto e formulário. Lembretes por WhatsApp mantêm um botão para cada um.
- Só app; o Apps Script não muda.

## ✅ v7.3 (no `main` desde 02/10/2026, PR #8) — título e cabeçalho da página pública

- Título da aba do navegador: "Portal do Condomínio - Prédio da Bosch".
- Cabeçalho da página pública com a fachada do prédio (mural) à direita, "Portal do Condomínio" em destaque e faixa com as cores do mural, que fica fixa por cima dos separadores ao fazer scroll. Mesma altura do anterior; a morada aparece só em ecrãs largos. Proposta escolhida: A + faixa da C (Claude Design).
- Só app; o Apps Script não muda.

## ✅ v7.2 (no `main` desde 02/10/2026, PR #7) — estatísticas de visitas

- Vercel Web Analytics (`@vercel/analytics`): visitantes, páginas vistas, país, dispositivo e origem (ex.: WhatsApp). Sem cookies; o endereço vai sem parâmetros (não revela `?apt=` nem `?setup`).
- Para funcionar: no Vercel, projecto → separador **Analytics** → **Enable**. Os dados aparecem nesse separador depois do merge para o `main`.
- Só app; o Apps Script não muda.

## ✅ v7.1 (no `main` desde 01/10/2026, PR #6) — A3, A4, C3, D3

Só app: o Apps Script continua o da v7 (não é preciso publicar nada no Google).

- **A3** Os cartões do painel abrem o detalhe do mês: *Cobrança* (quem pagou, quem falta, com Registar), *Saldo* (conta do mês e movimentos) e *Despesas* (por categoria e lista).
- **A4** "Inactivo" também na escolha do apartamento do extracto, no próprio extracto e na lista de quem não participa numa contribuição.
- **C3** Aviso em destaque no topo da página pública (o mais recente dos últimos 30 dias). Cada morador pode fechá-lo; volta a aparecer quando há um aviso novo.
- **D3** Botão "Partilhar PDF" em todos os relatórios (mensal, anual, extracto, atrasos, recibo e o relatório público). No telemóvel abre o menu de partilha (WhatsApp, email…); onde isso não existe, descarrega o PDF. As bibliotecas de PDF só são carregadas quando se carrega no botão.

## ✅ Feito na v7 (no `main` desde 01/10/2026, PR #5) — A1, A2, B1, C1, C2, D1, G1, G3, G4 + relatório por trimestre

**Publicar o Apps Script v7 numa folha (real ou beta), por esta ordem:**
1. Colar o novo `Code.gs` no Apps Script da folha e guardar.
2. **Antes de publicar**, no editor escolher a função `instalarCopiaSemanal` e carregar em *Executar*. Aceitar as permissões (Drive e accionadores). Sem este passo a v7 pede autorizações novas e a app pode deixar de ligar.
3. *Implementar → Gerir implementações → editar → Nova versão* (o URL mantém-se).
4. Opcional (C2), na aba ⚙️ Configurações acrescentar as chaves: `pagamento_iban`, `pagamento_titular`, `pagamento_banco`, `pagamento_descritivo` (ex.: `Quota apt {apt}`), `pagamento_instrucoes`, `comprovativo_telefone`. São públicas.

Por fazer depois do merge: criar a release `v7` no GitHub (*Releases → Draft a new release*, tag `v7` a partir do `main`).

- **A1** "Em dívida (total)" com "De onde vem": quotas + contribuições **abertas**, por contribuição e por apartamento, e o que não conta (fechadas, inactivos, isentos, meses por vencer).
- **A2** Apartamentos inactivos (`fracao_ativa` = Não): "Inactivo" no gestor e na página pública; sem dívida, fora da cobrança e das contribuições. Editável no formulário do apartamento ("Apartamento activo").
- **B1** Valor da quota ao longo do tempo: *Quotas → Mais → Valor da quota*. Nova aba "💲 Valor da Quota" (criada no primeiro registo). O primeiro valor novo guarda também o valor antigo desde o início, para os meses antigos não mudarem.
- **C1** Página pública: "Este é o meu apartamento" (fica guardado no telemóvel) e link pessoal `?apt=3B`.
- **C2** "Como pagar": IBAN, titular, banco e descritivo com o nº do apartamento (botões Copiar), instruções e "Enviar comprovativo ao gestor" por WhatsApp.
- **D1** Recibo de pagamento de quota: aparece depois de registar ("Recibo" no aviso), no mapa de quotas e no histórico. Imprimir/PDF e envio por WhatsApp.
- **G1** Registo de alterações: aba "🗒️ Registo" com cada gravação (e os valores antes, em edições e apagamentos). Consultável em *Gestão*.
- **G3** Cópias de segurança: pasta "Cópias de segurança" ao lado da folha, cópia semanal automática (2ª feira) e "Fazer cópia agora" em *Gestão*. Ficam as últimas 12.
- **Relatório anual com corte** (pedido extra): opção "Período" — ano completo, até ao fim de um trimestre (Mar/Jun/Set) ou de qualquer mês. Totais, mês a mês, despesas e contribuições param nesse mês; os atrasos são os que existiam no fim desse mês.
- **G4** Fecho de período em *Gestão*: quotas, contribuições e despesas com data até ao mês fechado deixam de poder ser criadas, alteradas ou apagadas (app e Apps Script). Chave `fechado_ate` na aba Configurações.

## ✅ Contribuições fechadas (app + Code.gs)

**Antes de publicar:** actualizar o Apps Script com o novo `Code.gs` e publicar
uma *Nova versão* na mesma implementação (o URL não muda). Sem este passo a app
já esconde e bloqueia as fechadas, mas o servidor ainda aceitaria pagamentos.

- Novo "Fechar contribuição" / "Reabrir contribuição" no menu "Mais" de cada cartão (com confirmação). Usa o campo Estado que já existia ("Fechado").
- Fechada: deixa de aceitar pagamentos (registar, lançar para vários e isentar), tanto na app como no Apps Script.
- Fechada: o que falta pagar deixa de contar como dívida (painel, "A cobrar", apartamentos, página pública, extracto, lista de atrasos).
- Mantém o histórico, datas, prazo, valor total e os pagamentos feitos (continuam no saldo em caixa). Os pagamentos antigos podem ser editados ou apagados.
- Gestor: fechadas no fim da lista, esbatidas, com a etiqueta "Fechada".
- Página pública: fechadas escondidas atrás de "Mostrar fechadas".
- Relatório anual: coluna "Falta" com "—" e estado "Fechado".

## ✅ Feito na v6 (app + Code.gs) — revisão UI/UX

**Antes de publicar:** actualizar o Apps Script com o novo `Code.gs` e fazer
*Implementar → Gerir implementações → editar (lápis) → Versão: Nova versão*.
Assim o URL não muda. Sem este passo a app funciona, mas o separador "Contas"
fica vazio e a página pública continua a receber os nomes.

**Erros corrigidos**
- Relatório mensal mostrava só o primeiro pagamento de cada apartamento (pagamentos em duas partes apareciam a menos na tabela).
- Etiquetas de atraso incoerentes: agora 1 mês = Pendente, 2–3 = Em atraso, 4+ = Grande atraso, em toda a app.
- O contador do separador Avisos não batia com a lista; conta agora os avisos dos últimos 30 dias (todos os tipos), os mesmos marcados "Novo".

**Morador (página pública)**
- Quotas: grelha do prédio por andar, só com o nº do apartamento; tocar num apartamento mostra os meses em falta e o valor.
- Privacidade: a leitura pública do Apps Script deixa de enviar nomes de proprietários e inquilinos (também nas Contribuições e em "Ver o meu apartamento").
- Novo separador Contas: saldo em caixa, conta do mês (saldo inicial + entradas − despesas), despesas por categoria e relatório do mês (sem nomes) para imprimir/PDF.
- Quotas e Contribuições continuam em separadores distintos.
- Cabeçalho sem gradiente, hora de actualização legível, "Área do gestor" no rodapé.

**Gestor**
- Painel do mês: cobrança (apts que pagaram, cobrado vs esperado), saldo em caixa, despesas do mês, dívida total, lista "A cobrar" com lembrete/detalhe/registar, saldo dos últimos 12 meses e últimos lançamentos.
- Quotas: mapa apartamentos × meses (pago, parcial, em falta, isento, por vencer); tocar num mês para registar, isentar, editar ou apagar. O histórico em lista continua em "Mais".
- Registar pagamento com os meses em botões (os em falta vêm seleccionados), valor calculado e repartido pelo que falta em cada mês, "Registar e novo".
- Telemóvel: barra de navegação em baixo, botão "Registar" sempre visível, apartamentos e despesas em cartões.
- Confirmações dentro da app (acabaram os `window.confirm`); apagar oferece "Anular" (volta a criar o registo).
- Contribuições: registar, lançar para vários e isentar dentro de cada cartão, com a grelha de quem já pagou.
- Cabeçalho: "Ver página pública" e menu da conta (actualizar, partilhar link, configurar ligação, terminar sessão).
- Escolher apartamento com pesquisa por nº ou nome, com a situação ao lado.
- Erros de validação junto ao campo, com o cursor posto lá.
- Partilhar aviso por WhatsApp (depois de publicar e em cada aviso).
- Despesas: resumo por categoria que segue os filtros.
- Aviso 10 minutos antes de a sessão terminar; o formulário aberto fica guardado e pode ser retomado depois de entrar.
- Acções raras (isentar, histórico) passam para menus "Mais".

**Relatórios**
- Separador Relatórios com pré-visualização; imprimir / guardar PDF a partir dela (já não abre janela nem imprime sozinho).
- Mensal: conta do mês (saldo inicial, entradas, saídas, saldo final), cobrança do mês, entradas pela data do pagamento (uma linha por pagamento, ou agrupadas), saídas com resumo por categoria, atrasos acumulados com meses, valores e proprietário/inquilino.
- Anual: acumulado do ano (anos anteriores + ano), mês a mês com saldo em caixa e quotas pagas, despesas por categoria, estado das contribuições.
- Novos: extracto por apartamento e lista de atrasos.
- Sem emojis, sinais + / −, nº de página, cabeçalho de tabela repetido, bloco de aprovação em assembleia (opcional).
- Caixa vs cobrança separados: entradas e saldo contam pela data em que o dinheiro entrou; a cobrança conta pelo mês de referência. O gráfico de entradas/despesas do painel usa também a data.

**Transversal**
- Cores em variáveis CSS; cinzentos e âmbar mais escuros (contraste ≥ 4,5:1); vermelho reservado para dívida (nºs de apartamento a escuro).
- Ícones de traço em vez de emojis; botões só com ícone têm nome para leitores de ecrã.
- Botões com pelo menos 44 px de altura no telemóvel.
- Modais fecham com Esc, prendem o foco e devolvem-no ao fechar; rótulos ligados aos campos.
- Carregamento com a estrutura da página em vez de só um spinner.
- Código dividido em ficheiros: `lib.js` (cálculos), `ui.jsx` (componentes e estilos), `Publico.jsx`, `Gestor.jsx`, `Relatorios.jsx` e `relatoriosHtml.js`.

## ✅ Feito na v5 (app + Code.gs)

**Erros corrigidos**
- Registar quota sem mexer nas listas Mês/Ano gravava o pagamento sem mês de referência.
- A data "Actualizado" da página pública mostrava sempre a data de hoje; passa a mostrar a hora da última leitura real (e avisa quando está sem ligação).
- Validações em todos os formulários (apartamento, valores, datas, títulos, duplicados).
- Datas passam a usar a hora local (antes usava UTC; entre as 00:00 e a 01:00 dava o dia anterior).

**Segurança (ponto 2)**
- O `API_SECRET` deixou de existir: não há nada secreto no código do site.
- Login do gestor validado no Apps Script; devolve uma sessão de 8 horas usada em todas as gravações.
- Palavra-passe nas Propriedades do Script (`GESTOR_PASSWORD`); a da folha fica só como recurso temporário.
- Bloqueio de 10 minutos após 5 tentativas erradas.
- Leitura pública sem telefones, emails, NIF, datas/referências de pagamento nem palavra-passe. Os dados completos só chegam com uma sessão de gestor válida.
- Mudar a palavra-passe termina todas as sessões abertas.

**Pendentes P3, P4, P5**
- P3: gráfico "Receitas vs Despesas" inclui os pagamentos de contribuições.
- P4: editar apartamento grava NIF, emails, início do contrato e observações.
- P5: contribuições ligadas por `id` (colunas `id` e `contribuicao_id` criadas automaticamente); mudar o título já não desliga os pagamentos.

**Funcionalidades**
- Editar e apagar lançamentos (quotas, isenções, contribuições, pagamentos de contribuições, despesas, avisos). Antes de gravar, o script confirma que a linha não foi alterada entretanto na folha.
- Lembretes por WhatsApp aos devedores (proprietário e/ou inquilino), com a mensagem já escrita.
- Pagar vários meses de uma vez (repartido pelos meses; sugere automaticamente os meses em falta).
- Aviso de pagamento duplicado (quotas e contribuições).
- Filtros e pesquisa nas tabelas; na página pública, "Ver o meu apartamento".

## 🕒 Pendentes para próximas versões

Cada item tem um código (ex.: **B2**) para pedir alterações directamente.
✅ = já no `main` · 🧪 = feito no `beta`, à espera de teste e merge. Os códigos mantêm-se para não baralhar referências.
Próximos sugeridos: 1) A5, G5 (pequenos) · 2) C5, D2, F1 · 3) B3, E1–E4 · 4) G2, F2, F3, D4 · Performance da base de dados (ver nota).

### A. Números e estados (fiabilidade)

- ✅ **A1. Rever o "Em dívida (total)" do painel do gestor** (`src/Gestor.jsx`, `totQ`/`totC`): não se percebe de onde sai o valor (ex.: 1 930 000 Kz = Quotas 650 000 + Contribuições 1 280 000). Deve ser só dívida de quotas + dívida das contribuições **abertas**; confirmar que as fechadas não entram e mostrar o detalhe (tocar no cartão → lista por apartamento/contribuição).
- ✅ **A2. Apartamentos inactivos** (`fracao_ativa`): devem aparecer como "Inactivo" (e não "Em dia") no separador Apartamentos do gestor e na grelha de Quotas da página pública; não devem gerar dívida nem contar em "A cobrar" / cobrança esperada. O Apps Script já envia `ativa`, falta a app usá-lo.
- ✅ **A3. Detalhe em todos os números do painel**: tocar em cobrança, saldo em caixa, despesas, etc. abre a lista que dá origem ao valor.
- ✅ **A4. Estados coerentes em toda a app** (activo / inactivo / sem quota mensal) no painel, grelhas, relatórios, página pública e lembretes.
- **A5. Multa por atraso** (`multa_atraso_pct`): calcular e mostrar separada da quota.
- **A8. Conciliação com o banco — fases 2 e 3** (fase 1 na v7.5). Decisões tomadas: chave dos movimentos = `NUM. DOC.` do extracto (o `NUM. OPER.` não é único); livro de NIBs importado na fase 3 (de `Etapa2_Livro_de_IBANs_v3.xlsx`); canal com lista fixa; fracção 0 mantém os "recebimentos não identificados".
  - ✅ **Fase 2 (feita na v7.6):** importar o extracto (.xlsx "Movimentos", cabeçalho na linha 7) para uma aba "🏦 Extracto" sem duplicar; converter os `id_movimento` antigos (`EXT-AAAAMMDD-NNN`) para `NUM. DOC.`; lista de movimentos por identificar; comparação com o SALDO do extracto.
  - ✅ **Fase 3 (feita na v7.7):** aba "🔗 NIBs" (NIB/nome → apartamento ou grupo: 0/6/8/9, 4/5, 24/25, 26/27, 34/35) que a app aprende; propostas de correspondência (ligar a registos existentes, criar em falta, mostrar registos sem movimento), também para despesas.
- **A7. Histórico do apartamento**: registar entradas e saídas de inquilinos (e mudanças de proprietário) com datas, e saber quem era o responsável em cada mês (para recibos, extractos e dívidas antigas). Por desenhar.
- **A6. Data real da última alteração no cabeçalho público**: hoje "Actualizado …" mostra a hora da leitura (o script devolve `new Date()` em cada pedido), por isso aparece sempre a data do dia. Passar a mostrar quando a folha foi alterada pela última vez (data de modificação do ficheiro no Drive, inclui edições à mão) com o texto "Dados de …"; sem ligação continua "Sem ligação". Mexe no `Code.gs` (nova versão a publicar) e no cabeçalho; ~0,1–0,3 s a mais por leitura. Estimativa: ~3–4% da v7.

### B. Regras de quotas

- ✅ **B1. Histórico do valor da quota**: hoje há um único `quota_mensal_kz`; se a quota subir, os meses antigos passam a ser calculados pelo valor novo. Guardar valores com data de início.
- **B2. Quota diferente por apartamento** (tipologia / permilagem), se aplicável ao prédio.
- **B3. Crédito / pagamento adiantado**: o que se paga a mais fica como crédito e é abatido automaticamente nos meses seguintes.

### C. Morador (página pública)

- ✅ **C1. Visão pessoal do morador** (mockups M0/M1 da revisão UI/UX): escolher o apartamento uma vez, ficar guardado no telemóvel (ou link `?apt=3B`) e abrir logo na situação pessoal — "login único e visão única".
- ✅ **C2. Como pagar**: IBAN, titular, descritivo a usar e botão para enviar o comprovativo ao gestor (precisa de novos campos na aba ⚙️ Configurações).
- ✅ **C3. Aviso em destaque** no topo da página pública (último aviso dos últimos 30 dias).
- **C4. Instalar no telemóvel (PWA)**: `manifest.json` e ícone para "Adicionar ao ecrã principal".
- **C5. Histórico pessoal**: o morador vê os pagamentos que fez e descarrega os recibos.

### D. Documentos e comprovativos

- ✅ **D1. Recibo de pagamento** para imprimir ou enviar por WhatsApp depois de registar uma quota.
- **D2. Anexar factura a despesas e comprovativo a pagamentos** (foto/PDF no Google Drive).
- ✅ **D3. Partilhar relatório em PDF directamente** (hoje: imprimir → Guardar como PDF → partilhar).
- **D4. Arquivo de documentos** na página pública: actas, regulamento, seguros, contratos.

### E. Finanças do condomínio

- **E1. Outras receitas** além de quotas e contribuições (aluguer de espaços, juros, reembolsos).
- **E2. Orçamento anual** vs real, por categoria.
- **E3. Fundo de reserva** separado do saldo corrente.
- **E4. Despesas recorrentes** (limpeza, água, luz) com lembrete ou lançamento automático.
- **E5. Fornecedores**: contactos, contratos e histórico de pagamentos.

### F. Comunicação

- **F1. Lembretes em lote**: preparar as mensagens de WhatsApp para todos os devedores de uma vez, filtradas por nível de atraso.
- **F2. Assembleias**: convocatória, ordem de trabalhos, presenças e votações, com a acta ligada ao aviso.
- **F3. Ocorrências / manutenção**: o morador reporta um problema (elevador, fuga de água) e o gestor acompanha o estado.
- **F4. Botão "Abrir grupo de pagamentos"** no cartão "Como pagar": abre o link de convite de um grupo de WhatsApp (nova chave, ex.: `comprovativo_grupo`). O WhatsApp não permite mensagem pré-escrita para grupos; quem abre o link entra no grupo e passa a ver os comprovativos e números dos outros.

### G. Gestão e segurança

- ✅ **G1. Registo de alterações**: quem criou, editou ou apagou o quê e quando.
- **G2. Vários utilizadores com perfis** (gestor, tesoureiro, só leitura para a comissão de fiscalização).
- ✅ **G3. Cópia de segurança automática** da folha (cópia periódica no Drive).
- ✅ **G4. Fecho de mês / ano**: bloquear edições em períodos já aprovados em assembleia.
- **G5. Apagar ou arquivar apartamentos** (hoje só se cria e edita).

## 📌 Notas

- A palavra-passe do gestor deve estar só em Apps Script → Definições do projecto → Propriedades do script → `GESTOR_PASSWORD`. Depois de a configurar, apagar `gestor_password` da aba ⚙️ Configurações (o script só usa a da folha quando a propriedade não existe). Confirmar antes com a função `testePassword` no editor ("✅ Palavra-passe configurada"). Fazer o mesmo na folha beta.
- **Performance (avaliado em 01/10/2026, não feito):** o volume do prédio é pequeno para o Google Sheets; a lentidão vem de cada gravação fazer 3 pedidos ao Apps Script (gravar + reler dados do gestor + reler dados públicos). Ordem sugerida: 1) medir em *Apps Script → Execuções*; 2) a gravação devolver os dados actualizados (uma releitura em vez de duas); 3) cache da leitura pública no script; 4) evitar leituras repetidas dentro do script. Mudar de base de dados não compensa.
- Linhas escritas à mão na folha continuam a funcionar: contribuições novas recebem `id` e pagamentos com o título de uma contribuição são ligados automaticamente na leitura seguinte.
