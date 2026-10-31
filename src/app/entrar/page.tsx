import Link from "next/link";
import { Layers3, ArrowUpRight } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { hasSupabaseConfig, isLocalDemo } from "@/lib/server/config";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const configured = hasSupabaseConfig();
  const demo = isLocalDemo();
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <Layers3 size={29} />
          <span>
            studio<span className="brand-dot">.</span>
          </span>
        </div>
        <div>
          <div className="eyebrow">GESTÃO PARA LOJAS DE MÓVEIS</div>
          <h1>
            Do primeiro projeto
            <br />à última entrega.
          </h1>
          <p>
            Clientes, ambientes, compras e operação conectados em um só lugar.
          </p>
          <div className="login-flow">
            <span>Projeto</span>
            <span>Contrato</span>
            <span>Execução</span>
            <span>Entrega</span>
          </div>
        </div>
        <small>Loja única · Gestão comercial e operacional</small>
      </section>
      <section className="login-panel">
        <div className="login-box">
          <div className="eyebrow">BEM-VINDO AO STUDIO</div>
          <h2>Sua loja, organizada.</h2>
          <p className="muted">
            Entre para acompanhar os projetos e as próximas etapas.
          </p>
          {configured ? (
            <LoginForm />
          ) : (
            <div className="stack">
              <div className="notice notice-info">
                <strong>O projeto está pronto para configurar.</strong>
                <p>
                  Conecte o banco Supabase seguindo o README do repositório. O
                  acesso será liberado após cadastrar o primeiro administrador.
                </p>
              </div>
              <div className="setup-command">
                <span>Para experimentar com dados fictícios</span>
                <code>npm run demo</code>
              </div>
              <Button asChild variant="outline">
                <a
                  href="https://github.com/ItamarJuniorDEV/system-test#como-executar"
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir instruções de instalação <ArrowUpRight size={15} />
                </a>
              </Button>
            </div>
          )}
          {demo && (
            <Button asChild className="mt">
              <Link href="/">Abrir demonstração local</Link>
            </Button>
          )}
          <p className="login-footnote">
            Sem módulo fiscal. Todos os acessos operacionais exigem um perfil
            autorizado.
          </p>
        </div>
      </section>
    </main>
  );
}
