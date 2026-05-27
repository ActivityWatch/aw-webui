[![en](https://img.shields.io/badge/lang-en-red.svg)](README.md) | [![zh](https://img.shields.io/badge/lang-zh--CN-yellow.svg)](README.zh.md)

# aw-webui

ActivityWatch 的 Web 界面，使用 Vue.js 构建

[![构建状态](https://github.com/ActivityWatch/aw-webui/workflows/Build/badge.svg)](https://github.com/ActivityWatch/aw-webui/actions)
[![覆盖率](https://codecov.io/gh/ActivityWatch/aw-webui/branch/master/graph/badge.svg)](https://codecov.io/gh/ActivityWatch/aw-webui)
[![已知漏洞](https://snyk.io/test/github/ActivityWatch/aw-webui/badge.svg)](https://snyk.io/test/github/ActivityWatch/aw-webui)

## 快速开始

设置开发环境非常简单：

```bash
# 以测试模式启动 aw-server 实例（端口 5666，使用独立数据库）
# 开发模式下 Web UI 默认连接到此实例
aw-qt --testing
# 或不带监控器运行：
aw-server --testing

# 安装依赖
npm install

# 以开发模式运行（带有热重载）
npm run serve

# 构建生产版本
npm run build
```

更多详情，请参阅[官方文档](https://docs.activitywatch.net)。
