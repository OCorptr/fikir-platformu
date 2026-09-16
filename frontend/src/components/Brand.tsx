import { Link } from "react-router-dom";
import logoUrl from "../../../assets/img/gencarge_logo.webp";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand${compact ? " brand--compact" : ""}`} to="/" aria-label="Geleceğin Fikri ana sayfa">
      <img src={logoUrl} alt="" />
      <span>
        <strong>Geleceğin Fikri</strong>
        <small>Fikrini paylaş, geleceğe yön ver</small>
      </span>
    </Link>
  );
}
