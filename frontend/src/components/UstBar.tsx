import type { MeResponse } from "../types";

interface UstBarProps {
  me?: MeResponse | null;
}

export function UstBar({ me }: UstBarProps = {}) {
  const ilPaneliGoster =
    me?.authenticated === true && me.roles.some((r) =>
      r === "ProvinceEvaluator" || r === "ProvinceManager",
    );

  return (
    <header className="ust">
      <div className="ust-sol">
        <a className="logo" href="/">
          <img className="logo-mark" src="/assets/img/gencarge_logo.webp" alt="Genç AR-GE" />
          <span className="logo-slogan">Fikrin Geleceğimiz Olsun</span>
        </a>
        <nav className="ust-nav">
          <a className="ust-nav-link" href="/fikir">Fikrimi Yaz</a>
          {ilPaneliGoster && (
            <a className="ust-nav-link" href="/il-panel">İl Paneli</a>
          )}
        </nav>
      </div>
      <div className="ust-sag">
        {me?.authenticated && (
          <span className="ust-kullanici">{me.firstName} {me.lastName}</span>
        )}
        <img
          className="yuz-yil-logo"
          src="/assets/img/1.webp"
          alt="Türkiye Yüzyılı · MEB 100. Yıl logosu"
        />
      </div>
    </header>
  );
}
