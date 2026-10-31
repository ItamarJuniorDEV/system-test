import Link from "next/link";
import { notFound } from "next/navigation";
import { one } from "@/lib/server/data";
import { requireViewer, can } from "@/lib/server/auth";
import type { Supplier } from "@/lib/domain";
import { PageHeader, Section, Notice } from "@/components/ui/primitives";
import { ContactForm } from "@/components/contact-form";
import { Button } from "@/components/ui/button";

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer();
  const supplier = await one<Supplier>("suppliers", id);
  if (!supplier) notFound();
  return (
    <>
      <PageHeader
        eyebrow="OPERAÇÃO / FORNECEDORES"
        title={supplier.name}
        actions={
          <Button asChild variant="outline">
            <Link href="/fornecedores">Voltar</Link>
          </Button>
        }
      />
      <div className="two-columns">
        <Section title="Dados do fornecedor">
          {can(viewer, "operations") ? (
            <ContactForm supplier record={supplier} />
          ) : (
            <p>
              {supplier.email || "E-mail não informado"} ·{" "}
              {supplier.phone || "Telefone não informado"}
            </p>
          )}
        </Section>
        <Notice>
          O cadastro organiza os pedidos da loja. Conexões automáticas com
          fábricas dependem de uma integração específica, prevista no mapa de
          processos.
        </Notice>
      </div>
    </>
  );
}
