import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty">
      <h1>Registro não encontrado</h1>
      <p>
        O endereço pode estar incorreto ou o registro não está disponível para
        seu perfil.
      </p>
      <Link href="/" className="button button-primary">
        Voltar à visão geral
      </Link>
    </div>
  );
}
