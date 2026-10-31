"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui/primitives";
import type { Contract, Customer, Supplier } from "@/lib/domain";

export function AssistanceOpenForm({
  customers,
  contracts,
  initialCustomerId = "",
  initialContractId = "",
}: {
  customers: Customer[];
  contracts: Contract[];
  initialCustomerId?: string;
  initialContractId?: string;
}) {
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const customerContracts = contracts.filter(
    (contract) => contract.customer_id === customerId,
  );
  return (
    <ActionForm command="assistance.open" submitLabel="Abrir assistência">
      <div className="form-grid">
        <Field label="Cliente">
          <select
            name="customer_id"
            required
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          >
            <option value="">Selecione o cliente</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Contrato (opcional)"
          hint="É possível abrir uma assistência sem contrato anterior."
        >
          <select
            name="contract_id"
            key={customerId}
            defaultValue={
              customerContracts.some(
                (contract) => contract.id === initialContractId,
              )
                ? initialContractId
                : ""
            }
          >
            <option value="">Sem contrato vinculado</option>
            {customerContracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                Contrato #{contract.number}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Assunto da assistência"
          className="full-width"
          hint="As ocorrências, o pagador e a solução serão registrados no detalhe."
        >
          <input
            name="title"
            required
            maxLength={300}
            placeholder="Ex.: ajuste das portas do ambiente"
          />
        </Field>
      </div>
    </ActionForm>
  );
}

export function FinancialTitleForm({
  customers,
  suppliers,
  today,
}: {
  customers: Customer[];
  suppliers: Supplier[];
  today: string;
}) {
  const [direction, setDirection] = useState(
    customers.length ? "receivable" : "payable",
  );
  return (
    <ActionForm command="finance.create" submitLabel="Criar título">
      <div className="form-grid">
        <Field label="Tipo de título">
          <select
            name="direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
          >
            <option value="receivable" disabled={!customers.length}>
              A receber
            </option>
            <option value="payable" disabled={!suppliers.length}>
              A pagar
            </option>
          </select>
        </Field>
        {direction === "receivable" ? (
          <Field label="Cliente">
            <select name="customer_id" key="customer" defaultValue="" required>
              <option value="">Selecione o cliente</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Fornecedor">
            <select name="supplier_id" key="supplier" defaultValue="" required>
              <option value="">Selecione o fornecedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Descrição" className="full-width">
          <input
            name="description"
            required
            maxLength={300}
            placeholder="Ex.: despesa de manutenção da loja"
          />
        </Field>
        <Field
          label="Valor (R$)"
          hint="Use vírgula para os centavos, como 1.250,00."
        >
          <input
            name="amount"
            required
            inputMode="decimal"
            placeholder="0,00"
            maxLength={20}
          />
        </Field>
        <Field label="Vencimento">
          <input name="due_date" type="date" required defaultValue={today} />
        </Field>
      </div>
      <p className="helper">
        O título manual nasce em aberto. Criá-lo não registra recebimento nem
        pagamento.
      </p>
    </ActionForm>
  );
}
