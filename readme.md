# LibreTV - 免费在线视频搜索与观看平台

## 📺 项目简介

LibreTV 是一个轻量级、免费的在线视频搜索与观看平台，提供来自多个视频源的内容搜索与播放服务。无需注册，即开即用，支持多种设备访问。项目采用前端技术构建，并**利用 Serverless Functions 实现内部代理**，以解决跨域请求问题并处理 M3U8 播放列表，可轻松部署在 Cloudflare Pages、Vercel、Netlify 等现代托管服务上。

本项目基于 [bestK/tv](https://github.com/bestK/tv)

演示站：[https://libretv.is-an.org/](https://libretv.is-an.org/)

<img src="https://testingcf.jsdelivr.net/gh/bestZwei/imgs@master/picgo/image-20250406231222216.png" alt="LibreTV 界面截图" style="zoom:67%;" />

**感谢 [NodeSupport](https://www.nodeseek.com/post-305185-1) 友情赞助**

## ✨ 主要特性

-   🔍 **多源搜索**: 同时聚合多个视频源的搜索结果。
-   📱 **响应式设计**: 完美适配电脑、平板和手机访问。
-   🔗 **内部代理**: 通过 Serverless Function 解决 API 跨域问题，处理 M3U8 播放列表。
-   🔄 **自定义 API**: 支持添加符合标准的苹果CMS V10 API 接口。
-   💾 **搜索历史**: 使用 localStorage 记录最近搜索，方便快速访问。
-   ⚡️ **现代部署**: 轻松部署于 Cloudflare Pages、Vercel、Netlify 等平台。
-   🛡️ **广告过滤**: 播放器内置基础的 M3U8 分片广告过滤（可开关）。
-   🎬 **定制播放器**: 基于 DPlayer 和 HLS.js，提供流畅的 HLS 播放体验。
-   ⌨️ **快捷键支持**: 播放器支持常用快捷键操作。

## ⌨️ 键盘快捷键

LibreTV 播放器支持以下键盘快捷键：

-   **Alt + 左箭头**: 播放上一集
-   **Alt + 右箭头**: 播放下一集
-   **空格键**: 暂停/播放
-   **左/右箭头**: 快退/快进 5 秒
-   **上/下箭头**: 调高/调低音量
-   **F**: 进入/退出全屏

## 📹 视频源与代理说明

-   **代理作用**: 由于浏览器同源策略限制，前端无法直接请求第三方 API。本项目使用 Serverless Function（部署在 Cloudflare Pages / Vercel / Netlify）作为内部代理，代为请求目标 API 和 M3U8 文件，解决跨域问题，并统一处理 M3U8 文件中的 URL，确保播放流畅。
-   **支持的源**: 默认支持黑木耳、非凡影视、天涯资源等多个公开采集站。
-   **CMS 兼容性**: 支持标准的**苹果CMS V10 API**格式。
    -   搜索接口格式: `/api.php/provide/vod/?ac=videolist&wd=关键词`
    *   详情接口格式: `/api.php/provide/vod/?ac=videolist&ids=视频ID` (注意：v10详情接口通常也是`ac=videolist`)
-   **自定义接口添加**:
    1.  在设置面板选择"自定义接口"。
    2.  接口地址**只需填写到域名部分**，例如：`https://jszyapi.com` 或 `http://ffzy5.tv` (注意 `http` 或 `https`)。
    3.  项目代码会自动在后端函数（或代理）中补全 `/api.php/provide/vod/...` 等路径。
-   **非标准接口**: 如果 CMS 的 API 路径不是标准的 `/api.php/provide/vod/`，你可能需要修改对应平台函数文件 (`/api/proxy/[...path].js` 或 `/netlify/functions/proxy.js`) 中的 `API_CONFIG` 部分。

## 🛠️ 技术栈

-   HTML5 + CSS3 + JavaScript (ES6+)
-   Tailwind CSS (通过 CDN 引入)
-   **Serverless Functions**: (Cloudflare Pages Functions / Vercel Serverless Functions / Netlify Functions) 用于实现内部代理。
-   HLS.js: 用于 HLS 流处理和广告过滤。
-   DPlayer: 视频播放器核心。
-   localStorage: 用于本地存储设置和历史记录。

## 🚀 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FbestZwei%2FLibreTV)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/bestZwei/LibreTV)
[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deploy%20to-Cloudflare%20Pages-F38020?logo=cloudflare&logoColor=F38020)](https://dash.cloudflare.com/?to=/:account/pages/new/deploy-with-git)

**重要**: 使用上方按钮部署后，仍需根据下文**手动配置环境变量**才能使代理功能正常工作！

## 🚀 部署指南

本项目包含前端静态文件和一个 Serverless Function 代理。部署到不同平台需要注意函数路径和环境变量配置。

### A. Cloudflare Pages 部署

1.  **Fork/克隆仓库**: 将本仓库 Fork 或克隆到你的 GitHub/GitLab 账户。
2.  **连接仓库**: 登录 Cloudflare Dashboard -> Pages -> 创建项目 -> 连接你的仓库。
3.  **构建设置**:
    *   构建命令：留空 (无需构建)
    *   输出目录：留空 (或填 `/`)
4.  **环境变量**: **【关键步骤】** 进入项目设置 -> 函数 -> 环境变量绑定 -> **添加生产和预览环境**的变量：
    *   `CACHE_TTL`: `86400` (代理缓存时间，秒)
    *   `MAX_RECURSION`: `5` (M3U8 最大递归层数)
    *   `USER_AGENTS_JSON`: `["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"]` (JSON 字符串数组格式，至少包含一个 User-Agent)
    *   `DEBUG`: `false` (设为 `true` 可在函数日志中看到更多信息)
5.  **部署**: 保存并部署。Cloudflare 会自动识别 `/functions` 目录下的函数。
6.  **检查配置**: 确保 `js/config.js` 中的 `PROXY_URL` 设置为 `/proxy/` (默认值)。

### B. Vercel 部署

1.  **Fork/克隆仓库**: 同上。
2.  **导入项目**: 登录 Vercel -> Add New -> Project -> Import Git Repository -> 选择你的仓库。
3.  **构建设置**: Vercel 通常会自动检测到这是一个静态项目（无框架）。
    *   Framework Preset: Other
    *   Build Command: 留空
    *   Output Directory: 留空 (或 `.`)
    *   Install Command: 留空
4.  **环境变量**: **【关键步骤】** 进入项目设置 -> Environment Variables -> 添加以下变量 (确保同时添加到 Production, Preview, Development):
    *   `CACHE_TTL`: `86400`
    *   `MAX_RECURSION`: `5`
    *   `USER_AGENTS_JSON`: `["...", "..."]` (同上)
    *   `DEBUG`: `false`
5.  **部署**: 点击 Deploy。Vercel 会自动识别 `/api` 目录下的函数。
6.  **检查配置**: **【关键步骤】** 修改 `js/config.js` 文件，将 `PROXY_URL` 的值改为 `/api/proxy/`。你需要**提交这次修改**到你的 Git 仓库，Vercel 会自动重新部署。
    ```javascript
    // js/config.js
    // const PROXY_URL = '/proxy/'; // 注释掉这行
    const PROXY_URL = '/api/proxy/'; // 取消注释这行
    ```

### C. Netlify 部署

1.  **Fork/克隆仓库**: 同上。
2.  **连接仓库**: 登录 Netlify -> Add new site -> Import an existing project -> 选择你的 Git 提供商 -> 选择你的仓库。
3.  **构建设置**:
    *   Build command: 留空
    *   Publish directory: 留空 (或 `.`)
    *   Functions directory: `netlify/functions` (确保 Netlify 识别函数目录)
4.  **环境变量**: **【关键步骤】** 进入 Site settings -> Build & deploy -> Environment -> Environment variables -> Add environment variables:
    *   `CACHE_TTL`: `86400`
    *   `MAX_RECURSION`: `5`
    *   `USER_AGENTS_JSON`: `["...", "..."]` (同上)
    *   `DEBUG`: `false`
5.  **部署**: 点击 Deploy site。Netlify 会部署静态文件并识别 `/netlify/functions` 目录下的函数。
6.  **检查配置**:
    *   确保项目根目录下有 `netlify.toml` 文件，并且包含正确的重写规则（如之前提供的内容）。
    *   确保 `js/config.js` 中的 `PROXY_URL` 设置为 `/proxy/` (默认值)。

### 本地测试 (仅限静态部分)

如果你只想预览静态界面，可以使用任何 HTTP 服务器：

```bash
# 使用 Node.js 的 http-server
npx http-server -p 8080
```

注意: 这种方式无法运行 Serverless Function 代理，因此 API 请求会因跨域失败。要完整测试（包括代理功能），你需要使用对应平台的 CLI 工具进行本地开发：
Cloudflare Pages: npm install -g wrangler 然后 wrangler pages dev .
Vercel: npm install -g vercel 然后 vercel dev
Netlify: npm install -g netlify-cli 然后 netlify dev

### Docker 部署 (仅限静态部分)
提供的 Docker 镜像仅包含 Nginx 和静态文件，同样无法运行 Serverless Function 代理。

```bash
docker pull bestzwei/libretv:latest
docker run -d --name libretv -p 8899:80 bestzwei/libretv:latest
```

访问 http://localhost:8899 只能查看静态界面，API 功能无法使用。不推荐使用 Docker 部署此项目，除非你自行在 Docker 环境中配置反向代理来模拟 Serverless Function 的行为（这比较复杂）。

## 🔧 自定义配置
前端配置 (js/config.js):
- `PROXY_URL`: 根据部署平台调整！ (Vercel: /api/proxy/, CF/Netlify: /proxy/)。
- `API_SITES`: 添加或修改默认视频源。
- `SITE_CONFIG`: 更改站点名称、描述等。
- `PLAYER_CONFIG`: 调整播放器默认参数。
- `后端代理配置 (环境变量)`: 在部署平台的设置界面修改 CACHE_TTL, DEBUG, MAX_RECURSION, USER_AGENTS_JSON 等环境变量。

## 🌟 项目结构 (适配多平台)

Cloudflare Pages 结构:

```
LibreTV/
├── functions/
│   └── proxy/
│       └── [[path]].js  # CF Pages Function
├── js/
│   └── ... (config.js 默认 PROXY_URL='/proxy/')
├── css/ ...
├── *.html ...
└── ...
```

Vercel 结构:

```
LibreTV/
├── api/
│   └── proxy/
│       └── [...path].js # Vercel Serverless Function
├── js/
│   └── ... (config.js 修改 PROXY_URL='/api/proxy/')
├── css/ ...
├── *.html ...
└── ...
```

Netlify 结构:

```
LibreTV/
├── netlify/
│   └── functions/
│       └── proxy.js     # Netlify Function
├── js/
│   └── ... (config.js 默认 PROXY_URL='/proxy/')
├── css/ ...
├── *.html ...
├── netlify.toml         # 包含重写规则
└── ...
```

(注意：实际项目中你只需保留与你目标平台对应的函数文件和配置)

## Star History
![alt text](https://api.star-history.com/svg?repos=bestZwei/LibreTV&type=Date)
⚠️ 免责声明
LibreTV 仅作为视频搜索工具，不存储、上传或分发任何视频内容。所有视频均来自第三方 API 接口提供的公开搜索结果。内部代理仅用于解决浏览器跨域限制和处理 M3U8 格式，不修改视频内容本身。如有侵权内容，请联系相应的内容提供方处理。使用本工具产生的任何法律后果由使用者自行承担。

## 🔄 更新日志
1.0.0 (2025-04-06): 初始版本发布。
1.0.1 (2025-04-07): 添加客户端广告过滤，优化播放器。
1.0.2 (2025-04-08): 分离播放页面，优化 API 兼容性。
1.1.0 (2025-04-12): 集成 Serverless Function 内部代理，解决 CORS 问题，重构 M3U8 处理逻辑，移除 KV 依赖，增加多平台 (CF Pages, Vercel, Netlify) 部署支持和指南。
