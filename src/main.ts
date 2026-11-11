import Phaser from "phaser";
import "./style.css";
import {
  GameState,
  visible,
  walkable,
  equal,
  difficulties,
  layouts,
  type Difficulty,
  type Point,
  type Item,
} from "./engine";
const root = document.querySelector<HTMLDivElement>("#app")!;
let state: GameState | null = null,
  renderer: Phaser.Game | null = null,
  scene: OfficeScene | null = null,
  started = 0,
  timer: ReturnType<typeof setInterval> | undefined,
  busy = false,
  settled = false;
const storageKey = "office-escape-v1";
type Result = {
  difficulty: Difficulty;
  score: number;
  escaped: boolean;
  minute: number;
  found: number;
  maxAlert: number;
  used: number;
  actions: number;
  achievements: string[];
  rank: string;
  date: string;
  mapId: number;
};
type Save = {
  history: Result[];
  best: Partial<Record<Difficulty, Result>>;
  cards: string[];
  progress: Record<string, number>;
  settings: { sound: boolean; motion: boolean; vision: boolean };
};
const fresh = (): Save => ({
  history: [],
  best: {},
  cards: [],
  progress: {},
  settings: { sound: true, motion: true, vision: true },
});
let save: Save = fresh();
let storageOK = true;
try {
  const v = JSON.parse(localStorage.getItem(storageKey) || "null");
  if (v && Array.isArray(v.history) && Array.isArray(v.cards))
    save = {
      ...fresh(),
      ...v,
      settings: { ...fresh().settings, ...v.settings },
    };
} catch {
  storageOK = false;
}
function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(save));
  } catch {
    storageOK = false;
    toast("浏览器存储不可用，当前记录仅保留在本次会话。");
  }
}
function toast(s: string) {
  document.querySelector(".toast")?.remove();
  const e = document.createElement("div");
  e.className = "toast";
  e.textContent = s;
  document.body.append(e);
  setTimeout(() => e.remove(), 3500);
}
function sound() {
  if (!save.settings.sound) return;
  try {
    const a = new AudioContext(),
      o = a.createOscillator(),
      g = a.createGain();
    o.type = "square";
    o.frequency.value = 330;
    g.gain.value = 0.025;
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + 0.045);
    o.onended = () => void a.close();
  } catch {}
}
const time = (n: number) =>
  `${17 + Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
function header() {
  return '<header><div class="logo">OE / 下班大作战</div><div class="version">OFFICE ESCAPE · V1.1</div></header>';
}
function modal(title: string, body: string) {
  const wrap = document.createElement("div");
  wrap.className = "modal-wrap";
  wrap.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-label="${title}"><button class="close" aria-label="关闭">×</button><h2>${title}</h2>${body}</section>`;
  document.body.append(wrap);
  wrap.querySelector("button")!.onclick = () => wrap.remove();
  wrap.querySelector("button")!.focus();
  return wrap;
}
let selected: Difficulty = "普通";
async function menu() {
  clearInterval(timer);
  if (renderer) {
    const previous = renderer;
    renderer = null;
    await new Promise<void>((resolve) => {
      previous.events.once(Phaser.Core.Events.DESTROY, resolve);
      previous.destroy(true);
    });
  }
  state = null;
  scene = null;
  root.innerHTML =
    header() +
    `<main class="menu"><section><p class="eyebrow">17:00 / THE GREAT OFFICE ESCAPE</p><h1>下班大作战<br><span style="color:#efc771">Office Escape</span></h1><p class="subtitle">工牌还在，心已经下班。<br>看清视线，伪装工作，找到通往自由的路线。</p><div class="menu-actions"><label class="muted" for="difficulty">行动难度</label><select id="difficulty">${Object.keys(
      difficulties,
    )
      .map((d) => `<option ${d === selected ? "selected" : ""}>${d}</option>`)
      .join(
        "",
      )}</select><button class="gold" id="start">开始游戏 →</button><div class="row"><button id="cards">卡牌图鉴 ${save.cards.length}/10</button><button id="records">个人战绩</button></div><button id="settings">游戏设置</button></div><p class="hint">WASD / 方向键移动 · 空格等待 · Q 观察 · E 伪装<br>鼠标点相邻格移动 · 手机使用方向面板<br>每次行动推进一分钟，观察不耗时。单局上限 5 分钟。</p></section><div class="menu-art"><canvas id="cover" width="384" height="384"></canvas><div class="art-label">SECTOR 03 / 最后一班电梯</div></div></main><footer>不靠运气抽卡 · 每一张收藏，都是一次真实的逃脱成就</footer>`;
  document
    .querySelector("#start")!
    .addEventListener("click", () => start(selected));
  document.querySelector<HTMLSelectElement>("#difficulty")!.onchange = (e) =>
    (selected = (e.target as HTMLSelectElement).value as Difficulty);
  document.querySelector("#cards")!.addEventListener("click", cards);
  document.querySelector("#records")!.addEventListener("click", records);
  document.querySelector("#settings")!.addEventListener("click", settings);
  const c = document.querySelector<HTMLCanvasElement>("#cover")!;
  drawCover(c);
}
function drawCover(c: HTMLCanvasElement) {
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  for (let y = 0; y < 12; y++)
    for (let z = 0; z < 12; z++) {
      const t = layouts[0][y][z];
      x.fillStyle = t === "#" ? "#344c55" : (z + y) % 2 ? "#7a8b83" : "#71837e";
      x.fillRect(z * 32, y * 32, 32, 32);
      if (t === "d") {
        x.fillStyle = "#a98258";
        x.fillRect(z * 32 + 1, y * 32 + 7, 30, 21);
        x.fillStyle = "#263f4c";
        x.fillRect(z * 32 + 8, y * 32 + 3, 16, 13);
        x.fillStyle = "#8fd3c1";
        x.fillRect(z * 32 + 10, y * 32 + 5, 12, 8);
      }
    }
  x.fillStyle = "#d4ab5d";
  x.fillRect(320, 320, 30, 30);
  for (const [a, b, col] of [
    [2, 2, "#86cbb6"],
    [7, 2, "#e0836f"],
    [3, 7, "#96b1d8"],
  ] as [number, number, string][]) {
    x.fillStyle = "#182b35";
    x.fillRect(a * 32 + 8, b * 32 + 21, 19, 7);
    x.fillStyle = col;
    x.fillRect(a * 32 + 8, b * 32 + 11, 17, 15);
    x.fillStyle = "#f0d1a6";
    x.fillRect(a * 32 + 10, b * 32 + 4, 13, 11);
    x.fillStyle = "#26353c";
    x.fillRect(a * 32 + 9, b * 32 + 2, 15, 5);
  }
  x.fillStyle = "#e6ba6033";
  x.beginPath();
  x.moveTo(240, 80);
  x.lineTo(310, 210);
  x.lineTo(180, 210);
  x.fill();
}
function start(d: Difficulty) {
  settled = false;
  state = new GameState(d);
  started = Date.now();
  busy = false;
  root.innerHTML =
    header() +
    `<main class="game-layout"><section><div class="hud"><div class="stat"><small>办公室时间</small><b id="clock"></b></div><div class="stat"><small>警觉 <span id="alert-text"></span></small><div class="bar"><i id="alert-bar"></i></div></div><div class="stat"><small>伪装 <span id="disguise-text"></span></small><div class="bar disguise"><i id="disguise-bar"></i></div></div></div><div id="board" role="application" aria-label="办公室地图，方向键移动"></div><div class="board-info"><span id="position"></span><span id="remaining"></span></div><div class="legend"><b>青色：你　红色：老板　蓝色：同事 A　紫色：同事 B</b><br>金色出口在右下角 · 地面色块为视野 · 点相邻地格移动</div><div class="controls"><div class="dpad"><span></span><button data-move="0,-1" aria-label="上">↑</button><span></span><button data-move="-1,0" aria-label="左">←</button><button data-action="等待" aria-label="等待">·</button><button data-move="1,0" aria-label="右">→</button><span></span><button data-move="0,1" aria-label="下">↓</button></div><div class="actions"><button data-action="等待">等待 [空格]</button><button id="observe">观察 [Q]</button><button data-action="伪装">伪装 [E]</button><button id="quit">结束本局</button></div></div></section><aside class="side panel"><section><h3>携带道具</h3><div class="inventory" id="inventory"></div><p class="legend">移动拾取 · 点击使用耗费 1 分钟<br>伪装随行动衰减，脱离视线降低警觉。</p></section><section><h3>巡逻情报</h3><div id="npcs" class="npc"></div></section><section class="log-section"><h3>行动记录</h3><ol class="log" id="log" aria-live="polite"></ol></section></aside></main>`;
  document.querySelectorAll<HTMLButtonElement>("[data-move]").forEach(
    (b) =>
      (b.onclick = () => {
        const [x, y] = b.dataset.move!.split(",").map(Number);
        action(() => state!.move(x, y));
      }),
  );
  document
    .querySelectorAll<HTMLButtonElement>("[data-action]")
    .forEach(
      (b) => (b.onclick = () => action(() => state!.act(b.dataset.action!))),
    );
  document.querySelector<HTMLButtonElement>("#observe")!.onclick = observe;
  document.querySelector<HTMLButtonElement>("#quit")!.onclick = () => {
    const w = modal(
      "结束本局？",
      '<p>主动结束将保存为失败战绩。</p><button id="confirm-quit">确认结束</button>',
    );
    w.querySelector<HTMLButtonElement>("#confirm-quit")!.onclick = () => {
      w.remove();
      state!.status = "failed";
      state!.reason = "主动结束行动。";
      finish();
    };
  };
  renderer = new Phaser.Game({
    type: Phaser.AUTO,
    width: 576,
    height: 576,
    parent: "board",
    backgroundColor: "#253d45",
    pixelArt: true,
    antialias: false,
    scene: OfficeScene,
    audio: { noAudio: true },
    banner: false,
  });
  updateHUD();
  timer = setInterval(() => {
    if (!state) return;
    state.timeout((Date.now() - started) / 1000);
    updateHUD();
    if (state.status !== "playing") finish();
  }, 250);
}
function observe() {
  if (!state || state.status !== "playing") return;
  state.observe();
  updateHUD();
  scene?.paint();
}
function action(fn: () => unknown) {
  if (
    !state ||
    state.status !== "playing" ||
    busy ||
    document.querySelector(".modal-wrap")
  )
    return;
  busy = true;
  const old = { ...state.player };
  const oldNPC = state.npcs.map((n) => ({ x: n.x, y: n.y }));
  fn();
  sound();
  checkCards(false);
  updateHUD();
  scene?.animate(old, oldNPC);
  setTimeout(
    () => {
      busy = false;
      if (state && state.status !== "playing") finish();
    },
    save.settings.motion ? 140 : 0,
  );
}
window.addEventListener("keydown", (e) => {
  if (!state || document.querySelector(".modal-wrap")) return;
  const key = e.key.toLowerCase();
  const m: Record<string, Point> = {
    arrowup: { x: 0, y: -1 },
    w: { x: 0, y: -1 },
    arrowdown: { x: 0, y: 1 },
    s: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 },
    a: { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 },
    d: { x: 1, y: 0 },
  };
  if (m[key]) {
    e.preventDefault();
    action(() => state!.move(m[key].x, m[key].y));
  } else if (key === " ") {
    e.preventDefault();
    action(() => state!.act("等待"));
  } else if (key === "q") observe();
  else if (key === "e") action(() => state!.act("伪装"));
});
function updateHUD() {
  if (!state) return;
  const g = state;
  const text = (id: string, s: string) => {
    const e = document.getElementById(id);
    if (e) e.textContent = s;
  };
  text("clock", time(g.minute));
  text("alert-text", `${g.alert}/100`);
  text("disguise-text", `${g.disguise}/100`);
  document.getElementById("alert-bar")!.style.width = g.alert + "%";
  document.getElementById("disguise-bar")!.style.width = g.disguise + "%";
  text(
    "position",
    `布局 0${g.mapId + 1} · ${g.difficulty} · 位置 ${g.player.x + 1},${g.player.y + 1}`,
  );
  text(
    "remaining",
    `${g.turn} 次行动 · 剩余 ${Math.max(0, 300 - Math.floor(g.elapsed))}s`,
  );
  document.getElementById("log")!.innerHTML = g.logs
    .slice(0, 14)
    .map((l) => `<li>${l}</li>`)
    .join("");
  document.getElementById("npcs")!.innerHTML = g.npcs
    .map((n) => `${n.name} / ${n.active ? n.state : "已离开"}<br>`)
    .join("");
  const inv = document.getElementById("inventory")!;
  inv.innerHTML = g.inventory.length
    ? g.inventory
        .map(
          (i, n) =>
            `<button data-item="${n}" title="${itemHelp[i]}">${i}<small style="display:block;font-size:9px;margin-top:4px">${itemHelp[i]}</small></button>`,
        )
        .join("")
    : "<small>空背包 · 寻找金色物资</small>";
  inv
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach(
      (b) =>
        (b.onclick = () =>
          action(() => g.use(g.inventory[Number(b.dataset.item)]))),
    );
}
const itemHelp: Record<Item, string> = {
  咖啡杯: "伪装100，6回合降低视线警觉",
  文件夹: "伪装100，4回合掩护",
  手机: "让老板转身接电话4回合",
  纸箱: "4回合大幅降低视线警觉",
  门禁卡: "解除电梯维修锁",
  耳机: "6回合加快警觉恢复，避免搭话和铃声",
};
class OfficeScene extends Phaser.Scene {
  g!: Phaser.GameObjects.Graphics;
  playerSprite!: Phaser.GameObjects.Container;
  npcSprites: Phaser.GameObjects.Container[] = [];
  create() {
    scene = this;
    this.g = this.add.graphics();
    this.playerSprite = this.actor(0x88d2bc);
    this.npcSprites = [
      this.actor(0xdf806c),
      this.actor(0x85abc9),
      this.actor(0xb49bc9),
    ];
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!state) return;
      const x = Math.floor(p.x / 48),
        y = Math.floor(p.y / 48);
      const dx = x - state.player.x,
        dy = y - state.player.y;
      if (Math.abs(dx) + Math.abs(dy) === 1) action(() => state!.move(dx, dy));
      else toast("点击与你相邻的地格，或使用方向键。");
    });
    this.paint();
    const labels: Record<string, string> = {
      P: "你的工位",
      B: "老板办公室",
      A: "同事 A",
      C: "同事 B",
      T: "茶水间",
      M: "会议室",
      R: "打印机",
      E: "电梯出口",
    };
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 12; x++) {
        const label = labels[state!.map[y][x]];
        if (label)
          this.add
            .text(x * 48 + 24, y * 48 + 43, label, {
              fontFamily: "monospace",
              fontSize: "9px",
              color: "#f3e5bc",
              backgroundColor: "#243b46",
            })
            .setOrigin(0.5)
            .setDepth(3);
      }
  }
  actor(color: number) {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x142b32, 0.5);
    g.fillRect(-11, 11, 24, 8);
    g.fillStyle(0x1b303b);
    g.fillRect(-8, 7, 6, 10);
    g.fillRect(3, 7, 6, 10);
    g.fillStyle(color);
    g.fillRect(-10, -5, 21, 16);
    g.fillStyle(0xe6c399);
    g.fillRect(-7, -17, 15, 13);
    g.fillStyle(0x263a40);
    g.fillRect(-8, -19, 17, 6);
    g.fillStyle(0xf0ddbe);
    g.fillRect(-13, -2, 4, 10);
    g.fillRect(11, -2, 4, 10);
    c.add(g);
    return c;
  }
  animate(old: Point, oldNPC: Point[]) {
    this.paint();
    if (state && save.settings.motion)
      for (const [i, n] of state.npcs.entries()) {
        if (!equal(oldNPC[i], n)) {
          this.npcSprites[i].setPosition(
            oldNPC[i].x * 48 + 24,
            oldNPC[i].y * 48 + 25,
          );
          this.tweens.add({
            targets: this.npcSprites[i],
            x: n.x * 48 + 24,
            y: n.y * 48 + 25,
            duration: 130,
          });
        }
      }
    if (!state) return;
    const end = { x: state.player.x * 48 + 24, y: state.player.y * 48 + 25 };
    if (save.settings.motion && !equal(old, state.player)) {
      this.playerSprite.setPosition(old.x * 48 + 24, old.y * 48 + 25);
      this.tweens.add({
        targets: this.playerSprite,
        ...end,
        duration: 130,
        ease: "Linear",
      });
    }
  }
  paint() {
    if (!state || !this.g) return;
    const g = this.g;
    g.clear();
    const m = state.map;
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 12; x++) {
        const t = m[y][x],
          px = x * 48,
          py = y * 48;
        g.fillStyle((x + y) % 2 ? 0x72867e : 0x7a8c83);
        g.fillRect(px, py, 48, 48);
        g.lineStyle(1, 0x536e69, 0.3);
        g.strokeRect(px, py, 48, 48);
        if (t === "#") {
          g.fillStyle(0x263f49);
          g.fillRect(px, py, 48, 48);
          g.fillStyle(0x4c656b);
          g.fillRect(px, py, 48, 11);
          g.fillStyle(0x192e37);
          g.fillRect(px, py + 40, 48, 8);
        }
        if (t === "d") {
          g.fillStyle(0x3c524f);
          g.fillRect(px + 5, py + 31, 40, 13);
          g.fillStyle(0xb18c63);
          g.fillRect(px + 1, py + 11, 46, 25);
          g.fillStyle(0xd1aa77);
          g.fillRect(px + 1, py + 9, 46, 5);
          g.fillStyle(0x29434c);
          g.fillRect(px + 12, py + 2, 25, 18);
          g.fillStyle(0x8fc6b4);
          g.fillRect(px + 15, py + 4, 19, 11);
          g.fillStyle(0xe6d3a1);
          g.fillRect(px + 15, py + 26, 19, 4);
        }
        if (t === "E") {
          g.fillStyle(0x233b44);
          g.fillRect(px + 2, py + 2, 44, 44);
          g.fillStyle(state.repair ? 0xd98c6c : 0xeac579);
          g.fillRect(px + 5, py + 5, 38, 5);
          g.fillStyle(0x9bb1ac);
          g.fillRect(px + 7, py + 13, 16, 30);
          g.fillRect(px + 25, py + 13, 16, 30);
        }
        if (t === "T") {
          g.fillStyle(0xabcac4);
          g.fillRect(px + 3, py + 15, 17, 22);
          g.fillStyle(0x81b8c5);
          g.fillRect(px + 6, py + 4, 11, 12);
          g.fillStyle(0x27414b);
          g.fillRect(px + 7, py + 23, 8, 7);
          g.fillStyle(0xb18c63);
          g.fillRect(px + 24, py + 17, 21, 20);
          g.fillStyle(0xd5e0cf);
          g.fillRect(px + 27, py + 11, 9, 7);
          g.fillStyle(0x37594f);
          g.fillRect(px + 37, py + 8, 6, 11);
        }
        if (t === "R") {
          g.fillStyle(0x42585a);
          g.fillRect(px + 6, py + 14, 36, 25);
          g.fillStyle(0xd3d6c4);
          g.fillRect(px + 8, py + 12, 32, 18);
          g.fillStyle(0xf6edce);
          g.fillRect(px + 15, py + 3, 18, 12);
          g.fillStyle(0x28424a);
          g.fillRect(px + 12, py + 26, 24, 5);
          g.fillStyle(0x8fd4b3);
          g.fillRect(px + 34, py + 17, 3, 3);
        }
        if (t === "M") {
          g.fillStyle(0x354b54);
          for (const [a, b] of [
            [7, 4],
            [31, 4],
            [7, 34],
            [31, 34],
          ])
            g.fillRect(px + a, py + b, 10, 10);
          g.fillStyle(0xb88f62);
          g.fillRect(px + 4, py + 15, 40, 20);
          g.fillStyle(0xd7b17a);
          g.fillRect(px + 4, py + 13, 40, 16);
          g.fillStyle(0xf0ead1);
          g.fillRect(px + 12, py + 18, 9, 7);
          g.fillStyle(0x395c62);
          g.fillRect(px + 29, py + 17, 8, 8);
        }
        if (["P", "B", "A", "C"].includes(t)) {
          g.fillStyle(t === "T" ? 0xa5cfc8 : t === "R" ? 0xd6d5bb : 0x597774);
          g.fillRect(px + 6, py + 10, 36, 26);
          g.fillStyle(0x24404b);
          g.fillRect(px + 12, py + 13, 24, 9);
          g.fillStyle(0xd3bd8b);
          g.fillRect(px + 12, py + 28, 14, 3);
        }
      }
    if (save.settings.vision)
      for (const [i, n] of state.npcs.entries()) {
        if (!n.active) continue;
        for (let y = 1; y < 11; y++)
          for (let x = 1; x < 11; x++)
            if (
              walkable(m, { x, y }) &&
              visible(m, n, { x, y }, difficulties[state.difficulty].range)
            ) {
              g.fillStyle(i === 0 ? 0xeb9270 : 0xdfc871, 0.22);
              g.fillRect(x * 48 + 1, y * 48 + 1, 46, 46);
            }
      }
    for (const p of state.pickups) {
      g.fillStyle(0xf4d184);
      g.fillRect(p.pos.x * 48 + 17, p.pos.y * 48 + 17, 14, 14);
      g.fillStyle(0x685739);
      g.fillRect(p.pos.x * 48 + 21, p.pos.y * 48 + 20, 6, 3);
    }
    this.playerSprite.setPosition(
      state.player.x * 48 + 24,
      state.player.y * 48 + 25,
    );
    for (const [i, n] of state.npcs.entries()) {
      this.npcSprites[i]
        .setVisible(n.active)
        .setPosition(n.x * 48 + 24, n.y * 48 + 25);
      g.fillStyle(i === 0 ? 0xffb39a : 0xf3e2a1);
      g.fillTriangle(
        n.x * 48 + 24 + n.dir.x * 21,
        n.y * 48 + 24 + n.dir.y * 21,
        n.x * 48 + 21 + n.dir.x * 15,
        n.y * 48 + 21 + n.dir.y * 15,
        n.x * 48 + 27 + n.dir.x * 15,
        n.y * 48 + 27 + n.dir.y * 15,
      );
    }
    g.lineStyle(2, 0xaff3ce);
    g.strokeRect(state.player.x * 48 + 3, state.player.y * 48 + 3, 42, 42);
  }
}
import { cardsData, scoring } from "./achievements";
function checkCards(final: boolean) {
  if (!state) return;
  for (const c of cardsData) {
    const value = c.value(state);
    save.progress[c.id] = Math.max(save.progress[c.id] || 0, value);
    if (value >= c.goal && !save.cards.includes(c.id)) {
      save.cards.push(c.id);
      toast("成就达成 · 解锁「" + c.name + "」");
    }
  }
  if (final || state.turn > 0) persist();
}
function cards() {
  modal(
    "行动档案 / 卡牌图鉴",
    `<p>卡牌全部由明确成就解锁，稀有度仅表示挑战难度。无抽奖、无随机掉落。</p><div class="cards">${cardsData.map((c) => `<article class="card ${save.cards.includes(c.id) ? "unlocked" : ""}" data-rarity="${c.rarity}"><div class="card-icon">${save.cards.includes(c.id) ? "▣" : "▧"}</div><small>${c.rarity} / ${save.cards.includes(c.id) ? "已获得" : "未获得"}</small><h3>${c.name}</h3><p>${c.condition}</p><p>进度 ${Math.min(c.goal, save.progress[c.id] || 0)} / ${c.goal}</p></article>`).join("")}</div>`,
  );
}
function records() {
  modal(
    "个人战绩",
    `<p>各难度独立纪录 · 最近 50 局</p><div class="result-grid">${Object.keys(
      difficulties,
    )
      .map((d) => {
        const r = save.best[d as Difficulty];
        return `<div>${d}<br>${r ? `${r.score} 分 / ${time(r.minute)}` : "尚无逃脱纪录"}</div>`;
      })
      .join(
        "",
      )}</div><table class="records"><thead><tr><th>难度</th><th>结果</th><th>时间</th><th>评分</th></tr></thead><tbody>${save.history
      .slice(0, 20)
      .map(
        (r) =>
          `<tr><td>${r.difficulty}</td><td>${r.escaped ? "逃脱" : "失败"}</td><td>${time(r.minute)}</td><td>${r.score}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table>${save.history.length ? "" : "<p>你的第一份下班战绩，等你创造。</p>"}`,
  );
}
function settings() {
  const w = modal(
    "游戏设置",
    `${(["sound", "motion", "vision"] as const).map((k, i) => `<label class="setting">${["像素音效", "移动动画", "显示已知视野"][i]}<input type="checkbox" data-setting="${k}" ${save.settings[k] ? "checked" : ""}></label>`).join("")}<p>观察不推进时间；方向键 / WASD 移动，空格等待，Q 观察，E 伪装。<br>最高警觉会计入结算。隐藏视野仅影响显示。</p><p>${storageOK ? "本地存档正常；清除浏览器数据会丢失记录。" : "浏览器存储不可用，当前为会话存档。"}</p>`,
  );
  w.querySelectorAll<HTMLInputElement>("input").forEach(
    (e) =>
      (e.onchange = () => {
        save.settings[e.dataset.setting as keyof Save["settings"]] = e.checked;
        persist();
        scene?.paint();
      }),
  );
}
function finish() {
  if (!state || settled) return;
  settled = true;
  clearInterval(timer);
  const g = state;
  checkCards(true);
  const calculated = scoring(g);
  const earned = cardsData
    .filter((c) => c.value(g) >= c.goal)
    .map((c) => c.name);
  const r: Result = {
    difficulty: g.difficulty,
    score: calculated.score,
    escaped: g.status === "escaped",
    minute: g.minute,
    found: g.found,
    maxAlert: g.maxAlert,
    used: g.used,
    actions: g.turn,
    achievements: earned,
    rank: calculated.rank,
    date: new Date().toISOString(),
    mapId: g.mapId,
  };
  save.history.unshift(r);
  save.history = save.history.slice(0, 50);
  const best = save.best[g.difficulty];
  if (
    r.escaped &&
    (!best ||
      r.score > best.score ||
      (r.score === best.score && r.minute < best.minute))
  )
    save.best[g.difficulty] = r;
  persist();
  const w = modal(
    r.escaped ? "行动成功 / 自由已抵达" : "行动结束 / 明天再战",
    `<p>${g.reason}</p><div class="result-score">${r.score}<span style="font-size:18px"> / 100</span></div><h3>${r.rank}</h3><div class="result-grid"><div>下班时间 ${time(r.minute)}</div><div>难度 ${r.difficulty}</div><div>被发现 ${r.found} 次</div><div>最高警觉 ${r.maxAlert}</div><div>使用道具 ${r.used}</div><div>行动次数 ${r.actions}</div></div><p>时间 40% / 潜行 30% / 效率 20% / 成就 10%<br>${r.escaped ? calculated.parts.join(" + ") + " = " + r.score : "失败局评分上限 39 分"}</p><p>本局成就：${earned.join("、") || "尚未达成，继续挑战"}</p><div class="actions" style="margin-top:20px"><button id="share">保存战绩卡 PNG</button><button id="back" class="gold">返回主界面</button></div>`,
  );
  w.querySelector<HTMLButtonElement>(".close")!.onclick = () => {
    w.remove();
    menu();
  };
  w.querySelector<HTMLButtonElement>("#back")!.onclick = () => {
    w.remove();
    menu();
  };
  w.querySelector<HTMLButtonElement>("#share")!.onclick = () => share(r);
}
function share(r: Result) {
  const c = document.createElement("canvas");
  c.width = 720;
  c.height = 960;
  const x = c.getContext("2d")!;
  x.fillStyle = "#101f29";
  x.fillRect(0, 0, 720, 960);
  x.fillStyle = "#f0c87a";
  x.fillRect(32, 32, 656, 8);
  x.fillRect(32, 920, 656, 8);
  x.strokeStyle = "#6a8a83";
  x.lineWidth = 4;
  x.strokeRect(32, 32, 656, 896);
  x.font = "bold 30px monospace";
  x.fillText("下班大作战 OFFICE ESCAPE", 64, 98);
  const cover = document.createElement("canvas");
  cover.width = 384;
  cover.height = 384;
  drawCover(cover);
  x.imageSmoothingEnabled = false;
  x.drawImage(cover, 180, 125, 360, 360);
  x.font = "bold 70px monospace";
  x.fillText(String(r.score).padStart(2, "0") + " / 100", 64, 570);
  x.font = "bold 30px monospace";
  x.fillText(r.rank, 64, 625);
  x.fillStyle = "#dce8de";
  x.font = "22px monospace";
  [
    `下班 ${time(r.minute)}  ·  ${r.difficulty}  ·  ${r.escaped ? "逃脱成功" : "未能逃脱"}`,
    `发现 ${r.found} 次 / 最高警觉 ${r.maxAlert}`,
    `行动 ${r.actions} 次 / 道具 ${r.used} 件`,
    `成就 ${r.achievements.slice(0, 3).join(" / ") || "继续挑战"}`,
  ].forEach((s, i) => x.fillText(s, 64, 686 + i * 43, 590));
  x.font = "16px monospace";
  x.fillStyle = "#8daaa6";
  x.fillText("确定的挑战，属于你的下班证明。", 64, 890);
  c.toBlob((b) => {
    if (!b) {
      toast("生成失败，请重试。");
      return;
    }
    const url = URL.createObjectURL(b),
      a = document.createElement("a");
    a.href = url;
    a.download = `OfficeEscape-${r.score}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
}
menu();
