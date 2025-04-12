// /netlify/functions/proxy.js - Netlify Function

// Netlify uses CommonJS by default, or you can configure ES Modules
// Assuming ES Modules for consistency if possible (check Netlify docs/config)
// If using CommonJS: const fetch = require('node-fetch'); etc.
import fetch from 'node-fetch';
import { URL } from 'url';

// --- 辅助函数 (与 Vercel 版本基本相同) ---
// Copy all helper functions from the Vercel version above:
// logDebug, getTargetUrlFromPath, getBaseUrl, resolveUrl, rewriteUrlToProxy (adjust path),
// getRandomUserAgent, fetchContentWithType, isM3u8Content, processKeyLine,
// processMapLine, processMediaPlaylist, processM3u8Content, processMasterPlaylist
// --- Make sure to adjust rewriteUrlToProxy path if needed ---
function rewriteUrlToProxy_Netlify(targetUrl) {
    if (!targetUrl || typeof targetUrl !== 'string') return '';
    // Path depends on how you configure Netlify redirects/proxying
    // Option 1: If using redirects in netlify.toml from /proxy/*
    // return `/proxy/${encodeURIComponent(targetUrl)}`;
    // Option 2: If calling the function directly (less common for this pattern)
    return `/.netlify/functions/proxy/${encodeURIComponent(targetUrl)}`;
}
// --- (Copy other helper functions here) ---
// ... [logDebug, getTargetUrlFromPath, getBaseUrl, resolveUrl, etc.] ...


// --- Netlify Handler ---
exports.handler = async (event, context) => {
    // --- Get Environment Variables ---
    const DEBUG_ENABLED = (process.env.DEBUG === 'true'); // Access Netlify env vars
    const CACHE_TTL = parseInt(process.env.CACHE_TTL || '86400');
    const MAX_RECURSION = parseInt(process.env.MAX_RECURSION || '5');
    let USER_AGENTS = ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36']; // Default
    try {
        const agentsJson = process.env.USER_AGENTS_JSON;
        if (agentsJson) { /* ... parse USER_AGENTS_JSON ... */ }
    } catch (e) { /* ... error handling ... */ }
    const env = { USER_AGENTS }; // Pass to helpers if needed

    // --- CORS Headers (Common for all responses) ---
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
    };

    // --- CORS Options Handling ---
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                ...corsHeaders,
                'Access-Control-Max-Age': '86400',
            },
            body: '',
        };
    }

    // --- Extract Target URL ---
    // Netlify puts the wildcard part in event.path after the function name
    // e.g., /.netlify/functions/proxy/ENCODED_URL -> path = /ENCODED_URL
    let encodedUrlPath = event.path.replace('/.netlify/functions/proxy', ''); // Default function path
    // If using redirects (e.g., from /proxy/*), event.path might be /proxy/ENCODED_URL
    if (event.path.startsWith('/proxy/')) {
        encodedUrlPath = event.path.replace('/proxy/', '');
    }
    encodedUrlPath = encodedUrlPath.startsWith('/') ? encodedUrlPath.substring(1) : encodedUrlPath; // Remove leading slash if present

    const targetUrl = getTargetUrlFromPath(encodedUrlPath); // Use the same helper

    if (!targetUrl) {
        return {
            statusCode: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: "Invalid proxy request path." }),
        };
    }

    logDebug(`Received proxy request for: ${targetUrl}`);

    // --- KV Cache Removed ---

    try {
        // --- Fetch Original Content ---
        const { content, contentType, responseHeaders } = await fetchContentWithType(targetUrl, event.headers, USER_AGENTS);

        // --- Process if M3U8 ---
        if (isM3u8Content(content, contentType)) {
            logDebug(`Processing M3U8 content: ${targetUrl}`);
            const processedM3u8 = await processM3u8Content(targetUrl, content, 0, MAX_RECURSION, env); // Pass env if needed
            return {
                statusCode: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/vnd.apple.mpegurl',
                    'Cache-Control': `public, max-age=${CACHE_TTL}`,
                },
                body: processedM3u8,
            };
        } else {
            // --- Return Original Content (Non-M3U8) ---
            logDebug(`Returning non-M3U8 content directly: ${targetUrl}, Type: ${contentType}`);
            const responseHeadersObject = { ...corsHeaders };
             responseHeaders.forEach((value, key) => {
                 // Skip setting CORS headers again, Cache-Control handled below
                 if (!key.toLowerCase().startsWith('access-control-') && key.toLowerCase() !== 'cache-control') {
                     responseHeadersObject[key.toLowerCase()] = value; // Netlify headers are case-insensitive? Be safe.
                 }
             });
            responseHeadersObject['cache-control'] = `public, max-age=${CACHE_TTL}`;

            // Netlify usually expects body as string. Check content type for binary data if needed.
            return {
                statusCode: 200,
                headers: responseHeadersObject,
                body: content,
                // isBase64Encoded: false, // Set true for binary data if needed
            };
        }

    } catch (error) {
        logDebug(`Proxy processing error: ${error.message} \n ${error.stack}`);
        return {
            statusCode: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: `Proxy processing error: ${error.message}` }),
        };
    }
};

// --- Make sure to include all the helper functions copied from Vercel version ---
// --- Remember to adjust rewriteUrlToProxy_Netlify if needed ---
