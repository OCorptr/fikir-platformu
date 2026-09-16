import type { ReactNode } from "react";

export function StatusBanner({
  tone,
  children,
}: {
  tone: "success" | "error" | "info";
  children: ReactNode;
}) {
  return (
    <div className={`status-banner status-banner--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span className="status-banner__icon" aria-hidden="true">
        {tone === "success" ? "✓" : tone === "error" ? "!" : "i"}
      </span>
      <div>{children}</div>
    </div>
  );
}
