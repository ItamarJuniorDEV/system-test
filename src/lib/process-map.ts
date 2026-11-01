/**
 * Mapa funcional da referência FoccoLOJAS, adaptado ao escopo de uma loja.
 * O bloco 10 (Fiscal) está excluído. IDs preservam a rastreabilidade da pesquisa.
 * dependencies expressa conexões entre blocos, não uma sequência obrigatória.
 * phase é prioridade de implementação; status só muda com evidência registrada.
 * Fontes, notas e hashes: docs/referencia/fontes.json.
 */
export type ProcessModuleStatus = "planned" | "partial" | "implemented";

export type ProcessModule = {
  id: string;
  name: string;
  group: string;
  description: string;
  features: string[];
  dependencies: string[];
  sources: { id: number; title: string; url: string }[];
  phase: number;
  status: ProcessModuleStatus;
  notes: string[];
};

export const PROCESS_MODULES: ProcessModule[] = [
  {
    id: "01",
    name: "Clientes e relacionamento",
    group: "Vender",
    description:
      "Identificar clientes, contatos, responsáveis e oportunidades de uma única loja.",
    features: [
      "Cadastro e edição de cliente com identificação e contatos",
      "Vínculo do cliente com projetos e histórico operacional",
      "Visitas, prospecção e carteira",
      "Especificadores, parceiros e indicações",
      "Fidelidade por cadastro e origem do cliente",
      "Pipeline comercial e previsão de fechamento",
    ],
    dependencies: ["13"],
    sources: [
      {
        id: 31114802885649,
        title: "FoccoLOJAS - Programas - Comercial - Vendas - Clientes",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114802885649-FoccoLOJAS-Programas-Comercial-Vendas-Clientes",
      },
      {
        id: 31115312153489,
        title: "FoccoLOJAS - Ficha Completa de Cliente",
        url: "https://suporte.promob.com/hc/pt-br/articles/31115312153489-FoccoLOJAS-Ficha-Completa-de-Cliente",
      },
      {
        id: 31115328556305,
        title: "FoccoLOJAS - Programas - Comercial - Vendas - Especificadores",
        url: "https://suporte.promob.com/hc/pt-br/articles/31115328556305-FoccoLOJAS-Programas-Comercial-Vendas-Especificadores",
      },
      {
        id: 31114213483537,
        title:
          "FoccoLOJAS - Programas - Avançado - Comercial - Níveis de Fidelidade",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114213483537-FoccoLOJAS-Programas-Avan%C3%A7ado-Comercial-N%C3%ADveis-de-Fidelidade",
      },
      {
        id: 49192062260881,
        title: "FoccoLOJAS - Pipeline | Painel de Projetos",
        url: "https://suporte.promob.com/hc/pt-br/articles/49192062260881-FoccoLOJAS-Pipeline-Painel-de-Projetos",
      },
    ],
    phase: 2,
    status: "partial",
    notes: [
      "A classificação do cliente e a fidelidade do especificador são controles diferentes; os gatilhos do pipeline dependem da configuração.",
      "Definir a política de duplicidade de CPF/CNPJ e os campos obrigatórios da loja.",
      "Carteira, fidelidade e gatilhos avançados permanecem planejados.",
      "Núcleo desta fatia entregue parcialmente. A lista de funcionalidades descreve o mapa completo, não uma lista de entregas concluídas; extensões avançadas e conectores externos permanecem planejados.",
    ],
  },
  {
    id: "02",
    name: "Projetos e negociação",
    group: "Vender",
    description:
      "Organizar projetos, ambientes, itens e versões de orçamento, com importação XML verificável.",
    features: [
      "Projeto vinculado ao cliente",
      "Ambientes e itens com quantidade e preço",
      "Importação de XML sintético com prévia e erros",
      "Orçamento com totais e desconto explícitos",
      "Vários cenários e versões de orçamento",
      "Itens avulsos e venda simplificada",
      "Tabelas e formação de preço por fornecedor",
      "Despesas, juros, envolvidos e comissionados",
      "Itens especiais e alçadas de desconto",
      "Demonstração, venda futura e devolução comercial",
    ],
    dependencies: ["01", "13"],
    sources: [
      {
        id: 31114181027089,
        title: "FoccoLOJAS - Programas - Comercial - Vendas - Projetos",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114181027089-FoccoLOJAS-Programas-Comercial-Vendas-Projetos",
      },
      {
        id: 31112331228689,
        title:
          "FoccoLojas - Programas - Comercial - Gestão - Tabela de Preços de Loja",
        url: "https://suporte.promob.com/hc/pt-br/articles/31112331228689-FoccoLojas-Programas-Comercial-Gest%C3%A3o-Tabela-de-Pre%C3%A7os-de-Loja",
      },
      {
        id: 31114194767761,
        title:
          "FoccoLOJAS - Programas - Comercial - Financeiro - Formação de Preço",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114194767761-FoccoLOJAS-Programas-Comercial-Financeiro-Forma%C3%A7%C3%A3o-de-Pre%C3%A7o",
      },
      {
        id: 31113830062609,
        title:
          "FoccoLOJAS - Programas - Avançado - Comercial - Layout de Importação",
        url: "https://suporte.promob.com/hc/pt-br/articles/31113830062609-FoccoLOJAS-Programas-Avan%C3%A7ado-Comercial-Layout-de-Importa%C3%A7%C3%A3o",
      },
      {
        id: 49360032858385,
        title:
          "FoccoLOJAS - Programas - Comercial - Gestão - Solicitações de Itens Especiais",
        url: "https://suporte.promob.com/hc/pt-br/articles/49360032858385-FoccoLOJAS-Programas-Comercial-Gest%C3%A3o-Solicita%C3%A7%C3%B5es-de-Itens-Especiais",
      },
      {
        id: 31115308739473,
        title:
          "FoccoLOJAS - Programas - Comercial - Financeiro - Limites de Desconto",
        url: "https://suporte.promob.com/hc/pt-br/articles/31115308739473-FoccoLOJAS-Programas-Comercial-Financeiro-Limites-de-Desconto",
      },
      {
        id: 31113835761041,
        title: "FoccoLOJAS - Processos - Devolução",
        url: "https://suporte.promob.com/hc/pt-br/articles/31113835761041-FoccoLOJAS-Processos-Devolu%C3%A7%C3%A3o",
      },
    ],
    phase: 2,
    status: "partial",
    notes: [
      "O projeto pode ter vários orçamentos. Layouts de importação são específicos; importação XML e integração API Promob são caminhos diferentes.",
      "O XML inicial é uma fixture sintética; compatibilidade com exportação real depende de arquivos fornecidos e validados.",
      "Decidir arredondamento, atualização de versões e reimportação antes de aceitar XML real.",
      "Política de crédito/reembolso na devolução comercial precisa ser definida para este produto.",
      "Núcleo desta fatia entregue parcialmente. A lista de funcionalidades descreve o mapa completo, não uma lista de entregas concluídas; extensões avançadas e conectores externos permanecem planejados.",
    ],
  },
  {
    id: "03",
    name: "Contratos e aprovações",
    group: "Vender",
    description:
      "Formalizar o orçamento aprovado e registrar decisões comerciais e financeiras com responsáveis.",
    features: [
      "Contrato originado do orçamento escolhido",
      "Decisão de aprovação com ator, data e motivo",
      "Estados de assinatura e liberação separados",
      "Cancelamento com análise dos vínculos",
      "Cláusulas, modelos e impressão de documentos",
      "Assinatura externa pelo DocSeguro",
      "Checklists e aprovações por alçada",
      "Contrato complementar ligado à revisão",
      "Distrato e tratamento de obrigações pendentes",
    ],
    dependencies: ["02", "09", "13"],
    sources: [
      {
        id: 31113939460753,
        title: "FoccoLOJAS - Programas - Comercial - Vendas - Contratos",
        url: "https://suporte.promob.com/hc/pt-br/articles/31113939460753-FoccoLOJAS-Programas-Comercial-Vendas-Contratos",
      },
      {
        id: 31114803810065,
        title:
          "FoccoLOJAS - Programas - Comercial - Vendas - Assinatura Eletrônica de Documentos",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114803810065-FoccoLOJAS-Programas-Comercial-Vendas-Assinatura-Eletr%C3%B4nica-de-Documentos",
      },
      {
        id: 31114261462289,
        title:
          "FoccoLOJAS - Programas - Sistema - Configurações - Financeiro - Configurações do Financeiro",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114261462289-FoccoLOJAS-Programas-Sistema-Configura%C3%A7%C3%B5es-Financeiro-Configura%C3%A7%C3%B5es-do-Financeiro",
      },
      {
        id: 31112431320977,
        title:
          "FoccoLojas - Processos - Comercial - Venda - Contrato - Cancelamento do Contrato com Pré Pedidos",
        url: "https://suporte.promob.com/hc/pt-br/articles/31112431320977-FoccoLojas-Processos-Comercial-Venda-Contrato-Cancelamento-do-Contrato-com-Pr%C3%A9-Pedidos",
      },
      {
        id: 31115322015121,
        title:
          "FoccoLOJAS - Programas - Financeiro - Gestão - Liberação Financeira",
        url: "https://suporte.promob.com/hc/pt-br/articles/31115322015121-FoccoLOJAS-Programas-Financeiro-Gest%C3%A3o-Libera%C3%A7%C3%A3o-Financeira",
      },
    ],
    phase: 3,
    status: "partial",
    notes: [
      "Assinatura, liberação comercial e liberação financeira são controles distintos. A liberação financeira pode ser automática; exigir essa liberação para revisar é opcional.",
      "Fixar os parâmetros da loja que tornam cada liberação obrigatória, automática ou dispensada.",
      "Assinatura interna de demonstração não equivale a assinatura eletrônica validada por provedor.",
      "Núcleo desta fatia entregue parcialmente. A lista de funcionalidades descreve o mapa completo, não uma lista de entregas concluídas; extensões avançadas e conectores externos permanecem planejados.",
    ],
  },
  {
    id: "04",
    name: "Revisão técnica",
    group: "Executar",
    description:
      "Revisar cada ambiente, comparar o vendido ao revisado e controlar diferenças antes da compra aplicável.",
    features: [
      "Revisor e situação por ambiente",
      "Conferência dos itens e valores",
      "Registro de conclusão e histórico",
      "Comparação de snapshots e reativação de versões",
      "Negociação e contratos complementares",
      "Liberação de diferenças por alçada",
      "Divisão, unificação, cancelamento e reversão de ambientes",
      "Revisão inicial/executiva de venda futura",
      "Integração Promob e migração de projetos legados",
    ],
    dependencies: ["02", "03", "13"],
    sources: [
      {
        id: 40799016253841,
        title: "FoccoLOJAS - Pós-Vendas - Revisão de Ambientes API",
        url: "https://suporte.promob.com/hc/pt-br/articles/40799016253841-FoccoLOJAS-P%C3%B3s-Vendas-Revis%C3%A3o-de-Ambientes-API",
      },
      {
        id: 41070712550801,
        title: "FoccoLOJAS - Pós-Venda - Revisões de Projeto - Importação XML",
        url: "https://suporte.promob.com/hc/pt-br/articles/41070712550801-FoccoLOJAS-P%C3%B3s-Venda-Revis%C3%B5es-de-Projeto-Importa%C3%A7%C3%A3o-XML",
      },
      {
        id: 31114577637009,
        title:
          "FoccoLOJAS - Programas - Pós-Venda - Revisões - Revisão de Ambientes",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114577637009-FoccoLOJAS-Programas-P%C3%B3s-Venda-Revis%C3%B5es-Revis%C3%A3o-de-Ambientes",
      },
      {
        id: 31114561429905,
        title:
          "FoccoLOJAS - Programas - Pós-Venda - Revisões - Manutenção de Ambientes",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114561429905-FoccoLOJAS-Programas-P%C3%B3s-Venda-Revis%C3%B5es-Manuten%C3%A7%C3%A3o-de-Ambientes",
      },
      {
        id: 31112258334737,
        title:
          "FoccoLOJAS - Comparar versões da Revisão de Ambientes - Planejados",
        url: "https://suporte.promob.com/hc/pt-br/articles/31112258334737-FoccoLOJAS-Comparar-vers%C3%B5es-da-Revis%C3%A3o-de-Ambientes-Planejados",
      },
    ],
    phase: 4,
    status: "partial",
    notes: [
      "A negociação da diferença pode bloquear alterações até assinatura ou cancelamento do complemento. Dividir exige percentuais totalizando 100%; unificar exige o mesmo contrato. Avulsos não devem herdar indiscriminadamente a revisão de planejados.",
      "Concluída Parcial aparece em ações do help, mas não em toda enumeração de estados; confirmar o comportamento antes de reproduzir.",
      "Não derivar estrutura interna do banco apenas do nome dos campos do help.",
      "Comparação disponível entre itens do orçamento contratado e snapshot da revisão vigente, por ambiente, com versões, inclusões, remoções, alterações, variantes, quantidades e valores antes/depois. Filtro e paginação preservam os totais conciliados; correspondências ambíguas ficam explícitas. Seleção de qualquer par de revisões históricas, reativação e complementos continuam planejados.",
      "Núcleo desta fatia entregue parcialmente. A lista de funcionalidades descreve o mapa completo, não uma lista de entregas concluídas; extensões avançadas e conectores externos permanecem planejados.",
    ],
  },
  {
    id: "05",
    name: "Compras e fornecedores",
    group: "Executar",
    description:
      "Registrar fornecedores e pedidos, acompanhar envio e receber quantidades com estados separados.",
    features: [
      "Fornecedor e itens do pedido",
      "Pedido manual ou originado da revisão",
      "Envio registrado e recebimento parcial",
      "Vínculo com obrigação a pagar quando configurado",
      "Catálogos, máscaras e tabelas de compra",
      "Alçadas, metas e condições de pagamento",
      "Pedidos por assistência, venda futura e compra avulsa",
      "Consulta de status e parcelas da fábrica",
      "Cancelamento e reabertura conforme origem",
      "Supplier Portal, FoccoERP e Web Service",
    ],
    dependencies: ["04", "09", "13"],
    sources: [
      {
        id: 31113817118097,
        title: "FoccoLOJAS - Processos - Processos de Compras",
        url: "https://suporte.promob.com/hc/pt-br/articles/31113817118097-FoccoLOJAS-Processos-Processos-de-Compras",
      },
      {
        id: 31114390670865,
        title:
          "FoccoLOJAS - Programas - Compras - Pedidos de Compra - Geração e Envio",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114390670865-FoccoLOJAS-Programas-Compras-Pedidos-de-Compra-Gera%C3%A7%C3%A3o-e-Envio",
      },
      {
        id: 31114383417873,
        title:
          "FoccoLOJAS - Programas - Compras - Pedidos de Compra - Pedido de Compra",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114383417873-FoccoLOJAS-Programas-Compras-Pedidos-de-Compra-Pedido-de-Compra",
      },
      {
        id: 31112877701137,
        title: "FoccoLOJAS - Processos - Integração com o Supplier Portal",
        url: "https://suporte.promob.com/hc/pt-br/articles/31112877701137-FoccoLOJAS-Processos-Integra%C3%A7%C3%A3o-com-o-Supplier-Portal",
      },
      {
        id: 31114389541393,
        title:
          "FoccoLOJAS - Programas - Compras - Pedidos de Compra - Atendimento",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114389541393-FoccoLOJAS-Programas-Compras-Pedidos-de-Compra-Atendimento",
      },
      {
        id: 51677040693265,
        title:
          "FoccoLOJAS - Programas - Compras - Pedidos de Compra – Cancelar Pedido de Compra",
        url: "https://suporte.promob.com/hc/pt-br/articles/51677040693265-FoccoLOJAS-Programas-Compras-Pedidos-de-Compra-Cancelar-Pedido-de-Compra",
      },
      {
        id: 31114561282705,
        title:
          "FoccoLOJAS - Programas - Pós-Venda - Entrega e Montagem - Consultar Pedidos na Fábrica",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114561282705-FoccoLOJAS-Programas-P%C3%B3s-Venda-Entrega-e-Montagem-Consultar-Pedidos-na-F%C3%A1brica",
      },
    ],
    phase: 4,
    status: "partial",
    notes: [
      "Compra avulsa e assistência podem originar pedidos sem a mesma revisão de um planejado. Supplier Portal tem fluxo próprio. Consultar parcelas na fábrica pode recriar previsões em aberto; não é apenas uma leitura de status.",
      "Conector externo depende de contrato técnico, credenciais autorizadas e ambiente de teste.",
      "Nesta fatia, cancelamento exige motivo e é bloqueado por recebimento, entrega ou baixas não estornadas; preserva o histórico. Nova revisão, compra ou reserva exige contrato ativo. Um pedido já existente em draft pode ter o envio local registrado após conclusão do contrato e ser recebido depois, mantendo assinatura e ambas as aprovações; isso não envia comunicação externa.",
      "Núcleo desta fatia entregue parcialmente. A lista de funcionalidades descreve o mapa completo, não uma lista de entregas concluídas; extensões avançadas e conectores externos permanecem planejados.",
    ],
  },
  {
    id: "06",
    name: "Estoque e recebimento",
    group: "Executar",
    description:
      "Controlar saldo, movimentos, reservas e recebimentos físicos de uma única loja.",
    features: [
      "Entrada operacional por recebimento",
      "Saldo por produto/local",
      "Histórico de movimentos",
      "Reserva e liberação de quantidade",
      "Conferência de volumes e etiquetas",
      "Vários almoxarifados dentro da mesma loja",
      "Conversão de unidades e máscaras",
      "Inventário, ajustes e fechamento/reabertura de períodos",
      "Controle de estoque negativo e fracionado",
      "Transferências internas entre locais",
    ],
    dependencies: ["05", "13"],
    sources: [
      {
        id: 31113765831313,
        title: "FoccoLOJAS - Processos - Processo de Movimentação de Estoque",
        url: "https://suporte.promob.com/hc/pt-br/articles/31113765831313-FoccoLOJAS-Processos-Processo-de-Movimenta%C3%A7%C3%A3o-de-Estoque",
      },
      {
        id: 33774366330769,
        title:
          "FoccoLOJAS - Programas – Compras - Estoque - Reservas de Estoque",
        url: "https://suporte.promob.com/hc/pt-br/articles/33774366330769-FoccoLOJAS-Programas-Compras-Estoque-Reservas-de-Estoque",
      },
      {
        id: 31114389719569,
        title: "FoccoLOJAS - Programas - Compras - Estoque - Movimentação",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114389719569-FoccoLOJAS-Programas-Compras-Estoque-Movimenta%C3%A7%C3%A3o",
      },
      {
        id: 31114349053073,
        title: "FoccoLOJAS - Programas - Compras",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114349053073-FoccoLOJAS-Programas-Compras",
      },
      {
        id: 31114389294353,
        title: "FoccoLOJAS - Programas - Compras - Estoque - Almoxarifados",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114389294353-FoccoLOJAS-Programas-Compras-Estoque-Almoxarifados",
      },
      {
        id: 31114388481297,
        title:
          "FoccoLOJAS - Programas - Compras - Cadastros Gerais - Itens Cadastro Completo",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114388481297-FoccoLOJAS-Programas-Compras-Cadastros-Gerais-Itens-Cadastro-Completo",
      },
    ],
    phase: 5,
    status: "partial",
    notes: [
      "Atendimento do pedido, entrada em estoque e reserva são estados diferentes. No produto de referência, movimentos dependem de parâmetros do item/documento. Neste escopo, a entrada é operacional e não emite ou importa documento fiscal.",
      "Confirmar unidade de medida, custo e regra de arredondamento por produto.",
      "Inventário fechado, custo médio e conversões avançadas permanecem planejados até verificação específica.",
      "Núcleo desta fatia entregue parcialmente. A lista de funcionalidades descreve o mapa completo, não uma lista de entregas concluídas; extensões avançadas e conectores externos permanecem planejados.",
    ],
  },
  {
    id: "07",
    name: "Agendas, entrega e montagem",
    group: "Executar",
    description:
      "Agendar entrega, montagem, medição e serviços e registrar execução, responsáveis e pendências.",
    features: [
      "Compromisso vinculado ao cliente/ambiente",
      "Responsável, data e situação",
      "Conclusão ou cancelamento com justificativa",
      "Consulta da agenda e histórico",
      "Equipes, habilitações e permissões de agenda",
      "Checklists condicionais de entrega e montagem",
      "Check-in, check-out e questionários",
      "Despesas e geração de comissão por execução",
      "Controle específico de entrega de avulsos",
      "Reagendamento e acompanhamento de prazos",
    ],
    dependencies: ["01", "03", "06", "13"],
    sources: [
      {
        id: 31114334539793,
        title: "FoccoLOJAS - Programas - Agendas",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114334539793-FoccoLOJAS-Programas-Agendas",
      },
      {
        id: 31114577074321,
        title: "FoccoLOJAS - Programas - Pós-Venda - Entrega e Montagem",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114577074321-FoccoLOJAS-Programas-P%C3%B3s-Venda-Entrega-e-Montagem",
      },
      {
        id: 40392771438737,
        title:
          "FoccoLOJAS - Pós-Venda - Como criar e concluir Agendas de Entrega e Montagem",
        url: "https://suporte.promob.com/hc/pt-br/articles/40392771438737-FoccoLOJAS-P%C3%B3s-Venda-Como-criar-e-concluir-Agendas-de-Entrega-e-Montagem",
      },
      {
        id: 31114456614033,
        title:
          "FoccoLOJAS - Programas - Pós Venda - Entrega e Montagem - Controle de Entregas",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114456614033-FoccoLOJAS-Programas-P%C3%B3s-Venda-Entrega-e-Montagem-Controle-de-Entregas",
      },
      {
        id: 31114351948945,
        title: "FoccoLOJAS - Programas - Agendas - Agendamentos - Compromissos",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114351948945-FoccoLOJAS-Programas-Agendas-Agendamentos-Compromissos",
      },
    ],
    phase: 5,
    status: "partial",
    notes: [
      "A montagem verifica entrega quando existe agenda de entrega, além dos checklists exigidos. Cancelamento de entrega/montagem exige justificativa. Não há evidência suficiente para presumir otimização automática de rotas.",
      "Definir quais serviços exigem checklist, disponibilidade e conclusão prévia.",
      "Aplicativo nativo, geolocalização e roteirização não estão comprovados pela simples existência da agenda web.",
      "Núcleo desta fatia entregue parcialmente. A lista de funcionalidades descreve o mapa completo, não uma lista de entregas concluídas; extensões avançadas e conectores externos permanecem planejados.",
    ],
  },
  {
    id: "08",
    name: "Assistência técnica",
    group: "Executar",
    description:
      "Tratar problemas e ocorrências, definindo pagador, serviço e eventual reposição.",
    features: [
      "Abertura da assistência e ocorrências",
      "Cliente e contrato opcional",
      "Pagador, responsável e situação",
      "Encerramento com solução registrada",
      "Visitas e agendamentos técnicos",
      "Peças, compra de assistência e acompanhamento de eventos",
      "Negociação com cliente ou transportadora",
      "Previsões financeiras e comissão",
      "Integração com projeto ou item do fornecedor",
      "Reprogramação justificada dos próximos eventos",
    ],
    dependencies: ["01", "05", "07", "09", "13"],
    sources: [
      {
        id: 40424078583697,
        title: "FoccoLOJAS - Pós-Venda - Como criar uma Assistência Técnica",
        url: "https://suporte.promob.com/hc/pt-br/articles/40424078583697-FoccoLOJAS-P%C3%B3s-Venda-Como-criar-uma-Assist%C3%AAncia-T%C3%A9cnica",
      },
      {
        id: 31113827607313,
        title: "FoccoLOJAS - Processos - Assistência Técnica",
        url: "https://suporte.promob.com/hc/pt-br/articles/31113827607313-FoccoLOJAS-Processos-Assist%C3%AAncia-T%C3%A9cnica",
      },
      {
        id: 31114363747985,
        title:
          "FoccoLOJAS - Programas - Pós-Vendas - Assistência Técnica - Assistências",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114363747985-FoccoLOJAS-Programas-P%C3%B3s-Vendas-Assist%C3%AAncia-T%C3%A9cnica-Assist%C3%AAncias",
      },
      {
        id: 31114280320529,
        title:
          "FoccoLOJAS - Programas - Estatísticas - Pós-Venda - Acompanhamento de Assistência Técnica",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114280320529-FoccoLOJAS-Programas-Estat%C3%ADsticas-P%C3%B3s-Venda-Acompanhamento-de-Assist%C3%AAncia-T%C3%A9cnica",
      },
    ],
    phase: 6,
    status: "partial",
    notes: [
      "Pode existir assistência sem contrato prévio e solução sem compra/peça. Cliente, loja, fábrica e transportadora são pagadores documentados; negociação com transportadora existe, mas seu tratamento financeiro completo requer validação.",
      "Validar cobrança e repasse específicos de transportadora/fábrica.",
      "Confirmar o vínculo entre resolução, agenda, compra e encerramento para cada tipo de ocorrência.",
      "Núcleo desta fatia entregue parcialmente. A lista de funcionalidades descreve o mapa completo, não uma lista de entregas concluídas; extensões avançadas e conectores externos permanecem planejados.",
    ],
  },
  {
    id: "09",
    name: "Financeiro e comissões",
    group: "Controlar",
    description:
      "Registrar contas a receber/pagar, previsões, pagamentos e reversões com saldos explicáveis.",
    features: [
      "Recebível e obrigação a pagar",
      "Vínculo com contrato ou compra",
      "Baixa parcial/total e saldo",
      "Estorno com histórico e motivo",
      "Previsões, efetivação e negociações",
      "Portadores, caixa e centros de custo",
      "Juros, multas, descontos e rateios",
      "Políticas, previsão e apuração de comissões",
      "Cheques, caução, TEF e cartas de crédito",
      "Fluxo de caixa, financiamentos e ponto de equilíbrio",
    ],
    dependencies: ["13"],
    sources: [
      {
        id: 31115308811537,
        title: "FoccoLOJAS - Programas - Financeiro",
        url: "https://suporte.promob.com/hc/pt-br/articles/31115308811537-FoccoLOJAS-Programas-Financeiro",
      },
      {
        id: 31114333328913,
        title: "Programas - Financeiro - Contas a Receber - Lançamentos",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114333328913-Programas-Financeiro-Contas-a-Receber-Lan%C3%A7amentos",
      },
      {
        id: 34213338898193,
        title: "FoccoLOJAS - Baixa de Títulos",
        url: "https://suporte.promob.com/hc/pt-br/articles/34213338898193-FoccoLOJAS-Baixa-de-T%C3%ADtulos",
      },
      {
        id: 35862488140177,
        title: "FoccoLOJAS - Cálculo de Previsão de Comissões - Nova Versão",
        url: "https://suporte.promob.com/hc/pt-br/articles/35862488140177-FoccoLOJAS-C%C3%A1lculo-de-Previs%C3%A3o-de-Comiss%C3%B5es-Nova-Vers%C3%A3o",
      },
      {
        id: 32993706395665,
        title:
          "FoccoLOJAS – Financeiro – Contas a Receber – Recebimento de Financiamento",
        url: "https://suporte.promob.com/hc/pt-br/articles/32993706395665-FoccoLOJAS-Financeiro-Contas-a-Receber-Recebimento-de-Financiamento",
      },
      {
        id: 31114261462289,
        title:
          "FoccoLOJAS - Programas - Sistema - Configurações - Financeiro - Configurações do Financeiro",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114261462289-FoccoLOJAS-Programas-Sistema-Configura%C3%A7%C3%B5es-Financeiro-Configura%C3%A7%C3%B5es-do-Financeiro",
      },
      {
        id: 31114287930385,
        title:
          "FoccoLOJAS - Programas - Financeiro - Contas a Receber - Cheques",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114287930385-FoccoLOJAS-Programas-Financeiro-Contas-a-Receber-Cheques",
      },
    ],
    phase: 3,
    status: "partial",
    notes: [
      "No produto de referência, previsão, título e caixa não são equivalentes; a interface pode efetivar e baixar na mesma ação. A previsão de comissão difere da apuração, e estornar uma baixa não necessariamente restaura uma alteração anterior do valor original do título. Nesta fatia, efetivação e baixa são operações separadas e o valor original do título é protegido.",
      "Definir a política de vencimentos, juros, desconto e mudança de valor original.",
      "Conciliação bancária, TEF produtivo, comissões complexas e contabilidade não são entregues por um contas a receber/pagar simples.",
      "Núcleo desta fatia entregue parcialmente. A lista de funcionalidades descreve o mapa completo, não uma lista de entregas concluídas; extensões avançadas e conectores externos permanecem planejados.",
    ],
  },
  {
    id: "11",
    name: "Indicadores e BI",
    group: "Controlar",
    description:
      "Exibir indicadores derivados dos registros reais, com filtros, datas-base e fórmulas declarados.",
    features: [
      "Resumo operacional com origem dos números",
      "Totais de contratos, pendências e financeiro do fluxo inicial",
      "Metas, carteira, ranking e conversão",
      "Lucratividade, margem e ponto de equilíbrio",
      "Painéis comerciais, financeiros e de execução",
      "Exportação ETL e pacote de BI",
      "Comparações por período e filtros permissionados",
    ],
    dependencies: ["03", "05", "06", "07", "08", "09"],
    sources: [
      {
        id: 40194895522321,
        title: "FoccoLOJAS - Dashboard",
        url: "https://suporte.promob.com/hc/pt-br/articles/40194895522321-FoccoLOJAS-Dashboard",
      },
      {
        id: 31114300641297,
        title: "FoccoLOJAS - Programas - Estatísticas",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114300641297-FoccoLOJAS-Programas-Estat%C3%ADsticas",
      },
      {
        id: 41644159258385,
        title: "FoccoLOJAS - ETL do FoccoLOJAS – Extrações de Dados para BI",
        url: "https://suporte.promob.com/hc/pt-br/articles/41644159258385-FoccoLOJAS-ETL-do-FoccoLOJAS-Extra%C3%A7%C3%B5es-de-Dados-para-BI",
      },
      {
        id: 31114329709073,
        title:
          "FoccoLOJAS - Programas - Estatísticas - Gráficos Gerenciais - Conversões",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114329709073-FoccoLOJAS-Programas-Estat%C3%ADsticas-Gr%C3%A1ficos-Gerenciais-Convers%C3%B5es",
      },
      {
        id: 46812182862993,
        title: "FoccoLOJAS – Análise do Ponto de Equilíbrio",
        url: "https://suporte.promob.com/hc/pt-br/articles/46812182862993-FoccoLOJAS-An%C3%A1lise-do-Ponto-de-Equil%C3%ADbrio",
      },
    ],
    phase: 6,
    status: "partial",
    notes: [
      "Datas-base e filtros mudam os resultados. O ETL descrito é diário/D-1 e seu dicionário é analítico, não o contrato integral de escrita do ERP. Conversão por período não comprova conversão por coorte.",
      "Não inventar indicadores quando a base está vazia: mostrar estado vazio ou dados de demonstração identificados.",
      "Definir cada fórmula, regime de datas e tratamento de cancelamentos antes da homologação.",
      "Núcleo desta fatia entregue parcialmente. A lista de funcionalidades descreve o mapa completo, não uma lista de entregas concluídas; extensões avançadas e conectores externos permanecem planejados.",
    ],
  },
  {
    id: "12",
    name: "Enterprise e automações",
    group: "Conectar",
    description:
      "Planejar pipelines, etapas, prazos e automações que acompanham os processos da loja.",
    features: [
      "Pipelines, cards e painéis de projetos",
      "Matriz de eventos e prazos",
      "Gatilhos e mensagens por evento",
      "Empreendimentos, parceiros e acompanhamento",
      "Avaliações, chat e solicitações do Meu Projeto",
    ],
    dependencies: ["01", "02", "03", "07", "13"],
    sources: [
      {
        id: 31114348560273,
        title: "FoccoLOJAS - Programas - Enterprise",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114348560273-FoccoLOJAS-Programas-Enterprise",
      },
      {
        id: 31114264643345,
        title:
          "FoccoLOJAS - Enterprise - Matriz de Eventos - Pipelines - Painel de Projetos",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114264643345-FoccoLOJAS-Enterprise-Matriz-de-Eventos-Pipelines-Painel-de-Projetos",
      },
      {
        id: 31113893570577,
        title:
          "FoccoLOJAS - Enterprise - Matriz de Eventos - Configurações Matriz",
        url: "https://suporte.promob.com/hc/pt-br/articles/31113893570577-FoccoLOJAS-Enterprise-Matriz-de-Eventos-Configura%C3%A7%C3%B5es-Matriz",
      },
      {
        id: 31114323239441,
        title:
          "FoccoLOJAS - Programas - Enterprise - APP Meu Projeto - Avaliações",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114323239441-FoccoLOJAS-Programas-Enterprise-APP-Meu-Projeto-Avalia%C3%A7%C3%B5es",
      },
      {
        id: 31114345859601,
        title:
          "FoccoLOJAS - Enterprise - APP Meu Projeto - Solicitações de Assistência Técnica",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114345859601-FoccoLOJAS-Enterprise-APP-Meu-Projeto-Solicita%C3%A7%C3%B5es-de-Assist%C3%AAncia-T%C3%A9cnica",
      },
    ],
    phase: 7,
    status: "planned",
    notes: [
      "Pipeline e matriz de eventos têm papéis diferentes. Há divergências documentais sobre alteração de tipo e propagação para contratos existentes; cada caso precisa de validação.",
      "Mensagens externas não devem ser enviadas por uma demonstração sem canal e autorização configurados.",
      "Escolher política de propagação, fila, repetição e tratamento de falha antes de ativar gatilhos.",
      "Bloco planejado; não há núcleo operacional implementado nesta entrega.",
    ],
  },
  {
    id: "13",
    name: "Sistema e Avançado",
    group: "Conectar",
    description:
      "Fornecer identidade, permissões, parâmetros e auditoria para uma única loja.",
    features: [
      "Identidade e acesso do operador",
      "Papéis e ações autorizadas",
      "Parâmetros de uma única loja",
      "Auditoria de alterações e transições",
      "Cargos, equipes e habilitações",
      "Campos obrigatórios e checklists",
      "Layouts e cadastros auxiliares",
      "Importações/exportações administrativas",
      "Notificações e navegação configurável",
    ],
    dependencies: [],
    sources: [
      {
        id: 31114364486161,
        title: "FoccoLOJAS - Programas - Sistema",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114364486161-FoccoLOJAS-Programas-Sistema",
      },
      {
        id: 31114324473233,
        title: "FoccoLOJAS - Programas - Avançado",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114324473233-FoccoLOJAS-Programas-Avan%C3%A7ado",
      },
      {
        id: 31114362970129,
        title: "FoccoLOJAS - Programas - Sistema - Usuários - Perfil",
        url: "https://suporte.promob.com/hc/pt-br/articles/31114362970129-FoccoLOJAS-Programas-Sistema-Usu%C3%A1rios-Perfil",
      },
      {
        id: 42811789456785,
        title:
          "FoccoLOJAS – Programas – Sistema – Usuários – Perfil – Mapa de Acesso",
        url: "https://suporte.promob.com/hc/pt-br/articles/42811789456785-FoccoLOJAS-Programas-Sistema-Usu%C3%A1rios-Perfil-Mapa-de-Acesso",
      },
      {
        id: 31115328226961,
        title: "FoccoLOJAS - Conhecendo o sistema",
        url: "https://suporte.promob.com/hc/pt-br/articles/31115328226961-FoccoLOJAS-Conhecendo-o-sistema",
      },
    ],
    phase: 1,
    status: "partial",
    notes: [
      "Acesso ao menu não prova permissão para toda ação. O produto de referência tem logs locais, sem garantia documentada de trilha imutável universal. Uma trilha permanente é requisito proposto para este projeto.",
      "Uma única loja elimina multitenancy; não elimina autorização por usuário.",
      "Identificar se o ambiente está conectado ao Supabase ou operando em demonstração; não apresentar persistência local como persistência de servidor.",
      "Núcleo desta fatia entregue parcialmente. A lista de funcionalidades descreve o mapa completo, não uma lista de entregas concluídas; extensões avançadas e conectores externos permanecem planejados.",
    ],
  },
  {
    id: "14",
    name: "Integrações e aplicativos",
    group: "Conectar",
    description:
      "Planejar conectores de projeto, fornecedor, assinatura, pagamento e exportação com contratos verificáveis.",
    features: [
      "Contrato explícito do importador de XML sintético usado no núcleo",
      "Importação real Promob por arquivo e integração API",
      "FoccoERP, Web Service e Supplier Portal",
      "PromobHub e pedidos de e-commerce",
      "DocSeguro e TEF",
      "Aplicativo operacional e Meu Projeto",
      "ETL e PipeRun, sujeito a documentação",
    ],
    dependencies: ["02", "03", "05", "09", "13"],
    sources: [
      {
        id: 31113830062609,
        title:
          "FoccoLOJAS - Programas - Avançado - Comercial - Layout de Importação",
        url: "https://suporte.promob.com/hc/pt-br/articles/31113830062609-FoccoLOJAS-Programas-Avan%C3%A7ado-Comercial-Layout-de-Importa%C3%A7%C3%A3o",
      },
      {
        id: 31112525846929,
        title: "Integração FoccoLOJAS x Promob via API",
        url: "https://suporte.promob.com/hc/pt-br/articles/31112525846929-Integra%C3%A7%C3%A3o-FoccoLOJAS-x-Promob-via-API",
      },
      {
        id: 31113782111505,
        title: "FoccoLOJAS - Processos - Processo WebService",
        url: "https://suporte.promob.com/hc/pt-br/articles/31113782111505-FoccoLOJAS-Processos-Processo-WebService",
      },
      {
        id: 31112877701137,
        title: "FoccoLOJAS - Processos - Integração com o Supplier Portal",
        url: "https://suporte.promob.com/hc/pt-br/articles/31112877701137-FoccoLOJAS-Processos-Integra%C3%A7%C3%A3o-com-o-Supplier-Portal",
      },
      {
        id: 31112651946385,
        title:
          "FoccoLOJAS - Programas - Comercial - E-Commerce - Pedidos Pendentes",
        url: "https://suporte.promob.com/hc/pt-br/articles/31112651946385-FoccoLOJAS-Programas-Comercial-E-Commerce-Pedidos-Pendentes",
      },
      {
        id: 31111881575953,
        title: "FoccoLOJAS - Processos de Integração TEF",
        url: "https://suporte.promob.com/hc/pt-br/articles/31111881575953-FoccoLOJAS-Processos-de-Integra%C3%A7%C3%A3o-TEF",
      },
      {
        id: 31115346205713,
        title: "FoccoLOJAS - Aplicativo",
        url: "https://suporte.promob.com/hc/pt-br/articles/31115346205713-FoccoLOJAS-Aplicativo",
      },
    ],
    phase: 7,
    status: "partial",
    notes: [
      "Documentar a integração do FoccoLOJAS não concede a outro ERP acesso à mesma API. Arquivo XML, API e Web Service exigem contratos e validação próprios.",
      "Sem XML real fornecido, nenhum importador deve ser chamado de compatível com todos os arquivos Promob/Focco.",
      "Nesta fatia, o backend reinterpreta o XML e persiste o snapshot por import_environment_version_verified, exclusiva de service_role, com ator verificado e autorizado. SUPABASE_SECRET_KEY permanece somente no servidor. Credenciais, limites, licenças e sandbox dos conectores externos não foram validados.",
      "PipeRun é citado no índice, mas o contrato técnico público não está demonstrado.",
      "Núcleo desta fatia entregue parcialmente. A lista de funcionalidades descreve o mapa completo, não uma lista de entregas concluídas; extensões avançadas e conectores externos permanecem planejados.",
    ],
  },
  {
    id: "15",
    name: "Marketing",
    group: "Conectar",
    description:
      "Manter no plano a compra de itens de marketing descrita na navegação do produto.",
    features: [
      "Itens de marketing de fornecedores",
      "Solicitação/compra conforme contrato a validar",
      "Acompanhamento de custo e atendimento quando especificado",
    ],
    dependencies: ["05", "13"],
    sources: [
      {
        id: 31115328226961,
        title: "FoccoLOJAS - Conhecendo o sistema",
        url: "https://suporte.promob.com/hc/pt-br/articles/31115328226961-FoccoLOJAS-Conhecendo-o-sistema",
      },
    ],
    phase: 7,
    status: "planned",
    notes: [
      "O índice cita compra de itens de marketing. Não há base para prometer campanhas multicanal, gestão de anúncios ou automação de marketing completa.",
      "Detalhamento público insuficiente: exige demonstração ou requisito específico da loja.",
      "Manter planejado, sem controles que apenas simulam sucesso de uma função inexistente.",
      "Bloco planejado; não há núcleo operacional implementado nesta entrega.",
    ],
  },
];
