import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <main>
      <section className="welcome-card">
        <div>
          <p className="eyebrow">Öğrenci paneli</p>
          <h1>Merhaba {user?.firstName}, fikrin için hazır mısın?</h1>
          <p>Buradan profilini tamamlayabilir, fikirlerini paylaşabilir ve değerlendirme sürecini takip edebilirsin.</p>
          <div className="welcome-card__actions">
            <span className="primary-button primary-button--muted" aria-disabled="true">Yeni fikir yaz <small>yakında</small></span>
            <Link className="secondary-button" to="/profil">Profilimi düzenle</Link>
          </div>
        </div>
        <div className="idea-orbit" aria-hidden="true">
          <span>💡</span><i /><i /><i />
        </div>
      </section>

      <section className="dashboard-grid" aria-label="Hesap özeti">
        <article className="dashboard-card dashboard-card--profile">
          <span className="dashboard-card__icon" aria-hidden="true">⌖</span>
          <div>
            <p>Seçili ilin</p>
            <h2>{user?.profile?.provinceName ?? "Henüz seçilmedi"}</h2>
            <span>Fikirlerin bu ilin İl AR-GE birimine ulaşacak.</span>
          </div>
          <Link to="/profil" aria-label="İl ve profil bilgilerini düzenle">Düzenle →</Link>
        </article>
        <article className="dashboard-card">
          <span className="dashboard-card__icon dashboard-card__icon--orange" aria-hidden="true">✓</span>
          <div><p>Hesap durumu</p><h2>E-posta doğrulandı</h2><span>Hesabın fikir göndermeye hazır.</span></div>
        </article>
        <article className="dashboard-card dashboard-card--disabled">
          <span className="dashboard-card__icon dashboard-card__icon--blue" aria-hidden="true">0</span>
          <div><p>Fikirlerin</p><h2>Süreç takibi</h2><span>Fikir ekranı bir sonraki geliştirme adımında açılacak.</span></div>
        </article>
      </section>
    </main>
  );
}
