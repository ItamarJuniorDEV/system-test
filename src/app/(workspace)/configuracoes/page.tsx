import { list } from "@/lib/server/data";
import { requireViewer } from "@/lib/server/auth";
import type { Profile } from "@/lib/domain";
import {
  PageHeader,
  Section,
  Notice,
  Field,
  Badge,
} from "@/components/ui/primitives";
import { ActionForm } from "@/components/action-form";

export default async function SettingsPage() {
  const viewer = await requireViewer();
  if (viewer.role !== "admin")
    return (
      <Notice>A configuração dos acessos é reservada ao administrador.</Notice>
    );
  const profiles = await list<Profile>("profiles", {
    orderBy: "name",
    ascending: true,
  });
  return (
    <>
      <PageHeader
        eyebrow="GESTÃO"
        title="Configurações e acessos"
        description="Uma loja, com perfis de acesso por responsabilidade e aprovação dentro do fluxo."
      />
      <div className="stack">
        <div className="two-columns">
          <Section title="Configuração operacional">
            <dl className="info-pairs">
              <div>
                <dt>Organização</dt>
                <dd>Loja única</dd>
              </div>
              <div>
                <dt>Moeda</dt>
                <dd>Real brasileiro (BRL)</dd>
              </div>
              <div>
                <dt>Revisão técnica</dt>
                <dd>Exige assinatura e liberações comercial e financeira</dd>
              </div>
              <div>
                <dt>Agenda</dt>
                <dd>Horário de São Paulo (UTC−3)</dd>
              </div>
              <div>
                <dt>Entrada de projetos</dt>
                <dd>XML UTF-8, layout configurável, por ambiente</dd>
              </div>
              <div>
                <dt>Fluxo fiscal</dt>
                <dd>Fora do escopo</dd>
              </div>
            </dl>
          </Section>
          <Section title="Como liberar um novo acesso">
            <div className="stack">
              <p className="helper">
                Cadastre o usuário no Supabase Auth seguindo o procedimento do
                README. O perfil aparecerá aqui inativo. Depois escolha a
                responsabilidade e libere o acesso.
              </p>
              <Notice>
                Um usuário ativo acessa os dados operacionais permitidos ao seu
                perfil. Somente financeiro e administradores consultam títulos e
                baixas. A verificação de permissão também é executada no banco.
              </Notice>
              <p className="helper">
                O primeiro administrador é habilitado pelo responsável técnico
                na instalação. Não há cadastro público com privilégio de
                administrador.
              </p>
            </div>
          </Section>
        </div>
        <Section
          title="Usuários da loja"
          description="Mudanças de perfil e ativação ficam registradas no histórico."
        >
          <div className="two-columns">
            {profiles.map((profile) => (
              <article className="approval-card" key={profile.id}>
                <div className="space-between">
                  <h3>{profile.name || "Usuário sem nome"}</h3>
                  <Badge value={profile.active ? "active" : "pending"}>
                    {profile.active ? "Ativo" : "Aguardando liberação"}
                  </Badge>
                </div>
                <ActionForm command="profile.save" submitLabel="Salvar acesso">
                  <input type="hidden" name="user_id" value={profile.id} />
                  <Field label="Nome">
                    <input
                      name="name"
                      defaultValue={profile.name}
                      required
                      maxLength={200}
                    />
                  </Field>
                  <Field label="Perfil">
                    <select name="role" defaultValue={profile.role}>
                      <option value="commercial">Comercial</option>
                      <option value="operations">Operação</option>
                      <option value="finance">Financeiro</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </Field>
                  <label className="check-row">
                    <input
                      name="active"
                      type="checkbox"
                      defaultChecked={profile.active}
                    />
                    <span>Acesso ativo</span>
                  </label>
                </ActionForm>
              </article>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
