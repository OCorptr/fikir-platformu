import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <>
      <div className="af-baslik"><span className="af-cizgi"></span>Hesap özeti<span className="af-cizgi"></span></div>

      <section className="fikir-karti" style={{ textAlign: "left" }}>
        <h1 style={{ fontSize: "1.9rem" }}>Merhaba {user?.firstName}, fikrin için hazır mısın?</h1>
        <p className="kart-not">Buradan profilini tamamlayabilir, fikirlerini paylaşabilir ve değerlendirme sürecini takip edebilirsin.</p>
        <div className="satir">
          <span className="btn-ikincil" aria-disabled="true">Yeni fikir yaz <small>(yakında)</small></span>
          <Link className="btn-ikincil" to="/profil">Profilimi düzenle</Link>
        </div>
      </section>

      <div className="bolum-basligi mavi">Durum özeti</div>
      <section className="uc-kart">
        <div className="fikir-karti">
          <p className="kart-not">Seçili ilin</p>
          <h3 style={{ color: "#16355c" }}>{user?.profile?.provinceName ?? "Henüz seçilmedi"}</h3>
          <span className="kart-not">Fikirlerin bu ilin İl AR-GE birimine ulaşacak.</span>
          <div style={{ marginTop: "0.6rem" }}><Link to="/profil">Düzenle →</Link></div>
        </div>
        <div className="fikir-karti">
          <p className="kart-not">Hesap durumu</p>
          <h3 style={{ color: "#16355c" }}>E-posta doğrulandı</h3>
          <span className="kart-not">Hesabın fikir göndermeye hazır.</span>
        </div>
        <div className="fikir-karti">
          <p className="kart-not">Fikirlerin</p>
          <h3 style={{ color: "#16355c" }}>Süreç takibi</h3>
          <span className="kart-not">Fikir ekranı bir sonraki geliştirme adımında açılacak.</span>
        </div>
      </section>
    </>
  );
}
