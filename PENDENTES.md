# Condomínio — Pendentes e histórico

Lista de trabalho da app (Vercel: bosch-app-4xip.vercel.app) e do Apps Script
(`apps-script/Code.gs`). Actualizar sempre que uma versão for publicada.

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

- **Rever o "Em dívida (total)" do painel do gestor** (`src/Gestor.jsx`, `totQ`/`totC`): não se percebe de onde sai o valor (ex.: 1 930 000 Kz = Quotas 650 000 + Contribuições 1 280 000). Deve ser só dívida de quotas + dívida das contribuições **abertas**; confirmar que as fechadas não entram e mostrar o detalhe (tocar no cartão → lista por apartamento/contribuição).
- **Visão pessoal do morador** (mockups M0/M1 da revisão UI/UX): escolher o apartamento uma vez, ficar guardado no telemóvel (ou link `?apt=3B`) e abrir logo na situação pessoal — "login único e visão única".
- **Como pagar** na página pública: IBAN, titular, descritivo a usar e botão para enviar o comprovativo ao gestor (precisa de novos campos na aba ⚙️ Configurações).
- **Aviso em destaque** no topo da página pública (último aviso dos últimos 30 dias).
- **Instalar no telemóvel (PWA)**: `manifest.json` e ícone para "Adicionar ao ecrã principal".
- **Recibo de pagamento** para imprimir ou enviar por WhatsApp depois de registar uma quota.
- **Partilhar relatório em PDF directamente** (hoje: imprimir → Guardar como PDF → partilhar).
- **Usar campos da folha que a app ainda ignora:**
  - `multa_atraso_pct` → calcular multa por atraso;
  - `fracao_ativa` → apartamentos inactivos devem aparecer como "Inactivo" (e não "Em dia") no separador Apartamentos do gestor e na grelha de Quotas da página pública; não devem gerar dívida nem contar em "A cobrar" / cobrança esperada. O Apps Script já envia `ativa`, falta a app usá-lo.
- **Anexar factura** a uma despesa (foto/PDF no Google Drive).
- Apagar apartamentos (hoje só se cria e edita).

## 📌 Notas

- A palavra-passe do gestor deve estar só em Apps Script → Definições do projecto → Propriedades do script → `GESTOR_PASSWORD`. Depois de a configurar, apagar `gestor_password` da aba ⚙️ Configurações.
- Linhas escritas à mão na folha continuam a funcionar: contribuições novas recebem `id` e pagamentos com o título de uma contribuição são ligados automaticamente na leitura seguinte.
