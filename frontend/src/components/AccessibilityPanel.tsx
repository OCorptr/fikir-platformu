import { useEffect, useState } from "react";

type TextScale = "normal" | "large" | "larger";

export function AccessibilityPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [textScale, setTextScale] = useState<TextScale>(() =>
    (localStorage.getItem("gf-text-scale") as TextScale | null) ?? "normal");
  const [highContrast, setHighContrast] = useState(
    () => localStorage.getItem("gf-high-contrast") === "true",
  );

  useEffect(() => {
    document.documentElement.dataset.textScale = textScale;
    document.documentElement.dataset.highContrast = String(highContrast);
    localStorage.setItem("gf-text-scale", textScale);
    localStorage.setItem("gf-high-contrast", String(highContrast));
  }, [textScale, highContrast]);

  return (
    <aside className={`accessibility${isOpen ? " accessibility--open" : ""}`}>
      <button
        className="accessibility__trigger"
        type="button"
        aria-expanded={isOpen}
        aria-controls="accessibility-options"
        onClick={() => setIsOpen((value) => !value)}
      >
        <span aria-hidden="true">♿</span>
        <span className="sr-only">Erişilebilirlik ayarları</span>
      </button>

      <div id="accessibility-options" className="accessibility__panel" hidden={!isOpen}>
        <div className="accessibility__heading">
          <strong>Erişilebilirlik</strong>
          <button type="button" onClick={() => setIsOpen(false)} aria-label="Paneli kapat">×</button>
        </div>
        <fieldset>
          <legend>Metin boyutu</legend>
          <div className="segmented-control">
            {(["normal", "large", "larger"] as const).map((scale, index) => (
              <button
                key={scale}
                type="button"
                className={textScale === scale ? "is-active" : ""}
                aria-pressed={textScale === scale}
                onClick={() => setTextScale(scale)}
              >
                {`A${index === 0 ? "" : index === 1 ? "+" : "++"}`}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="switch-row">
          <span>Yüksek kontrast</span>
          <input
            type="checkbox"
            checked={highContrast}
            onChange={(event) => setHighContrast(event.target.checked)}
          />
        </label>
      </div>
    </aside>
  );
}
