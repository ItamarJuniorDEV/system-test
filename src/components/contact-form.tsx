import { ActionForm } from "./action-form";
import { Field } from "./ui/primitives";
import type { Customer, Supplier } from "@/lib/domain";

export function ContactForm({
  supplier = false,
  record,
}: {
  supplier?: boolean;
  record?: Customer | Supplier;
}) {
  return (
    <ActionForm
      command={supplier ? "supplier.save" : "customer.save"}
      submitLabel={
        record
          ? "Salvar alterações"
          : supplier
            ? "Cadastrar fornecedor"
            : "Cadastrar cliente"
      }
      resetOnSuccess={!record}
    >
      {record && <input type="hidden" name="id" value={record.id} />}
      <Field
        label={
          supplier ? "Nome do fornecedor *" : "Nome completo / razão social *"
        }
      >
        <input
          name="name"
          required
          maxLength={200}
          placeholder={supplier ? "Ex.: Forma Móveis" : "Ex.: Marina Alves"}
          defaultValue={record?.name}
        />
      </Field>
      <div className="form-grid">
        <Field label="CPF / CNPJ">
          <input
            name="document"
            maxLength={30}
            defaultValue={record?.document ?? ""}
          />
        </Field>
        <Field label="Telefone">
          <input
            name="phone"
            type="tel"
            maxLength={40}
            defaultValue={record?.phone ?? ""}
          />
        </Field>
      </div>
      <Field label="E-mail">
        <input
          name="email"
          type="email"
          maxLength={254}
          defaultValue={record?.email ?? ""}
          placeholder="nome@exemplo.com.br"
        />
      </Field>
      {supplier && (
        <Field label="Prazo de fornecimento (dias)">
          <input
            type="number"
            name="lead_days"
            min={1}
            max={730}
            defaultValue={
              record && "lead_days" in record ? record.lead_days : 30
            }
            required
          />
        </Field>
      )}
      <Field label="Observações">
        <textarea
          name="notes"
          maxLength={5000}
          defaultValue={record?.notes ?? ""}
          placeholder="Informações úteis para o atendimento"
        />
      </Field>
    </ActionForm>
  );
}
