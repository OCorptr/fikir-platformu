import { useEffect, useState } from "react";
import { getHealth, type HealthResponse } from "./api/health";

type ApiState =
  | { kind: "loading" }
  | { kind: "online"; data: HealthResponse }
  | { kind: "offline" };

export default function App() {
  const [apiState, setApiState] = useState<ApiState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    getHealth(controller.signal)
      .then((data) => setApiState({ kind: "online", data }))
      .catch(() => {
        if (!controller.signal.aborted) {
          setApiState({ kind: "offline" });
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="app-shell">
      <section className="foundation-card" aria-labelledby="page-title">
        <p className="eyebrow">Geleceğin Fikri Platformu</p>
        <h1 id="page-title">Taşınabilir uygulama temeli hazır</h1>
        <p className="description">
          Öğrenci, İl AR-GE ve Bakanlık modülleri bu sağlayıcıdan bağımsız temel üzerinde
          geliştirilecek.
        </p>

        <dl className="technology-list">
          <div>
            <dt>Frontend</dt>
            <dd>React + TypeScript + Vite</dd>
          </div>
          <div>
            <dt>Backend</dt>
            <dd>ASP.NET Core 10</dd>
          </div>
          <div>
            <dt>Veri</dt>
            <dd>Değiştirilebilir altyapı adaptörleri</dd>
          </div>
        </dl>

        <div className={`api-status api-status--${apiState.kind}`} role="status">
          <span className="status-dot" aria-hidden="true" />
          {apiState.kind === "loading" && "API bağlantısı kontrol ediliyor…"}
          {apiState.kind === "offline" && "API çevrimdışı — frontend bağımsız çalışıyor."}
          {apiState.kind === "online" && `${apiState.data.application} çalışıyor.`}
        </div>
      </section>
    </main>
  );
}
