/* Calque d'annotations datashake.
   Déclaration dans la page, avant ce script :
     window.DS_ANNOTATIONS = [{sel:'.retenir', text:'Pourquoi…', place:'above', all:false, pad:4, m:{place:'below'}}]
   ou attribut sur l'élément : data-annot="Pourquoi…" (data-annot-place facultatif).
   place = above | below | inside-top | inside-bottom | right | left (ordre de repli automatique ensuite).
   m = surcharges pour mobile (< 600 px). */
(function () {
  'use strict';
  var MOBILE = 600, GAP = 8, EDGE = 8;
  var layer, btn, items = [], raf = 0;

  function cfg() {
    var list = (window.DS_ANNOTATIONS || []).slice();
    document.querySelectorAll('[data-annot]').forEach(function (el) {
      list.push({ el: el, text: el.getAttribute('data-annot'), place: el.getAttribute('data-annot-place') || undefined });
    });
    return list;
  }

  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }

  function docRect(el, pad) {
    var r = el.getBoundingClientRect(), sx = window.scrollX, sy = window.scrollY;
    return { l: r.left + sx - pad, t: r.top + sy - pad, r: r.right + sx + pad, b: r.bottom + sy + pad };
  }

  function overlap(a, b) { return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t; }

  function mk(cls, parent) { var d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; }

  var touched = [];
  function restore() {
    touched.forEach(function (t) { t.el.style.setProperty('margin-top', t.v, t.p); });
    touched = [];
  }
  function spacer(el) {
    var cur = el;
    while (cur && cur !== document.body) {
      var d = getComputedStyle(cur).display;
      if (d !== 'inline' && d !== 'contents') return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  function draw() {
    raf = 0;
    if (!layer) return;
    restore();
    layer.innerHTML = '';
    if (document.documentElement.classList.contains('dsa-off')) { lastH = document.body.offsetHeight; return; }
    var vw = document.documentElement.clientWidth;
    var mobile = vw < MOBILE;
    var jobs = [];
    // passe 1, résolution et mesure des étiquettes
    items.forEach(function (a) {
      var o = {};
      for (var k in a) o[k] = a[k];
      if (mobile && a.m) for (var k2 in a.m) o[k2] = a.m[k2];
      if (o.hide) return;
      var els = o.el ? [o.el] : Array.prototype.slice.call(document.querySelectorAll(o.sel));
      els = els.filter(visible);
      if (!els.length) return;
      if (!o.all) els = [els[o.index || 0] || els[0]];
      var lab = mk('dsa-lab', layer);
      lab.textContent = '\u2022 ' + o.text;
      lab.style.maxWidth = Math.min(o.w || 320, vw - 2 * EDGE) + 'px';
      jobs.push({ o: o, els: els, lab: lab, h: lab.offsetHeight, w: lab.offsetWidth });
    });
    // passe 2, on réserve la place au-dessus de chaque élément annoté (le contenu n'est jamais masqué)
    var hosts = [];
    jobs.forEach(function (j) {
      var host = spacer(j.els[0]);
      var prev = hosts.filter(function (x) { return x.el === host; })[0];
      if (prev) { prev.need = Math.max(prev.need, j.h); return; }
      hosts.push({ el: host, need: j.h });
    });
    hosts.forEach(function (x) {
      var el = x.el, cs = getComputedStyle(el);
      touched.push({ el: el, v: el.style.getPropertyValue('margin-top'), p: el.style.getPropertyPriority('margin-top') });
      var m = parseFloat(cs.marginTop) || 0;
      el.style.setProperty('margin-top', (m + x.need + 18) + 'px', 'important');
    });
    // passe 3, positions
    var n = 0, placed = [];
    jobs.forEach(function (j) {
      n++;
      var pad = j.o.pad == null ? 4 : j.o.pad;
      var boxes = j.els.map(function (el) {
        var r = docRect(el, pad);
        r.l = Math.max(2, r.l); r.r = Math.min(vw - 2, r.r);
        var b = mk('dsa-box', layer);
        b.style.left = r.l + 'px'; b.style.top = r.t + 'px';
        b.style.width = (r.r - r.l) + 'px'; b.style.height = (r.b - r.t) + 'px';
        var p = mk('dsa-num', layer);
        p.textContent = n;
        var s = mobile ? 22 : 24;
        p.style.left = Math.max(2, Math.min(vw - s - 2, r.l - s / 2 + 2)) + 'px';
        p.style.top = Math.max(2, r.t - s / 2 + 2) + 'px';
        return r;
      });
      var R = boxes[0], w = j.w, h = j.h;
      var off = mobile ? 16 : 20;
      var x = Math.max(EDGE, Math.min(vw - EDGE - w, R.l + off + (j.o.dx || 0)));
      var y = R.t - pad - h - 4;
      var rr = { l: x, t: y, r: x + w, b: y + h };
      placed.forEach(function (p) { if (overlap(p, rr)) { var dy = p.b + 4 - rr.t; rr.t += dy; rr.b += dy; } });
      j.lab.style.left = rr.l + 'px'; j.lab.style.top = rr.t + 'px';
      placed.push(rr);
    });
    lastH = document.body.offsetHeight;
  }

  var lastH = -1;
  function schedule() { if (!raf) raf = requestAnimationFrame(draw); }

  function setState(on) {
    document.documentElement.classList.toggle('dsa-off', !on);
    btn.textContent = on ? 'Masquer les annotations' : 'Afficher les annotations';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    try { localStorage.setItem('dsa-on', on ? '1' : '0'); } catch (e) {}
    schedule();
  }

  function init() {
    items = cfg();
    if (!items.length) return;
    layer = document.createElement('div');
    layer.className = 'dsa-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dsa-toggle';
    document.body.appendChild(btn);
    var on = true;
    try { if (localStorage.getItem('dsa-on') === '0') on = false; } catch (e) {}
    var q = location.search;
    if (/[?&]annot=0/.test(q)) on = false;
    if (/[?&]annot=1/.test(q)) on = true;
    if (/[?&]shot=1/.test(q)) document.documentElement.classList.add('dsa-shot');
    btn.addEventListener('click', function () { setState(document.documentElement.classList.contains('dsa-off')); });
    setState(on);
    window.addEventListener('resize', schedule);
    window.addEventListener('load', schedule);
    document.addEventListener('click', function () { setTimeout(schedule, 60); }, true);
    document.addEventListener('toggle', schedule, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    if (window.ResizeObserver) new ResizeObserver(function () { if (document.body.offsetHeight !== lastH) schedule(); }).observe(document.body);
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
