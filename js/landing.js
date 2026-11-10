/* Daybook landing page: draws Page and runs the small try-it demo. */
(function () {
  "use strict";
  var M = window.DaybookMascot;
  var ACCENT = "#2f4fc4";
  // Set this to the public repository address once it exists, for example
  // "https://github.com/yourname/daybook". While empty, the link stays hidden.
  var REPO_URL = "";

  var page = function (o, size) { return M.page(o, size, "", { accent: ACCENT, status: true }); };

  // logos
  var logo = document.getElementById("logo"); if (logo) logo.innerHTML = M.logo(48);
  var big = document.getElementById("logoBig"); if (big) big.innerHTML = M.logo(120);

  // the five moods, the same ones the app uses
  var moods = [
    { t: "Ready", d: "Tasks to do today. Orange, with a beanie.", o: { m: "pending", hat: "beanie" } },
    { t: "Focusing", d: "While a focus timer runs. Purple, with headphones.", o: { m: "focus", hat: "phones", eyes: "focus", mouth: "flat" } },
    { t: "Something is late", d: "A little worried, never loud.", o: { m: "overdue", eyes: "worry", mouth: "worry", drop: 1 } },
    { t: "Day complete", d: "Green, a party hat and confetti.", o: { m: "done", hat: "party", eyes: "happy", mouth: "grin", conf: 1 } },
    { t: "Late evening", d: "After 22:00. Time to rest.", o: { m: "night", hat: "night", eyes: "sleep", mouth: "sleep", zz: 1 } }
  ];
  var ml = document.getElementById("moods");
  if (ml) ml.innerHTML = moods.map(function (x) { return "<li>" + page(x.o, 104) + "<b>" + x.t + "</b><span>" + x.d + "</span></li>"; }).join("");

  // try-it demo
  var demoPage = document.getElementById("demoPage"), say = document.getElementById("demoSay"),
      count = document.getElementById("demoCount"), list = document.getElementById("demoList"), reset = document.getElementById("demoReset");
  var buttons = list ? Array.prototype.slice.call(list.querySelectorAll("button")) : [];
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function confetti() {
    if (reduced) return;
    var cols = ["#FF2D95", "#FFD60A", "#22D3EE", "#8B5CF6", "#2EE6A8", "#FF7A1A"];
    for (var i = 0; i < 28; i++) {
      var c = document.createElement("i"); c.className = "confetti";
      c.style.left = Math.random() * 100 + "vw"; c.style.background = cols[i % cols.length];
      c.style.animationDelay = Math.random() * 0.5 + "s"; c.style.animationDuration = 1.3 + Math.random() * 1.2 + "s";
      document.body.appendChild(c); (function (n) { setTimeout(function () { n.remove(); }, 3400); })(c);
    }
  }

  function draw(done, total, reaction) {
    var o;
    if (done === total) o = { m: "done", hat: "party", eyes: "happy", mouth: "grin", conf: 1 };
    else if (reaction) o = { m: "done", hat: "beanie", eyes: "happy" };
    else o = { m: "pending", hat: "beanie" };
    demoPage.innerHTML = page(o, 92);
    count.textContent = done + " of " + total;
  }

  function update(reaction) {
    var total = buttons.length, done = buttons.filter(function (b) { return b.getAttribute("aria-pressed") === "true"; }).length, left = total - done;
    draw(done, total, reaction);
    reset.hidden = done === 0;
    if (!reaction) { say.textContent = "Tick something and watch Page."; return; }
    if (left === 0) { say.textContent = "Day complete. Nicely done."; confetti(); }
    else if (left === 1) say.textContent = "Last one. You've got this.";
    else if (done === 1) say.textContent = "First one down. " + left + " to go.";
    else say.textContent = ["Nice.", "Done.", "Keep going."][done % 3] + " " + left + " to go.";
    demoPage.classList.remove("hop"); void demoPage.offsetWidth; demoPage.classList.add("hop");
  }

  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      var on = b.getAttribute("aria-pressed") === "true";
      b.setAttribute("aria-pressed", on ? "false" : "true");
      update(!on);
    });
  });
  if (reset) reset.addEventListener("click", function () {
    buttons.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    update(false);
  });
  if (demoPage) update(false);

  // repository link
  var wrap = document.getElementById("ghWrap"), a = document.getElementById("ghLink");
  if (REPO_URL && wrap && a) { a.href = REPO_URL; wrap.hidden = false; }
})();
