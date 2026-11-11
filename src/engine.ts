export type Point = { x: number; y: number };
export type Difficulty = "简单" | "普通" | "困难" | "地狱";
export const difficulties: Record<
  Difficulty,
  { range: number; gain: number; speed: number; items: number }
> = {
  简单: { range: 3, gain: 12, speed: 2, items: 6 },
  普通: { range: 4, gain: 18, speed: 1, items: 5 },
  困难: { range: 5, gain: 25, speed: 1, items: 4 },
  地狱: { range: 6, gain: 32, speed: 1, items: 3 },
};
export const layouts = [
  [
    "############",
    "#P..#..B...#",
    "#...#......#",
    "#dd.#.dd...#",
    "#..........#",
    "#..##..##..#",
    "#A.........#",
    "#dd..dd..C.#",
    "#..........#",
    "#T..M..R...#",
    "#.........E#",
    "############",
  ],
  [
    "############",
    "#P.....B...#",
    "#..dd..dd..#",
    "#..........#",
    "#.##..##...#",
    "#A....#....#",
    "#dd...#..C.#",
    "#.....#....#",
    "#..dd......#",
    "#T..M..R...#",
    "#.........E#",
    "############",
  ],
  [
    "############",
    "#P...#B....#",
    "#dd..#..dd.#",
    "#....#.....#",
    "#..........#",
    "#..dd..dd..#",
    "#A....#..C.#",
    "#.....#....#",
    "#dd...#....#",
    "#T..M..R...#",
    "#.........E#",
    "############",
  ],
];
export const equal = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const distance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export function walkable(map: string[], p: Point) {
  return (
    p.x >= 0 &&
    p.x < 12 &&
    p.y >= 0 &&
    p.y < 12 &&
    !["#", "d"].includes(map[p.y][p.x])
  );
}
export function path(map: string[], a: Point, b: Point): Point[] {
  const q = [a],
    prev = new Map<string, Point>();
  const key = (p: Point) => `${p.x},${p.y}`;
  prev.set(key(a), a);
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    if (equal(p, b)) {
      const out: Point[] = [];
      let n = p;
      while (!equal(n, a)) {
        out.unshift(n);
        n = prev.get(key(n))!;
      }
      return out;
    }
    for (const d of [
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: -1, y: 0 },
    ]) {
      const n = { x: p.x + d.x, y: p.y + d.y };
      if (walkable(map, n) && !prev.has(key(n))) {
        prev.set(key(n), p);
        q.push(n);
      }
    }
  }
  return [];
}
export type NPC = Point & {
  name: string;
  dir: Point;
  home: Point;
  route: Point[];
  target: number;
  state: string;
  notice: number;
  pause: number;
  active: boolean;
};
export function visible(
  map: string[],
  npc: Point & { dir: Point },
  p: Point,
  range: number,
) {
  const dx = p.x - npc.x,
    dy = p.y - npc.y;
  const forward = dx * npc.dir.x + dy * npc.dir.y;
  const side = Math.abs(dx * npc.dir.y - dy * npc.dir.x);
  if (forward < 0 || forward + side > range || side > forward || equal(npc, p))
    return equal(npc, p);
  const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 3;
  for (let i = 1; i < steps; i++) {
    const q = {
      x: Math.round(npc.x + (dx * i) / steps),
      y: Math.round(npc.y + (dy * i) / steps),
    };
    if (!walkable(map, q)) return false;
  }
  return true;
}
export function marker(map: string[], c: string): Point {
  for (let y = 0; y < 12; y++) {
    const x = map[y].indexOf(c);
    if (x >= 0) return { x, y };
  }
  throw Error("Missing " + c);
}
export const itemNames = [
  "咖啡杯",
  "文件夹",
  "手机",
  "纸箱",
  "门禁卡",
  "耳机",
] as const;
export type Item = (typeof itemNames)[number];
export class GameState {
  map: string[];
  mapId: number;
  player: Point;
  exit: Point;
  npcs: NPC[];
  difficulty: Difficulty;
  turn = 0;
  minute = 0;
  alert = 0;
  maxAlert = 0;
  disguise = 0;
  found = 0;
  used = 0;
  waits = 0;
  disguises = 0;
  helped = 0;
  deflections = 0;
  observations = 0;
  status: "playing" | "escaped" | "failed" = "playing";
  reason = "";
  logs: string[] = [];
  inventory: Item[] = [];
  pickups: { pos: Point; item: Item }[] = [];
  events = new Set<string>();
  repair = 0;
  shield = 0;
  box = 0;
  quiet = 0;
  phone = 0;
  elapsed = 0;
  eventOffset = 0;
  constructor(difficulty: Difficulty = "普通", random = Math.random) {
    this.difficulty = difficulty;
    this.eventOffset = Math.floor(random() * 3);
    this.mapId = Math.floor(random() * 3);
    this.map = layouts[this.mapId];
    this.player = marker(this.map, "P");
    this.exit = marker(this.map, "E");
    this.npcs = ["B", "A", "C"].map((c, i) => {
      const home = marker(this.map, c);
      const initial =
        path(this.map, home, { x: 9, y: 4 })[Math.floor(random() * 3) - 1] ||
        home;
      const route = [home, { x: 9, y: 4 }, { x: 5, y: 8 }, { x: 1, y: 4 }];
      return {
        ...initial,
        name: ["老板", "同事 A", "同事 B"][i],
        dir: [
          { x: 0, y: 1 },
          { x: 1, y: 0 },
          { x: -1, y: 0 },
        ][i],
        home,
        route,
        target: Math.floor(random() * route.length),
        state: i ? "工作" : "正常工作",
        notice: 0,
        pause: i + 2,
        active: true,
      };
    });
    const floors: Point[] = [];
    for (let y = 2; y < 11; y++)
      for (let x = 1; x < 11; x++)
        if (walkable(this.map, { x, y })) floors.push({ x, y });
    const pool = [...itemNames];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let i = 0; i < difficulties[difficulty].items; i++) {
      const j = Math.floor(random() * floors.length);
      this.pickups.push({ pos: floors.splice(j, 1)[0], item: pool[i] });
    }
    this.inventory = [
      "文件夹",
      ...(difficulty === "简单" ? ["咖啡杯" as Item] : []),
    ];
    this.log("17:00，避开视线，抵达东南角电梯。道具走近自动拾取。");
  }
  log(s: string) {
    this.logs.unshift(s);
    this.logs = this.logs.slice(0, 40);
  }
  observe() {
    this.observations++;
    this.log(
      "观察（不耗时）：" +
        this.npcs
          .filter((n) => n.active)
          .map(
            (n) =>
              `${n.name}：${n.state}，朝${n.dir.x > 0 ? "东" : n.dir.x < 0 ? "西" : n.dir.y > 0 ? "南" : "北"}；下一站 ${n.route[n.target].x + 1},${n.route[n.target].y + 1}`,
          )
          .join("；"),
    );
  }
  move(dx: number, dy: number) {
    const p = { x: this.player.x + dx, y: this.player.y + dy };
    if (!walkable(this.map, p)) {
      this.log("墙壁或桌椅挡住了去路。");
      return false;
    }
    this.player = p;
    this.act("移动");
    return true;
  }
  act(action: string) {
    if (this.status !== "playing") return;
    this.turn++;
    this.minute += 1;
    this.disguise = Math.max(0, this.disguise - 5);
    if (action === "伪装") {
      this.disguise = Math.min(100, this.disguise + 65);
      this.disguises++;
      this.log("整理文件假装工作，伪装 +65。");
    }
    if (action === "等待") this.waits++;
    for (const p of [...this.pickups])
      if (equal(p.pos, this.player)) {
        this.inventory.push(p.item);
        this.pickups.splice(this.pickups.indexOf(p), 1);
        this.log("拾取 " + p.item + "。");
      }
    this.event();
    this.maxAlert = Math.max(this.maxAlert, this.alert);
    const confirmedByEvent = this.alert >= 100;
    this.tickNPC();
    this.detect();
    if (this.repair > 0) this.repair--;
    if (this.box > 0) this.box--;
    if (this.shield > 0) this.shield--;
    if (this.quiet > 0) this.quiet--;
    if (this.phone > 0) this.phone--;
    if (confirmedByEvent || this.alert >= 100) {
      this.status = "failed";
      this.reason = "身份确认：老板叫住了你。";
    } else if (equal(this.player, this.exit)) {
      if (this.repair > 0) {
        this.log("电梯检修中，还需 " + this.repair + " 次行动；门禁卡可解除。");
      } else {
        this.status = "escaped";
        this.reason = "电梯门关闭，下班成功。";
      }
    }
    if (this.minute >= 60 && this.status === "playing") {
      this.status = "failed";
      this.reason = "18:00，临时加班任务已下发。";
    }
  }
  tickNPC() {
    const config = difficulties[this.difficulty];
    for (const n of this.npcs) {
      if (!n.active) continue;
      if (n.pause > 0) {
        n.pause--;
        continue;
      }
      if (this.turn % config.speed !== 0) continue;
      if (
        n.name === "老板" &&
        (this.alert >= 45 || (n.state === "调查" && this.alert >= 25))
      ) {
        n.state = "调查";
        const step = path(this.map, n, this.player)[0];
        if (step) {
          n.dir = { x: step.x - n.x, y: step.y - n.y };
          Object.assign(n, step);
        }
        continue;
      }
      if ((n.state === "调查" && this.alert < 25) || n.state === "怀疑") {
        n.state = "返回办公室";
        n.target = 0;
      }
      if (equal(n, n.route[n.target])) {
        n.target = (n.target + 1) % n.route.length;
        n.dir = { x: -n.dir.y, y: n.dir.x };
        n.state = n.target === 1 ? "巡逻" : "观察";
        n.pause = 1;
      } else {
        const step = path(this.map, n, n.route[n.target])[0];
        if (step) {
          n.dir = { x: step.x - n.x, y: step.y - n.y };
          Object.assign(n, step);
        }
        n.state = n.target === 0 ? "返回办公室" : "巡逻";
      }
    }
  }
  detect() {
    let exposure = false;
    for (const n of this.npcs) {
      if (!n.active) continue;
      const seen =
        visible(
          this.map,
          n,
          this.player,
          difficulties[this.difficulty].range,
        ) &&
        (this.box === 0 || this.turn % 2 === 0);
      if (seen) {
        exposure = true;
        n.notice++;
        const gain = Math.max(
          2,
          Math.round(
            difficulties[this.difficulty].gain *
              (n.name === "老板" ? 1 : 0.55) *
              (1 - this.disguise / 120) *
              (this.shield ? 0.35 : 1) *
              (this.box ? 0.15 : 1),
          ),
        );
        this.alert = Math.min(100, this.alert + gain);
        n.state = n.notice === 1 ? "注意" : n.notice === 2 ? "怀疑" : "确认";
        if (n.name === "同事 B" && n.notice === 2) {
          this.npcs[0].state = "调查";
          this.npcs[0].pause = 0;
          this.log("同事 B 向老板报告异常，老板开始调查。");
        }
        if (n.notice === 3) {
          this.found++;
          this.log(n.name + "确认异常，已记一次发现。");
        }
        this.log(`${n.name}${n.state}：你处于视线内，警觉 +${gain}。`);
      } else n.notice = 0;
    }
    if (!exposure && this.alert > 0) {
      const loss = Math.min(this.alert, this.quiet ? 12 : 7);
      this.alert -= loss;
      this.log(`脱离视线，警觉 -${loss}。`);
    }
    this.maxAlert = Math.max(this.maxAlert, this.alert);
  }
  use(item: Item) {
    const i = this.inventory.indexOf(item);
    if (i < 0 || this.status !== "playing") return;
    this.inventory.splice(i, 1);
    this.used++;
    if (item === "咖啡杯") {
      this.shield = 7;
      this.disguise = 100;
      this.log("拿着咖啡自然走动，6 回合降低怀疑。");
    }
    if (item === "文件夹") {
      this.disguise = 100;
      this.shield = 5;
      this.log("抱文件送材料，伪装 100，4 回合掩护。");
    }
    if (item === "手机") {
      this.phone = 5;
      this.npcs[0].pause = 5;
      this.npcs[0].dir = { x: 0, y: -1 };
      this.npcs[0].state = "接电话";
      this.deflections++;
      this.log("发起业务电话，老板转身接听 4 回合。");
    }
    if (item === "纸箱") {
      this.box = 5;
      this.log("纸箱掩护 4 回合，视线警觉增长大幅降低。");
    }
    if (item === "门禁卡") {
      this.repair = 0;
      this.log("门禁卡解除电梯维护锁。");
    }
    if (item === "耳机") {
      this.quiet = 7;
      this.shield = 4;
      this.log("戴耳机避免搭话，隐蔽恢复加快 6 回合。");
    }
    this.act("道具");
  }
  event() {
    const boss = this.npcs[0];
    const fire = (id: string, condition: boolean, fn: () => void) => {
      if (condition && !this.events.has(id)) {
        this.events.add(id);
        fn();
      }
    };
    fire("老板突然起身", this.turn === 3 + this.eventOffset, () => {
      boss.pause = 0;
      boss.target = 1;
      boss.state = "巡逻";
      this.log("老板突然起身：开始沿走廊巡逻。");
    });
    fire(
      "同事求助",
      distance(this.player, this.npcs[1]) <= 2 && this.turn > 2,
      () => {
        if (this.quiet) {
          this.log("同事看到耳机，放弃求助。");
          return;
        }
        this.minute += 2;
        this.helped++;
        this.npcs[1].pause = 4;
        this.log("同事 A 求助：协助整理资料，耗时 +2 分钟；同事停留 4 回合。");
      },
    );
    fire(
      "打印机卡纸",
      distance(this.player, marker(this.map, "R")) <= 2,
      () => {
        boss.target = 2;
        boss.pause = 0;
        this.log("打印机卡纸：异响引导老板前往南侧走廊。");
      },
    );
    fire("老板接电话", this.turn === 9 + this.eventOffset, () => {
      boss.pause = 4;
      boss.dir = { x: 0, y: -1 };
      boss.state = "接电话";
      this.log("老板接电话：朝北停留 4 回合。");
    });
    fire("临时会议", this.turn === 15 + this.eventOffset, () => {
      boss.target = 2;
      boss.pause = 3;
      boss.state = "会议";
      this.log("临时会议：老板原地开语音会，停留 3 回合。");
    });
    fire(
      "电梯维修",
      this.turn === 6 + this.eventOffset && this.mapId !== 1,
      () => {
        this.repair = 10;
        this.log("电梯维修：维护锁持续 9 次行动，可用门禁卡解除。");
      },
    );
    fire("同事提前离开", this.turn === 22 + this.eventOffset, () => {
      this.npcs[1].active = false;
      this.log("同事 A 提前离开，工位不再有人。");
    });
    fire("老板寻找员工", this.turn === 28 + this.eventOffset, () => {
      boss.target = 0;
      boss.pause = 0;
      boss.state = "返回办公室";
      this.log("老板寻找员工：返回办公室检查出勤。");
    });
    fire(
      "茶水间有人",
      distance(this.player, marker(this.map, "T")) <= 1,
      () => {
        this.npcs[2].target = 2;
        this.npcs[2].pause = 2;
        this.log("茶水间有人：同事 B 停下聊天 2 回合。");
      },
    );
    fire("客户突然来电", this.turn === 18 + this.eventOffset, () => {
      if (this.quiet) {
        this.log("耳机静音接听，避免客户来电暴露。");
        return;
      }
      this.alert = Math.min(100, this.alert + 8);
      this.log("客户突然来电：铃声暴露位置，警觉 +8。");
    });
  }
  timeout(seconds: number) {
    this.elapsed = seconds;
    if (seconds >= 300 && this.status === "playing") {
      this.status = "failed";
      this.reason = "五分钟已到，本次逃脱失败。";
    }
  }
}
