// /api/proxy/[...path].js - Vercel Serverless Function

import { URL } from 'url';
import fetch from 'node-fetch'; // Vercel 通常需要显式导入 fetch

// --- 辅助函数 (移植并适配 Node.js 环境) ---

function logDebug(message) {
    if (process.env.DEBUG === 'true') {
        console.log(`[Proxy Func Vercel] ${message}`);
    }
}

function getTargetUrlFromPath(encodedPath) {
    if (!encodedPath) return null;
    try {
        let decodedUrl = decodeURIComponent(encodedPath);
        if (!decodedUrl.match(/^https?:\/\//i)) {
            // 尝试原始路径（如果未编码）
            if (encodedPath.match(/^https?:\/\//i)) {
                decodedUrl = encodedPath;
                logDebug(`Warning: Path was not encoded but looks like URL: ${decodedUrl}`);
            } else {
                logDebug(`Invalid target URL format (decoded): ${decodedUrl}`);
                return null;
            }
        }
        return decodedUrl;
    } catch (e) {
        logDebug(`Error decoding target URL: ${encodedPath} - ${e.message}`);
        return null;
    }
}

function getBaseUrl(urlStr) {
    if (!urlStr) return '';
    try {
        const parsedUrl = new URL(urlStr);
        if (!parsedUrl.pathname || parsedUrl.pathname === '/') return `${parsedUrl.origin}/`;
        const pathParts = parsedUrl.pathname.split('/');
        pathParts.pop(); // 移除文件名或最后一个路径段
        return `${parsedUrl.origin}${pathParts.join('/')}/`;
    } catch (e) {
        logDebug(`Getting BaseUrl failed: ${urlStr} - ${e.message}`);
        const lastSlashIndex = urlStr.lastIndexOf('/');
        return lastSlashIndex > urlStr.indexOf('://') + 2 ? urlStr.substring(0, lastSlashIndex + 1) : urlStr + '/';
    }
}

function resolveUrl(baseUrl, relativeUrl) {
    if (!baseUrl || !relativeUrl) return relativeUrl || '';
    if (relativeUrl.match(/^https?:\/\//i)) return relativeUrl;
    try {
        // 使用 Node.js 的 URL 对象来处理相对路径
        return new URL(relativeUrl, baseUrl).toString();
    } catch (e) {
        logDebug(`Resolving URL failed: base=${baseUrl}, rel=${relativeUrl}`, e.message);
        if (relativeUrl.startsWith('/')) {
            try {
                const urlObj = new URL(baseUrl);
                return `${urlObj.origin}${relativeUrl}`;
            } catch { return relativeUrl; }
        }
        // 尝试拼接
         const baseEndsWithSlash = baseUrl.endsWith('/');
         const relStartsWithSlash = relativeUrl.startsWith('/');
         if (baseEndsWithSlash && relStartsWithSlash) {
             return baseUrl + relativeUrl.substring(1);
         } else if (!baseEndsWithSlash && !relStartsWithSlash) {
              return baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1) + relativeUrl;
         } else {
            return baseUrl + relativeUrl;
         }
    }
}


function rewriteUrlToProxy(targetUrl) {
    if (!targetUrl || typeof targetUrl !== 'string') return '';
    // 这里的路径取决于 Vercel 部署的函数路径
    return `/api/proxy/${encodeURIComponent(targetUrl)}`;
}

function getRandomUserAgent(agents) {
    if (!agents || agents.length === 0) {
       return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'; // 默认
    }
    return agents[Math.floor(Math.random() * agents.length)];
}

async function fetchContentWithType(targetUrl, requestHeaders, userAgents) {
    const headers = { // 使用普通对象，node-fetch 会处理
        'User-Agent': getRandomUserAgent(userAgents),
        'Accept': '*/*',
        'Accept-Language': requestHeaders['accept-language'] || 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': requestHeaders['referer'] || new URL(targetUrl).origin
    };

    try {
        logDebug(`Fetching: ${targetUrl}`);
        const response = await fetch(targetUrl, { headers, redirect: 'follow' });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            logDebug(`Fetch failed: ${response.status} ${response.statusText} - ${targetUrl}`);
            throw new Error(`HTTP error ${response.status}: ${response.statusText}. URL: ${targetUrl}. Body: ${errorBody.substring(0, 150)}`);
        }

        const content = await response.text();
        const contentType = response.headers.get('content-type') || '';
        logDebug(`Fetch success: ${targetUrl}, Content-Type: ${contentType}, Length: ${content.length}`);
        return { content, contentType, responseHeaders: response.headers }; // response.headers 是 Headers 对象

    } catch (error) {
        logDebug(`Fetch exception: ${targetUrl}: ${error.message}`);
        throw new Error(`Failed to fetch target URL ${targetUrl}: ${error.message}`);
    }
}

function isM3u8Content(content, contentType) {
    if (contentType && (contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('application/x-mpegurl') || contentType.includes('audio/mpegurl'))) {
        return true;
    }
    return content && typeof content === 'string' && content.trim().startsWith('#EXTM3U');
}

function processKeyLine(line, baseUrl) {
    return line.replace(/URI="([^"]+)"/, (match, uri) => {
        const absoluteUri = resolveUrl(baseUrl, uri);
        logDebug(`Processing KEY URI: Original='${uri}', Absolute='${absoluteUri}'`);
        return `URI="${rewriteUrlToProxy(absoluteUri)}"`;
    });
}

function processMapLine(line, baseUrl) {
    return line.replace(/URI="([^"]+)"/, (match, uri) => {
        const absoluteUri = resolveUrl(baseUrl, uri);
        logDebug(`Processing MAP URI: Original='${uri}', Absolute='${absoluteUri}'`);
        return `URI="${rewriteUrlToProxy(absoluteUri)}"`;
    });
}

function processMediaPlaylist(url, content) {
    const baseUrl = getBaseUrl(url);
    const lines = content.split('\n');
    const output = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line && i === lines.length - 1) { // Keep last empty line
            output.push(line); continue;
        }
        if (!line) continue; // Skip intermediate empty lines

        // Ad filtering is disabled in proxy
        // if (FILTER_DISCONTINUITY && line === '#EXT-X-DISCONTINUITY') continue;

        if (line.startsWith('#EXT-X-KEY')) {
            output.push(processKeyLine(line, baseUrl)); continue;
        }
        if (line.startsWith('#EXT-X-MAP')) {
            output.push(processMapLine(line, baseUrl)); continue;
        }
        if (line.startsWith('#EXTINF')) {
            output.push(line); continue;
        }
        if (!line.startsWith('#')) {
            const absoluteUrl = resolveUrl(baseUrl, line);
            logDebug(`Rewriting media segment: Original='${line}', Absolute='${absoluteUrl}'`);
            output.push(rewriteUrlToProxy(absoluteUrl)); continue;
        }
        output.push(line); // Keep other tags
    }
    return output.join('\n');
}

async function processM3u8Content(targetUrl, content, recursionDepth, maxRecursion, env) {
    // Note: env is passed for potential future use, not used here for KV
    if (content.includes('#EXT-X-STREAM-INF') || content.includes('#EXT-X-MEDIA:')) {
        logDebug(`Detected master playlist: ${targetUrl}`);
        return await processMasterPlaylist(targetUrl, content, recursionDepth, maxRecursion, env);
    }
    logDebug(`Detected media playlist: ${targetUrl}`);
    return processMediaPlaylist(targetUrl, content);
}


async function processMasterPlaylist(url, content, recursionDepth, maxRecursion, env) {
    if (recursionDepth > maxRecursion) {
        throw new Error(`Max recursion depth (${maxRecursion}) exceeded for master playlist: ${url}`);
    }

    const baseUrl = getBaseUrl(url);
    const lines = content.split('\n');
    let highestBandwidth = -1;
    let bestVariantUrl = '';

    // Find highest bandwidth variant
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
            const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/);
            const currentBandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0;
            let variantUriLine = '';
            for (let j = i + 1; j < lines.length; j++) {
                const line = lines[j].trim();
                if (line && !line.startsWith('#')) {
                    variantUriLine = line; i = j; break;
                }
            }
            if (variantUriLine && currentBandwidth >= highestBandwidth) {
                highestBandwidth = currentBandwidth;
                bestVariantUrl = resolveUrl(baseUrl, variantUriLine);
            }
        }
    }

    // Fallback: find first m3u8 URI if no bandwidth found
    if (!bestVariantUrl) {
        logDebug(`No BANDWIDTH found in master playlist, trying first URI: ${url}`);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith('#') && (line.endsWith('.m3u8') || line.includes('.m3u8?'))) {
                bestVariantUrl = resolveUrl(baseUrl, line);
                logDebug(`Fallback: Found first sub-playlist URI: ${bestVariantUrl}`);
                break;
            }
        }
    }

    if (!bestVariantUrl) {
        logDebug(`No valid sub-playlist URI found in master: ${url}. Processing as media playlist.`);
        return processMediaPlaylist(url, content);
    }

    logDebug(`Selected sub-playlist (Bandwidth: ${highestBandwidth}): ${bestVariantUrl}`);

    // --- KV Cache Removed ---
    // No cache check here

    // Fetch the selected sub-playlist content
    const { content: variantContent, contentType: variantContentType, responseHeaders: variantHeaders } = await fetchContentWithType(bestVariantUrl, {}, env.USER_AGENTS); // Pass user agents from env

    if (!isM3u8Content(variantContent, variantContentType)) {
        logDebug(`Fetched sub-playlist ${bestVariantUrl} is not M3U8 (Type: ${variantContentType}). Treating as media playlist.`);
        // Attempt to process it as a media playlist anyway
         return processMediaPlaylist(bestVariantUrl, variantContent);
        // Or alternatively, proxy the content directly (less common for master playlists)
        // return { content: variantContent, headers: variantHeaders, isM3u8: false };
    }

    // Recursively process the fetched M3U8 content
    const processedVariant = await processM3u8Content(bestVariantUrl, variantContent, recursionDepth + 1, maxRecursion, env);

    // --- KV Cache Removed ---
    // No cache write here

    return processedVariant; // Return the processed content directly
}


// --- Vercel Handler ---
export default async function handler(req, res) {
    // --- Get Environment Variables ---
    const DEBUG_ENABLED = (process.env.DEBUG === 'true'); // Access Vercel env vars
    const CACHE_TTL = parseInt(process.env.CACHE_TTL || '86400');
    const MAX_RECURSION = parseInt(process.env.MAX_RECURSION || '5');
    let USER_AGENTS = ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36']; // Default
    try {
        const agentsJson = process.env.USER_AGENTS_JSON;
        if (agentsJson) {
            const parsedAgents = JSON.parse(agentsJson);
            if (Array.isArray(parsedAgents) && parsedAgents.length > 0) {
                USER_AGENTS = parsedAgents;
            }
        }
    } catch (e) {
        logDebug(`Error parsing USER_AGENTS_JSON env var: ${e.message}`);
    }
    const env = { USER_AGENTS }; // Pass agents to helper functions if needed

    // --- CORS Options Handling ---
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*'); // Allow all headers

    if (req.method === 'OPTIONS') {
        res.status(204).setHeader('Access-Control-Max-Age', '86400').end();
        return;
    }

    // --- Extract Target URL ---
    const pathSegments = req.query.path || [];
    const encodedUrlPath = pathSegments.join('/');
    const targetUrl = getTargetUrlFromPath(encodedUrlPath);

    if (!targetUrl) {
        res.status(400).json({ error: "Invalid proxy request path." });
        return;
    }

    logDebug(`Received proxy request for: ${targetUrl}`);

    // --- KV Cache Removed ---

    try {
        // --- Fetch Original Content ---
        const { content, contentType, responseHeaders } = await fetchContentWithType(targetUrl, req.headers, USER_AGENTS);

        // --- Process if M3U8 ---
        if (isM3u8Content(content, contentType)) {
            logDebug(`Processing M3U8 content: ${targetUrl}`);
            const processedM3u8 = await processM3u8Content(targetUrl, content, 0, MAX_RECURSION, env);
            res.status(200)
                .setHeader('Content-Type', 'application/vnd.apple.mpegurl')
                .setHeader('Cache-Control', `public, max-age=${CACHE_TTL}`)
                // CORS headers already set above
                .send(processedM3u8);
        } else {
            // --- Return Original Content (Non-M3U8) ---
            logDebug(`Returning non-M3U8 content directly: ${targetUrl}, Type: ${contentType}`);
             res.status(200);
             // Set original headers, overriding Cache-Control and adding CORS
             responseHeaders.forEach((value, key) => {
                 // Skip setting CORS headers again, Cache-Control handled below
                 if (!key.toLowerCase().startsWith('access-control-') && key.toLowerCase() !== 'cache-control') {
                     res.setHeader(key, value);
                 }
             });
             res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL}`);
             // CORS headers already set above
             res.send(content); // Send raw content
        }

    } catch (error) {
        logDebug(`Proxy processing error: ${error.message} \n ${error.stack}`);
        res.status(500).json({ error: `Proxy processing error: ${error.message}` });
    }
}
