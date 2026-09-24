import { Outlet, useLocation } from "react-router-dom";
import { KullaniciCikis } from "./KullaniciCikis";
import { UstBar } from "./UstBar";

const balonMetinleri: Record<string, string> = {
  "/giris": "Tekrar hoş geldin! 🎉 E-posta ve şifrenle hesabına giriş yapabilirsin.",
  "/kayit": "Merhaba, ben Fikri! 🖐 Önce bilgilerini doldur, sonra fikrini anlat. Sıra sende!",
  "/sifremi-unuttum": "Şifreni mi unuttun? 😊 Endişelenme, hemen sıfırlama bağlantısı gönderelim.",
  "/sifre-sifirla": "Yeni şifreni belirleyebilirsin. 🔐 Güvenli bir şifre seçmayı unutma!",
};

export function PublicLayout() {
  const yol = useLocation().pathname;
  const balon = balonMetinleri[yol] ?? "Merhaba, ben Fikri! 🖐 Sıra sende, hadi başlayalım!";

  return (
    <>
      <UstBar />
      <KullaniciCikis />
      <main className="fikir-hero">
        <div className="fikir-sol">
          <div className="balon-kapsa">
            <div className="balon" id="balon">{balon}</div>
          </div>
          <img
            className="maskot-fikir"
            src="/assets/img/gencarge_logo.webp"
            alt="Genç AR-GE maskotu"
          />
        </div>
        <section className="fikir-karti">
          <Outlet />
        </section>
      </main>
    </>
  );
}
