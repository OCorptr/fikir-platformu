// Koyu tema, React yüklenmeden ÖNCE uygulanmalı — aksi hâlde sayfa açık
// başlar, sonra koyuya döner (yanıp sönme).
//
// Sprint 11.92 (güvenlik): Bu kod index.html içinde <script> bloğu olarak
// çalışıyordu. CSP `script-src 'unsafe-inline'` gerektiriyordu; dış dosyaya
// taşıyarak CSP'yi sıkılaştırıyoruz ("'unsafe-inline'" ve "'unsafe-eval'" kalktı).
try {
  if (localStorage.getItem("gf-tema") === "koyu") {
    document.documentElement.classList.add("koyu-mod");
  }
} catch (e) {
  // localStorage erişimi kapalıysa (gizli sekme) — sessizce açık temayla devam et.
}
