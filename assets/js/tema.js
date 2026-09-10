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
  }

  window.gfTemaDegistir = function () {
    var tema = document.documentElement.classList.contains('koyu-mod') ? 'acik' : 'koyu';
    kaydet(tema);
    uygula(tema);
  };

  uygula(oku());
  document.addEventListener('DOMContentLoaded', function () {
    uygula(oku());
    var b = document.getElementById('tema-dugme');
    if (b) b.addEventListener('click', window.gfTemaDegistir);
    panelAnahtarlari().forEach(function (a) { a.addEventListener('click', window.gfTemaDegistir); });
  });
})();
