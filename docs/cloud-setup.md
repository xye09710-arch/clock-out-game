# 可复用云环境设置

使用已有隔离检出 `/workspace/clock-out-game`，除非用户明确要求，不创建 Git worktree。

安装脚本：

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /workspace/clock-out-game
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm test
npm run build
```

启动：在持久终端运行 `cd /workspace/clock-out-game && npm run dev -- --port 5173`。通过本地 HTTP GET 和浏览器开始游戏、移动玩家验证。依赖与构建产物可随快照保留，运行进程必须重新启动。浏览器验收使用 `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`；没有系统 Chromium 时使用 Playwright 官方安装方式。无需应用密钥。

云环境草稿读取和保存接口本次返回 INVALID_ARGUMENT，保存未获确认；此文件保留可复用步骤，不表示平台配置已经保存或发布。
