# Condomínio — Pendentes e histórico

Lista de trabalho da app (Vercel: bosch-app-4xip.vercel.app) e do Apps Script
(`apps-script/Code.gs`). Actualizar sempre que uma versão for publicada.

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

- **Recibo de pagamento** para imprimir ou enviar por WhatsApp depois de registar uma quota.
- **Usar campos da folha que a app ainda ignora:**
  - `multa_atraso_pct` → calcular multa por atraso;
  - `fracao_ativa` → esconder apartamentos inactivos.
- **Anexar factura** a uma despesa (foto/PDF no Google Drive).
- Apagar apartamentos (hoje só se cria e edita).

## 📌 Notas

- A palavra-passe do gestor deve estar só em Apps Script → Definições do projecto → Propriedades do script → `GESTOR_PASSWORD`. Depois de a configurar, apagar `gestor_password` da aba ⚙️ Configurações.
- Linhas escritas à mão na folha continuam a funcionar: contribuições novas recebem `id` e pagamentos com o título de uma contribuição são ligados automaticamente na leitura seguinte.
