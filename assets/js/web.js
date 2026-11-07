/* 网页开发页：两张代码卡 + 输入框的逐字输入 / 逐字退格，循环播放
   代码卡是「边写边删」的循环：
   01→05 依次写；写完第 3 行后，第 1 行开始删；
   最后一行 05 开始消失时，第 1 行重新开始写。
   序号 01–05 在 .web-line__typed 外面，不参与动画 */
(function () {
  var cards = Array.prototype.slice.call(
    document.querySelectorAll('.web-stage__code-lines, .web-code__lines')
  );
  var prompt = document.querySelector('.web-stage__prompt-text');
  if (!cards.length && !prompt) return;

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  function collect(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue && n.nodeValue.length) {
        nodes.push({ node: n, text: n.nodeValue });
      }
    }
    nodes.forEach(function (item) { item.node.nodeValue = ''; });
    return nodes;
  }

  /* 光标放在被遮罩的文字外面，否则会被渐隐效果一起吃掉 */
  function makeCaretAfter(el) {
    var caret = document.createElement('span');
    caret.className = 'web-type-caret';
    caret.setAttribute('aria-hidden', 'true');
    el.parentNode.insertBefore(caret, el.nextSibling);
    return caret;
  }

  function typeDelay(char, base, spread) {
    var d = base + Math.random() * spread;
    if (char === ' ') d += base * 0.6;
    if (/[.,;:+→]/.test(char)) d += base * 2.2;
    return d;
  }

  function typeNodes(data, base, spread, done) {
    var i = 0;
    var j = 0;
    data.caret.classList.add('is-on');
    if (data.el) data.el.classList.add('is-typing');

    function step() {
      if (i >= data.nodes.length) {
        if (data.el) data.el.classList.remove('is-typing');
        if (done) done();
        return;
      }
      var item = data.nodes[i];
      if (j < item.text.length) {
        var ch = item.text.charAt(j);
        item.node.nodeValue += ch;
        j++;
        setTimeout(step, typeDelay(ch, base, spread));
      } else {
        i++;
        j = 0;
        setTimeout(step, base);
      }
    }
    step();
  }

  function lastNode(data) {
    for (var k = data.nodes.length - 1; k >= 0; k--) {
      if (data.nodes[k].node.nodeValue.length) return data.nodes[k].node;
    }
    return null;
  }

  /* 退格时不显示光标 */
  function eraseNodes(data, base, spread, done) {
    data.caret.classList.remove('is-on');
    if (data.el) data.el.classList.add('is-typing');

    function step() {
      var node = lastNode(data);
      if (!node) {
        if (data.el) data.el.classList.remove('is-typing');
        if (done) done();
        return;
      }
      node.nodeValue = node.nodeValue.slice(0, -1);
      setTimeout(step, base + Math.random() * spread);
    }
    step();
  }

  function setupCard(card, startDelay) {
    var lines = Array.prototype.slice.call(card.querySelectorAll('p'));
    if (!lines.length) return;

    var lineData = lines.map(function (line) {
      var typed = line.querySelector('.web-line__typed') || line;
      return {
        el: typed,
        nodes: collect(typed),
        caret: makeCaretAfter(typed),
        state: 'empty'
      };
    });

    var eraseQueue = [];
    var erasing = false;

    function queueErase(index) {
      if (index < 0) return;
      var data = lineData[index];
      if (!data || data.state !== 'full') return;
      if (eraseQueue.indexOf(index) === -1) eraseQueue.push(index);
      pumpErase();
    }

    function pumpErase() {
      if (erasing) return;
      while (eraseQueue.length) {
        var index = eraseQueue.shift();
        var data = lineData[index];
        if (!data || data.state !== 'full') continue;
        erasing = true;
        data.state = 'erasing';
        /* 最后一行 05 开始消失时，第 1 行就重新开始出现（不等到它删完） */
        if (index === lineData.length - 1 && !writing) {
          startWriting();
        }
        eraseNodes(data, 78, 30, function () {
          data.state = 'empty';
          erasing = false;
          pumpErase();
        });
        return;
      }
    }

    var writeIndex = 0;
    var writing = false;

    function startWriting() {
      if (writing) return;
      writing = true;
      writeIndex = 0;
      lineData.forEach(function (data) {
        data.caret.classList.remove('is-on');
      });
      writeNext();
    }

    function writeNext() {
      var index = writeIndex;
      var data = lineData[index];
      if (!data) return;

      if (data.state !== 'empty') {
        setTimeout(writeNext, 80);
        return;
      }

      data.state = 'typing';
      typeNodes(data, 18, 14, function () {
        data.state = 'full';
        data.caret.classList.remove('is-on');

        /* 写完第 3 行，第 1 行开始删；第 4、5 行继续写，形成一边写一边删 */
        if (index >= 2) queueErase(index - 2);

        if (index === lineData.length - 1) {
          /* 本轮写完；最后一行开始删时，pumpErase 会启动下一轮 01 */
          writing = false;
          for (var e = 0; e < lineData.length; e++) queueErase(e);
          return;
        }

        writeIndex = index + 1;
        setTimeout(writeNext, 220);
      });
    }

    setTimeout(startWriting, startDelay);

    /* 兜底：如果某次删除结束后没有触发下一轮，空场超过 1 秒就自动重启 */
    setInterval(function () {
      if (writing || erasing || eraseQueue.length) return;
      var allEmpty = lineData.every(function (data) {
        return data.state === 'empty';
      });
      if (allEmpty) startWriting();
    }, 1000);
  }

  cards.forEach(function (card, index) {
    setupCard(card, 500 + index * 260);
  });

  var promptData = null;
  if (prompt) {
    promptData = { el: prompt, nodes: collect(prompt), caret: makeCaretAfter(prompt) };
  }

  function promptCycle() {
    if (!promptData) return;
    typeNodes(promptData, 64, 36, function () {
      setTimeout(function () {
        eraseNodes(promptData, 92, 42, function () {
          setTimeout(promptCycle, 600);
        });
      }, 2200);
    });
  }
  setTimeout(promptCycle, 600);
})();

/* --------------------------------------------------------------------------
   底部 CTA：「更快更好更美」的渐变字，等这句话真的露出来 60% 再开始铺色，
   免得卡片刚露个边就播完、用户滚到时已经褪回去了。只播一次。
   -------------------------------------------------------------------------- */
(function () {
  var grad = document.querySelector('.web-cta__grad');
  if (!grad) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  if (!('IntersectionObserver' in window)) {
    grad.classList.add('is-color');
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        grad.classList.add('is-color');
        io.disconnect();
        return;
      }
    }
  }, { threshold: 0.6 });
  io.observe(grad);
})();
