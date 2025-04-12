// js/config.js

// 全局常量配置

// 默认代理路径 (适用于 Cloudflare Pages 和 Netlify with rewrite)
const PROXY_URL = '/proxy/';

// **部署到 Vercel 时，请取消注释下面这行，并注释掉上面那行**
// const PROXY_URL = '/api/proxy/';

const HOPLAYER_URL = 'https://hoplayer.com/index.html';
const SEARCH_HISTORY_KEY = 'videoSearchHistory';
const MAX_HISTORY_ITEMS = 5;

// 网站信息配置
const SITE_CONFIG = {
    name: 'LibreTV',
    url: 'https://www.sumingys.top', // 您可以改成您的实际部署地址
    description: '免费在线视频搜索与观看平台',
    logo: 'https://images.icon-icons.com/38/PNG/512/retrotv_5520.png',
    version: '1.0.1' // 版本号更新
};

// API站点配置
const API_SITES = {
    heimuer: {
        api: 'https://json.heimuer.xyz',
        name: '黑木耳',
        detail: 'https://heimuer.tv' // 假设详情页基础 URL
    },
    ffzy: {
        api: 'http://ffzy5.tv', // 注意 http
        name: '非凡影视',
        detail: 'http://ffzy5.tv' // 详情页基础 URL
    },
    tyyszy: {
        api: 'https://tyyszy.com',
        name: '天涯资源',
        // detail: 'https://tyyszy.com' // 如果有详情页
    },
    ckzy: {
        api: 'https://www.ckzy1.com',
        name: 'CK资源',
        // detail: 'https://www.ckzy1.com'
    },
    zy360: {
        api: 'https://360zy.com',
        name: '360资源',
        // detail: 'https://360zy.com'
    },
    wolong: {
        api: 'https://wolongzyw.com',
        name: '卧龙资源',
        // detail: 'https://wolongzyw.com'
    },
    cjhw: {
        api: 'https://cjhwba.com',
        name: '新华为',
        // detail: 'https://cjhwba.com'
    },
    jisu: {
        api: 'https://jszyapi.com',
        name: '极速资源',
        detail: 'https://jszyapi.com' // 详情页基础 URL
    },
    dbzy: {
        api: 'https://dbzy.com',
        name: '豆瓣资源',
        // detail: 'https://dbzy.com'
    },
    hhzy: {
        api: 'https://www.haohuazy.com',
        name: '豪华资源',
    },
    fqzy: {
        api: 'https://fqzy2.me',
        name: '番茄9kg资源',
        detail: 'https://fqzy2.me' // 详情页基础 URL
    }
    // 您可以按需添加更多源
};

// 添加聚合搜索的配置选项
const AGGREGATED_SEARCH_CONFIG = {
    enabled: true,             // 是否启用聚合搜索 (目前通过选择 "聚合搜索" 实现)
    timeout: 8000,            // 单个源超时时间（毫秒） - 用于 handleAggregatedSearch
    maxResults: 10000,          // 最大结果数量 (目前未强制限制)
    parallelRequests: true,   // 是否并行请求所有源 (handleAggregatedSearch 已实现)
    showSourceBadges: true    // 是否显示来源徽章 (app.js 已实现)
};

// 抽象API请求配置 (这些路径通常是固定的)
const API_CONFIG = {
    search: {
        path: '/api.php/provide/vod/?ac=videolist&wd=',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    },
    detail: {
        path: '/api.php/provide/vod/?ac=videolist&ids=',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    }
};

// 优化后的正则表达式模式 (用于非凡/极速等直接爬取详情页的情况)
const M3U8_PATTERN = /\$https?:\/\/[^"'\s]+?\.m3u8/g;

// 添加自定义播放器URL
const CUSTOM_PLAYER_URL = 'player.html'; // 使用相对路径引用本地player.html

// 增加视频播放相关配置
const PLAYER_CONFIG = {
    autoplay: true,
    allowFullscreen: true,
    width: '100%',
    height: '600', // player.html 中通过 CSS 控制更灵活
    timeout: 15000,  // 播放器加载超时时间 (player.html 中有类似逻辑)
    filterAds: true,  // 是否启用广告过滤 (现在由 player.html 的逻辑和开关控制)
    autoPlayNext: true,  // 默认启用自动连播功能 (player.html 中实现)
    adFilteringEnabled: true, // 默认开启分片广告过滤 (player.html 中实现)
    adFilteringStorage: 'adFilteringEnabled' // 存储广告过滤设置的键名
};

// 增加错误信息本地化 (可以在 ui.js 中使用)
const ERROR_MESSAGES = {
    NETWORK_ERROR: '网络连接错误，请检查网络设置',
    TIMEOUT_ERROR: '请求超时，服务器响应时间过长',
    API_ERROR: 'API接口返回错误，请尝试更换数据源',
    PLAYER_ERROR: '播放器加载失败，请尝试其他视频源',
    UNKNOWN_ERROR: '发生未知错误，请刷新页面重试'
};

// 添加进一步安全设置 (主要用于前端输入验证)
const SECURITY_CONFIG = {
    enableXSSProtection: true,  // 是否启用XSS保护 (体现在 app.js 处理用户输入和渲染结果时)
    sanitizeUrls: true,         // 是否清理URL (体现在 app.js 处理用户输入和 API 结果时)
    maxQueryLength: 100,        // 最大搜索长度 (可以在 app.js 的 search 函数中检查)
    // allowedApiDomains 不再需要，因为所有请求都通过内部代理
};

// 添加多个自定义API源的配置
const CUSTOM_API_CONFIG = {
    separator: ',',           // 分隔符
    maxSources: 5,            // 最大允许的自定义源数量
    testTimeout: 5000,        // 测试超时时间(毫秒) - 用于 app.js 的 testSiteAvailability
    namePrefix: '自定义-',    // 自定义源名称前缀 (修改为中文)
    validateUrl: true,        // 验证URL格式 (app.js 中使用)
    cacheResults: true,       // 缓存测试结果 (app.js 中使用 localStorage)
    cacheExpiry: 5184000000   // 缓存过期时间(2个月) (app.js 中使用)
};


// --- 内部代理功能配置已移除 ---
// 代理功能的配置现在通过 Cloudflare Pages / Vercel / Netlify 的环境变量设置
// --- 内部代理功能配置结束 ---
