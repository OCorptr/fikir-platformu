// Erişilebilirlik yardımcı bileşenleri (YEĞİTEK gereksinim #36):
// - SkipToContent: klavye kullanıcıları için ana içeriğe atlama bağlantısı
// - useFocusTrap: modal'larda Tab tuşunu içeride tutma
// - useEscapeKey: ESC tuşuyla modal kapatma

import { useEffect, useRef, type ReactNode } from "react";

/** Sayfa başında görünmez, Tab ile ortaya çıkan atlama bağlantısı. */
export function SkipToMainContent() {
  return (
    <a
      href="#ana-icerik"
      className="skip-to-main"
      onClick={(e) => {
        e.preventDefault();
        const hedef = document.getElementById("ana-icerik");
        if (hedef) {
          hedef.tabIndex = -1;
          hedef.focus();
          hedef.scrollIntoView({ block: "start" });
        }
      }}
    >
      Ana içeriğe atla
    </a>
  );
}

/** Bir modal/drawer içinde Tab tuşunu içeride tutar. İlk odaklanabilir öğeden başlar. */
export function useFocusTrap(aktif: boolean, containerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!aktif || !containerRef.current) return;
    const oncekiOdak = document.activeElement as HTMLElement | null;

    const odaklanabilirleri = () => {
      if (!containerRef.current) return [] as HTMLElement[];
      return Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(
          'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    };

    const odakIlk = () => {
      const liste = odaklanabilirleri();
      if (liste.length > 0) liste[0]?.focus();
    };
    odakIlk();

    const tus = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const liste = odaklanabilirleri();
      if (liste.length === 0) return;
      const ilk = liste[0];
      const son = liste[liste.length - 1];
      const aktifEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && aktifEl === ilk) {
        e.preventDefault();
        son.focus();
      } else if (!e.shiftKey && aktifEl === son) {
        e.preventDefault();
        ilk.focus();
      }
    };

    document.addEventListener("keydown", tus);
    return () => {
      document.removeEventListener("keydown", tus);
      oncekiOdak?.focus?.();
    };
  }, [aktif, containerRef]);
}

/** ESC tuşuna basıldığında callback çağrılır. */
export function useEscapeKey(aktif: boolean, callback: () => void) {
  useEffect(() => {
    if (!aktif) return;
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") callback();
    };
    document.addEventListener("keydown", tus);
    return () => document.removeEventListener("keydown", tus);
  }, [aktif, callback]);
}

/** ARIA live duyuru bileşeni (ekran okuyucu için değişiklik bildirimi). */
export function CanliDuyuru({ mesaj, politika = "polite" }: { mesaj: string; politika?: "polite" | "assertive" }) {
  return (
    <div role="status" aria-live={politika} className="sr-only">
      {mesaj}
    </div>
  );
}

/** Yardımcı: skip-to-main için sarmalayıcı. */
export function IcerikSarmalayici({ children, id = "ana-icerik" }: { children: ReactNode; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div id={id} ref={ref} tabIndex={-1}>
      {children}
    </div>
  );
}