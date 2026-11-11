import { test, expect } from "@playwright/test";
import { GameState, path, type Difficulty } from "../src/engine";
for (const config of [
  {
    name: "desktop",
    width: 1280,
    height: 900,
    mobile: false,
    difficulty: "普通" as Difficulty,
    seed: 0,
  },
  {
    name: "mobile",
    width: 390,
    height: 844,
    mobile: true,
    difficulty: "地狱" as Difficulty,
    seed: 0.8,
  },
]) {
  test(
    config.name + " complete playable escape, share and persistence",
    async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: config.width, height: config.height },
        isMobile: config.mobile,
        hasTouch: config.mobile,
        acceptDownloads: true,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.stack || e.message));
      await page.goto("/");
      // Scope fixed randomness to GameState's captured constructor RNG.
      // Restore the global immediately so Phaser's texture UUIDs remain unique.
      await page.evaluate((seed) => {
        const original = Math.random;
        Math.random = () => {
          Math.random = original;
          return seed;
        };
      }, config.seed);
      await page.selectOption("#difficulty", config.difficulty);
      await page.locator("#start").click();
      await expect(page.locator("#board canvas")).toBeVisible();
      await expect(page.locator("#remaining")).toContainText("0 次行动");
      await page.locator("#observe").click();
      await expect(page.locator("#remaining")).toContainText("0 次行动");
      const g = new GameState(config.difficulty, () => config.seed);
      await page
        .locator("#inventory button")
        .filter({ hasText: "文件夹" })
        .click();
      g.use("文件夹");
      await page.waitForTimeout(170);
      for (let i = 0; i < 70 && g.status === "playing"; i++) {
        if (g.disguise < 90) {
          await page.locator('[data-action="伪装"]').click();
          g.act("伪装");
        } else {
          const p = path(g.map, g.player, g.exit)[0];
          if (p) {
            const dx = p.x - g.player.x,
              dy = p.y - g.player.y;
            if (config.mobile) {
              await page.locator(`[data-move="${dx},${dy}"]`).tap();
            } else {
              await page.keyboard.press(
                dx === 1
                  ? "ArrowRight"
                  : dx === -1
                    ? "ArrowLeft"
                    : dy === 1
                      ? "ArrowDown"
                      : "ArrowUp",
              );
            }
            g.move(dx, dy);
          } else {
            await page.locator('.actions [data-action="等待"]').click();
            g.act("等待");
          }
        }
        await page.waitForTimeout(170);
      }
      expect(g.status).toBe("escaped");
      await expect(page.getByRole("dialog")).toContainText("行动成功");
      await expect(page.getByRole("dialog")).toContainText(time(g.minute));
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#share").click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/OfficeEscape-.*\.png/);
      const file = await download.path();
      expect(file).toBeTruthy();
      await page.screenshot({
        path: `/tmp/office-${config.name}-result.png`,
        fullPage: true,
      });
      await page.locator("#back").click();
      await page.reload();
      await page.locator("#cards").click();
      await expect(page.locator(".card.unlocked")).not.toHaveCount(0);
      await page.locator(".close").click();
      await page.locator("#records").click();
      await expect(page.locator(".records tbody tr")).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
      await context.close();
    },
  );
}
const time = (n: number) =>
  `${17 + Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
test("mouse moves to adjacent tile and five-minute deadline produces saved failure", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.locator("#start").click();
  await expect(page.locator("#board canvas")).toBeVisible();
  const box = await page.locator("#board canvas").boundingBox();
  await page.mouse.click(
    box!.x + (box!.width * 2.5) / 12,
    box!.y + (box!.height * 1.5) / 12,
  );
  await page.clock.runFor(200);
  await expect(page.locator("#position")).toContainText("位置 3,2");
  await page.clock.fastForward(301000);
  await expect(page.getByRole("dialog")).toContainText("五分钟已到");
  await page.locator("#back").click();
  await page.locator("#records").click();
  await expect(page.locator(".records")).toContainText("失败");
});
