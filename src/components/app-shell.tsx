"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  ClipboardCheck,
  ShoppingBag,
  Boxes,
  CalendarDays,
  Wrench,
  Wallet,
  Truck,
  GitBranch,
  Settings2,
  History,
  Layers3,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Store,
} from "lucide-react";
import { signOut } from "@/app/auth-actions";
import { label } from "@/lib/format";
import type { Viewer } from "@/lib/server/auth";

const groups = [
  {
    label: "VISÃO GERAL",
    links: [
      { href: "/", title: "Visão geral", icon: LayoutDashboard },
      { href: "/agenda", title: "Agenda", icon: CalendarDays },
    ],
  },
  {
    label: "COMERCIAL",
    links: [
      { href: "/clientes", title: "Clientes", icon: Users },
      { href: "/projetos", title: "Projetos e ambientes", icon: FolderKanban },
      { href: "/orcamentos", title: "Orçamentos", icon: FileText },
      {
        href: "/contratos",
        title: "Contratos e revisões",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "OPERAÇÃO",
    links: [
      { href: "/compras", title: "Compras", icon: ShoppingBag },
      { href: "/fornecedores", title: "Fornecedores", icon: Truck },
      { href: "/estoque", title: "Estoque e reservas", icon: Boxes },
      { href: "/assistencia", title: "Assistência", icon: Wrench },
      { href: "/financeiro", title: "Financeiro", icon: Wallet },
    ],
  },
  {
    label: "GESTÃO",
    links: [
      { href: "/mapa", title: "Mapa de processos", icon: GitBranch },
      { href: "/auditoria", title: "Histórico de operações", icon: History },
      { href: "/configuracoes", title: "Configurações", icon: Settings2 },
    ],
  },
];

export function AppShell({
  viewer,
  children,
}: {
  viewer: Viewer;
  children: ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = groups
    .flatMap((g) => g.links)
    .filter((l) => (l.href === "/" ? path === "/" : path.startsWith(l.href)))
    .at(-1);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      {open && (
        <button
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Fechar navegação"
        />
      )}
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <Link href="/" className="brand" onClick={() => setOpen(false)}>
            <Layers3 size={26} />
            <span>
              studio<span className="brand-dot">.</span>
            </span>
          </Link>
          <button
            className="mobile-close"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={21} />
          </button>
        </div>
        <div className="store-chip">
          <span className="store-icon">
            <Store size={17} />
          </span>
          <div>
            <strong>Minha loja</strong>
            <small>Gestão integrada</small>
          </div>
          <span className="online-dot" />
        </div>
        <nav aria-label="Navegação principal">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <h2>{group.label}</h2>
              {group.links
                .filter(
                  (link) =>
                    viewer.role === "admin" ||
                    !["/auditoria", "/configuracoes"].includes(link.href),
                )
                .map((link) => {
                  const selected =
                    link.href === "/"
                      ? path === "/"
                      : path.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`nav-link ${selected ? "is-active" : ""}`}
                      aria-current={selected ? "page" : undefined}
                    >
                      <link.icon size={18} strokeWidth={1.8} />
                      <span>{link.title}</span>
                      {selected && (
                        <ChevronRight size={14} className="nav-arrow" />
                      )}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">{viewer.name.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{viewer.name}</strong>
            <small>{label(viewer.role)}</small>
          </div>
          <form action={signOut}>
            <button aria-label="Sair" title="Sair">
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{active?.title ?? "Gestão da loja"}</strong>
          </div>
          <div className="topbar-right">
            <span className="connection-indicator">
              <i />
              {viewer.demo ? "Demonstração local" : "Loja conectada"}
            </span>
            <span className="avatar avatar-small">
              {viewer.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        {viewer.demo && (
          <div className="demo-banner">
            Dados fictícios em memória. Reiniciar o servidor apaga a
            demonstração. <Link href="/mapa">Ver escopo da versão</Link>
          </div>
        )}
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>Studio Gestão · Loja única</span>
          <span>Comercial · Operação · Financeiro</span>
        </footer>
      </div>
    </div>
  );
}
