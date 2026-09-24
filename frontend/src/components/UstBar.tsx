interface UstBarProps {
  /** geriye dönük uyumluluk — kullanılmıyor */
  me?: unknown;
  /** geriye dönük uyumluluk — kullanılmıyor */
  onLogout?: () => void;
}

/**
 * Üst bar — sadece logo + slogan. Link/buton YOK.
 * Logo `<a>` değil `<div>`: tıklanınca sayfa değişmez (admin teması bu davranışı istiyor).
 * Navigasyon il/bakanlık paneli içindeki sidebar'dan yapılır.
 */
export function UstBar(_props: UstBarProps = {}) {
  return (
    <header className="ust">
      <div className="ust-sol">
        <div className="logo">
          <img className="logo-mark" src="/assets/img/gencarge_logo.webp" alt="Genç AR-GE" />
          <span className="logo-slogan">Fikrin Geleceğimiz Olsun</span>
        </div>
      </div>
      <div className="ust-sag">
        <img
          className="yuz-yil-logo"
          src="/assets/img/1.webp"
          alt="Türkiye Yüzyılı · MEB 100. Yıl logosu"
        />
      </div>
    </header>
  );
}

// Auto-deploy test marker: 34c54f888a4244c29fcdec6dbbc6ce01
