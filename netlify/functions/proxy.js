// /api/proxy/[...path].mjs - Vercel Serverless Function (ES Module)

import fetch from 'node-fetch';
import { URL } from 'url'; // Use Node.js built-in URL

// --- Configuration (Read from Environment Variables) ---
const DEBUG_ENABLED = process.env.DEBUG === 'true';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '86400', 10); // Default 24 hours
const MAX_RECURSION = parseInt(process.env.MAX_RECURSION || '5', 10); // Default 5 levels

// --- User Agent Handling ---
// Start with a default User Agent array
let USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
];
// Try to read and parse the USER_AGENTS_JSON environment variable
try {
    const agentsJsonString = process.env.USER_AGENTS_JSON;
    if (agentsJsonString) {
        const parsedAgents = JSON.parse(agentsJsonString);
        // Check if parsing resulted in a non-empty array
        if (Array.isArray(parsedAgents) && parsedAgents.length > 0) {
            USER_AGENTS = parsedAgents; // Use the array from the environment variable
            console.log(`[Proxy Log] Loaded ${USER_AGENTS.length} user agents from environment variable.`);
        } else {
            console.warn("[Proxy Log] USER_AGENTS_JSON environment variable is not a valid non-empty array, using default.");
        }
    } else {
        console.log("[Proxy Log] USER_AGENTS_JSON environment variable not set, using default user agents.");
    }
} catch (e) {
    // Log an error if JSON parsing fails
    console.error(`[Proxy Log] Error parsing USER_AGENTS_JSON environment variable: ${e.message}. Using default user agents.`);
}

// Ad filtering is disabled in proxy, handled by player
const FILTER_DISCONTINUITY = false;


// --- Helper Functions ---

function logDebug(message) {
    if (DEBUG_ENABLED) {
        console.log(`[Proxy Log] ${message}`);
    }
}

/**
 * Extracts the target URL from the encoded path part of the proxy request.
 * @param {string} encodedPath - The URL-encoded path part (e.g., "https%3A%2F%2F...")
 * @returns {string|null} The decoded target URL or null if invalid.
 */
function getTargetUrlFromPath(encodedPath) {
    if (!encodedPath) {
        logDebug("getTargetUrlFromPath received empty path.");
        return null;
    }
    try {
        const decodedUrl = decodeURIComponent(encodedPath);
        if (decodedUrl.match(/^https?:\/\/.+/i)) {
            return decodedUrl;
        } else {
            logDebug(`Invalid decoded URL format: ${decodedUrl}`);
            if (encodedPath.match(/^https?:\/\/.+/i)) {
                logDebug(`Warning: Path was not encoded but looks like URL: ${encodedPath}`);
                return encodedPath;
            }
            return null;
        }
    } catch (e) {
        logDebug(`Error decoding target URL: ${encodedPath} - ${e.message}`);
        return null;
    }
}

function getBaseUrl(urlStr) {
    if (!urlStr) return '';
    try {
        const parsedUrl = new URL(urlStr);
        const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
        if (pathSegments.length <= 1) {
            return `${parsedUrl.origin}/`;
        }
        pathSegments.pop();
        return `${parsedUrl.origin}/${pathSegments.join('/')}/`;
    } catch (e) {
        logDebug(`Getting BaseUrl failed for "${urlStr}": ${e.message}`);
        const lastSlashIndex = urlStr.lastIndexOf('/');
        if (lastSlashIndex > urlStr.indexOf('://') + 2) {
            return urlStr.substring(0, lastSlashIndex + 1);
        }
        return urlStr + '/';
    }
}

function resolveUrl(baseUrl, relativeUrl) {
    if (!relativeUrl) return '';
    if (relativeUrl.match(/^https?:\/\/.+/i)) {
        return relativeUrl;
    }
    if (!baseUrl) return relativeUrl;
    try {
        return new URL(relativeUrl, baseUrl).toString();
    } catch (e) {
        logDebug(`URL resolution failed: base="${baseUrl}", relative="${relativeUrl}". Error: ${e.message}`);
        if (relativeUrl.startsWith('/')) {
            try {
                const baseOrigin = new URL(baseUrl).origin;
                return `${baseOrigin}${relativeUrl}`;
            } catch { return relativeUrl; }
        } else {
            return `${baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1)}${relativeUrl}`;
        }
    }
}

function rewriteUrlToProxy(targetUrl) {
    if (!targetUrl || typeof targetUrl !== 'string') return '';
    return `/api/proxy/${encodeURIComponent(targetUrl)}`; // Vercel proxy path
}

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchContentWithType(targetUrl, requestHeaders) {
    const headers = {
        'User-Agent': getRandomUserAgent(),
        'Accept': requestHeaders['accept'] || '*/*',
        'Accept-Language': requestHeaders['accept-language'] || 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': requestHeaders['referer'] || new URL(targetUrl).origin,
    };
    Object.keys(headers).forEach(key => headers[key] === undefined || headers[key] === null || headers[key] === '' ? delete headers[key] : {});

    logDebug(`Fetching target: ${targetUrl} with headers: ${JSON.stringify(headers)}`);

    try {
        const response = await fetch(targetUrl, { headers, redirect: 'follow' });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            logDebug(`Fetch failed: ${response.status} ${response.statusText} - ${targetUrl}`);
            const err = new Error(`HTTP error ${response.status}: ${response.statusText}. URL: ${targetUrl}. Body: ${errorBody.substring(0, 200)}`);
            err.status = response.status;
            throw err;
        }
        const content = await response.text();
        const contentType = response.headers.get('content-type') || '';
        logDebug(`Fetch success: ${targetUrl}, Content-Type: ${contentType}, Length: ${content.length}`);
        return { content, contentType, responseHeaders: response.headers };
    } catch (error) {
        logDebug(`Fetch exception for ${targetUrl}: ${error.message}`);
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
    if (!baseUrl) {
        logDebug(`Could not determine base URL for media playlist: ${url}. Cannot process relative paths.`);
    }
    const lines = content.split('\n');
    const output = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line && i === lines.length - 1) { output.push(line); continue; }
        if (!line) continue;
        if (line.startsWith('#EXT-X-KEY')) { output.push(processKeyLine(line, baseUrl)); continue; }
        if (line.startsWith('#EXT-X-MAP')) { output.push(processMapLine(line, baseUrl)); continue; }
        if (line.startsWith('#EXTINF')) { output.push(line); continue; }
        if (!line.startsWith('#')) {
            const absoluteUrl = resolveUrl(baseUrl, line);
            logDebug(`Rewriting media segment: Original='${line}', Resolved='${absoluteUrl}'`);
            output.push(rewriteUrlToProxy(absoluteUrl)); continue;
        }
        output.push(line);
    }
    return output.join('\n');
}

async function processM3u8Content(targetUrl, content, recursionDepth = 0) {
    if (content.includes('#EXT-X-STREAM-INF') || content.includes('#EXT-X-MEDIA:')) {
        logDebug(`Detected master playlist: ${targetUrl} (Depth: ${recursionDepth})`);
        return await processMasterPlaylist(targetUrl, content, recursionDepth);
    }
    logDebug(`Detected media playlist: ${targetUrl} (Depth: ${recursionDepth})`);
    return processMediaPlaylist(targetUrl, content);
}

async function processMasterPlaylist(url, content, recursionDepth) {
    if (recursionDepth > MAX_RECURSION) {
        throw new Error(`Max recursion depth (${MAX_RECURSION}) exceeded for master playlist: ${url}`);
    }
    const baseUrl = getBaseUrl(url);
    const lines = content.split('\n');
    let highestBandwidth = -1;
    let bestVariantUrl = '';
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
            const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/);
            const currentBandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0;
            let variantUriLine = '';
            for (let j = i + 1; j < lines.length; j++) {
                const line = lines[j].trim();
                if (line && !line.startsWith('#')) { variantUriLine = line; i = j; break; }
            }
            if (variantUriLine && currentBandwidth >= highestBandwidth) {
                highestBandwidth = currentBandwidth;
                bestVariantUrl = resolveUrl(baseUrl, variantUriLine);
            }
        }
    }
    if (!bestVariantUrl) {
        logDebug(`No BANDWIDTH found, trying first URI in: ${url}`);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith('#') && line.match(/\.m3u8($|\?.*)/i)) {
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
    const { content: variantContent, contentType: variantContentType } = await fetchContentWithType(bestVariantUrl, {});
    if (!isM3u8Content(variantContent, variantContentType)) {
        logDebug(`Fetched sub-playlist ${bestVariantUrl} is not M3U8 (Type: ${variantContentType}). Treating as media playlist.`);
        return processMediaPlaylist(bestVariantUrl, variantContent);
    }
    return await processM3u8Content(bestVariantUrl, variantContent, recursionDepth + 1);
}


// --- Vercel Handler ---
export default async function handler(req, res) {
    console.log('--- Vercel Proxy Request ---');
    console.log('Time:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('URL:', req.url);

    // --- Set CORS Headers Early ---
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        logDebug("Handling OPTIONS request");
        res.status(204).setHeader('Access-Control-Max-Age', '86400').end();
        return;
    }

    // --- Extract Target URL ---
    let encodedUrlPath = '';
    if (req.url && req.url.startsWith('/api/proxy/')) {
        encodedUrlPath = req.url.substring('/api/proxy/'.length);
    } else {
        const pathSegments = req.query.path || [];
        encodedUrlPath = pathSegments.join('/');
    }
    const targetUrl = getTargetUrlFromPath(encodedUrlPath);
    logDebug(`Resolved target URL: ${targetUrl || 'null'}`);

    if (!targetUrl) {
        logDebug('Error: Invalid proxy request path.');
        res.setHeader('Content-Type', 'application/json');
        res.status(400).json({ success: false, error: "Invalid proxy request path. Could not extract target URL." });
        return;
    }

    logDebug(`Processing proxy request for target: ${targetUrl}`);

    try {
        // Fetch Original Content
        const { content, contentType, responseHeaders } = await fetchContentWithType(targetUrl, req.headers);

        // --- Process if M3U8 ---
        if (isM3u8Content(content, contentType)) {
            logDebug(`Processing M3U8 content: ${targetUrl}`);
            const processedM3u8 = await processM3u8Content(targetUrl, content);

            logDebug(`Successfully processed M3U8 for ${targetUrl}`);
            res.status(200)
                .setHeader('Content-Type', 'application/vnd.apple.mpegurl;charset=utf-8')
                .setHeader('Cache-Control', `public, max-age=${CACHE_TTL}`)
                .removeHeader('content-encoding') // CRITICAL FIX for Vercel/Node.js
                .removeHeader('content-length')   // Length has changed
                .send(processedM3u8);

        } else {
            // --- Return Original Content (Non-M3U8) ---
            logDebug(`Returning non-M3U8 content directly: ${targetUrl}, Type: ${contentType}`);

            // Set original headers EXCEPT problematic ones
            responseHeaders.forEach((value, key) => {
                 const lowerKey = key.toLowerCase();
                 if (!lowerKey.startsWith('access-control-') &&
                     lowerKey !== 'content-encoding' && // CRITICAL FIX
                     lowerKey !== 'content-length') {   // CRITICAL FIX
                     res.setHeader(key, value);
                 }
             });
            res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL}`);

            res.status(200).send(content);
        }

    } catch (error) {
        logDebug(`ERROR in proxy processing for ${targetUrl}: ${error.message}`);
        console.error(`[Proxy Error Stack] ${error.stack}`);

        const statusCode = error.status || 500;

        res.setHeader('Content-Type', 'application/json');
        res.status(statusCode).json({
            success: false,
            error: `Proxy processing error: ${error.message}`,
            targetUrl: targetUrl
        });
    }
}
