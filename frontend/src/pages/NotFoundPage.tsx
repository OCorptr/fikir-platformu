import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="not-found">
      <span aria-hidden="true">404</span>
      <h1>Bu sayfayı bulamadık</h1>
      <p>Bağlantı değişmiş veya sayfa henüz hazırlanıyor olabilir.</p>
      <Link className="primary-button" to="/">Ana sayfaya dön</Link>
    </main>
  );
}
