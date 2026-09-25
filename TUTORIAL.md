# Tutorial — Sistema Bio Cell

**Prontuário Eletrônico e Controle de Estoque de Células-Tronco**

---

## 1. Acesso ao sistema

Abra o navegador e acesse:

**https://biocell-mu.vercel.app**

Na tela de login, digite seu e-mail e senha.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador (Matriz) | admin@biocell.com | biocell123 |
| Profissional | joao@clinilab.com | biocell123 |
| Gestora de Unidade | maria@clinilab.com | biocell123 |

O **Administrador** enxerga todas as 74 unidades (matriz + 73 UABCs). Os demais perfis veem apenas a unidade a que estão vinculados.

---

## 2. Dashboard

Após o login, você verá o painel principal com:

- **Unidades Ativas** — total de UABCs cadastradas no sistema
- **Pacientes** — quantidade de animais registrados
- **Prontuários** — total de prontuários criados
- **Prontuários Recentes** — últimos atendimentos com nome do paciente e status (Aberto / Concluído)
- **Patologias Tratadas** — ranking das patologias mais frequentes nos prontuários
- **Estoque por Unidade** — quantidade de palhetas disponíveis em cada UABC

Todos os números atualizam em tempo real conforme novos prontuários e movimentações de estoque são registrados.

---

## 3. Prontuários

No menu lateral, clique em **Prontuários** para ver a lista de todos os prontuários da sua unidade.

### Criar novo prontuário

1. Clique em **"Novo Prontuário"**
2. Selecione a **Unidade** (UABC) onde o atendimento será realizado
3. Selecione o **Paciente** (animal já cadastrado)
4. Preencha os dados do tratamento:
   - Patologia diagnosticada
   - Quantidade de células
   - Via de aplicação
   - Doadores
   - Se o soro foi coletado
5. Preencha as **aplicações** (1ª a 4ª) conforme o protocolo de tratamento
6. Preencha os **descongelamentos** (palhetas descongeladas e local de retirada)
7. Clique em **Salvar**

### Concluir prontuário (baixa automática de estoque)

Quando o tratamento estiver finalizado:

1. Abra o prontuário desejado
2. Clique em **"Concluir Prontuário"**
3. Selecione o **lote** de células utilizado
4. Informe a **quantidade de palhetas** consumidas
5. Confirme a conclusão

Ao concluir, o sistema dá baixa automática no estoque daquela unidade. Não é necessário fazer a baixa manualmente — o registro de consumo é criado com rastreabilidade completa (quem, quando, qual lote, qual prontuário).

---

## 4. Pacientes

No menu lateral, clique em **Pacientes**.

- Veja a lista de animais cadastrados na sua unidade
- Clique em um paciente para ver seus dados e histórico de prontuários
- Clique em **"Novo Paciente"** para cadastrar um animal

Dados necessários para o cadastro:

- **Animal:** nome, espécie (canino, felino, equino), raça, peso
- **Tutor:** nome do responsável legal, telefone, e-mail
- **Atendimento:** veterinário responsável, clínica

---

## 5. Estoque

No menu lateral, clique em **Estoque**.

O painel de estoque mostra:

- **Total de palhetas** disponíveis no sistema
- **Lotes ativos** com número do lote, produto e data de vencimento
- **Saldo por unidade** — tabela com o estoque atual de cada UABC
- **Movimentações recentes** — entradas, consumos, descartes e ajustes

Cada movimentação registra: tipo (Recebimento, Consumo, Descarte, Ajuste), quantidade, quem realizou e quando.

O estoque funciona como um livro-razão: cada movimento é registrado individualmente e o saldo é sempre a soma de todos os movimentos. Isso garante rastreabilidade total de cada palheta.

Quando o estoque de uma unidade fica abaixo do mínimo configurado, o sistema gera um alerta automático.

---

## 6. Unidades, Relatórios e Alertas

### Unidades

Clique em **Unidades** no menu lateral para ver todas as 74 unidades (73 UABCs + Matriz), organizadas por estado, com nome, cidade, espécies atendidas, endereço e telefone.

### Relatórios

Clique em **Relatórios** para ver estatísticas consolidadas: total de prontuários e pacientes, ranking de patologias mais tratadas e distribuição por unidade.

### Alertas

Clique em **Alertas** para ver notificações automáticas geradas pelo sistema:

- Estoque abaixo do mínimo configurado em uma UABC
- Lote próximo do vencimento

Alertas podem ser marcados como **resolvidos** após a ação corretiva.

---

## 7. Perfis de acesso e fluxo de trabalho

| Perfil | O que pode fazer |
| --- | --- |
| Administrador | Vê todas as unidades, todo o estoque, todos os prontuários. Controle total do sistema. |
| Gestor de Unidade | Vê apenas sua UABC. Gerencia estoque e prontuários da unidade. |
| Profissional | Cria e preenche prontuários na sua unidade. |
| Estoque | Gerencia movimentações de estoque (recebimentos, ajustes) na sua unidade. |

### Fluxo principal

1. Cadastrar o paciente (animal)
2. Criar o prontuário vinculado ao paciente
3. Preencher os dados do tratamento (patologia, aplicações, descongelamentos)
4. Concluir o prontuário selecionando o lote e a quantidade de palhetas
5. O sistema dá baixa automática no estoque da unidade
6. A Matriz acompanha tudo em tempo real pelo Dashboard

Em caso de dúvidas ou problemas, entre em contato com o desenvolvedor responsável pelo sistema.
