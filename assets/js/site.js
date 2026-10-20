/* ==========================================================================
   site.js — 交互
   原生 JS，无依赖。所有效果在 JS 不可用时都能优雅降级。
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;

  /* 系统是否开了「减弱动态效果」。多处要用，统一在这里取一次。
     注意只取一次快照、不监听变化 —— 中途改系统设置刷新页面才生效，
     这些动画都是一次性的，不值得为它挂一个全局监听。 */
  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  var prefersReduced = !!(reduceMotion && reduceMotion.matches);

  /* 标记 JS 可用：base.css 里滚动显现的初始态（opacity:0）只有在 .js 下才
     生效，这样禁用 JS 时内容仍然完全可见，不会白屏。

     ⚠️ 这个类现在 **HTML 的 <head> 里就挂上了**（见各页面的内联脚本），
        因为首屏入场要求它必须在样式表之前生效，否则入场动画会退化成 1→1。
        这里的重复设置是幂等的，留着当第二道保险。
     下面这个标记是给 <head> 里那个兜底定时器用的：它一旦发现
     site.js 没跑起来，就把 .js 撤掉，免得内容永远停在 opacity:0。 */
  window.__siteReady = true;
  root.classList.remove('no-js');
  root.classList.add('js');

  /* ----------------------------------------------------------------------
     1. 移动端抽屉菜单
     ---------------------------------------------------------------------- */
  var toggle = doc.querySelector('.nav-toggle');
  var list = doc.querySelector('.site-nav__list');
  var scrim = doc.querySelector('.nav-scrim');

  function setMenu(open) {
    if (!toggle || !list) return;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    list.classList.toggle('is-open', open);
    if (scrim) scrim.classList.toggle('is-open', open);
    doc.body.style.overflow = open ? 'hidden' : '';
  }

  if (toggle && list) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    if (scrim) scrim.addEventListener('click', function () { setMenu(false); });

    /* 点了菜单项就关掉，否则跳转后抽屉还开着 */
    list.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });

    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });

    /* 窗口变宽回到桌面布局时，必须复位，否则 body 会一直锁着滚动 */
    /* ⚠️ 断点跟 CSS 的导航那一档对齐（CSS 是 max-width:767 = 手机）——
       两边对不上会出现「手机上抽屉还锁着滚动」这种卡死状态。 */
    var mq = window.matchMedia('(min-width: 768px)');
    var onChange = function (e) { if (e.matches) setMenu(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* ----------------------------------------------------------------------
     2. 页脚年份（避免每年手改一次）
     ---------------------------------------------------------------------- */
  var yearEl = doc.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ----------------------------------------------------------------------
     3. 作品视频：点一下播放 / 再点暂停

     同时只让一条在播 —— 否则六条一起响起来没法听。
     滚出视口自动暂停，省资源，也避免用户滑走了声音还在继续。
     ---------------------------------------------------------------------- */
  var vboxes = doc.querySelectorAll('.work__media--video');
  if (vboxes.length) {
    var vids = [];

    var pauseOthers = function (except) {
      vids.forEach(function (o) {
        if (o.video !== except && !o.video.paused) {
          o.video.pause();
          o.box.classList.remove('is-playing');
          o.btn.setAttribute('aria-label', o.btn.getAttribute('aria-label').replace('暂停', '播放'));
        }
      });
    };

    for (var k = 0; k < vboxes.length; k++) {
      (function (box) {
        var video = box.querySelector('video');
        var btn = box.querySelector('.work__play');
        if (!video) return;

        var entry = { box: box, video: video, btn: btn };
        vids.push(entry);

        /* 触屏设备：浏览器自带的控制条**平时不要挂**。
           卡片在手机上只有 342px 宽，那条黑条一压，16:9 的画面就少一截，
           而且它是可点区域，容易误触（2026-10-20 复查）。
           改成「响了才出现」：play 时挂上、pause 时摘掉 ——
           播放中照样能拖进度、全屏；暂停后控制条消失，大播放按钮回到原位。
           只按 (hover:none)+(pointer:coarse) 判断，桌面哪怕窗口很窄也不动。 */
        var touchOnly = window.matchMedia &&
            window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        if (touchOnly) {
          video.removeAttribute('controls');
          video.addEventListener('play', function () { video.setAttribute('controls', ''); });
          /* ⚠️ 暂停时除了摘掉控制条，还要把大播放按钮放回来 ——
             用户可能是拖原生进度条时点的暂停，那条路走不到下面的按钮回调，
             不补这一句的话画面会停在「没按钮也没控制条」的死状态。 */
          video.addEventListener('pause', function () {
            video.removeAttribute('controls');
            box.classList.remove('is-playing');
            if (btn) btn.setAttribute('aria-label', btn.getAttribute('aria-label').replace('暂停', '播放'));
          });
        }

        /* 只绑在那层大按钮上，不绑整个容器 ——
           播放中要能把点击让给视频自带的功能条 */
        var trigger = btn || box;
        trigger.addEventListener('click', function (e) {
          e.stopPropagation();
          if (video.paused) {
            pauseOthers(video);
            var pr = video.play();
            if (pr && pr.catch) pr.catch(function () { /* 自动播放被拦，忽略 */ });
            box.classList.add('is-playing');
            if (btn) btn.setAttribute('aria-label', btn.getAttribute('aria-label').replace('播放', '暂停'));
          } else {
            video.pause();
            box.classList.remove('is-playing');
            if (btn) btn.setAttribute('aria-label', btn.getAttribute('aria-label').replace('暂停', '播放'));
          }
        });
      })(vboxes[k]);
    }

    /* 滚出视口就暂停 */
    if ('IntersectionObserver' in window) {
      var vio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) return;
          var v = e.target.querySelector('video');
          if (v && !v.paused) {
            v.pause();
            e.target.classList.remove('is-playing');
          }
        });
      }, { threshold: 0.25 });
      for (var m = 0; m < vboxes.length; m++) vio.observe(vboxes[m]);
    }
  }

  /* ----------------------------------------------------------------------
     4. 首屏背景视频：系统开了「减弱动态效果」就不自动播
     ---------------------------------------------------------------------- */
  var heroBg = doc.querySelector('.page-hero__bg');
  if (heroBg && heroBg.tagName === 'VIDEO' && window.matchMedia) {
    var rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var syncHero = function () {
      if (rmq.matches) {
        heroBg.pause();
        heroBg.removeAttribute('autoplay');
      } else {
        var p = heroBg.play();
        if (p && p.catch) p.catch(function () { /* 被拦就停在首帧，不影响阅读 */ });
      }
    };
    syncHero();
    if (rmq.addEventListener) rmq.addEventListener('change', syncHero);
    else if (rmq.addListener) rmq.addListener(syncHero);
  }

  /* ----------------------------------------------------------------------
     5. 首屏入场（只在首页）

     标题拆成单字依次升起，eyebrow 先到、副标题后到、滚动提示最后。
     只在 index.html 生效 —— 靠 .hero__stage 是否存在判断，子页面没有这个节点。

     拆字用的是 textContent 再逐字包 span，文本本身没变，
     选中复制、读屏、搜索引擎看到的都还是「天生我材必有用」。
     ---------------------------------------------------------------------- */
  /* ⚠️⚠️ 这两个查询必须在 `if (heroStageEl)` **外面**。
     `var` 只把**声明**提到函数作用域，赋值不会 —— 原来这两个写在
     `if (heroStageEl) {` 里面，首屏换成封面（index.html 不再有
     `.hero__stage`）之后整块被跳过，`cueEl` 一直是 undefined，
     于是第 12b 节那个 `if (cueEl && cuePill)` 直接不成立，
     **滚动提示整个不出现**（而且不报任何错）。
     首屏文案的入场和滚动提示本来就是两件独立的事，
     不该共用一个「这一页有没有 .hero__stage」的判断。 */
  var cueEl = doc.querySelector('.hero__cue');        /* 外层：随滚动消失 */
  var cuePill = doc.querySelector('.hero__cue-pill'); /* 内层：入场 */

  var heroStageEl = doc.querySelector('.hero__stage');
  if (heroStageEl) {
    var heroTitleEl = doc.querySelector('.hero__title');
    var subEl = doc.querySelector('.hero__sub');
    var eyebrowEl = doc.querySelector('.hero__eyebrow');

    var actors = [];          /* 待点亮的元素 */
    var charSpans = [];

    /* 减弱动态效果时不用拆字 —— 拆了也只是原地立着 */
    if (heroTitleEl && !prefersReduced) {
      /* ⚠️ 不能读 textContent 再把标题整体重建 ——
         标题里现在有 <span class="title-gradient">必有用</span> 这层包裹，
         那样会被拍平成一串纯文本，渐变就没了。
         改成遍历子节点：文本节点拆成单字，元素节点原样保留，
         **整块当作一个动画单位**（往里拆的话每个字会各自带一份完整渐变，
         变成三段重复的颜色）。 */
      var splitHeroTitle = function (parent) {
        var kids = Array.prototype.slice.call(parent.childNodes);
        for (var i = 0; i < kids.length; i++) {
          var node = kids[i];
          if (node.nodeType === 3) {                 /* 文本节点 */
            var txt = node.nodeValue || '';
            if (!txt) continue;
            var frag = doc.createDocumentFragment();
            for (var c = 0; c < txt.length; c++) {
              var ch = txt.charAt(c);
              if (ch.trim() === '') {                /* 空格原样留着 */
                frag.appendChild(doc.createTextNode(ch));
                continue;
              }
              var span = doc.createElement('span');
              span.className = 'char';
              span.textContent = ch;
              frag.appendChild(span);
              charSpans.push(span);
            }
            parent.replaceChild(frag, node);
          } else if (node.nodeType === 1) {
            /* 元素节点（比如 .title-gradient）：**递归进去继续拆**，
               但这一层包裹原样保留 —— 它承载着渐变的定义。
               深度优先，所以 push 进 charSpans 的次序和视觉顺序一致，
               逐个升起的节奏不会乱。 */
            splitHeroTitle(node);
          }
        }
      };
      splitHeroTitle(heroTitleEl);

      /* 彩色短语拆完字之后，让父级把渐变**交给每个字分摊一段**：
         这样既能逐字升起（和前面几个字一样），合起来又还是一条连续渐变，
         而不是同一道彩虹刷三遍。数值算法见 site.css 的 .title-gradient.is-split。 */
      var gradEls = heroTitleEl.querySelectorAll('.title-gradient');
      for (var gi = 0; gi < gradEls.length; gi++) {
        var gradEl = gradEls[gi];
        var gradChars = gradEl.querySelectorAll('.char');
        var gn = gradChars.length;
        if (!gn) continue;                   /* 没拆出字就保持父级自己铺渐变 */
        gradEl.classList.add('is-split');
        for (var gj = 0; gj < gn; gj++) {
          gradChars[gj].style.setProperty('--gs', (gn * 100) + '%');
          gradChars[gj].style.setProperty(
            '--gp', (gn > 1 ? (gj / (gn - 1)) * 100 : 0).toFixed(4) + '%');
        }
      }
    }

    var START = 300;    /* 第一个字起步（ms），先让浏览器喘一口气 */
    var GAP = 70;       /* 字与字之间的间隔 */
    var tail = START + charSpans.length * GAP;

    if (eyebrowEl) {
      eyebrowEl.style.setProperty('--d', '110ms');
      actors.push(eyebrowEl);
    }
    for (var ci = 0; ci < charSpans.length; ci++) {
      charSpans[ci].style.setProperty('--d', (START + ci * GAP) + 'ms');
      actors.push(charSpans[ci]);
    }
    if (subEl) {
      subEl.style.setProperty('--d', (tail + 180) + 'ms');
      actors.push(subEl);
    }
    if (cuePill) {
      /* 只负责把首屏节奏的起跑时刻给它；卡贴的宽度、透明度、描边
         全部由下面第 12b 节按时间线逐帧驱动。 */
      cuePill.style.setProperty('--d', (tail + 420) + 'ms');
      actors.push(cuePill);
    }

    var fireHero = function () {
      for (var i = 0; i < actors.length; i++) actors[i].classList.add('is-in');
    };

    if (prefersReduced) {
      /* 立刻点亮，别留任何悬念（CSS 那边也做了兜底） */
      fireHero();
    } else {
      /* 加 is-in 之前必须先把「初始态」逼出来，否则浏览器会把初始态和终态
         并进同一次样式计算，过渡退化成 1→1，等于没播。

         ⚠️ 原来是连等两个 requestAnimationFrame —— **不可靠，实测会失效**。
            刚插进去的 .char 是新节点，rAF 只是「下一次渲染机会」，
            并不保证在那之前一定发生过一次样式计算；
            页面忙、标签页刚被切回来、或者 .js 是后挂上去的，都可能被合并掉。
         改成读一次 offsetWidth：它会**同步**把样式和布局算出来，
         没有竞态。代价是一次强制重排，元素就一个，可以忽略。 */
      void heroStageEl.offsetWidth;
      fireHero();
    }
  }

  /* ----------------------------------------------------------------------
     5b. 封面首屏的文案入场（**平面设计子页**，不是首页）

     平面设计页的首屏是作品集封面：底图 + 四个文案。这里给它们一份
     依次上浮的入场：主标题 → 中文标题 → 标签行。

     ⚠️ 它与第 5 节（首页 PSD 版首屏）是**两套东西**，靠节点名区分：
        首页       .hero__stage / .hero__title …
        平面设计页  .cover-hero__copy / .cover-hero__mark …
       互不干扰，改一边不会动到另一边。

     ⚠️ **不要复用第 5 节那套逐字拆开**。那一版会把标题的文本节点拆成
        `.char` 再逐个升起，而封面主标题的渐变是靠
        `background-clip: text` 做的 —— 一拆字，每个字各自成一个渐变盒，
        「一条渐变横跨整个标题」就散成一串单色的字了。这里整块动，不拆字。
        （早先不拆字的理由不一样：那时主标题靠 `<span>` 的 scaleX 仿字形，
          拆开会把压缩层拆掉。span 已经删了，结论不变。）
     ---------------------------------------------------------------------- */
  var coverEl = doc.querySelector('.cover-hero__copy');
  if (coverEl) {
    var coverItems = coverEl.querySelectorAll('.cover-hero__reveal');
    var push = function () {
      for (var k = 0; k < coverItems.length; k++) {
        coverItems[k].classList.add('is-in');
      }
    };
    if (prefersReduced) {
      push();
    } else {
      for (var m = 0; m < coverItems.length; m++) {
        coverItems[m].style.setProperty('--d', (140 + m * 130) + 'ms');
      }
      /* 先读一次 offsetWidth 把初始态逼出来再点亮 —— 理由同第 5 节：
         并行计算会把初始态和终态并成一次，过渡退化成 1→1，等于没播。 */
      void coverEl.offsetWidth;
      push();
    }
  }

  /* ----------------------------------------------------------------------
     5c. **空号**（2026-10-10 起）—— 这里原本是「平面设计页那段导语的逐字升起」。

     为什么删：用户 2026-10-10 把那段导语**整段去掉了**（截图圈的就是它：
     「看家的手艺。商业地产、商场活动、品牌宣传——把要卖的东西，
     翻译成远看是气氛、近看是信息的画面。」）。连带清掉：
     HTML 里的 `<p class="cover-hero__lead">`、CSS 里它的三条规则、
     `_shots/verify_lead.py` 这个脚本。
     编号**留着不复用**，免得以后有人对着 README 里的"第 5c 节"找错地方。

     手法本身没丢，在第 5 节（首页主标题）。真要再给谁做逐字升起，从那里抄，
     别从记忆里重写 —— 拆字那套坑（中文标点压缩、每字后补 `<wbr>`、
     空格换 nbsp、文本先归一化）在 README 里记着。
     ---------------------------------------------------------------------- */

  /* ----------------------------------------------------------------------
     5d. 作品区那台机甲的**整幅出血视频**：滚出视口就停，减弱动态效果就不自动播

     视频是静音循环的装饰性内容，HTML 上已经挂了 `autoplay muted playsinline loop`
     —— 这几个属性已经能让它在桌面和手机上都自动播，不需要 JS 帮忙。
     这里只补两件 HTML 做不到的事：

     ① **减弱动态效果**：撤掉 autoplay 并暂停，让封面帧顶上。这是循环动画，
        用户明确要求减少动效时不该还一直转。（HTML 里没法表达这个条件。）
     ② **滚出视口就暂停**：这一页有 25 张大图，让一个看不见的视频一直解码
        纯属浪费。用 IntersectionObserver 按「是否真的露出来」控制，
        跟第 10 节作品带里那些视频一个口径。
     ---------------------------------------------------------------------- */
  (function () {
    var v = doc.querySelector('video.mecha-hero__video');
    if (!v) return;

    if (prefersReduced) {
      v.removeAttribute('autoplay');
      v.pause();
      return;
    }
    if (!('IntersectionObserver' in window)) return;   /* 老浏览器：交给自动播放 */

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          var p = v.play();
          /* ⚠️ play() 返回 Promise，被拦下时会 reject（比如某些省电模式）。
             不接住就是一条控制台报错，所以这里必须 catch 掉。 */
          if (p && p.catch) p.catch(function () {});
        } else {
          v.pause();
        }
      }
    }, { threshold: 0.1 });
    io.observe(v);
  })();

  /* ----------------------------------------------------------------------
     5e. 作品区机甲那两行文案：滚到视口时**整块淡入上浮**

     2026-10-09 用户要求「最后再给文字加入动画」。

     ⚠️⚠️ **不要改成逐字升起**（第 5c 节导语那套）。大标题的渐变靠
        `background-clip: text`，一拆字，每个字各自成一个渐变盒，
        「一条渐变横跨整个标题」就散成一串单色的字 —— 同一个坑在第 5b 节
        首屏主标题那里已经写过一次。这里整块动。
     ⚠️ 触发条件是「滚到视口」而不是页面加载就播 —— 这块在首屏下面，
        加载时根本看不见（导语那节是同一个理由）。
     ⚠️ 播完就 `disconnect()`，不留观察者。
     ---------------------------------------------------------------------- */
  (function () {
    /* ⚠️ 从 `.mecha-hero` 上找，**不是从 `.mecha-hero__copy`** ——
       2026-10-10 加的那个 Siri 式问好（.morb）在 `.mecha-hero__frame` 里，
       挂在 copy 下面的话它永远拿不到 .is-in，整套动效都不会播。 */
    var host = doc.querySelector('.mecha-hero');
    if (!host) return;
    var items = host.querySelectorAll('.mecha-hero__reveal');
    if (!items.length) return;

    var push = function () {
      for (var i = 0; i < items.length; i++) items[i].classList.add('is-in');
    };
    if (prefersReduced || !('IntersectionObserver' in window)) {
      push();
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          push();
          io.disconnect();
        }
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
    io.observe(host);
  })();

  /* ----------------------------------------------------------------------
     5f. Siri 问好的**起跑时机**（2026-10-10 用户反馈）

     用户原话：「底部的动画怎么提前就播放了，应该用户下拉到出现在屏幕里才能
     开始播放吧」。

     根因：这套动效原来跟着上面那两行文案**共用第 5e 节那个观察者** ——
     观察的是整个 `.mecha-hero`，而问好落在**视频框的下沿**
     （`.morb` 的 top 是框高的 88%）。框一露头就触发，
     等滚到胶囊那儿，动画早播完、只剩一座空框。

     改法：单独一个观察者，**直接盯胶囊自己的盒子**（`.morb__pill`）。

     ⚠️ 不能盯 `.morb` —— 它宽高是 0（形状都靠子元素 translate 居中），
        零面积的靶子算不出交叠比例，`threshold` 会失效。
     ⚠️ `.morb__pill` 播之前是 `opacity: 0`，但 IntersectionObserver 只看**几何**、
        不看透明度，所以照样能当靶子 —— 换成 `display:none` 就不行了（没有盒子）。
     ⚠️ 容器上的 `.mecha-hero__reveal` 已经摘掉（见 design.html 的注释）：
        留着的话第 5e 节会给它加 `.is-in`，时机又被拉回"框一露头"。
     ⚠️ 触发位置：胶囊顶边越过**视口高 -18%** 那条线时才算"进了屏幕"。
        实测 1600×900 下那一刻胶囊在 y≈738~794（离视口底还有 100px），
        球和整条变形都在画面里，**不会出现"动画在屏幕外播"**。
        ⚠️ 这个数别调大（比如 -5%）：那时胶囊贴着屏幕最下沿，变形全发生在
           边角，看着像"刚冒头就没了"；也别调小到 -30% 以下 ——
           用户快速下滑时可能整段都没看见。想动就 ±5% 地试。
     ⚠️⚠️ **一颗胶囊一个观察者**（2026-10-10 起有两颗：机甲视频框里那颗、
        方板里那颗「继续下滑参观摄影图」）。所以下面遍历 `.morb`，
        而不是只看第一个 —— `querySelector` 只取第一个的写法在多实例下
        会**静默漏掉后面那颗**（它永远停在 opacity:0，页面不报错）。

     ⭐ 2026-10-12：**滚出视口要复位，滑回来重播**（用户要求）
     ----------------------------------------------------------------------
     用户原话：「这个东西在用户下滑消失后动画要重置，下一次滑动继续出现出场动画」。

     改法：观察者**不再 `disconnect()`**，改成双向 —— 进了就 `.is-in`，
     完全滚出视口就摘掉。**摘掉等于复位**：整套出场动画都挂在
     `.js .morb.is-in .morb__*` 上（`animation: … both`），类一摘，
    动画连同 `both` 记住的终态一起被撤掉，元素回到 base CSS 的
     `opacity: 0`；下次再挂上就是**从头播一遍**（`animation-name` 从无到有，
     浏览器重新起跑，不需要重建节点）。

     ⚠️ **复位条件是「完全滚出视口」，不是「离开触发线」**：
        · 触发线是 `视口底 -18%`。要是拿"离开触发线"当复位条件，
          **手机上首屏那一下**（胶囊本来就在触发线下方、还没进过场）
          会反复摘类，虽然无害但语义是错的；
          真正要复位的是**已经播完、又滚出去了**那种。
        · `r.bottom <= 0`（整颗在视口上沿之外）是个干干净净的判据 ——
          只要还有一像素在屏幕里就不复位，所以边界上不会来回抖。
        · `r.top >= vh` 那一支是兜底（从下方完全滚出去，正常不会发生）。
     ⚠️ 复位时**读一次 `pill.offsetWidth` 强制重排**：确保"摘类"在下一次
        "挂类"之前真的落到样式系统里。两个动作本来就在不同的滚动帧上，
        这一下只是保险（每次滚出才一次，不在热路径上）。
     ⚠️ 别改成 `threshold: 1`（"整颗可见才算进过场"）—— 手机上胶囊贴着
        视口下沿时永远到不了 1，出场动画就再也不会播了。
     ---------------------------------------------------------------------- */
  (function () {
    var morbs = doc.querySelectorAll('.morb');
    if (!morbs.length) return;

    var show = function (m) { m.classList.add('is-in'); };
    var reset = function (m, pill) {
      if (!m.classList.contains('is-in')) return;
      m.classList.remove('is-in');
      void pill.offsetWidth;          /* 强制重排：让"摘类"真的生效 */
    };
    var canObserve = !prefersReduced && ('IntersectionObserver' in window);

    for (var m = 0; m < morbs.length; m++) {
      (function (morb) {
        var pill = morb.querySelector('.morb__pill');
        if (!canObserve || !pill) {
          show(morb);                 /* 静止版/老浏览器：直接给最终形态 */
          return;
        }
        var io = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (e.isIntersecting) { show(morb); continue; }
            var r = e.boundingClientRect;
            var vh = window.innerHeight || doc.documentElement.clientHeight;
            if (r.bottom <= 0 || r.top >= vh) reset(morb, pill);
          }
        }, { rootMargin: '0px 0px -18% 0px', threshold: 0 });
        io.observe(pill);             /* ⚠️ 不 disconnect：要一直盯着复位 */
      })(morbs[m]);
    }

    /* ⛔ 2026-10-12：这里原来还有一条「**被"木板"盖住也算消失**」的检查 ——
       机甲视频那段被 `position: sticky` 钉住、又被作品区那块板子（`.slab`）
       盖住时，胶囊**几何上还在视口里**，而 IntersectionObserver 只看几何、
       看不见"被挡住"，所以得靠它手动复位/重播。

       当天晚些时候用户要求「这个木板的动画去掉」，板子连同钉住一起去掉了
       （见 site.css 那段「已去掉」的注释），这条检查随即失去意义 ——
       留着只会跟上面的观察者重复干活。

       ⚠️⚠️ **哪天又把木板贴回来，这条必须跟着回来**，判据是：
            板子顶边盖过整颗胶囊（`slabTop < pillTop − 1`）→ 复位；
            板子退回胶囊下边、且胶囊已进触发区（`pillTop ≤ 视口 82%`）→ 重播；
            中间那一段什么都不做（免得扫过去一次闪一下）。
          ⚠️ 还要排除「板子里面的胶囊」（两块方板里那两颗"继续下滑"）——
             它们本来就在板子上，`slabTop < pillTop` 永远成立，
             不排除的话会被判成"一直被盖住"、再也不显示。
          两个坑的完整版都能在 git 历史里捞回来（`git log -S slabTop`）。 */
  })();

  /* ----------------------------------------------------------------------
     12b. 首屏滚动提示卡贴：出场时间线 + 退场时间线

     **出场**（六段，从首屏节奏给的 --d 起算）：
       0ms     一个很小的蓝边白底圆淡入
       200ms   一路放大到满尺寸（末尾带一点点回弹）
       600ms   蓝边淡掉，只留白底
       820ms   白底横向拉长成卡贴
       1330ms  左边文字、右边蓝球淡入
       1580ms  白球里的白箭头淡入
       1900ms  箭头开始缓缓闪烁

     **退场**（由滚动进度驱动，滚过 50% 视口高走完）：
       0~34%    文字和蓝球先消失
       30~72%   卡贴收回成小白球
       72~100%  小球整体淡出

     ⚠️⚠️ **宽度、透明度、描边色全部由这里逐帧写，CSS 那边一条 transition
        都没有。** 原因：出场和退场都要改宽度，而 transition-delay 对
        **每一次**变化都生效 —— 出场那段延迟（--d + 300ms）会在退场时
        再等一遍，收回动作会平白拖 1.5 秒。这个坑上一版踩过。
     ⚠️ 用 Math.min / 插值把退场和出场揉在一起，所以用户在下滑动画还没播完
        就滚走时，也不会看到「先弹回来再消失」这种倒放。
     ---------------------------------------------------------------------- */
  if (cueEl && cuePill) {
    var cueText  = cuePill.querySelector('.hero__cue-text');
    var cueDot   = cuePill.querySelector('.hero__cue-dot');
    var cueArrow = cuePill.querySelector('.hero__cue-arrow');
    var CUE_D = 54;                       /* 起始小圆直径 = 卡贴高度，和 CSS 的 --cue-d 对齐 */

    /* 量展开后的宽度：此刻卡贴是 60px 宽 + overflow:hidden，
       scrollWidth 就是内容（含内边距）想要多宽。文字宽度随字体变，不能写死。
       ⚠️⚠️ **scrollWidth 不含 border，而 width 是 border-box** ——
          必须把左右描边补回去。少补这 6px 的话，内容比盒子宽 6px，
          右侧会被 overflow:hidden 裁掉一截，看上去就是「蓝球跑出卡贴了」。
          （这个 bug 就是照用户反馈查出来的：右边余量实测只剩 0.6px。）
       scrollWidth 取整会向下抹掉不足 1px 的余量，所以再 ceil 一下。 */
    var cueBW = parseFloat(window.getComputedStyle(cuePill).borderLeftWidth) +
                parseFloat(window.getComputedStyle(cuePill).borderRightWidth);
    var cueTarget = Math.max(CUE_D, Math.ceil(cuePill.scrollWidth + cueBW));

    /* 延迟从 CSS 变量读回来（首屏那段写进去的），别在这里再算一遍 */
    var cueDelay = parseFloat(
      window.getComputedStyle(cuePill).getPropertyValue('--d')) || 0;

    /* 出场各段的起止时刻（相对起点，毫秒） */
    var T_APPEAR = [0, 240], T_GROW = [200, 680], T_UNBORDER = [600, 880],
        T_STRETCH = [820, 1400], T_TEXT = [1330, 1640], T_ARROW = [1580, 1820],
        T_BLINK = 1900;

    var clamp01 = function (x) { return x < 0 ? 0 : (x > 1 ? 1 : x); };
    var seg  = function (t, a) { return clamp01((t - a[0]) / (a[1] - a[0])); };
    var easeOut = function (x) { return 1 - Math.pow(1 - x, 3); };

    var cueT0 = 0;                        /* 起点，下面设成脚本跑起来的时刻 */
    var cueLooping = false;
    var cueTick = 0;

    var cueApply = function (now) {
      var reduced = reduceMotion && reduceMotion.matches;
      var el = now - cueT0 - cueDelay;    /* 出场已经过去多久（ms） */

      /* ---- 出场 ---- */
      var op, w, sc, bAlpha, txtOp, arrOp;
      if (reduced) {
        /* 减弱动态效果：CSS 那边已经给最终态，这里一个样式都别写 */
        op = null;
      } else {
        var pApp = seg(el, T_APPEAR);
        var pGrow = seg(el, T_GROW);
        var pUnb = seg(el, T_UNBORDER);
        var pStr = seg(el, T_STRETCH);
        var pTxt = seg(el, T_TEXT);
        var pArr = seg(el, T_ARROW);

        op = easeOut(pApp);
        /* scale：起点 .60（"蓝边小圆"阶段），再一路放到 1，
           末尾用 sin 拱一下做回弹。三个系数是配平的：
           pApp 满、g 满时 (.60 + .10 + .30) 正好 = 1.00。 */
        var g = easeOut(pGrow);
        sc = 0.60 + 0.10 * easeOut(pApp) + 0.30 * g + 0.10 * Math.sin(Math.PI * g);
        /* 蓝边：拉长时褪掉，**之后不再回来** —— 最终卡贴是没有蓝边的
           （按用户明确要求）。描边那 3px 一直留着但颜色透明，只为布局稳定。 */
        bAlpha = 1 - easeOut(pUnb);
        w = CUE_D + (cueTarget - CUE_D) * easeOut(pStr);
        txtOp = easeOut(pTxt);
        arrOp = easeOut(pArr);

        if (el >= T_BLINK && !cueArrow.classList.contains('is-blink')) {
          cueArrow.classList.add('is-blink');
        }
      }

      /* ---- 退场（滚动驱动） ---- */
      var y = window.pageYOffset || doc.documentElement.scrollTop || 0;
      var vh = window.innerHeight || doc.documentElement.clientHeight;
      var xe = clamp01(y / (vh * 0.5));
      var eText   = clamp01((xe - 0.00) / 0.34);   /* 文字/蓝球消失 */
      var eShrink = clamp01((xe - 0.30) / 0.42);   /* 收回成小球 */
      var eFade   = clamp01((xe - 0.72) / 0.28);   /* 整体淡出 */

      /* 退场一旦开始就把闪烁摘掉 —— 动画优先级高于内联样式，
         留着的话淡出会被它按住不放 */
      if (eText > 0 && cueArrow.classList.contains('is-blink')) {
        cueArrow.classList.remove('is-blink');
      }

      if (op !== null) {
        cuePill.style.opacity = (op * (1 - eFade)).toFixed(3);
        cuePill.style.width = (w * (1 - eShrink) + CUE_D * eShrink).toFixed(2) + 'px';
        cuePill.style.transform = 'scale(' + (sc * (1 - 0.12 * eFade)).toFixed(3) + ')';
        cuePill.style.borderColor = 'rgba(36,113,225,' +
          (bAlpha * (1 - eText)).toFixed(3) + ')';
        cueText.style.opacity = (txtOp * (1 - eText)).toFixed(3);
        cueDot.style.opacity = (txtOp * (1 - eText)).toFixed(3);
        cueArrow.style.opacity = (arrOp * (1 - eText)).toFixed(3);
      } else {
        /* 减弱动态效果：只做整体淡出，宽度和位移都不动 */
        cuePill.style.opacity = (1 - eFade).toFixed(3);
      }

      /* 位移：纯装饰，减弱动态效果时不位移 */
      var reduced2 = reduceMotion && reduceMotion.matches;
      cueEl.style.setProperty('--cue-drift',
        (reduced2 ? 0 : -12 * xe).toFixed(1) + 'px');
    };

    var cueLoop = function (now) {
      cueApply(now);
      if (now - cueT0 < cueDelay + 2600) {
        window.requestAnimationFrame(cueLoop);
      } else {
        cueLooping = false;
      }
    };

    var cueOnScroll = function () {
      if (cueLooping || cueTick) return;
      cueTick = window.requestAnimationFrame(function () {
        cueTick = 0;
        cueApply(performance.now());
      });
    };

    /* 点卡贴 → 平滑滚到下一段（首屏之后的第一块 = 精选作品带）。
       HTML 那边它是 <a href="#main">，这里接管掉这次跳转：
       锚点是**没 JS 时的兜底**，有 JS 时按下面这个落点走。

       ⚠️ 落点取「下一段自己的顶边」，**不要减 --nav-h** ——
          减了的话会把那段的顶部内边距吃掉一截（.band-sec 约 44~92px），
          眉题「精选作品」正好钻进 sticky 导航底下。
          不减的话那段整体正好铺满视口，导航压在它的留白上，谁也不碰谁。
       ⚠️ 只在首页有下一段时才拦（子页面没有 .hero__cue，进来也白搭）。 */
    var cueNext = doc.querySelector('#main > section');
    if (cueNext) {
      cuePill.addEventListener('click', function (ev) {
        ev.preventDefault();
        var to = cueNext.getBoundingClientRect().top +
                 (window.pageYOffset || doc.documentElement.scrollTop || 0);
        window.scrollTo({
          top: Math.max(0, Math.round(to)),
          /* 减弱动态效果：CSS 那边 html{scroll-behavior:auto} 已经管了，
             这里必须显式给 'auto' —— 传 'smooth' 会盖过那条 CSS。 */
          behavior: prefersReduced ? 'auto' : 'smooth'
        });
      });
    }

    cueT0 = performance.now();
    cueLooping = true;
    window.requestAnimationFrame(cueLoop);
    window.addEventListener('scroll', cueOnScroll, { passive: true });
    window.addEventListener('resize', cueOnScroll, { passive: true });
  }

  /* ----------------------------------------------------------------------
     6. AI视频页：钉住式页头

     下拉时按顺序做三件事：
       1. 标题 + 副标先上移并淡出 —— 行程比页面滚动短，所以看着"拉得比较快"
       2. 文字看不见之后，压暗视频的那层灰色立刻褪掉
       3. 灰色褪完，继续下拉，这时才解除钉住，视频跟着页面上滚

     前两步由 scrollY ÷ 钉住行程 的进度驱动，**不是时间动画** ——
     所以跟手指完全同步，滚回去会原样倒放，不会有动画播到一半被打断的问题。
     ---------------------------------------------------------------------- */
  var pinEl = doc.querySelector('.hero-pin');
  var phEl = pinEl && pinEl.querySelector('.page-hero');
  if (pinEl && phEl && !prefersReduced) {
    var phStage = phEl.querySelector('.page-hero__stage');
    var phVeil = phEl.querySelector('.page-hero__veil');

    /* 三个分界点，都是 0~1 的进度值 */
    var TEXT_END = 0.42;   /* 文字走到这儿算走完 */
    var VEIL_END = 0.88;   /* 灰色褪到这儿算褪完，剩下的行程留给"放开" */
    var FADE_AT = 0.82;    /* 文字走到本段的多少比例时彻底透明 */
    var OUT_VH = 55;       /* 文字最终上移多少 vh */

    var pinTravel = 0;
    var pinTick = false;

    var clamp01 = function (v) { return v < 0 ? 0 : (v > 1 ? 1 : v); };

    /* 行程 = 容器高 − 页头高。用实测值而不是读 CSS 里的 --pin：
       页头在窄屏可能被内容撑得比 min-height 还高，那时候 CSS 算不准。
       算出来非正说明布局没留出行程，直接不启用，文字保持原样。 */
    var pinMeasure = function () {
      pinTravel = pinEl.offsetHeight - phEl.offsetHeight;
    };

    var pinApply = function () {
      pinTick = false;

      /* 行程非正 = 布局没给钉住留空间。可能是窄屏被内容撑满，
         也可能是用户中途把系统切成了「减弱动态效果」——
         CSS 那边随即解除钉住，高度就没了。这时候必须把之前写进去的
         位移和透明度**收回来**，否则文字会卡在"已经飞走"的状态再也回不来。 */
      if (pinTravel <= 0) {
        if (phStage) {
          phStage.style.removeProperty('--out');
          phStage.style.removeProperty('--fade');
        }
        if (phVeil) phVeil.style.removeProperty('opacity');
        return;
      }

      var p = clamp01((window.pageYOffset || doc.documentElement.scrollTop || 0) / pinTravel);

      if (phStage) {
        var t = clamp01(p / TEXT_END);
        /* 先快后慢：起步就有速度（"拉得快"要靠这个），收尾柔和地化掉 */
        var eased = 1 - Math.pow(1 - t, 1.5);
        phStage.style.setProperty('--out', (-OUT_VH * eased).toFixed(2) + 'vh');
        phStage.style.setProperty('--fade', (1 - clamp01(t / FADE_AT)).toFixed(3));
      }
      if (phVeil) {
        phVeil.style.opacity =
          (1 - clamp01((p - TEXT_END) / (VEIL_END - TEXT_END))).toFixed(3);
      }
    };

    var pinScroll = function () {
      if (pinTick) return;
      pinTick = true;
      window.requestAnimationFrame(pinApply);
    };

    pinMeasure();
    pinApply();
    window.addEventListener('scroll', pinScroll, { passive: true });
    window.addEventListener('resize', function () { pinMeasure(); pinScroll(); });
  }

  /* ----------------------------------------------------------------------
     6b. 平面设计页：文案先上移消失，然后镜头扎进机甲的门洞，最后黑场收尾

     用户 2026-10-10：「下拉滚动的过程中上方的字体先行上移消失，然后不断放大
                       机甲的入口（这里速度稍快一点），直至黑屏，
                       然后直接无损切换到下一页」

     跟第 6 节同一套思路（**滚动进度驱动**、不是时间动画，所以滚回去原样倒放），
     只是多了"放大"这一段：

       p  0    → 0.30   文案上移 + 淡出（先走完）
       p  0.24 → 1.00   机甲放大，锚点=门洞，曲线 t^1.9（**越放越快**）
       p  0.78 → 0.96   黑场压上来；0.96→1 是全黑停一下
       p  1.00           解除钉住，下一页在纯黑里接上来

     ⚠️ 门洞在图里的位置/大小是**从资产像素量出来的**（hero-subject.png 2400×1540：
        开口约 x 980~1360、y 760~1040），别跟着感觉改；换图要重新量。
     ⚠️ 黑场那层盖住的是"放大到 11 倍之后的模糊"，所以放大倍数宁可大一点 ——
        只要保证最后整屏都是门洞里的暗部，模糊就永远看不见。
     ---------------------------------------------------------------------- */
  var diveEl = doc.querySelector('.dive-pin');
  var diveHero = diveEl && diveEl.querySelector('.cover-hero');
  if (diveEl && diveHero && !prefersReduced) {
    var dCopy = diveHero.querySelector('.cover-hero__copy');
    var dSubj = diveHero.querySelector('.cover-hero__subject');
    var dImg = dSubj && dSubj.querySelector('img');
    var dVoid = diveHero.querySelector('.cover-hero__void');
    var dNav = doc.querySelector('.site-nav--bar');

    var D_TEXT_END = 0.30;   /* 文案走到这儿算走完 */
    var D_ZOOM_AT = 0.24;    /* 放大从这儿开始（跟文案尾巴叠一点，别等死了才动） */
    var D_VOID_AT = 0.78;    /* 黑场从这儿压上来 */
    var D_VOID_END = 0.96;   /* 到这儿全黑，剩下的行程算"黑屏停一下" */
    var D_OUT_VH = 42;       /* 文案最终上移多少 vh */
    var D_ZOOM_POW = 1.9;    /* 放大曲线，>1 = 越放越快 */
    var D_OVER = 1.12;       /* 放大倍数余量，保证整屏落在门洞的暗部里 */
    var D_MOVE_END = 0.45;   /* 把门洞挪到画面中心这件事，在缩放行程的前 45% 内做完 */

    /* ⚠️ 2026-10-10 用户看了定稿的第一帧说「往右一点点，往下一点点」——
       右 / 下各加了 40 像素（图上坐标）。要再调就动这两个分子，
       分母是图片本身的宽高，别改。 */
    var DOOR = { x: 1210 / 2400, y: 920 / 1540, w: 370 / 2400, h: 280 / 1540 };

    var dClamp01 = function (v) { return v < 0 ? 0 : (v > 1 ? 1 : v); };
    var dTravel = 0, dTick = false, dGeo = null;

    var dMeasure = function () {
      dTravel = diveEl.offsetHeight - diveHero.offsetHeight;
      dGeo = null;
      if (!dImg) return;
      /* ⚠️⚠️ 量之前先把自己写上去的 transform 摘掉 —— 否则 getBoundingClientRect
         拿到的是**变换后**的外接矩形（14 倍下能差出几千像素）。量完立刻还原。 */
      var keepTf = dSubj.style.transform;
      var keepOr = dSubj.style.transformOrigin;
      dSubj.style.transform = 'none';
      var hb = diveHero.getBoundingClientRect();
      var sb = dSubj.getBoundingClientRect();      /* subject 的**未变换**盒 */
      var ib = dImg.getBoundingClientRect();
      dSubj.style.transform = keepTf;
      dSubj.style.transformOrigin = keepOr;

      var nw = dImg.naturalWidth || 2400;
      var nh = dImg.naturalHeight || 1540;
      /* object-fit: contain + object-position: center bottom
         → 内容盒水平居中、贴底；门洞的落点要从这里反推，不能按"图片盒"算。 */
      var cw = Math.min(ib.width, ib.height * (nw / nh));
      var ch = cw * nh / nw;
      /* ⚠️⚠️ **transform-origin 是相对元素自身 border box 的**，所以门洞位置必须用
         "图片在 subject 盒里的偏移"去算。第一版用的是"图片相对**页头**的偏移"
         —— 那等于多加了一份 subject 在页头里的偏移（这里 64 / 346px），
         在 14 倍缩放下把画面整体推出去了几千像素：表现是"最后推到了宇航员的脚上"，
         而不是门洞。（2026-10-10 用 DOM 反解 origin 才定位到。） */
      var ix = ib.left - sb.left, iy = ib.top - sb.top;
      var ox = ix + (ib.width - cw) / 2 + DOOR.x * cw;
      var oy = iy + (ib.height - ch) + DOOR.y * ch;
      /* 锚点静止时的视口坐标。
         ⚠️ 页头的静止位置 = **导航条高度**（导航在文档流最上面、页头紧跟着它，
            钉住时也正好贴在它下面）。**不要用 offsetTop 链去推** —— sticky 元素的
            offsetTop 会带上钉住位移，一旦"滚到一半再 resize"触发重测，算出来的
            静止位置就是错的（那些量都是加载时量的，所以之前没暴露）。
         ⚠️ subject 在页头里的偏移用 (sb.top − hb.top)：两者同步位移，差是稳定的。 */
      dGeo = {
        ox: ox, oy: oy,
        ax: sb.left + ox,
        ay: (dNav ? dNav.offsetHeight : 0) + (sb.top - hb.top) + oy,
        dw: DOOR.w * cw, dh: DOOR.h * ch,
        heroH: diveHero.offsetHeight,
        navH: dNav ? dNav.offsetHeight : 0
      };
    };

    var dApply = function () {
      dTick = false;
      /* 行程非正 = 布局没给钉住留空间（窄屏 / 中途切成「减弱动态效果」）——
         必须把之前写进去的位移和透明度收回来，否则文案会卡在"已经飞走"的状态。 */
      if (dTravel <= 0 || !dGeo) {
        if (dCopy) { dCopy.style.transform = ''; dCopy.style.opacity = ''; }
        if (dSubj) dSubj.style.transform = '';
        if (dVoid) dVoid.style.opacity = '0';
        return;
      }
      var p = dClamp01((window.pageYOffset || doc.documentElement.scrollTop || 0) / dTravel);

      /* ① 文案先走：上移 + 淡出 */
      if (dCopy) {
        var t1 = dClamp01(p / D_TEXT_END);
        var e1 = 1 - Math.pow(1 - t1, 1.5);      /* 起步就有速度，收尾化掉 */
        dCopy.style.transform = 'translateY(' + (-D_OUT_VH * e1).toFixed(2) + 'vh)';
        dCopy.style.opacity = (1 - dClamp01(t1 / 0.85)).toFixed(3);
      }

      /* ② 镜头往门洞里扎：锚点 = 门洞
         ⚠️⚠️ **平移必须比缩放先到位**。两者用同一条进度曲线时踩过坑：
            放大到 7 倍时锚点还差 95px 没到画面中心，那 95px 被放大成画面里的
            274px —— 结果镜头是贴着门洞"往下看"，最后几帧看到的是亮堂堂的舷梯，
            不是门洞里的暗部（"直至黑屏"就废了）。
            现在平移在缩放行程的前 45% 内就走完，之后是**纯居中的推近**。 */
      var t2 = dClamp01((p - D_ZOOM_AT) / (1 - D_ZOOM_AT));
      var e2 = Math.pow(t2, D_ZOOM_POW);                  /* 缩放：越放越快 */
      var eT = 1 - Math.pow(1 - dClamp01(t2 / D_MOVE_END), 2);   /* 平移：先到位 */
      var kMax = Math.max(window.innerWidth / dGeo.dw, window.innerHeight / dGeo.dh) * D_OVER;
      var sc = 1 + (kMax - 1) * e2;
      if (dSubj) {
        var cxT = window.innerWidth / 2;
        var cyT = dGeo.navH + dGeo.heroH / 2;
        var tx = (cxT - dGeo.ax) * eT;
        var ty = (cyT - dGeo.ay) * eT;
        dSubj.style.transformOrigin = dGeo.ox.toFixed(1) + 'px ' + dGeo.oy.toFixed(1) + 'px';
        dSubj.style.transform = 'translate(' + tx.toFixed(2) + 'px, ' + ty.toFixed(2) +
                                'px) scale(' + sc.toFixed(4) + ')';
      }

      /* ③ 黑场 */
      if (dVoid) {
        dVoid.style.opacity =
          dClamp01((p - D_VOID_AT) / (D_VOID_END - D_VOID_AT)).toFixed(3);
      }
    };

    var dScroll = function () {
      if (dTick) return;
      dTick = true;
      window.requestAnimationFrame(dApply);
    };

    dMeasure();
    dApply();
    window.addEventListener('scroll', dScroll, { passive: true });
    window.addEventListener('resize', function () { dMeasure(); dScroll(); });
    if (dImg && !dImg.complete) dImg.addEventListener('load', function () { dMeasure(); dApply(); });
  }

  /* ----------------------------------------------------------------------
     7. 逐行浮现

     找每一「行」（作品条目、章节标题区），把它里面的 .reveal-line
     按出现顺序依次点亮，延迟写进 --d。
     用同一套逻辑跑所有行，所以加新条目不用改这里。

     ⚠️⚠️ **这里漏一个选择器 = 那一块内容永远看不见。**
         `.js .reveal-line` 的初始态是 opacity: 0，只有这里的 revealRow
         才会加上 .is-in 把它点亮。没被这个列表覆盖到的 .reveal-line
         就永远停在 0 —— 页面不会报错，只是那一整块空空如也。

         2026-10-08 实际踩过：平面设计页加了一版 25 条目的 `.pages` 网格，
         忘了把它加进下面的列表，结果「全部版面」整段是黑的，
         截图只有 12KB（一片纯色）。量 DOM 才发现 25 个条目的
         computed opacity 全是 0（图其实都加载好了）。

         ⚠️ 另外注意 revealRow 用的是 `row.querySelectorAll('.reveal-line')`，
          **不包含 row 自己**。所以放进这个列表的必须是一个**容器**
          （里面裹着若干 .reveal-line），或者用下面那句把自身也带上。
     ---------------------------------------------------------------------- */
  /* ⚠️ 这个列表**就是**「哪些容器里的 .reveal-line 会被点亮」的白名单。
     新加一整块带 .reveal-line 的内容时，必须把它的容器加进来 ——
     漏了不会报错，只是那一块永远停在 opacity: 0（见上面的注释）。
     2026-10-13 加 `.clips`（AI视频页的讲课片段卡片）。 */
  var staggerRows = doc.querySelectorAll(
    '.work, .section__head, .gallery, .pages__item, .promo, .plate, .clips,'
    + ' .gx-head, .gx-card, .gx-shot--wide,'
    + ' .llm-head, .llm-card, .llm-tile, .llm-spec__item, .empty-state');
  if (staggerRows.length) {
    var revealRow = function (row) {
      var lines = row.querySelectorAll('.reveal-line');
      /* 行自己就带着 .reveal-line 的情况（比如 .pages__item）——
         querySelectorAll 不匹配自身，要单独补上，否则整块点不亮。 */
      if (row.classList.contains('reveal-line')) {
        var merged = [row];
        for (var m = 0; m < lines.length; m++) merged.push(lines[m]);
        lines = merged;
      }
      for (var i = 0; i < lines.length; i++) {
        lines[i].style.setProperty('--d', (i * 90) + 'ms');
        lines[i].classList.add('is-in');
      }
    };

    if (!('IntersectionObserver' in window)) {
      for (var r0 = 0; r0 < staggerRows.length; r0++) revealRow(staggerRows[r0]);
    } else {
      var sio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          revealRow(e.target);
          sio.unobserve(e.target);   /* 只播一次，来回滚不会反复动 */
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

      for (var r1 = 0; r1 < staggerRows.length; r1++) {
        var row = staggerRows[r1];
        /* 首屏里已经在视野内的直接点亮，不要等滚动 */
        var box = row.getBoundingClientRect();
        if (box.top < window.innerHeight * 0.88) revealRow(row);
        else sio.observe(row);
      }
    }
  }

  /* ----------------------------------------------------------------------
     8. 首页：一旦有下拉动作，缓动滚到下方内容

     只在 index.html 生效（靠 .hero 是否存在判断）。
     三个边界很重要，否则会变成「滚不动」的糟糕体验：
       · 只在接近顶部时触发 —— 用户已经滚到中间了就不该再劫持
       · 只认向下 —— 向上滑必须放行
       · 触发过一次就锁住，等滚回顶部才解锁
     另外系统开了「减弱动态效果」就整个不启用 ——
     突然跳一屏对这类用户是负体验。

     ⚠️ **不用 `scrollIntoView({behavior:'smooth'})`，自己写滚动动画。**
        它的时长由浏览器定：这个距离（约一屏 900px）实测 0.5 秒左右走完，
        又急又硬，用户反馈「跳的过程太猛，像换页」。这里用 rAF 拉长到 1.1 秒
        并加缓入缓出，位移是一段看得见的滑行，而不是一次跳切。
     ⚠️ 动画期间必须把 `html` 上的 `scroll-behavior` 临时关掉 ——
        不关的话 `scrollTo` 自己也是平滑的，会和这个 rAF 循环打架
        （每一帧都启动一次浏览器自己的动画，结果卡住或抽搐）。
     ---------------------------------------------------------------------- */
  var heroEl = doc.querySelector('.hero');
  var mainEl = doc.getElementById('main');
  if (heroEl && mainEl && !(reduceMotion && reduceMotion.matches)) {
    var TOP_ZONE = 32;      /* 距顶多少像素以内算「还在首屏」 */
    var GLIDE_MS = 1100;    /* 滑过去用多久（原来是浏览器定的约 500ms） */
    var jumped = false;
    var rootStyle = doc.documentElement.style;

    /* easeInOutCubic：两头慢、中间快，才像「滑过去」而不是「甩过去」 */
    var glideEase = function (x) {
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    };

    var glideToMain = function () {
      jumped = true;

      var y0 = window.pageYOffset || doc.documentElement.scrollTop || 0;
      var off = parseFloat(window.getComputedStyle(mainEl).scrollMarginTop) || 0;
      var target = Math.max(0, Math.round(
        mainEl.getBoundingClientRect().top + y0 - off));
      if (target <= y0 + 4) return;          /* 已经在内容区了，别动 */

      var prevBehavior = rootStyle.scrollBehavior;
      rootStyle.scrollBehavior = 'auto';

      var t0 = 0;
      var lastWritten = -1;

      var step = function (now) {
        /* 用户自己又滚了（触屏惯性、键盘、拖滚动条）就立刻让位，别跟他抢 */
        if (lastWritten >= 0 &&
            Math.abs((window.pageYOffset || doc.documentElement.scrollTop || 0)
                     - lastWritten) > 4) {
          rootStyle.scrollBehavior = prevBehavior;
          return;
        }
        if (!t0) t0 = now;
        var p = Math.min(1, (now - t0) / GLIDE_MS);
        var v = y0 + (target - y0) * glideEase(p);
        window.scrollTo(0, v);
        lastWritten = v;
        if (p < 1) {
          window.requestAnimationFrame(step);
        } else {
          rootStyle.scrollBehavior = prevBehavior;
        }
      };
      window.requestAnimationFrame(step);
    };

    var atTop = function () {
      return (window.pageYOffset || doc.documentElement.scrollTop || 0) <= TOP_ZONE;
    };

    /* 鼠标滚轮 */
    window.addEventListener('wheel', function (e) {
      if (e.deltaY <= 0 || jumped || !atTop()) return;
      e.preventDefault();
      glideToMain();
    }, { passive: false });

    /* 触屏：记起点，判断是「往下滑」才触发 */
    var touchY = 0;
    window.addEventListener('touchstart', function (e) {
      touchY = e.touches[0].clientY;
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (jumped || !atTop()) return;
      if (touchY - e.touches[0].clientY < 14) return;   /* 向上滑放行 */
      glideToMain();
    }, { passive: true });

    /* 键盘 */
    window.addEventListener('keydown', function (e) {
      if (jumped || !atTop()) return;
      if (['ArrowDown', 'PageDown', ' ', 'Spacebar'].indexOf(e.key) === -1) return;
      e.preventDefault();
      glideToMain();
    });

    /* 滚回顶部就解锁，允许再触发一次 */
    window.addEventListener('scroll', function () {
      if ((window.pageYOffset || doc.documentElement.scrollTop || 0) < 8) jumped = false;
    }, { passive: true });
  }

  /* ----------------------------------------------------------------------
     9. 滚动显现
     ---------------------------------------------------------------------- */
  var reveals = doc.querySelectorAll('.reveal');

  if (reveals.length) {
    if (!('IntersectionObserver' in window)) {
      /* 老浏览器：直接全显示 */
      for (var i = 0; i < reveals.length; i++) reveals[i].classList.add('is-in');
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);   /* 只播一次 */
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

      for (var j = 0; j < reveals.length; j++) {
        var el = reveals[j];
        /* 首屏内的元素立刻显示，不要等滚动 */
        var rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.9) el.classList.add('is-in');
        else io.observe(el);
      }
    }
  }

  /* ----------------------------------------------------------------------
     10. 首页精选作品带：自动向左滑，滑到头就停；全程仍可手动拖

     起点在最左（此时**左边**留出版心空白，首图与内容列对齐），
     用户滚到这一屏时自动向右推进，滑到最右停住
     （此时**右边**留出版心空白，末图停在内容列右边界）。
     两头都由 site.css 第 11 节里 .band__track 的 padding-inline 决定。

     **为什么不用纯 CSS 的 marquee 动画**：需求同时要「自动滑」和「能手动拖」。
     CSS 动画改的是 transform，手动滚动改的是 scrollLeft —— 两套坐标系，
     混在一起必然互相打架（拖完一松手会被动画拽回原位）。
     所以统一只用一个 scrollLeft：自动滑 = 每帧加一点，手动拖 = 直接写它。

     滑到最右就停住，**不循环**。因此不需要克隆第二套内容，
     也就没有「同一件作品被看到两次」和「两份视频进度不同步」这些问题 ——
     代码比无限循环版简单一截。
     ---------------------------------------------------------------------- */
  var bandEl = doc.querySelector('.band');
  var bandTrack = bandEl && bandEl.querySelector('.band__track');

  if (bandEl && bandTrack && bandTrack.children.length) {
    var setCount = bandTrack.children.length;

    /* 顺序随机。每次刷新重排一次，所以加新卡片不用手动安排谁在前谁在后。 */
    var bandOrder = [];
    for (var bo = 0; bo < setCount; bo++) bandOrder.push(bo);
    for (var bs = setCount - 1; bs > 0; bs--) {
      var bj = Math.floor(Math.random() * (bs + 1));
      var bt = bandOrder[bs]; bandOrder[bs] = bandOrder[bj]; bandOrder[bj] = bt;
    }
    for (var bk = 0; bk < setCount; bk++) {
      bandTrack.appendChild(bandTrack.children[bandOrder[bk]]);
    }

    var bandVideos = bandTrack.querySelectorAll('video');

    /* 每秒滑多少像素。想快想慢改这一个数。
       参考值（1440 宽视口，一张卡片约 650px，整条可滑 2930px）：
             45  → 14.4 秒/张，整条 65 秒   ← 最初，慢到看不出在动
            120  →  5.4 秒/张，整条 24 秒
            180  →  3.6 秒/张，整条 16 秒   ← 用户嫌太快
            150  →  4.3 秒/张，整条 20 秒   ← 现在
       ⚠️ 实测（_diag_band_speed.py）写的值基本能按比例落下来：150 实测 156.8 px/s。
          （最初 45 却实测到 60 —— 那一档每帧只走 0.75px，误差占比大。）
    /* ⚠️ 2026-10-16：这一步重写注释时用索引切片替换，**把声明本身一起切掉了** ——
       只留了注释、没留 `var BAND_SPEED`。node --check 只查语法，少一个 var 是运行时
       ReferenceError，它查不出来；表现就是整个自动滑一声不响地全停（bandStep
       每帧抛异常、rAF 链断掉，而闭包里 bandRun 还停在 true）。
       做这种「整段替换」时，替换串的末尾必须把原来的语句原样带上。 */
    var BAND_SPEED = 150;     /* 每秒滑多少像素 */
    var BAND_RESUME = 1800;   /* 用户手动操作后停多久恢复自动（毫秒） */
    var BAND_DWELL = 2000;    /* 光标在带子上停留多久才算「在看这一张」→ 停住（3 秒太慢，改 2 秒） */
    var BAND_STAGGER = 90;    /* 相邻两张卡片之间差多少毫秒开始浮现 */
    var BAND_REVEAL = 620;    /* 单张卡片浮现用多久 —— 必须和 CSS 里的过渡时长一致 */

    var bandAuto = !prefersReduced;
    var bandHeld = false;     /* 用户刚操作过（拖过 / 横滚过），先别自动滑 */
    var bandDragging = false;
    /* 「停在上面看」与「路过」是两回事 —— 见下面 bandEnter / bandLeave。
       bandDwelling：光标已经在带子上停留够久了，停住别滑
       bandDwellTimer：还没到点的那段计时 */
    var bandDwelling = false;
    var bandDwellTimer = null;
    /* 还没确认进视野之前当作「不在视野」—— 否则页面刚加载时会先推进一帧
       才被 IntersectionObserver 纠正。没有 IO 的浏览器直接当可见。 */
    var bandInView = !('IntersectionObserver' in window);
    /* ⚠️⚠️ `bandFinished` = 「这次自动滑到此为止」的**一次性闩**。
       用户 2026-10-16 的最终要求：「滚动动画执行一次就行，如果用户用鼠标拉回去
       就不需要再滚动了」。
       置 true 的时机只有两个：
         · 自动滑自己走到最右（一次跑完）
         · 用户自己横着动了这条带子（拖 / 横滚 / 横划）—— 他接手了，就别再自作主张
       置上之后 bandStart 直接 return、bandStep 也立刻收循环，**本次加载内不再自动滑**，
       刷新页面才重来。

       ⚠️ 历史：这里一度**没有**闩，理由写在当时 `bandEndDrag` 的注释里
          （「拖回左边之后，自动滑接着从当前位置走」）—— 那句注释和用户真正想要的
          是相反的，已删。中间那版也确实是「拖回左边会接着滑」，用户看了之后
          明确要求改回一次性，所以这里不是简单地改回去，而是把闩的语义收窄成
          「跑完 **或** 用户接手」，不再像最早那样「只要碰到 max 就永久终止」。 */
    var bandFinished = false;
    var bandRun = false;      /* rAF 循环是否在跑 */
    var bandTouched = false;  /* 自动滑已经在动、或用户已经手动动过 */
    var bandIdle = null;
    var bandLast = 0;

    var bandHold = function () {
      bandTouched = true;
      bandHeld = true;
      if (bandIdle) clearTimeout(bandIdle);
      bandIdle = setTimeout(function () {
        bandHeld = false;
        /* 挂起结束时重新评估一次要不要接着滑。
           ⚠️ 必须有这一句：循环在「滑到最右」时会自己停掉（bandRun=false），
              而用户拖回左边 / 用触控板横滚回来走的都是这条路，
              没人再调 bandStart 的话它就永远停在那儿了。 */
        bandStart();
      }, BAND_RESUME);
    };

    /* 用户自己横着动了这条带子 —— 自动滑到此为止（一次性）。
       拖 / 横向滚轮 / 横向划都走这里。⚠️ 不放在 bandHold 里：
       bandHold 也会被 pointerdown（按下但没拖）触发，那样「点一下」就把动画废了。 */
    var bandTakeOver = function () {
      bandFinished = true;
      bandTouched = true;
      bandHold();
    };

    /* --- 「停在上面看」才停，路过不停（2026-10-16 用户要求）-------------------
       他原话：「鼠标悬停到卡片上3秒左右就让滚动动画停止，鼠标移开马上恢复滚动，
                但是鼠标经过不能让滚动动画停止」。
       ⚠️ 所以不能直接用 mouseenter 停 —— 那样鼠标从屏幕这头扫到那头、
          中间掠过带子一下就会把它停住（这正是他上一次抱怨的「鼠标扫过就停」）。
          做法：进入时**只起计时器**，停留够 BAND_DWELL 才真的停；
          中途移开就把计时器清掉，等于没发生过。
       ⚠️ 挂在 .band 上而不是每张卡片上：带子一直横移，卡片会从光标底下走过去，
          按卡片算的话光标每跨过一条卡片边界就要重新计时，语义反而乱
          （而且 180px/s 下一张卡 3.6 秒就过去了，几乎永远到不了 3 秒）。
          挂在容器上 = 「光标在带子上待够 3 秒」，稳定且好解释。
       ⚠️ 恢复是**马上**的：bandDwelling 只是挡住移动，rAF 循环一直没停，
          所以置回 false 的下一帧就接着滑，不用等 BAND_RESUME。
          这一点和 bandHeld（手动操作后等 1.8 秒）刻意分开。 */
    var bandEnter = function () {
      if (bandDwellTimer || bandDwelling) return;
      bandDwellTimer = setTimeout(function () {
        bandDwellTimer = null;
        bandDwelling = true;      /* 到点了：停住 */
      }, BAND_DWELL);
    };
    var bandLeave = function () {
      if (bandDwellTimer) { clearTimeout(bandDwellTimer); bandDwellTimer = null; }
      if (bandDwelling) bandDwelling = false;   /* 移开立刻放行 */
    };
    bandEl.addEventListener('mouseenter', bandEnter);
    bandEl.addEventListener('mouseleave', bandLeave);

    /* 还能滚多远。容器比内容宽时为 0，那就没有必要自动滑 */
    var bandMax = function () {
      return Math.max(0, bandEl.scrollWidth - bandEl.clientWidth);
    };

    var bandStep = function (ts) {
      /* 已经跑完 / 用户接手了 / 滚出屏幕了 / 标签页被切走 ——
         就把这个循环停掉，别让它在看不见的地方空转耗电。 */
      if (bandFinished || !bandInView || doc.hidden) { bandRun = false; return; }

      /* 切到别的标签页再切回来会有个巨大的时间差，夹住，否则会瞬移一大段 */
      var dt = bandLast ? Math.min(ts - bandLast, 64) : 16;
      bandLast = ts;

      if (!bandHeld && !bandDragging && !bandDwelling) {
        /* 起点在最左（左边留出版心空白），一路向右推进到最右
           （末图停在版心右边界，右边留白）。
           ⚠️ 是**加**不是减 —— 写成减会在起点就立刻归零、什么都不动。 */
        var max = bandMax();
        var next = bandEl.scrollLeft + BAND_SPEED * dt / 1000;
        if (next >= max) {
          /* 一次跑完：停在最右，并落下一次性闩（本次加载不再自动滑）。 */
          bandEl.scrollLeft = max;
          bandTouched = true;
          bandFinished = true;
          bandRun = false;
          return;
        }
        bandEl.scrollLeft = next;
        bandTouched = true;
      }
      window.requestAnimationFrame(bandStep);
    };

    var bandShown = false;
    var bandPending = 0;

    /* 卡片逐张浮现。返回「还要等多久才浮完」——已经浮过就返回 0。
       延迟不写死在 CSS 里，而是按 DOM 顺序写进 --d，所以加卡片不用动样式。 */
    var bandShow = function () {
      if (bandShown) return 0;
      bandShown = true;
      var list = bandTrack.children;
      for (var i = 0; i < list.length; i++) {
        list[i].style.setProperty('--d', (i * BAND_STAGGER) + 'ms');
        list[i].classList.add('is-in');
      }
      return (list.length - 1) * BAND_STAGGER + BAND_REVEAL;
    };

    var bandStart = function () {
      if (bandRun || bandFinished || !bandAuto || !bandInView) return;
      bandRun = true;

      /* 先让卡片一张张浮起来，**浮完再开始滑** ——
         一边浮现一边横移会糊成一团，看不出是「逐张出现」。 */
      var wait = bandShow();
      bandLast = 0;              /* 重置，否则重新进视野那一刻会按旧时间差跳一下 */
      if (wait > 0) {
        clearTimeout(bandPending);
        bandPending = setTimeout(function () {
          window.requestAnimationFrame(bandStep);
        }, wait);
      } else {
        window.requestAnimationFrame(bandStep);
      }
    };

    /* --- 鼠标拖动 ---------------------------------------------------------
       ⚠️ 只接管鼠标。触屏交给浏览器原生滚动 —— 自己实现的那套惯性
          永远不如系统的跟手。 */
    var bandDragX = 0, bandDragLeft = 0, bandDragId = null, bandMoved = false;

    bandEl.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      bandDragging = true;
      bandMoved = false;              /* 每次按下都重置，否则「拖过」会粘住 */
      bandDragX = e.clientX;
      bandDragLeft = bandEl.scrollLeft;
      bandDragId = e.pointerId;
      bandEl.classList.add('is-dragging');
      bandHold();
      try { bandEl.setPointerCapture(e.pointerId); } catch (err) {}
    });

    bandEl.addEventListener('pointermove', function (e) {
      if (!bandDragging || e.pointerId !== bandDragId) return;
      var dx = e.clientX - bandDragX;
      if (Math.abs(dx) > 5) bandMoved = true;   /* 超过 5px 算「拖」，不算「点」 */
      bandEl.scrollLeft = bandDragLeft - dx;
    });

    var bandEndDrag = function () {
      if (!bandDragging) return;
      bandDragging = false;
      bandEl.classList.remove('is-dragging');
      try { bandEl.releasePointerCapture(bandDragId); } catch (err) {}
      bandDragId = null;
      /* 真的拖动过（不是点一下）→ 用户接手，自动滑到此为止。
         ⚠️ 原来这里写的是「拖回左边之后，自动滑接着从当前位置走」——
            那是错的，用户 2026-10-16 明确要求「拉回去就不需要再滚动了」。 */
      if (bandMoved) bandTakeOver(); else bandHold();
    };
    bandEl.addEventListener('pointerup', bandEndDrag);
    bandEl.addEventListener('pointercancel', bandEndDrag);

    /* 拖完不能顺带把链接点开。用捕获阶段拦，抢在 <a> 的默认行为之前。 */
    bandEl.addEventListener('click', function (e) {
      if (!bandMoved) return;
      e.preventDefault();
      e.stopPropagation();
      bandMoved = false;
    }, true);

    /* 拖动时别触发浏览器原生的「拖拽图片」幽灵图 */
    bandEl.addEventListener('dragstart', function (e) { e.preventDefault(); });

    /* 滚轮 / 手指：**只有在横着操作这条带子时**才让自动滑停一会儿。
       ⚠️⚠️ 这里原来是无条件 bandHold —— 纵向滚轮也算。而带子占满整个视口宽度，
          用户看这一屏时光标天然就在它上面，于是「滚页面」的每一个滚轮刻度
          都把自动滑暂停 BAND_RESUME（1.8 秒）。实测（_diag_band_hover.py）：
          光标停在带子上滚页面，5 秒只前进 1px；光标一移开立刻恢复 299px/5s。
          用户 2026-10-16 报的「拉到这一页不滚动 / 鼠标放上去还颤抖」就是这个 ——
          一停一走的循环看着就是抖。手机上更严重：竖滑翻页是常态，
          等于这条带子永远起不来。
       纵向滚轮滚的是整页，跟这条带子没关系，不该停它；
       横向滚轮才是「用户在自己滑这条带子」。 */
    bandEl.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) bandTakeOver();
    }, { passive: true });

    /* 手指同理 —— 只有横向手势才算在滑带子。
       原来 touchstart 也无条件 hold，竖滑翻页一碰就暂停。
       起点记在 touchstart 上，方向在 touchmove 里判。 */
    var bandTouchX = 0, bandTouchY = 0;
    bandEl.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches[0]) {
        bandTouchX = e.touches[0].clientX;
        bandTouchY = e.touches[0].clientY;
      }
    }, { passive: true });
    bandEl.addEventListener('touchmove', function (e) {
      if (!e.touches || !e.touches[0]) return;
      if (Math.abs(e.touches[0].clientX - bandTouchX) >
          Math.abs(e.touches[0].clientY - bandTouchY)) bandTakeOver();
    }, { passive: true });

    /* --- 视频只在真的露出来时才播 -----------------------------------------
       全部一起解码 CPU 吃不消，也没必要。 */
    if (bandAuto && bandVideos.length && 'IntersectionObserver' in window) {
      var bandVio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var v = en.target;
          if (en.isIntersecting) {
            var pr = v.play();
            if (pr && pr.catch) pr.catch(function () { /* 被拦就停在首帧，不影响阅读 */ });
          } else if (!v.paused) {
            v.pause();
          }
        });
      }, { root: bandEl, threshold: 0.3 });
      for (var bvi = 0; bvi < bandVideos.length; bvi++) bandVio.observe(bandVideos[bvi]);
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        bandInView = entries[0].isIntersecting;
        if (bandInView) bandStart();     /* 滚进视野就开始；离开再回来接着滑 */
      }, { threshold: 0 }).observe(bandEl);
    }

    doc.addEventListener('visibilitychange', function () {
      if (!doc.hidden) bandStart();
    });

    /* 还没动过的话，重新摆一次起点（视口宽度变了，留白量也跟着变） */
    var bandReinit = function () {
      if (!bandTouched) bandEl.scrollLeft = 0;
      bandStart();
    };
    window.addEventListener('resize', bandReinit);
    window.addEventListener('load', bandReinit);

    /* 一开始就归零：用户滚过来之前停在最左，也就是「左边留出版心空白」那一屏。
       要等进了视野才动，所以这里只摆位、不启动。 */
    bandEl.scrollLeft = 0;

    /* ⚠️ 减弱动态效果下 bandStart 会直接返回，卡片就永远停在初始的 opacity:0。
       CSS 那条 media query 虽然也写死成可见了，但这里必须再点一次 ——
       两道保险都关掉才可能出白块。 */
    if (!bandAuto) bandShow();

    bandStart();
  }

  /* ----------------------------------------------------------------------
     11. 首页导航：滚动之后加背景

     导航已经改成 position: fixed（见 site.css 第 2 节），会一直浮在最上层。
     但停在页面顶部时不能给它背景和分隔线 —— 首屏要保持 PSD 的「纯平无装饰」，
     多一条线就多了一样 PSD 里没有的东西。所以滚起来之后才加。

     子页面用的是 .site-nav--bar，是常驻粘顶条 —— 那套见下面 11b。
     ---------------------------------------------------------------------- */
  var heroNav = doc.querySelector('.site-nav--hero');
  if (heroNav) {
    var syncNavBackdrop = function () {
      var y = window.pageYOffset || doc.documentElement.scrollTop || 0;
      heroNav.classList.toggle('is-stuck', y > 8);
    };
    window.addEventListener('scroll', syncNavBackdrop, { passive: true });
    syncNavBackdrop();
  }

  /* ----------------------------------------------------------------------
     11b. 深色页的粘顶导航：压在首屏上时透明，滚过去才长出底色和分割线

     ⚠️ 只在深色页（`html.theme-dark`）做。浅色内页的导航是浅色带压在
        浅色页头上，本来就顺；深色页不行 —— --nav-veil 压在纯黑首屏上
        合出来是 #090909 比首屏亮，再加一条分割线，顶上就是「灰带 + 白线」
        （用户 2026-10-08 圈出来要求去掉）。样式见 site.css 第 15 节。

     判定线 = 首屏底边滚到导航条下沿的那一刻。
     用首屏的**文档坐标**（getBoundingClientRect().bottom + 已滚动距离）算，
     不用 offsetTop —— offsetTop 是相对 offsetParent 的，页面结构一改就错。
     ---------------------------------------------------------------------- */
  (function () {
    if (!root.classList.contains('theme-dark')) return;
    var bar = doc.querySelector('.site-nav--bar');
    if (!bar) return;
    var anchor = doc.querySelector('.cover-hero, .page-hero');
    if (!anchor) return;

    var trigger = Infinity;
    var measure = function () {
      trigger = anchor.getBoundingClientRect().bottom
        + (window.pageYOffset || doc.documentElement.scrollTop || 0)
        - bar.offsetHeight;
    };
    var sync = function () {
      var y = window.pageYOffset || doc.documentElement.scrollTop || 0;
      bar.classList.toggle('is-stuck', y > trigger);
    };

    measure();
    sync();
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', function () { measure(); sync(); }, { passive: true });
    /* 首屏里那张主体图是 fetchpriority=high 但仍在加载完成后才占位，
       图片一落地文档高度会变，所以要再量一次 */
    window.addEventListener('load', function () { measure(); sync(); });
  })();

  /* ----------------------------------------------------------------------
     12. 首页「把想法做成东西」：滚到这一屏时变成彩色

     做法：深色字上面叠一个克隆出来的 span（.scroll-fill__layer），
     它铺满**竖向**渐变（--grad-title，橙红→浅粉）并用 mask 只露出上面一截，
     这一截跟着滚动进度**往下长** —— 颜色从字的上沿往下漫。

     渐变方向是竖的、填色方向也是竖的，两者一致；早先做成了横向彩虹 + 从左往右填，
     不是需求要的。

     **进度怎么算**：元素**刚好完整进入视口**时算 0，升到视口 42% 高处算 1。
     这样颜色和滚动位置严格对应 —— 往回滚会退回去，
     不会卡在「已经变完」的状态回不来。

     ⚠️ 起点不能用「元素顶边刚碰到视口底边」（那是我第一版写的）：
        那一刻整句话还在屏幕外，填色的前段全花在看不见的地方，
        用户滚了半天一个字都没变色。用 offsetHeight 把起点推到「刚好看全」。

     ⚠️ 写进去的 --p 是 **-16% ~ 116%**，不是 0 ~ 100%。
        mask 那条线性渐变要靠 --p 和 (--p − 16%) 两个停点夹出一条 16% 的羽化带，
        所以两头各得留出这 16%：p=0 时 -16% 才能让整条 mask 落在负方向、颜色全隐，
        p=1 时 116% 才能保证最下面一行笔画完全被盖住。
        改成 0~100% 的话，开头会残留一小截颜色、结尾笔画会缺一角。
        （16% 这个数只有 58px 高，折合约 9px 羽化；横向那版用 6% 是因为有 333px 宽。）

     减弱动态效果时**直接给最终态**（全彩），不留中间态 ——
     与站内其它动画「内容直接就是最终状态」的取向一致。
     ---------------------------------------------------------------------- */
  var fillEl = doc.querySelector('.scroll-fill');
  if (fillEl) {
    /* 两层都是 JS 就地搭出来的，HTML 里只有一份文字，改字只改一处：
         .scroll-fill__base   现有的文字原样搬进去（深色底字）
         .scroll-fill__layer  克隆一份，铺渐变（aria-hidden，否则读屏念两遍）
       ⚠️ 两层要能各带一个 mask，就不能是父子关系 ——
          mask 会连同子树一起裁掉。所以这里把底字包成兄弟节点。 */
    var fillBase = doc.createElement('span');
    fillBase.className = 'scroll-fill__base';
    while (fillEl.firstChild) fillBase.appendChild(fillEl.firstChild);
    fillEl.appendChild(fillBase);

    var fillLayer = doc.createElement('span');
    fillLayer.className = 'scroll-fill__layer';
    fillLayer.setAttribute('aria-hidden', 'true');
    fillLayer.textContent = fillBase.textContent.replace(/\s+/g, ' ').trim();
    fillEl.appendChild(fillLayer);

    var FEATHER = 16;                   /* 羽化带宽（%），与 CSS 里那两个停点对齐 */
    var fillReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    var fillApply = function () {
      if (fillReduced.matches) {
        fillEl.style.setProperty('--p', (100 + FEATHER) + '%');
        return;
      }
      var vh = window.innerHeight || doc.documentElement.clientHeight;
      var top = fillEl.getBoundingClientRect().top;
      /* 起点：整句话刚好完整进入视口的那一刻 */
      var start = vh - fillEl.offsetHeight;
      var end = vh * 0.42;              /* 终点：顶边升到 42% 视口高 */
      var t = (start - top) / (start - end);
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      fillEl.style.setProperty('--p',
        (-FEATHER + t * (100 + FEATHER * 2)).toFixed(2) + '%');
    };

    /* 滚动事件一帧可能来好几次，用 rAF 合并成每帧算一次 */
    var fillTick = 0;
    var fillOnScroll = function () {
      if (fillTick) return;
      fillTick = window.requestAnimationFrame(function () {
        fillTick = 0;
        fillApply();
      });
    };

    window.addEventListener('scroll', fillOnScroll, { passive: true });
    window.addEventListener('resize', fillOnScroll, { passive: true });
    /* 用户中途改系统设置时要重新算一次，否则会卡在某个中间态 */
    if (fillReduced.addEventListener) fillReduced.addEventListener('change', fillApply);
    fillApply();
  }

  /* ----------------------------------------------------------------------
     13. 图片查看器（lightbox）：点图看大图 + **缩放 / 平移**

     2026-10-10 用户两轮要求：
       ①「用户点击图片要可以查看图片详情，然后点击空白的地方要退出查看模式」
       ②「查看图片详情的时候要可以放大缩小」

     · 触发器用**事件委托**挂在 document 上：平面设计页有一百多张作品图，
       逐张 addEventListener 没必要；而且那些图是生成器
       （build_design_pages.py）产出的，逐个挂监听等于把交互绑到生成器上。
     · 关闭三条路：① 点空白处（**只有遮罩本身**算，点到大图上不算）
                    ② 点右上角 ×
                    ③ 按 Esc
     · 缩放：滚轮（触控板双指）／＋－按钮／双击／键盘 + - 0；触摸是双指捏合。
       放大之后可以**拖动平移**（鼠标拖、单指拖）。
     · 滚动锁沿用移动端抽屉那一招（`body.style.overflow`），另外补一条
       padding-right 抵消滚动条消失 ——
       ⚠️ 不补的话，打开的一瞬间背后的内容会整体右移十几像素（Windows 上
          滚动条是真的占宽），关掉再跳回来，很显眼。

     ⚠️ 可点开的图 = `ZOOM_SEL` 里那几类。**要加一类就只改这个常量**，
        别在别处再写一遍选择器。目前故意**不含**：
          · 首页作品带（`.band__item img`）—— 它们整条是去 design.html 的链接，
            改成点开查看会把跳转弄没；
          · AI 视频页画廊缩略图（`.gallery__thumb img`）—— 同理，外层是锚点链接；
          · 两块方板上的机甲图（`.plate__mecha img`）—— 那是配图不是作品，
            放大只会看见生成的瑕疵。

     ---- 缩放这块的四个约定（改之前先读）----
     ① **不用改 width/height 那套，用 transform**：`translate(tx,ty) scale(s)`。
        改尺寸会触发布局，caption 会跟着跳；transform 不动布局、也不掉帧。
     ② `transform-origin: 50% 50%`（写在 CSS 里）。于是坐标关系是
        `屏幕位置 = 图片中心 + t + s × (图内偏移)`，
        "缩放时盯住鼠标那一点"就是 `t' = k − (s'/s)(k − t)`，k 是鼠标相对图片中心。
     ③ **`s = 1` 就是"适口大小"**（图片刚好放进可用区），不是原图 1:1。
        界面上显示的是**相对原图的百分比** `s × fitW / naturalWidth` ——
        设计师看得懂这个数（竖幅图一打开就是 79%，因为屏幕上放不下）。
     ④ 缩放上限按**原图 2 倍**封顶，同时给 3 倍下限（小图也够看），
        再夹到 8 倍以内。见 `maxS`。
     ---------------------------------------------------------------------- */
  var ZOOM_SEL = '.promo__work img, .promo__posters img';
  (function () {
    var zoomables = doc.querySelectorAll(ZOOM_SEL);
    if (!zoomables.length) return;

    var lb = doc.createElement('div');
    lb.className = 'lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', '图片查看');

    var big = doc.createElement('img');
    big.className = 'lb__img';
    /* ⚠️ 大图 alt 留空：作品名由下面那行文字念一遍就够了，
       两边都填读屏会念两遍同一个名字。 */
    big.alt = '';
    /* ⚠️ 关掉原生拖拽：不然按住图片拖动会触发浏览器"拖图片"那个动作
       （一个半透明残影跟着鼠标），平移就废了。 */
    big.draggable = false;

    var cap = doc.createElement('p');
    cap.className = 'lb__cap';
    var capName = doc.createElement('span');
    var capHint = doc.createElement('span');
    capHint.className = 'lb__hint';
    capHint.textContent = '滚轮 / 双指缩放 · 拖动平移 · 点空白处或 Esc 退出';
    cap.appendChild(capName);
    cap.appendChild(capHint);

    var mkBtn = function (glyph, label, cls) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'lb__btn' + (cls ? ' ' + cls : '');
      b.setAttribute('aria-label', label);
      b.textContent = glyph;
      return b;
    };
    var zout = mkBtn('−', '缩小');           /* 真减号 U+2212，不是连字符 */
    var zin = mkBtn('+', '放大');
    var pct = doc.createElement('span');
    pct.className = 'lb__pct';
    pct.textContent = '100%';
    var close = mkBtn('×', '关闭图片查看', 'lb__close');

    var tools = doc.createElement('div');
    tools.className = 'lb__tools';
    tools.appendChild(zout);
    tools.appendChild(pct);
    tools.appendChild(zin);
    tools.appendChild(close);

    lb.appendChild(big);
    lb.appendChild(cap);
    lb.appendChild(tools);
    doc.body.appendChild(lb);

    /* 每张可点开的图：加上光标类（CSS 靠它给 zoom-in），并让它键盘可达。
       ⚠️ 加 tabindex 会让这一页多出一百多个 Tab 停靠点 —— 这是**故意的**：
          每张作品图都是一个打得开的东西，键盘用户不该被挡在门外。 */
    for (var i = 0; i < zoomables.length; i++) {
      var im = zoomables[i];
      im.classList.add('is-zoomable');
      im.setAttribute('tabindex', '0');
      im.setAttribute('role', 'button');
      im.setAttribute('aria-label',
        '查看大图：' + ((im.getAttribute('alt') || '').trim() || '作品图'));
    }

    /* ---------------- 缩放 / 平移的状态 ---------------- */
    var s = 1, tx = 0, ty = 0;        /* translate(tx,ty) scale(s)，origin 在图片中心 */
    var fitW = 0, fitH = 0;           /* s=1 时图片的排版尺寸 */
    var cx0 = 0, cy0 = 0;             /* s=1 时图片中心相对 .lb 左上角的位置 */
    var boxW = 0, boxH = 0;           /* 可用区 = .lb 的内边距盒 */
    var k1 = 1;                       /* 一个变换单位 = 原图的多少比例（fitW / naturalWidth） */
    var maxS = 3;
    var FIT_MIN = 1;

    var pctText = function () {
      if (!fitW || !k1) return '—';
      return Math.round(s * k1 * 100) + '%';
    };

    var apply = function () {
      if (!fitW) { big.style.transform = ''; return; }
      /* 越界夹紧：比可用区小就回正中间，大就限制在边界内 */
      var sw = fitW * s, sh = fitH * s;
      var lim = (sw - boxW) / 2;
      tx = sw <= boxW ? 0 : Math.max(-lim, Math.min(lim, tx));
      lim = (sh - boxH) / 2;
      ty = sh <= boxH ? 0 : Math.max(-lim, Math.min(lim, ty));

      big.style.transform = (s === 1 && tx === 0 && ty === 0) ? ''
        : 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) scale(' + s.toFixed(4) + ')';
      lb.classList.toggle('is-zoomed', s > 1.001);
      pct.textContent = pctText();
    };

    var measure = function () {
      /* ⚠️ 量之前先把 transform 摘掉 —— 不然 rect 是变换后的外接矩形
         （站里的老坑，缩放下差几千像素）。transform 不影响布局，
         所以这一摘不会让 caption 之类的东西动一下。 */
      big.style.transform = 'none';
      var r = big.getBoundingClientRect();
      var lr = lb.getBoundingClientRect();
      var cs = window.getComputedStyle(lb);
      fitW = r.width;
      fitH = r.height;
      cx0 = r.left + r.width / 2 - lr.left;
      cy0 = r.top + r.height / 2 - lr.top;
      boxW = lr.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      boxH = lr.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      var nw = big.naturalWidth || parseFloat(big.getAttribute('width')) || 0;
      k1 = (nw > 0 && fitW > 0) ? fitW / nw : 1;
      /* 上限：原图的 2 倍，但不小于 3 倍"适口大小"，最多 8 倍 */
      maxS = Math.max(3, Math.min(8, k1 > 0 ? 2 / k1 : 3));
      apply();
    };

    var resetZoom = function () { s = 1; tx = 0; ty = 0; apply(); };

    /* 以 (ux,uy) 为锚点缩放到 ns —— 鼠标那一点始终停在原处 */
    var zoomAt = function (ns, ux, uy) {
      ns = Math.max(FIT_MIN, Math.min(maxS, ns));
      if (!fitW) return;
      var lr = lb.getBoundingClientRect();
      var kx = ux - lr.left - cx0;
      var ky = uy - lr.top - cy0;
      var f = ns / s;
      tx = kx - f * (kx - tx);
      ty = ky - f * (ky - ty);
      s = ns;
      apply();
    };

    var zoomCenter = function (f) {
      var r = lb.getBoundingClientRect();
      zoomAt(s * f, r.left + r.width / 2, r.top + r.height / 2);
    };

    var lastFocus = null;
    var isOpen = function () { return lb.classList.contains('is-open'); };

    var open = function (img) {
      /* ⚠️ 焦点要记**被点开的那张图**，不是 `doc.activeElement` ——
         移动端/触摸点击**不会**给元素上焦点，那一刻 activeElement 是 body，
         关掉之后焦点就散到 body 了（键盘用户会从页首重新开始 Tab）。
         图片本身挂了 tabindex=0，是能接住焦点的。 */
      lastFocus = (img && img.focus) ? img : doc.activeElement;
      var name = (img.getAttribute('alt') || '').trim();
      capName.textContent = name;
      capName.style.display = name ? '' : 'none';
      /* 把宽高属性抄过来：图还没解码时也知道比例，排版不会先塌一下再弹开 */
      var wa = img.getAttribute('width'), ha = img.getAttribute('height');
      if (wa && ha) {
        big.setAttribute('width', wa);
        big.setAttribute('height', ha);
      } else {
        big.removeAttribute('width');
        big.removeAttribute('height');
      }
      resetZoom();
      big.src = img.currentSrc || img.src;
      lb.classList.add('is-open');
      doc.body.style.overflow = 'hidden';
      var sbw = window.innerWidth - root.clientWidth;
      doc.body.style.paddingRight = sbw > 0 ? sbw + 'px' : '';
      close.focus();
    };

    var shut = function () {
      if (!isOpen()) return;
      lb.classList.remove('is-open');
      big.removeAttribute('src');       /* 免得下次打开先闪一下上一张 */
      resetZoom();
      doc.body.style.overflow = '';
      doc.body.style.paddingRight = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      lastFocus = null;
    };

    /* 图解码完才知道"适口大小"和原图尺寸；顺带复位缩放 */
    big.addEventListener('load', function () {
      s = 1; tx = 0; ty = 0;
      measure();
    });
    window.addEventListener('resize', function () {
      if (!isOpen()) return;
      measure();
      resetZoom();
    });

    /* ---------------- 打开 ---------------- */
    doc.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.nodeName === 'IMG' && t.classList.contains('is-zoomable')) {
        e.preventDefault();
        open(t);
      }
    });

    /* 键盘：图片拿到焦点后回车/空格打开。
       ⚠️ 挂了 `role="button"` 就必须响应这两个键 —— 否则是"说了能按、其实不能"。 */
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      var t = e.target;
      if (t && t.nodeName === 'IMG' && t.classList.contains('is-zoomable')) {
        e.preventDefault();
        open(t);
      }
    });

    /* ---------------- 关闭 ---------------- */
    lb.addEventListener('click', function (e) {
      if (e.target === lb) shut();      /* ⚠️ 只有点在遮罩本身才算"空白处" */
    });
    close.addEventListener('click', shut);
    doc.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape' || e.key === 'Esc') shut();
      else if (e.key === '+' || e.key === '=') { zoomCenter(1.25); e.preventDefault(); }
      else if (e.key === '-' || e.key === '_') { zoomCenter(1 / 1.25); e.preventDefault(); }
      else if (e.key === '0') { resetZoom(); e.preventDefault(); }
    });

    /* ---------------- 缩放 ---------------- */
    zin.addEventListener('click', function () { zoomCenter(1.25); });
    zout.addEventListener('click', function () { zoomCenter(1 / 1.25); });

    /* 滚轮 / 触控板双指（后者带 ctrlKey，走同一条路）。
       ⚠️ 必须 passive:false，否则 preventDefault 无效、页面会跟着滚
          （虽然这时 body 已经锁了滚动，但触控板上会看到整页被"橡皮筋"拽）。 */
    lb.addEventListener('wheel', function (e) {
      e.preventDefault();
      /* 一格 deltaY≈100 → 1.0022^100 ≈ 1.25 倍，跟按钮一档对齐 */
      zoomAt(s * Math.pow(1.0022, -e.deltaY), e.clientX, e.clientY);
    }, { passive: false });

    /* 双击：放大到 2.5 倍 / 再双击回到适口大小 */
    lb.addEventListener('dblclick', function (e) {
      if (e.target !== big && e.target !== lb) return;
      if (s > 1.001) resetZoom();
      else zoomAt(2.5, e.clientX, e.clientY);
    });

    /* ---------------- 平移 ---------------- */
    var dragging = false, lastX = 0, lastY = 0;
    lb.addEventListener('mousedown', function (e) {
      if (s <= 1.001 || e.button !== 0 || e.target !== big) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lb.classList.add('is-dragging');
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      tx += e.clientX - lastX;
      ty += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      apply();
    });
    window.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      lb.classList.remove('is-dragging');
    });

    /* 触摸：双指捏合缩放 + 放大后单指拖动。
       ⚠️ 触摸事件不像鼠标那样"点一下"就够用，得自己算两指的距离和中点；
          `touchmove` 里 preventDefault 要 passive:false。 */
    var tDist = 0, tS = 1, tLast = null;
    var dist2 = function (e) {
      var a = e.touches[0], b = e.touches[1];
      return Math.sqrt(Math.pow(a.clientX - b.clientX, 2) + Math.pow(a.clientY - b.clientY, 2));
    };
    var mid2 = function (e) {
      var a = e.touches[0], b = e.touches[1];
      return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    };
    lb.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        tDist = dist2(e);
        tS = s;
        tLast = null;
      } else if (e.touches.length === 1 && s > 1.001 && e.target === big) {
        tLast = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });
    lb.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && tDist > 0) {
        e.preventDefault();
        var m = mid2(e);
        zoomAt(tS * (dist2(e) / tDist), m.x, m.y);
      } else if (e.touches.length === 1 && tLast) {
        e.preventDefault();
        tx += e.touches[0].clientX - tLast.x;
        ty += e.touches[0].clientY - tLast.y;
        tLast = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        apply();
      }
    }, { passive: false });
    lb.addEventListener('touchend', function (e) {
      if (e.touches.length < 2) tDist = 0;
      if (!e.touches.length) tLast = null;
    }, { passive: true });
  })();

  /* ----------------------------------------------------------------------
     25. 小游戏页首屏那片蓝光：改用 canvas 画

     用户 2026-10-15：「后面的蓝色背景你有办法渲染得好看点吗？」

     原来是一条 `radial-gradient` 铺满一屏。8 位的径向渐变在这么大的面积上
     一定有**色带**（banding）：暗部相邻两级的差值超过了眼睛的分辨阈值，
     看上去就是一圈一圈的台阶，截图里尤其明显。

     参考页（deepseek.com/harness）那片光晕**本来就是 canvas 画的**，做法也不复杂：
     几个不同位置/半径的径向渐变叠起来，再盖一层**噪点**。噪点把台阶打碎，
     眼睛就看不见带子了 —— 这是治 banding 的常规做法。

     ⭐ 2026-10-19 用户「这一页的背景我还是感觉不对，我想抄这个网页」→ 重做：
        · 把参考页的背景单独截出来（藏掉所有文字），做最小二乘拟合，
          得到「底色 rgb(12,18,25) + 8 个旋转高斯」，RMSE 1.45/255；
        · 上一版的形状是错的：它以为「左暗右亮」，其实亮核在左上偏中
          （nx≈0.29, ny≈0.06），右边只是一条更淡的斜带；
        · 噪点从 0.45 压到 0.10 —— 参考页外层 blur(20px) 早把颗粒抹平了，
          我们那版比它粗五六倍，看着是一层沙。

     为什么不用更省事的纯 CSS：
       · 多层 radial-gradient 也能做，但**加不了噪点**（CSS 没有便宜的逐像素噪声），
         带子治不掉；
       · SVG feTurbulence 可以当噪声层，但整块是滤镜，这么大的区域跑一次
         要几毫秒到几十毫秒，而且尺寸一变就得重算。

     ⭐ 2026-10-20 用户「背景的蓝色可以改成流动的蓝色光效吗？也要这样渐变过渡到黑色」
        → 从「画一次」改成「静态底图 + 每帧合成」：
          · 拟合出来的色场（底色 + 8 个高斯）不随时间变，**烘一次**到离屏画布；
          · 每帧只做：drawImage 底图 → 叠 3 团缓慢游走的淡蓝光（'lighter'）
            → 收边渐变 → 噪点。整帧 6 次绘制，30fps；
          · 首屏离开视口 / 标签页隐藏就停；`prefers-reduced-motion` 只画一帧。
        ⚠️ 光要在**收边之前**画，否则会跑到下半段的黑色里去。

     ⚠️ 只在页面里真有 `.harness-hero__glow` 时才跑 —— 其余五个页面连 canvas
        都不会创建。
     ⚠️ CSS 里那条 `radial-gradient` **保留着当兜底**：脚本没跑、被拦、
        或者浏览器不支持 canvas 时，首屏依然是深蓝的，只是有带子。
     ⚠️ 平滑的光晕先缩到**一半尺寸**画（最多 900px 宽），再让 CSS 拉伸 ——
        这是没有细节的渐变，缩一半看不出来，绘制量少到 1/4。
        ⚠️ 噪点也在同一张半分辨率画布上，会被拉成 2px 一颗 —— 所以它的
           幅度必须很小（0.10）。调到能看见颗粒就说明已经把参考页的
           blur 效果做没了。
     ---------------------------------------------------------------------- */
  (function () {
    var cv = doc.querySelector('.harness-hero__glow');
    if (!cv || !cv.getContext) return;
    var host = cv.parentNode;
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    /* 2026-10-20 起这里不再生成噪点贴片（用户要求去掉那层"布纹"）。
       防色带交给 CSS 的轻微模糊：`.harness-hero__glow { filter: blur(12px) }`。 */

    /* 一片光斑。坐标/半径都按**画布宽度**归一（画布是首屏等比缩小的，
       所以横竖同一个尺度），改尺寸不用重调。

       ⚠️ `ky` 是纵向压扁系数。`createRadialGradient` 画出来的是**正圆**，
          但参考页那片光晕是一条「横着铺开、往下掉得很快」的带子 ——
          圆画不出来。做法是把画布在纵向临时拉长 ky 倍再画圆，
          松开之后圆就是横躺的椭圆。

       ⚠️ `py` 用的是 `bw` 不是 `bh`。画布是 bh = bw * H / W，
          和首屏是等比关系，所以横竖必须用同一个基准；
          用 bh 的话，首屏一变高光斑就跟着往下跑。 */
    /* 一片高斯光斑：颜色按 exp(-4.5t²) 衰减（t = r / 3σ）。
       canvas 只认色标不认函数，所以把高斯离散成 11 个色标 ——
       σ 处（t=1/3）还剩 0.67，到 3σ 只剩 0.011，肉眼看就是归零。
       (cx, cy, sx, sy, th) 直接来自 `_shots/fit_glow.py` 的最小二乘拟合。 */
    var GAUSS = [1, .956, .835, .667, .487, .325, .198, .110, .056, .026, .011];

    function blob(g, W, cx, cy, sx, sy, th, ar, ag, ab) {
      var R = sx * 3 * W;             /* 3σ 当渐变半径 */
      g.save();
      g.translate(cx * W, cy * W);
      g.rotate(th || 0);
      g.scale(1, sy / sx);            /* 正圆 → 椭圆（先转后压） */
      var grd = g.createRadialGradient(0, 0, 0, 0, 0, R);
      var cr = Math.round(ar * 255), cg = Math.round(ag * 255), cb = Math.round(ab * 255);
      for (var k = 0; k < GAUSS.length; k++) {
        grd.addColorStop(k / (GAUSS.length - 1),
          'rgba(' + cr + ',' + cg + ',' + cb + ',' + GAUSS[k] + ')');
      }
      g.fillStyle = grd;
      var half = R * 1.25;
      g.fillRect(-half, -half, half * 2, half * 2);
      g.restore();
    }

    /* ---- 光斑贴图：3 团流动的光每帧都重建渐变太贵（实测整帧 ~30ms，只能跑 30fps）
       把每团光**按固定颜色**烘成一张 384px 的贴图，每帧只做 drawImage + globalAlpha。
       形状完全等价：blob() 里渐变半径是 R、填充范围是 ±R*1.25，
       所以贴图的半边长 192 对应 R*1.25，渐变半径对应 192*0.8。 */
    var SP = 384;
    function lightSprite(r, g, b) {
      var c = doc.createElement('canvas');
      c.width = SP; c.height = SP;
      var gg = c.getContext('2d');
      var grd = gg.createRadialGradient(SP / 2, SP / 2, 0, SP / 2, SP / 2, SP * 0.4);
      for (var k = 0; k < GAUSS.length; k++) {
        grd.addColorStop(k / (GAUSS.length - 1),
          'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' + GAUSS[k] + ')');
      }
      gg.fillStyle = grd;
      gg.fillRect(0, 0, SP, SP);
      return c;
    }

    /* ---- 静态色场：只画一次，烘到离屏画布 -------------------------------
       拟合出来的「底色 + 8 个高斯」本身不会动，每帧重画纯属浪费；
       烘成底图之后，每帧只要 drawImage 一次。 */
    var lastW = 0, sprites = null;
    var bw = 0, bh = 0, fadeTop = 0, fadeGrad = null;
    var base = doc.createElement('canvas');
    var bctx = base.getContext('2d');

    function bake() {
      var W = host.clientWidth, H = host.clientHeight;
      if (!W || !H || W === lastW) return false;
      lastW = W;

      bw = Math.max(320, Math.min(900, Math.round(W / 2)));
      bh = Math.max(180, Math.round(bw * H / W));
      cv.width = bw; cv.height = bh;         /* 改宽高会把 context 状态清掉，下面重设 */
      base.width = bw; base.height = bh;

      var g = bctx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgb(12,18,25)';         /* 拟合出来的底色 */
      g.fillRect(0, 0, bw, bh);

      /* [cx, cy, sx, sy, theta, ΔR, ΔG, ΔB] —— 坐标以画布宽度为单位。
         ⚠️ 这组数字是**最小二乘拟合**出来的，不是手调的：
            把参考页背景单独截出来（藏掉文字），降采样成 90×56 网格，
            用「底色 + 8 个可旋转、各向异性的高斯」逼近，RMSE 1.45/255。
            推导脚本 `_shots/fit_glow.py`，参数同步写在 `glow_params.json`。
            要改就三处一起改（这里 / fit_glow.py / CSS 兜底渐变）。 */
      g.globalCompositeOperation = 'lighter';
      var BLOBS = [
        [0.1575, 0.1334, 0.0985, 0.0535,  0.236, .1656, .1313, .0842],
        [0.8058, 0.1682, 0.3363, 0.2689,  0.956, .1286, .0706, .0000],
        [0.1405, 0.2364, 0.0478, 0.1511, -0.884, .0355, .0705, .1139],
        [0.2938, 0.0617, 0.1256, 0.0446,  0.192, .2340, .1727, .0905],
        [-0.0299, 0.4809, 0.0576, 0.0877, -0.316, .1674, .1744, .1782],
        [0.3268, 0.2941, 0.1138, 0.1738, -0.600, .0350, .0686, .1108],
        [0.8028, 0.3844, 0.2501, 0.1397,  0.316, .0384, .0889, .1548],
        [0.6389, 0.0476, 0.5044, 0.1773,  0.047, .0199, .1826, .3867]
      ];
      for (var bi = 0; bi < BLOBS.length; bi++) {
        var B_ = BLOBS[bi];
        blob(g, bw, B_[0], B_[1], B_[2], B_[3], B_[4], B_[5], B_[6], B_[7]);
      }

      /* 收边渐变预生成（每帧直接复用）。
         ⚠️ 匀速落到首屏底边，别用 smoothstep —— 它两端斜率为 0，
            末端会提前变成一片死黑的平板。 */
      fadeTop = Math.min(bh, Math.max(bw * 0.40, bh * 0.42));
      /* ⚠️ 渐变终点收在 bh*0.978 而不是 bh：画布比首屏四周各大 24px（给模糊留料），
         真正露出来的底边在画布 97.9% 处，那里必须已经是纯黑，否则会和
         下面的正文差 1 个色阶。 */
      fadeGrad = ctx.createLinearGradient(0, fadeTop, 0, Math.round(bh * 0.978));
      for (var fi = 0; fi <= 10; fi++) {
        fadeGrad.addColorStop(fi / 10, 'rgba(10,10,10,' + (fi / 10).toFixed(2) + ')');
      }
      return true;
    }

    /* ---- 流动的蓝光 -----------------------------------------------------
       2026-10-20 用户：「背景的蓝色可以改成流动的蓝色光效吗？也要这样渐变过渡到黑色」。
       三团很淡的光各自沿一条很慢的椭圆轨迹游走，叠在静态色场上面（'lighter'）。

       [cx0, cy0, ax, ay, 速度, 相位, rx, ry, 倾角, R, G, B, 峰值]
       ⚠️ 必须在**收边之前**画 —— 否则光会跑到下半段的黑色里去。
       ⚠️ 峰值 0.075~0.13：第一版只有 0.03~0.055，用户「完全没在动」——
          那个量级 4 秒只变 1 个色阶，等于静止。现在 6 秒能看出 10~20 个色阶。
       ⚠️ 速度是 rad/s：0.34 / 0.26 / 0.19 对应 **18 / 24 / 33 秒**一个来回。
          第一版写成 0.021（周期 5 分钟），肉眼完全看不出在动。
       ⚠️ 2026-10-20 用户：「这一页的背景动画动的幅度太小了」——
          ax/ay（游走的椭圆半径，单位是画布宽）几乎翻倍：0.15/0.05 → 0.30/0.13。
          第一版这两个数只有现在的一半，光团基本钉在原位上只是亮度起伏。 */
    var LIGHTS = [
      [0.30, 0.20, 0.300, 0.130, 0.34, 0.00, 0.44, 0.28, -0.28, 150, 195, 245, 0.130],
      [0.72, 0.13, 0.270, 0.110, 0.26, 2.10, 0.38, 0.24,  0.22, 120, 170, 230, 0.105],
      [0.50, 0.33, 0.340, 0.090, 0.19, 4.05, 0.52, 0.13, -0.06, 170, 205, 250, 0.075]
    ];

    function paint(t) {
      var g = ctx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.drawImage(base, 0, 0);

      g.globalCompositeOperation = 'lighter';
      if (!sprites) {
        sprites = [];
        for (var j = 0; j < LIGHTS.length; j++) sprites.push(lightSprite(LIGHTS[j][9], LIGHTS[j][10], LIGHTS[j][11]));
      }
      for (var i = 0; i < LIGHTS.length; i++) {
        var L = LIGHTS[i];
        var cx = L[0] + Math.sin(t * L[4] + L[5]) * L[2];
        var cy = L[1] + Math.cos(t * L[4] * 0.73 + L[5]) * L[3];
        /* 亮度也轻微起伏，节奏和位移不同步，看起来才不像机械循环 */
        var a = L[12] * (0.62 + 0.38 * Math.sin(t * L[4] * 1.37 + L[5] * 1.7));
        var half = L[6] * 3 * bw * 1.25;          /* 与 blob() 的填充半宽一致 */
        var k = half / (SP / 2);
        g.save();
        g.translate(cx * bw, cy * bw);
        g.rotate(L[8] || 0);
        g.scale(k, k * (L[7] / L[6]));            /* 先转后压，和 blob() 一致 */
        g.globalAlpha = a;
        g.drawImage(sprites[i], -SP / 2, -SP / 2, SP, SP);
        g.restore();
      }

      /* 收边：拟合只覆盖到 y/W≈0.63，再往下是外推。
         ⚠️ 必须收到 #0A0A0A —— 首屏下沿紧接的正文就是这个底色。 */
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = fadeGrad;
      g.fillRect(0, fadeTop, bw, bh - fadeTop);

      /* ⚠️ 2026-10-20 用户：「上面有一层布纹一样的东西，去掉，做成流畅的光影」。
         原来这里盖了一层 64×64 的噪点贴片（防色带）。它在半分辨率画布上
         被放大成 2px 一颗，平铺出来就是一层**布纹**。
         现在去掉了 —— 防色带改由 CSS 的轻微模糊负责（见 .harness-hero__glow）。 */
    }

    /* ---- 动起来的调度 ---------------------------------------------------
       · 30fps（33ms 一帧）—— 背景是缓慢流动，60fps 是浪费
       · 首屏离开视口 / 标签页隐藏 → 立刻停，别在后台烧 CPU
       · `prefers-reduced-motion: reduce` → 只画一帧静态的 */
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var rafId = 0, lastPaint = 0, inView = true;

    function frame(ts) {
      rafId = requestAnimationFrame(frame);
      if (ts - lastPaint < 33) return;
      lastPaint = ts;
      paint(ts / 1000);
    }
    function start() {
      if (reduce || rafId || !inView || doc.hidden) return;
      lastPaint = 0;
      rafId = requestAnimationFrame(frame);
    }
    function stop() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    }

    function refresh() {
      if (bake()) paint(0.6);       /* t=0.6 避开 sin 的零点，光斑位置更自然 */
    }

    refresh();
    if (!reduce) {
      start();
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          inView = es[0].isIntersecting;
          if (inView) start(); else stop();
        }, { rootMargin: '120px' }).observe(host);
      }
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden) stop(); else start();
      });
    }

    var t0 = 0;
    window.addEventListener('resize', function () {
      clearTimeout(t0);
      t0 = setTimeout(function () { lastW = 0; refresh(); }, 160);
    });
  })();

  /* ----------------------------------------------------------------------
     25b. 大模型页首屏：一颗自己会转的「数据球」

     用户 2026-10-20 第五轮（定稿）：
       「最开始要从四周凭空浮现小点（浮现的时候自然点，慢一点，规律一点不要乱跑，直接汇聚），
         然后浮现的小点汇聚起来（汇聚成圆后，就可以在圆内乱跑了，可以有一两个速度很快，
         大部分都是慢慢移动，注意这里不要颤抖）。
         小点可以换个颜色或者改暗一点，不然和文字太接近了，小点改成圆形」

     → 时间轴：
        0 → 2.20s   四边淡入浮现，然后顺着直线慢慢飞向球心
                    （这段时间**球本身不动**，所以路线是直的、规律的，
                      不是追着一颗正在转的球跑曲线）
        2.20 → 2.90s 成球；**从这一刻起**点才开始在球里动
        2.90 → 5.40s 大球缩到最终尺寸
        > 5.40s     一直在转的球

     ⭐ 球内运动：每颗粒子一个固定球坐标，绕自己的纬度圈匀速走 + 一点点径向呼吸
        （全是连续的正弦量）。85% 很慢，随机 1~2 颗给 6~10 倍角速度。
     ⛔ 绝不能按阈值切换「随时间连续变化的量」（粒径、半径…）——
        2026-10-20 那版按 `depth > 0.72` 切粒径，球一转就有一片点在 3↔4px 之间跳，
        整屏都在抖。粒径现在是纯静态的。
     ⭐ 点是**圆**的：预先烘一张圆形贴图，逐帧 drawImage 缩放
        （比每帧画 arc 便宜，而且天然带抗锯齿边）。
     ⚠️ 尺寸用 offsetWidth/offsetHeight；离开视口 / 标签页隐藏就停 rAF。
     ---------------------------------------------------------------------- */
  (function () {
    var cv = doc.querySelector('.llm-hero__flow-cv');
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var reduce = false;
    try { reduce = !!window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    /* T_FORM 必须 ≥ T_FLY + 最大 delay，否则最后一颗还没落地球就转起来了，
       它的路线会跟着弯 —— 用户明确要「直接汇聚、规律一点」 */
    var T_FLY = 2.20, T_FORM = 2.65, T_BIG = 3.60, T_SMALL = 6.10, S_BIG = 1.55;
    /* 成球后不是"哨声一响全体起跑"：半径的角速度用 0.8 秒从 0 缓升到正常，
       否则那两颗快的会在同一帧里突然窜出去 */
    var RAMP = 0.80;

    var W = 0, H = 0, R = 0, bx = 0, by = 0;
    var parts = [], sprite = null;
    var lastKey = "", clock = 0, lastTs = 0, raf = 0, playing = false;

    function rndFactory() {
      var s = 20261020;
      return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    }
    function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
    function smooth(v) { return v * v * (3 - 2 * v); }

    /* 一颗圆点的贴图：实心 + 一圈柔和收边。颜色统一在这里改 */
    function makeSprite() {
      var c = doc.createElement('canvas');
      var S = 16;
      c.width = S; c.height = S;
      var g = c.getContext('2d');
      var grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      grd.addColorStop(0.00, 'rgba(126,170,226,1)');
      grd.addColorStop(0.82, 'rgba(126,170,226,1)');   /* 核心撑到 82%，圆才显得饱满 */
      grd.addColorStop(1.00, 'rgba(126,170,226,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.fill();
      return c;
    }

    function build() {
      var cssW = cv.offsetWidth, cssH = cv.offsetHeight;
      if (!cssW || !cssH) return false;
      var dpr = Math.min(1.5, window.devicePixelRatio || 1);
      var w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
      var key = w + 'x' + h;
      if (key === lastKey) return false;
      lastKey = key;
      cv.width = w; cv.height = h;
      W = w; H = h;
      bx = W / 2;
      var narrow = cssW < 560;
      by = H * (narrow ? 0.24 : 0.37);
      R = Math.min(W, H) * (narrow ? 0.26 : 0.22);

      sprite = makeSprite();

      var rnd = rndFactory();
      var n = Math.round(Math.PI * R * R / 950);
      var fast = 2;                                 /* 只给两颗"飞得很快"的 */
      var out = [];
      for (var i = 0; i < n; i++) {
        var rr = Math.pow(rnd(), 0.40) * R * 0.97;
        var ph = Math.acos(rnd() * 2 - 1);
        var th0 = rnd() * Math.PI * 2;
        var isFast = fast > 0 && rnd() < 0.05;
        if (isFast) fast--;
        var w2 = isFast ? (0.55 + rnd() * 0.55) * (rnd() < 0.5 ? -1 : 1)
                        : (0.02 + rnd() * 0.07) * (rnd() < 0.5 ? -1 : 1);

        /* 起点：画布四条边上，22% 压在角上 */
        var edge = (rnd() * 4) | 0;
        var alongT = rnd() < 0.22 ? (rnd() < 0.5 ? 0 : 1) : rnd();
        var px, py;
        if (edge === 0) { px = alongT * W; py = 0; }
        else if (edge === 1) { px = W; py = alongT * H; }
        else if (edge === 2) { px = alongT * W; py = H; }
        else { px = 0; py = alongT * H; }

        var r2 = rnd();
        out.push({
          r: rr, ph: ph, th0: th0, w: w2,
          ph2: rnd() * Math.PI * 2,                 /* 径向呼吸的相位 */
          ws: 0.35 + rnd() * 0.55,
          amp: 0.03 + rnd() * 0.05,
          /* 点少了以后整体会显虚，亮度稍微抬一点（仍是偏蓝、比白字暗） */
          a: 0.46 + Math.pow(rnd(), 1.15) * 0.46,
          /* 2/3/4/5 混着来：一半是 2px 的小点，跟 4、5px 的拉开对比
             （用户：「有一些点点再小一点，来做对比，不要都那么大」） */
          sz: Math.max(2, Math.round((r2 < 0.42 ? 2 : (r2 < 0.74 ? 3 : (r2 < 0.92 ? 4 : 5))) * dpr)),
          fx: px, fy: py,
          delay: rnd() * 0.45
        });
      }
      parts = out;
      clock = 0; lastTs = 0;
      return true;
    }

    /* 球内运动的"有效时间"：前 RAMP 秒按 smoothstep 积分缓入，之后恢复正常速度。
       这样 tB 的一阶导（= 点的实际速度）是从 0 连续升到 1 的，不会有起跑的顿挫。 */
    function ballTime(t) {
      var tb = t - T_FORM;
      if (tb <= 0) return 0;
      if (tb < RAMP) {
        var u = tb / RAMP;
        return RAMP * (u * u * u - u * u * u * u / 2);
      }
      return tb - RAMP * 0.5;
    }

    function scaleAt(t) {
      if (t <= T_BIG) return S_BIG;
      if (t >= T_SMALL) return 1;
      return S_BIG + (1 - S_BIG) * smooth((t - T_BIG) / (T_SMALL - T_BIG));
    }

    function draw(t) {
      var tB = ballTime(t);                        /* 球本身的运动从"成球"那一刻起，缓入 */

      var ay = tB * 0.18, tilt = 0.42;
      var sa = Math.sin(ay), ca = Math.cos(ay);
      var st = Math.sin(tilt), ct = Math.cos(tilt);
      var S = scaleAt(t);

      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];

        /* ① 球内：绕自己的纬度圈 + 一点点径向呼吸（都是连续量，不会跳） */
        var th = p.th0 + p.w * tB;
        var rr = p.r * (1 + p.amp * Math.sin(p.ph2 + p.ws * tB));
        var rp = rr * Math.sin(p.ph);
        var lx = rp * Math.cos(th);
        var ly = rr * Math.cos(p.ph);
        var lz = rp * Math.sin(th);

        /* ② 整球旋转 + ③ 透视 */
        var x1 = lx * ca - lz * sa;
        var z1 = lx * sa + lz * ca;
        var y1 = ly * ct - z1 * st;
        var z2 = ly * st + z1 * ct;
        var persp = 1 + z2 / (R * 3.6);

        var tx = bx + x1 * persp * S;
        var ty = by + y1 * persp * S;

        /* ④ 浮现 + 直接飞向球心：这段时间球不动，所以是直线 */
        var k = clamp01((t - p.delay) / T_FLY);
        var e = smooth(k);
        var sx = p.fx + (tx - p.fx) * e;
        var sy = p.fy + (ty - p.fy) * e;

        /* ⑤ 先在原地淡入（前 35% 的行程），越近越亮 */
        var born = clamp01((t - p.delay) / (T_FLY * 0.35));
        var depth = (z2 / R + 1) * 0.5;
        var al = p.a * born * (0.62 + 0.38 * depth);
        if (al <= 0.004) continue;

        ctx.globalAlpha = al;
        var d = p.sz;
        ctx.drawImage(sprite, sx - d / 2, sy - d / 2, d, d);
      }
      ctx.globalAlpha = 1;
    }

    /* ⚠️ 用累计时钟，不是 ts - started：
       切到别的标签页 / 滚出视口会 stop()，回来再 start() 时如果直接用时间戳，
       时间会凭空跳一大段，球会瞬移（入场那 6 秒更是直接跳过）。
       这里只在"播放中"累加，暂停期间时间不动。单帧最多计 50ms，
       掉帧时宁可慢一点，也不要一帧跳很远。 */
    function loop(ts) {
      if (!lastTs) lastTs = ts;
      clock += Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      draw(clock);
      raf = window.requestAnimationFrame(loop);
    }

    function start() {
      if (reduce) { if (!parts.length && !build()) return; draw(99); return; }
      if (playing) return;
      if (!parts.length && !build()) return;
      playing = true;
      lastTs = 0;                       /* 恢复播放时不要把暂停的那段时间算进去 */
      raf = window.requestAnimationFrame(loop);
    }

    function stop() {
      if (!playing) return;
      playing = false;
      window.cancelAnimationFrame(raf);
      raf = 0;
    }

    if (!build()) return;
    start();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) start(); else stop();
      }, { rootMargin: '80px' }).observe(cv);
    }
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) stop(); else start();
    });

    var rt = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { stop(); lastKey = ""; if (build()) start(); }, 180);
    });
  })();

  /* ----------------------------------------------------------------------
     26. 就地玩：把游戏塞进 iframe 浮层

     用户：「把那几个网页都内置到页面里去，点开就能玩」。
     五个游戏都是自包含的单文件（没有一条外链），放在 `games/*.html`。

     ⚠️ `iframe.src` **只在点开的那一刻才设**，关掉时清空（设成 'about:blank'）——
        五个文件加起来 2.2MB，一进页面就全下下来的话首屏会被拖垮，
        而且五个游戏的音效/循环会在后台一起跑。
     ⚠️ 关掉时必须**把焦点还给刚才那颗按钮**，否则键盘用户会被扔回页面开头。
     ⚠️ 锁滚动挂在 `<html>` 上（`html.is-playing`），不是 body ——
        站里不少高度是拿 `100svh` 算的，动 body 会连带影响它们。
     ⚠️ 只在页面里真有 `.play` 时才跑。
     ---------------------------------------------------------------------- */
  (function () {
    var box = doc.getElementById('play');
    if (!box) return;
    var frame = doc.getElementById('play-frame');
    var titleEl = doc.getElementById('play-title');
    var openLink = doc.getElementById('play-open');
    var closeBtn = doc.getElementById('play-close');
    var last = null;                     /* 打开之前焦点在哪 */

    function open(btn) {
      var src = btn.getAttribute('data-play');
      if (!src) return;
      last = btn;
      titleEl.textContent = btn.getAttribute('aria-label')
        ? btn.getAttribute('aria-label').replace(/^在这里打开玩：/, '') : '游戏';
      openLink.href = src;
      box.hidden = false;
      root.classList.add('is-playing');
      frame.src = src;
      closeBtn.focus();
    }

    function close() {
      if (box.hidden) return;
      box.hidden = true;
      root.classList.remove('is-playing');
      frame.src = 'about:blank';         /* 停掉里面的循环和音效 */
      if (last && last.focus) last.focus();
      last = null;
    }

    /* 事件委托：五个按钮 + 以后再加的，都不用逐个绑。
       ⚠️ 选择器是 `.work__launch`，不是 `.work__play` ——
          后者是第 3 节作品视频的播放按钮，别混。 */
    doc.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.work__launch') : null;
      if (btn) { e.preventDefault(); open(btn); return; }
      /* 点浮层的空白处（不是面板里）也关掉 */
      if (e.target === box) close();
    });
    closeBtn.addEventListener('click', close);
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) close();
    });
  })();
})();
