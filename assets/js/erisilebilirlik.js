/* Geleceğin Fikri — Erişilebilirlik araçları v5
   Ekran Okuyucu (tıkla-oku + sayfayı oku + durdur) · Yazı Boyutu ·
   Disleksi Dostu (Lexend) · Yüksek Kontrast · Bağlantıları Vurgula ·
   İmleç Rengi (Varsayılan/Beyaz/Siyah/Sarı) · Animasyonları Durdur */
(function () {
  var ANAHTAR = 'gf-erisilebilirlik';
  var SINIFLAR = ['yazi-buyuk', 'yazi-kucuk', 'disleksi', 'yuksek-kontrast',
                  'baglanti-vurgu', 'animasyon-durdur',
                  'imlec-beyaz', 'imlec-siyah', 'imlec-sari'];

  /* İmleç Rengi: klasik imleç OKU, yalnızca renkleri farklı
     (beyaz: beyaz gövde + lacivert kenar, siyah: lacivert gövde + beyaz kenar,
      sarı: sarı gövde + siyah kenar). Merkez (4,2) = okun ucu. */
  var IMLEC_OK = {
    beyaz: "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M4 2 L4 24 L9.5 19 L13 27 L16.8 25.2 L13.4 17.5 L21 17.5 Z' fill='white' stroke='%2316355C' stroke-width='2' stroke-linejoin='round' paint-order='stroke'/></svg>",
    siyah: "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M4 2 L4 24 L9.5 19 L13 27 L16.8 25.2 L13.4 17.5 L21 17.5 Z' fill='%2316355C' stroke='white' stroke-width='2' stroke-linejoin='round' paint-order='stroke'/></svg>",
    sari: "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M4 2 L4 24 L9.5 19 L13 27 L16.8 25.2 L13.4 17.5 L21 17.5 Z' fill='%23FFE066' stroke='black' stroke-width='2' stroke-linejoin='round' paint-order='stroke'/></svg>"
  };
  function imlecCursor(deger, son) {
    return 'url("data:image/svg+xml;utf8,' + IMLEC_OK[deger] + '") 4 2, ' + son;
  }
  var IMLECLER = {
    beyaz: imlecCursor('beyaz', 'auto'),
    siyah: imlecCursor('siyah', 'auto'),
    sari: imlecCursor('sari', 'auto')
  };
  var IMLEC_PTR = {
    beyaz: imlecCursor('beyaz', 'pointer'),
    siyah: imlecCursor('siyah', 'pointer'),
    sari: imlecCursor('sari', 'pointer')
  };

  function oku() {
    try { return JSON.parse(localStorage.getItem(ANAHTAR)) || {}; } catch (e) { return {}; }
  }
  function kaydet(d) { try { localStorage.setItem(ANAHTAR, JSON.stringify(d)); } catch (e) {} }

  function uygula(d) {
    var h = document.documentElement;
    SINIFLAR.forEach(function (s) { h.classList.remove(s); });

    if (d.yazi === 'buyuk') h.classList.add('yazi-buyuk');
    if (d.yazi === 'kucuk') h.classList.add('yazi-kucuk');
    ['disleksi', 'yuksek-kontrast', 'baglanti-vurgu', 'animasyon-durdur'].forEach(function (o) {
      if (d[o]) h.classList.add(o);
    });

    if (d.imlec && IMLECLER[d.imlec]) {
      h.classList.add('imlec-' + d.imlec);
      h.style.cursor = IMLECLER[d.imlec];
      var stil = document.getElementById('imlec-pointer-stil');
      if (!stil) {
        stil = document.createElement('style');
        stil.id = 'imlec-pointer-stil';
        document.head.appendChild(stil);
      }
      stil.textContent = 'html.imlec-aktif body a, html.imlec-aktif body button { cursor: ' + IMLEC_PTR[d.imlec] + ' !important; } html.imlec-aktif body { cursor: ' + IMLECLER[d.imlec] + ' !important; }';
      h.classList.add('imlec-aktif');
    } else {
      h.style.cursor = '';
      var stil2 = document.getElementById('imlec-pointer-stil');
      if (stil2) stil2.textContent = '';
      h.classList.remove('imlec-aktif');
    }

    document.querySelectorAll('.ep-anahtar').forEach(function (b) {
      /* koyu mod tema.js'e aittir (html.koyu-mod sinifi + localStorage gf-tema) */
      if (b.dataset.ozellik === 'koyu-mod') return;
      b.classList.toggle('acik', !!d[b.dataset.ozellik]);
    });
    document.querySelectorAll('.ep-dugme').forEach(function (b) {
      if (b.dataset.grup === 'imlec') {
        b.classList.toggle('acik', d.imlec === b.dataset.deger);
      } else {
        b.classList.toggle('acik', (d.yazi || 'normal') === b.dataset.deger);
      }
    });

    var araclar = document.getElementById('ep-okuma-araclari');
    if (araclar) araclar.hidden = !d['ekran-okuyucu'];
    if (!d['ekran-okuyucu'] && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function konus(metin) {
    if (!('speechSynthesis' in window)) { alert('Tarayıcınız seslendirmeyi desteklemiyor.'); return; }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(metin);
    u.lang = 'tr-TR';
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }

  function tiklaOku(e) {
    var hedef = e.target.closest('p, h1, h2, h3, h4, li, td, th, label, blockquote, .tablo-notu, .ayin-fikir, .alt-baslik, .istat .istat-etiket');
    if (!hedef || hedef.closest('.erisilebilirlik-panel, button, a, input, select, textarea')) return;
    var metin = (hedef.textContent || '').replace(/\s+/g, ' ').trim();
    if (metin) konus(metin.slice(0, 300));
  }

  function sayfayiOku() {
    if (!('speechSynthesis' in window)) return;
    var parcalar = [];
    document.querySelectorAll('main h1, main h2, main h3, main p, main li, main td').forEach(function (e) {
      var yazi = (e.textContent || '').replace(/\s+/g, ' ').trim();
      if (yazi) parcalar.push(yazi);
    });
    if (!parcalar.length) return;
    window.speechSynthesis.cancel();
    parcalar.forEach(function (yazi) {
      var u = new SpeechSynthesisUtterance(yazi);
      u.lang = 'tr-TR';
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    });
  }

  /* tarayici geri tusu bfcache ile donerse ozellikleri yeniden uygula */
  window.addEventListener('pageshow', function () {
    d = oku(); uygula(d);
  });

  document.addEventListener('DOMContentLoaded', function () {
    var d = oku();
    uygula(d);

    var dugme = document.getElementById('erisilebilirlik-dugme');
    var panel = document.getElementById('erisilebilirlik-panel');
    if (dugme && panel) {
      dugme.addEventListener('click', function (e) {
        e.stopPropagation();
        panel.classList.toggle('acik');
      });
      panel.addEventListener('click', function (e) { e.stopPropagation(); });
      document.addEventListener('click', function (e) {
        if (panel.classList.contains('acik') && !panel.contains(e.target) && !dugme.contains(e.target)) {
          panel.classList.remove('acik');
        }
      });
    }

    document.querySelectorAll('.ep-anahtar').forEach(function (b) {
      b.addEventListener('click', function () {
        /* koyu mod anahtari tema.js tarafindan yonetilir */
        if (b.dataset.ozellik === 'koyu-mod') return;
        d[b.dataset.ozellik] = !d[b.dataset.ozellik];
        kaydet(d); uygula(d);
      });
    });
    document.querySelectorAll('.ep-dugme[data-grup="yazi"]').forEach(function (b) {
      b.addEventListener('click', function () {
        d.yazi = b.dataset.deger === 'normal' ? null : b.dataset.deger;
        kaydet(d); uygula(d);
      });
    });
    document.querySelectorAll('.ep-dugme[data-grup="imlec"]').forEach(function (b) {
      b.addEventListener('click', function () {
        d.imlec = b.dataset.deger; /* kapatmak icin "Tumunu Sifirla" kullanilir */
        kaydet(d); uygula(d);
      });
    });
    var sifirla = document.getElementById('ep-sifirla');
    if (sifirla) sifirla.addEventListener('click', function () {
      d = {}; kaydet(d); uygula(d);
    });

    var oaSayfa = document.getElementById('oa-sayfa');
    var oaDurdur = document.getElementById('oa-durdur');
    if (oaSayfa) oaSayfa.addEventListener('click', sayfayiOku);
    if (oaDurdur) oaDurdur.addEventListener('click', function () {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    });
  });
})();
