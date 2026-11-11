import { test } from "node:test";
import assert from "node:assert/strict";
import { layouts, marker, path, visible, GameState } from "../src/engine";
test("three 12×12 maps have routes and all patrol targets reachable", () => {
  for (const m of layouts) {
    assert.equal(m.length, 12);
    assert.ok(m.every((r) => r.length === 12));
    assert.ok(path(m, marker(m, "P"), marker(m, "E")).length);
    for (const c of ["B", "A", "C"])
      for (const p of [
        { x: 9, y: 4 },
        { x: 5, y: 8 },
        { x: 1, y: 4 },
      ])
        assert.ok(path(m, marker(m, c), p).length);
  }
});
test("direction and desks block sight", () => {
  const m = layouts[0];
  assert.ok(visible(m, { x: 1, y: 1, dir: { x: 1, y: 0 } }, { x: 3, y: 1 }, 5));
  assert.ok(
    !visible(m, { x: 1, y: 1, dir: { x: 1, y: 0 } }, { x: 5, y: 1 }, 8),
  );
  assert.ok(
    !visible(m, { x: 3, y: 1, dir: { x: 1, y: 0 } }, { x: 1, y: 1 }, 5),
  );
});
test("movement collision, free observation and autonomous patrol", () => {
  const g = new GameState("普通", () => 0);
  assert.equal(g.move(-1, 0), false);
  g.observe();
  assert.equal(g.turn, 0);
  for (let i = 0; i < 5; i++) g.act("等待");
  assert.notDeepEqual({ x: g.npcs[0].x, y: g.npcs[0].y }, g.npcs[0].home);
});
test("difficulty changes resources and sight gain; disguise reduces exposure", () => {
  const easy = new GameState("简单", () => 0),
    hell = new GameState("地狱", () => 0);
  assert.ok(easy.pickups.length > hell.pickups.length);
  const setup = (g: GameState) => {
    g.player = { x: 1, y: 4 };
    g.npcs.forEach((n, i) => {
      n.active = i === 0;
      n.x = 1;
      n.y = 5;
      n.dir = { x: 0, y: -1 };
    });
  };
  setup(easy);
  setup(hell);
  easy.detect();
  hell.detect();
  assert.ok(hell.alert > easy.alert);
  const hidden = new GameState("地狱", () => 0);
  setup(hidden);
  hidden.disguise = 100;
  hidden.detect();
  assert.ok(hidden.alert < hell.alert);
});
test("six items apply effects and consume turns", () => {
  for (const item of [
    "咖啡杯",
    "文件夹",
    "手机",
    "纸箱",
    "门禁卡",
    "耳机",
  ] as const) {
    const g = new GameState("普通", () => 0);
    g.inventory = [item];
    g.repair = 4;
    g.use(item);
    assert.equal(g.used, 1);
    assert.equal(g.turn, 1);
    assert.equal(g.inventory.length, 0);
    if (item === "门禁卡") assert.equal(g.repair, 0);
  }
});
test("escape, suspicion stages, failure and hard real-time limit", () => {
  const g = new GameState("简单", () => 0);
  g.player = { x: 9, y: 10 };
  g.move(1, 0);
  assert.equal(g.status, "escaped");
  const f = new GameState("地狱", () => 0);
  f.player = { x: 1, y: 4 };
  f.npcs.forEach((n, i) => {
    n.active = i === 0;
    n.x = 1;
    n.y = 5;
    n.dir = { x: 0, y: -1 };
  });
  for (let i = 0; i < 3; i++) f.detect();
  assert.equal(f.found, 1);
  f.alert = 100;
  f.act("等待");
  assert.equal(f.status, "failed");
  const t = new GameState();
  t.timeout(300);
  assert.equal(t.status, "failed");
});
test("all ten contextual events can trigger", () => {
  const g = new GameState("简单", () => 0);
  for (const t of [3, 9, 15, 6, 22, 28, 18]) {
    g.turn = t;
    g.event();
  }
  for (const c of ["R", "T"]) {
    g.player = marker(g.map, c);
    g.event();
  }
  g.player = { ...g.npcs[1] };
  g.event();
  assert.equal(g.events.size, 10);
});
import { cardsData, scoring } from "../src/achievements";
test("all maps and difficulties support a complete stealth escape", () => {
  for (const difficulty of ["简单", "普通", "困难", "地狱"] as const)
    for (const seed of [0, 0.4, 0.8]) {
      const g = new GameState(difficulty, () => seed);
      g.use("文件夹");
      for (let i = 0; i < 70 && g.status === "playing"; i++) {
        if (g.disguise < 90) g.act("伪装");
        else {
          const p = path(g.map, g.player, g.exit)[0];
          if (p) g.move(p.x - g.player.x, p.y - g.player.y);
          else g.act("等待");
        }
      }
      assert.equal(g.status, "escaped", difficulty + " map " + g.mapId);
      assert.ok(g.minute < 60);
    }
});
test("ten deterministic cards and weighted scoring", () => {
  assert.equal(cardsData.length, 10);
  const g = new GameState("地狱", () => 0);
  assert.equal(cardsData.filter((c) => c.value(g) >= c.goal).length, 0);
  g.status = "escaped";
  g.minute = 20;
  g.turn = 20;
  const ids = cardsData.filter((c) => c.value(g) >= c.goal).map((c) => c.id);
  assert.ok(ids.includes("god"));
  assert.ok(ids.includes("boss"));
  assert.ok(ids.includes("first"));
  assert.ok(!ids.includes("loyal"));
  const a = scoring(g);
  assert.equal(
    a.score,
    a.parts.reduce((a, b) => a + b, 0),
  );
  assert.ok(a.score <= 100);
  g.status = "failed";
  assert.ok(scoring(g).score <= 39);
});
