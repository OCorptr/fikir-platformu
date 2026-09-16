import { Outlet } from "react-router-dom";
import { Brand } from "./Brand";

export function PublicLayout() {
  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="Geleceğin Fikri hakkında">
        <Brand />
        <div className="auth-story__content">
          <p className="eyebrow">Gençlerin fikri, geleceğin gücü</p>
          <h1>Bir fikrin varsa, değişim tam burada başlar.</h1>
          <p>
            Fikrini güvenle paylaş, kendi ilindeki değerlendirme sürecini takip et ve
            Türkiye’nin geleceğine katkı sağla.
          </p>
        </div>
        <ol className="auth-steps" aria-label="Başvuru adımları">
          <li><span>1</span>Kayıt ol</li>
          <li><span>2</span>Fikrini yaz</li>
          <li><span>3</span>Süreci takip et</li>
        </ol>
      </section>
      <section className="auth-panel">
        <div className="auth-panel__inner">
          <Outlet />
        </div>
        <p className="auth-footer">T.C. Millî Eğitim Bakanlığı · Genç AR-GE</p>
      </section>
    </main>
  );
}
