import { GameState } from "./engine";
export const cardsData = [
  {
    id: "god",
    name: "下班之神",
    rarity: "传说",
    condition: "地狱难度成功逃脱，17:25 前且零发现",
    goal: 1,
    value: (g: GameState) =>
      Number(
        g.status === "escaped" &&
          g.difficulty === "地狱" &&
          g.minute <= 25 &&
          g.found === 0,
      ),
  },
  {
    id: "ghost",
    name: "公司幽灵",
    rarity: "史诗",
    condition: "成功逃脱，最高警觉不超过 20",
    goal: 1,
    value: (g: GameState) => Number(g.status === "escaped" && g.maxAlert <= 20),
  },
  {
    id: "lift",
    name: "电梯刺客",
    rarity: "稀有",
    condition: "在 17:22 前成功逃脱",
    goal: 1,
    value: (g: GameState) => Number(g.status === "escaped" && g.minute <= 22),
  },
  {
    id: "deflect",
    name: "甩锅艺术家",
    rarity: "稀有",
    condition: "使用手机转移老板注意 1 次",
    goal: 1,
    value: (g: GameState) => g.deflections,
  },
  {
    id: "actor",
    name: "影帝",
    rarity: "史诗",
    condition: "同一局伪装 5 次，并成功逃脱",
    goal: 5,
    value: (g: GameState) => (g.status === "escaped" ? g.disguises : 0),
  },
  {
    id: "limit",
    name: "极限逃生",
    rarity: "史诗",
    condition: "最高警觉达到 80 后仍成功逃脱",
    goal: 80,
    value: (g: GameState) => (g.status === "escaped" ? g.maxAlert : 0),
  },
  {
    id: "slack",
    name: "摸鱼大师",
    rarity: "普通",
    condition: "同一局等待 8 次",
    goal: 8,
    value: (g: GameState) => g.waits,
  },
  {
    id: "loyal",
    name: "最后的忠臣",
    rarity: "稀有",
    condition: "17:50 或之后成功逃脱",
    goal: 1,
    value: (g: GameState) => Number(g.status === "escaped" && g.minute >= 50),
  },
  {
    id: "boss",
    name: "老板克星",
    rarity: "传说",
    condition: "困难或地狱难度零发现且不用道具逃脱",
    goal: 1,
    value: (g: GameState) =>
      Number(
        g.status === "escaped" &&
          ["困难", "地狱"].includes(g.difficulty) &&
          g.found === 0 &&
          g.used === 0,
      ),
  },
  {
    id: "first",
    name: "自由第一步",
    rarity: "普通",
    condition: "任意难度成功逃脱 1 次",
    goal: 1,
    value: (g: GameState) => Number(g.status === "escaped"),
  },
];
export function scoring(g: GameState) {
  const speed = Math.max(0, (100 * (60 - g.minute)) / 60);
  const stealth = Math.max(0, 100 - g.found * 20 - g.maxAlert * 0.5);
  const efficiency = Math.min(100, Math.max(0, 100 - (g.turn - 18) * 3));
  const special = Math.min(
    100,
    cardsData.filter((c) => c.value(g) >= c.goal).length * 25,
  );
  const score =
    g.status === "escaped"
      ? [
          Math.round(speed * 0.4),
          Math.round(stealth * 0.3),
          Math.round(efficiency * 0.2),
          Math.round(special * 0.1),
        ].reduce((a, b) => a + b, 0)
      : Math.min(39, Math.round(stealth * 0.2 + efficiency * 0.1));
  return {
    score,
    parts: [
      Math.round(speed * 0.4),
      Math.round(stealth * 0.3),
      Math.round(efficiency * 0.2),
      Math.round(special * 0.1),
    ],
    rank:
      g.status !== "escaped"
        ? "加班练习生"
        : score >= 90
          ? "下班宗师"
          : score >= 75
            ? "潜行专家"
            : score >= 55
              ? "准点达人"
              : "办公室幸存者",
  };
}
