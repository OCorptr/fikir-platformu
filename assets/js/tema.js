/* Geleceğin Fikri — koyu/açık mod anahtarı (tüm sayfalarda ortak)
   Paneldeki "Koyu Mod" anahtarı (.ep-anahtar[data-ozellik="koyu-mod"]) da
   bu dosyaya bağlıdır; erisilebilirlik.js bu anahtara dokunmaz. */
(function () {
  var ANAHTAR = 'gf-tema';

  function kaydet(tema) { try { localStorage.setItem(ANAHTAR, tema); } catch (e) {} }
  function oku() { try { return localStorage.getItem(ANAHTAR) || 'acik'; } catch (e) { return 'acik'; } }

  function panelAnahtarlari() {
    return document.querySelectorAll('.ep-anahtar[data-ozellik="koyu-mod"]');
  }

  function uygula(tema) {
    var koyu = tema === 'koyu';
    document.documentElement.classList.toggle('koyu-mod', koyu);
    var b = document.getElementById('tema-dugme');
    if (b) {
      b.textContent = koyu ? '☀️' : '🌙';
      b.title = koyu ? 'Açık moda geç' : 'Koyu moda geç';
    }
    panelAnahtarlari().forEach(function (a) { a.classList.toggle('acik', koyu); });
    /* koyu modda acik renkli logo turevleri: GENÇ AR-GE (beyaz yazi) + Turkiye Yuzyili (beyaz) */
    var KOYU_GORSELLER = {
      'assets/img/gencarge_logo.webp': 'assets/img/gencarge_logo_koyu.webp',
      'assets/img/1.webp': 'assets/img/1_koyu.webp'
    };
    document.querySelectorAll('img').forEach(function (img) {
      var yol = img.getAttribute('src');
      if (KOYU_GORSELLER[yol] !== undefined && img.dataset.orijinalGorsel === undefined) {
        img.dataset.orijinalGorsel = yol;
      }
      var temel = img.dataset.orijinalGorsel || yol;
      if (KOYU_GORSELLER[temel]) {
        img.src = koyu ? KOYU_GORSELLER[temel] : temel;
      }
    });
  }

  window.gfTemaDegistir = function () {
    var tema = document.documentElement.classList.contains('koyu-mod') ? 'acik' : 'koyu';
    kaydet(tema);
    uygula(tema);
  };

  uygula(oku());
  /* tarayici geri tusu bfcache ile eski gorunumu geri yukler — temayi tazele */
  window.addEventListener('pageshow', function () { uygula(oku()); });
  document.addEventListener('DOMContentLoaded', function () {
    uygula(oku());
    var b = document.getElementById('tema-dugme');
    if (b) b.addEventListener('click', window.gfTemaDegistir);
    panelAnahtarlari().forEach(function (a) { a.addEventListener('click', window.gfTemaDegistir); });
  });
})();
