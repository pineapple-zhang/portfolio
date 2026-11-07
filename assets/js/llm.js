/* ==========================================================================
   大模型部署页的补丁脚本
   目前只有一件事：「0 元」滚进视口时从一个大数字倒数归零。
   ========================================================================== */
(function () {
  'use strict';

  var zero = document.querySelector('.vs-zero[data-count-from]');
  if (!zero) return;

  var numEl = zero.querySelector('.vs-zero__num');
  var from = parseInt(zero.getAttribute('data-count-from'), 10);
  if (!numEl || !isFinite(from) || from <= 0) return;

  var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = !!(mq && mq.matches);
  var fmt = function (n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  /* 先摆出起始值：JS 没跑时 HTML 里留的是 0，也就是最终要说的那句话 */
  if (!reduced) numEl.textContent = fmt(from);

  var started = false;
  var DURATION = 1500;

  function settle() {
    numEl.textContent = '0';
    zero.classList.add('is-done');
  }

  function run() {
    if (started) return;
    started = true;
    if (reduced || !window.requestAnimationFrame) {
      settle();
      return;
    }
    var t0 = null;
    var tick = function (now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / DURATION);
      /* easeOut：一开始掉得快，快落到 0 时变慢，像计价器停表 */
      var eased = 1 - Math.pow(1 - p, 3.2);
      numEl.textContent = fmt(Math.round(from * (1 - eased)));
      if (p < 1) {
        window.requestAnimationFrame(tick);
      } else {
        settle();
      }
    };
    window.requestAnimationFrame(tick);
  }

  if (reduced) {
    settle();
    return;
  }

  if ('IntersectionObserver' in window) {
    var target = zero.closest('.vs-split__visual') || zero;
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          io.disconnect();
          run();
          return;
        }
      }
    }, { threshold: 0.3 });
    io.observe(target);
  } else {
    run();
  }
})();
