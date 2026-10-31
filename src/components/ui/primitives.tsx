import { Inbox } from "lucide-react";
import { label } from "@/lib/format";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
export function Section({
  title,
  description,
  children,
  actions,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-header">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}
export function Badge({
  value,
  children,
}: {
  value?: string;
  children?: ReactNode;
}) {
  const tone =
    value &&
    [
      "active",
      "approved",
      "completed",
      "done",
      "received",
      "paid",
      "settled",
      "resolved",
      "closed",
    ].includes(value)
      ? "success"
      : value && ["cancelled", "rejected"].includes(value)
        ? "muted"
        : value && ["pending", "forecast", "partial", "draft"].includes(value)
          ? "warning"
          : "info";
  return (
    <span className={`badge badge-${tone}`}>
      {children ?? label(value ?? "")}
    </span>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={32} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export { Field } from "./field";
export function Stat({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: ReactNode;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <article className="stat">
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "success";
}) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}
