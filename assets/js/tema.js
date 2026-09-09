/* Geleceğin Fikri — koyu/açık mod anahtarı (tüm sayfalarda ortak) */
(function () {
  var ANAHTAR = 'gf-tema';

  function kaydet(tema) { try { localStorage.setItem(ANAHTAR, tema); } catch (e) {} }
  function oku() { try { return localStorage.getItem(ANAHTAR) || 'acik'; } catch (e) { return 'acik'; } }

  function uygula(tema) {
    document.documentElement.classList.toggle('koyu-mod', tema === 'koyu');
    var b = document.getElementById('tema-dugme');
    if (b) {
      b.textContent = tema === 'koyu' ? '☀️' : '🌙';
      b.title = tema === 'koyu' ? 'Açık moda geç' : 'Koyu moda geç';
    }
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
  });
})();
