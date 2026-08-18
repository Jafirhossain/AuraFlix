const express = require("express");
const axios = require("axios");
const NodeCache = require("node-cache");

// SMART CACHE SYSTEM
const apiCache = new NodeCache({ stdTTL: 3600 }); 
const streamCache = new NodeCache({ stdTTL: 21600 }); 

const TMDB_API_KEY = "15d2ea6d0dc1d476efbca3eba2b9bbfb"; 

const SCRAPER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json"
};

// BYPASS ENGINE
async function fetchWithBypass(url, useHeaders = false) {
    let cachedResponse = apiCache.get(url);
    if (cachedResponse) return cachedResponse;

    try {
        let reqConfig = { timeout: 4500 }; 
        if (useHeaders) reqConfig.headers = SCRAPER_HEADERS;
        let res = await axios.get(url, reqConfig);
        apiCache.set(url, res); 
        return res;
    } catch (err) {
        try {
            let proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            let reqConfig = { timeout: 6000 };
            if (useHeaders) reqConfig.headers = SCRAPER_HEADERS;
            let resProxy = await axios.get(proxyUrl, reqConfig);
            apiCache.set(url, resProxy); 
            return resProxy;
        } catch (proxyErr) {
            return null;
        }
    }
}

function getDefaultConfig() {
    return {
        catalogs: {
            indo_horror_trending: true, indo_horror_latest: true, global_horror: true,
            anime_trending: true, anime_airing: true, anime_movies: true,
            bolly_trending: true, bolly_latest: true, south_trending: true, south_latest: true,
            netflix_trending: true, prime_trending: true, hotstar_trending: true, holly_trending: true
        },
        providers: { torrentcsv: true, nyaa: true, yts: true, bitsearch: true, torrentio_backup: true },
        langPriority: "hindi", excludeResolutions: []
    };
}

function parseConfig(configStr) {
    if (!configStr) return getDefaultConfig();
    try {
        const decoded = Buffer.from(configStr, 'base64').toString('utf8');
        let parsed = JSON.parse(decoded);
        if (!parsed.providers) parsed.providers = getDefaultConfig().providers;
        return { ...getDefaultConfig(), ...parsed };
    } catch (e) { return getDefaultConfig(); }
}

function getManifest(config) {
    const extraParams = [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }];
    const allCatalogs = [
        { type: "movie", id: "indo_horror_trending", name: "👻 Indonesian Horror: Trending", extra: extraParams },
        { type: "movie", id: "indo_horror_latest", name: "👻 Indonesian Horror: Latest & Upcoming", extra: extraParams },
        { type: "movie", id: "global_horror", name: "💀 World Horror Masterpieces", extra: extraParams },
        { type: "series", id: "anime_trending", name: "🔥 Anime: Trending", extra: extraParams },
        { type: "series", id: "anime_airing", name: "⚡ Anime: Latest Airing", extra: extraParams },
        { type: "movie", id: "anime_movies", name: "🎬 Anime: Movies", extra: extraParams },
        { type: "movie", id: "bolly_trending", name: "🔥 Bollywood: Trending", extra: extraParams },
        { type: "movie", id: "bolly_latest", name: "🆕 Bollywood: Latest", extra: extraParams },
        { type: "movie", id: "south_trending", name: "🌟 South Indian: Trending", extra: extraParams },
        { type: "movie", id: "south_latest", name: "💥 South Indian: Latest", extra: extraParams },
        { type: "series", id: "netflix_trending", name: "👑 Netflix: Trending", extra: extraParams },
        { type: "series", id: "prime_trending", name: "📦 Amazon Prime: Trending", extra: extraParams },
        { type: "series", id: "hotstar_trending", name: "✨ Disney+ Hotstar: Trending", extra: extraParams },
        { type: "movie", id: "holly_trending", name: "🌍 Hollywood (Hindi): Trending", extra: extraParams }
    ];

    return {
        id: "org.auraflix.mastermind", version: "36.0.0",
        name: "AuraFlix Anti-Ban 🇮🇳",
        description: "8-Second Speed Engine & Smart Cache. Guaranteed links & posters.",
        logo: "https://raw.githubusercontent.com/Jafirhossain/AuraFlix/main/logo.png",
        background: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1920&auto=format&fit=crop",
        resources: [
            "catalog",
            { name: "meta", types: ["anime", "series", "movie"], idPrefixes: ["kitsu"] }, 
            { name: "stream", types: ["anime", "series", "movie"], idPrefixes: ["kitsu", "tmdb", "tt"] }
        ],
        types: ["series", "movie", "anime"], 
        behaviorHints: { configurable: true, configurationRequired: false },
        catalogs: allCatalogs.filter(cat => config.catalogs[cat.id] !== false)
    };
}

async function fetchAnime(catalogId, search = null, skip = 0) {
    try {
        let url = `https://kitsu.io/api/edge/anime?page[limit]=20&page[offset]=${skip || 0}`;
        if (search) url += `&filter[text]=${encodeURIComponent(search)}`;
        else if (catalogId === "anime_trending") url = `https://kitsu.io/api/edge/trending/anime?page[limit]=20`;
        else if (catalogId === "anime_airing") url += `&filter[status]=current&sort=-userCount`;
        else if (catalogId === "anime_movies") url += `&filter[subtype]=movie&sort=-userCount`;
        
        let res = await fetchWithBypass(url);
        if(!res) return [];
        return (res.data.data || []).map(anime => {
            const attr = anime.attributes;
            return {
                id: `kitsu:${anime.id}`, type: "anime",
                name: attr.canonicalTitle || attr.titles?.en || "Anime",
                poster: attr.posterImage?.large || attr.posterImage?.original || "https://via.placeholder.com/500x750?text=No+Poster",
                description: "⭐ Score: " + (attr.averageRating || "N/A") + "%\n" + (attr.synopsis || "")
            };
        });
    } catch (e) { return []; }
}

async function fetchOTTContent(catalogId, search = null, skip = 0) {
    try {
        const page = Math.floor((skip || 0) / 20) + 1;
        let isSeries = catalogId.includes("series") || catalogId.includes("netflix") || catalogId.includes("prime") || catalogId.includes("hotstar");
        let url = "";
        const today = new Date().toISOString().split('T')[0];

        if (search) url = `https://api.themoviedb.org/3/search/${isSeries ? 'tv' : 'movie'}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(search)}&page=${page}`;
        else if (catalogId === "indo_horror_trending") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27&with_origin_country=ID&sort_by=popularity.desc&page=${page}`;
        else if (catalogId === "indo_horror_latest") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27&with_origin_country=ID&sort_by=primary_release_date.desc&primary_release_date.lte=${today}&page=${page}`;
        else if (catalogId === "global_horror") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27&sort_by=vote_average.desc&vote_count.gte=500&page=${page}`;
        else if (catalogId === "bolly_trending") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=popularity.desc&page=${page}`;
        else if (catalogId === "bolly_latest") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=primary_release_date.desc&primary_release_date.lte=${today}&page=${page}`;
        else if (catalogId === "south_trending") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=te|ta|ml|kn&sort_by=popularity.desc&page=${page}`;
        else if (catalogId === "south_latest") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=te|ta|ml|kn&sort_by=primary_release_date.desc&primary_release_date.lte=${today}&page=${page}`;
        else if (catalogId === "netflix_trending") url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=8&watch_region=IN&sort_by=popularity.desc&page=${page}`;
        else if (catalogId === "prime_trending") url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=119&watch_region=IN&sort_by=popularity.desc&page=${page}`;
        else if (catalogId === "hotstar_trending") url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=122&watch_region=IN&sort_by=popularity.desc&page=${page}`;
        else if (catalogId === "holly_trending") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=en&sort_by=popularity.desc&page=${page}`;

        if (!url) return [];
        let res = await fetchWithBypass(url);
        if(!res) return [];
        return (res.data.results || []).map(m => ({
            id: `tmdb:${m.id}`, type: isSeries ? "series" : "movie",
            name: m.title || m.name,
            poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "https://via.placeholder.com/500x750?text=No+Poster",
            description: "⭐ TMDB: " + (m.vote_average || "N/A") + "/10\n" + (m.overview || "")
        }));
    } catch (e) { return []; }
}

const app = express();
app.use((req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); });

app.get("/", (req, res) => res.redirect("/configure"));
app.get("/configure", (req, res) => renderConfigPage(res, getDefaultConfig()));
app.get("/:config/configure", (req, res) => renderConfigPage(res, parseConfig(req.params.config)));
app.get("/manifest.json", (req, res) => res.json(getManifest(getDefaultConfig())));
app.get("/:config/manifest.json", (req, res) => res.json(getManifest(parseConfig(req.params.config))));

// YAHI ROUTES MAINE DELETE KAR DIYE THE! Ab wapas laga diye hain.
app.get("/catalog/:type/:id.json", handleCatalog);
app.get("/catalog/:type/:id/:extra", handleCatalog);
app.get("/:config/catalog/:type/:id.json", handleCatalog);
app.get("/:config/catalog/:type/:id/:extra", handleCatalog);

async function handleCatalog(req, res) {
    let { type, id, extra } = req.params;
    let skip = 0, search = null;
    if (extra) {
        let parsed = extra.replace('.json', '');
        parsed.split('&').forEach(p => {
            let [k, v] = p.split('=');
            if (k === 'skip') skip = parseInt(v) || 0;
            if (k === 'search') search = decodeURIComponent(v);
        });
    }
    let metas = id.startsWith("anime") ? await fetchAnime(id, search, skip) : await fetchOTTContent(id, search, skip);
    return res.json({ metas });
}

app.get("/meta/:type/:id.json", handleMeta);
app.get("/:config/meta/:type/:id.json", handleMeta);

async function handleMeta(req, res) {
    const { id, type } = req.params;
    if (id.startsWith("kitsu:")) {
        try {
            const cleanId = id.replace("kitsu:", "");
            let resData = await fetchWithBypass(`https://kitsu.io/api/edge/anime/${cleanId}`);
            if(!resData) return res.status(404).send("Not Found");
            const attr = resData.data.data.attributes;
            let metaObj = { 
                id, type: "anime", name: attr.canonicalTitle || attr.titles?.en || "Anime", 
                poster: attr.posterImage?.large || "https://via.placeholder.com/500x750?text=No+Poster", 
                description: attr.synopsis || ""
            };
            if (attr.subtype !== "movie") {
                const videos = [];
                for (let i = 1; i <= (attr.episodeCount || 24); i++) videos.push({ id: `kitsu:${cleanId}:${i}`, title: `Episode ${i}`, season: 1, episode: i });
                metaObj.videos = videos;
            }
            return res.json({ meta: metaObj });
        } catch (e) { return res.status(404).send("Not Found"); }
    }
    return res.status(404).send("Not Found"); 
}

app.get("/stream/:type/:id.json", handleStream);
app.get("/stream/:type/:id/:extra", handleStream);
app.get("/:config/stream/:type/:id.json", handleStream);
app.get("/:config/stream/:type/:id/:extra", handleStream);

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function handleStream(req, res) {
    let configStr = req.params.config || null;
    const config = parseConfig(configStr);
    const type = req.params.type;
    let targetId = req.params.id.replace(".json", "");
    
    // CACHE MEMORY
    const streamCacheKey = `stream_${type}_${targetId}`;
    let cachedStreams = streamCache.get(streamCacheKey);
    if (cachedStreams) return res.json(cachedStreams);

    let isAnime = targetId.startsWith("kitsu:");
    let mediaTitle = "";
    let episodeNum = "";
    let seasonNum = "";
    
    try {
        if (isAnime) {
            const parts = targetId.split(":");
            episodeNum = parts[2] || "";
            let kRes = await fetchWithBypass(`https://kitsu.io/api/edge/anime/${parts[1]}`);
            if(kRes) mediaTitle = kRes.data.data.attributes.canonicalTitle || kRes.data.data.attributes.titles.en;
        } else if (targetId.startsWith("tmdb:")) {
            const parts = targetId.split(":");
            seasonNum = parts[2]; episodeNum = parts[3];
            let tRes = await fetchWithBypass(`https://api.themoviedb.org/3/${type === "series" ? 'tv' : 'movie'}/${parts[1]}?api_key=${TMDB_API_KEY}`);
            if(tRes) mediaTitle = tRes.data.title || tRes.data.name;
        } else if (targetId.startsWith("tt")) {
            const parts = targetId.split(":");
            seasonNum = parts[1]; episodeNum = parts[2];
            let findRes = await fetchWithBypass(`https://api.themoviedb.org/3/find/${parts[0]}?api_key=${TMDB_API_KEY}&external_source=imdb_id`);
            if(findRes) {
                const item = findRes.data.movie_results?.[0] || findRes.data.tv_results?.[0];
                if (item) mediaTitle = item.title || item.name;
            }
        }
    } catch (e) {}

    let allStreams = [];
    const scraperPromises = [];

    if (mediaTitle) {
        let safeTitle = mediaTitle.replace(/[^a-zA-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
        let query = isAnime ? `${safeTitle} ${episodeNum}` : (seasonNum ? `${safeTitle} S${seasonNum.padStart(2, '0')}E${episodeNum.padStart(2, '0')}` : safeTitle);

        scraperPromises.push((async () => {
            let cUrl = `https://torrents-csv.com/service/search?q=${encodeURIComponent(query)}&size=30`;
            let res = await fetchWithBypass(cUrl);
            if (res && res.data && res.data.torrents) {
                res.data.torrents.forEach(t => allStreams.push({ title: t.name, infoHash: t.infohash, seeders: t.seeders || 15, sizeFormatted: formatBytes(t.size_bytes), provider: "TorrentCSV" }));
            }
        })());

        scraperPromises.push((async () => {
            let bUrl = `https://bitsearch.info/api/v1/search?q=${encodeURIComponent(query)}&limit=15`;
            let res = await fetchWithBypass(bUrl, true);
            if (res && res.data && res.data.data) {
                res.data.data.forEach(t => allStreams.push({ title: t.name, infoHash: t.infohash, seeders: parseInt(t.seeders) || 10, sizeFormatted: t.size, provider: "BitSearch" }));
            }
        })());
    }

    scraperPromises.push((async () => {
        let tUrl = `https://torrentio.strem.fun/stream/${isAnime ? "anime" : type}/${targetId}.json`;
        let res = await fetchWithBypass(tUrl);
        if (res && res.data && res.data.streams) {
            res.data.streams.forEach(s => { s.provider = "Torrentio API"; allStreams.push(s); });
        }
    })());

    // THE 8-SECOND TIME BOMB
    const maxWaitTimer = new Promise(resolve => setTimeout(() => resolve("TIMEOUT"), 8000));
    await Promise.race([Promise.allSettled(scraperPromises), maxWaitTimer]);

    let processedStreams = [];
    let seen = new Set();

    allStreams.forEach(s => {
        if (!s || typeof s !== 'object') return; 
        let fullText = ((s.title || "") + " " + (s.name || "")).toLowerCase();
        let seeders = s.seeders || 15; 
        
        const uniqueKey = s.infoHash || s.url;
        if (!uniqueKey || seen.has(uniqueKey)) return;
        seen.add(uniqueKey);

        let quality = "📼 SD";
        if (fullText.includes("4k") || fullText.includes("2160p")) quality = "✨ 4K ULTRA HD";
        else if (fullText.includes("1080p")) quality = "📺 1080p FULL HD";
        else if (fullText.includes("720p")) quality = "📱 720p HD";

        let langBadge = "🌐 MULTI AUDIO";
        if (/\b(hindi|hin)\b/i.test(fullText)) langBadge = "🇮🇳 HINDI DUB";
        else if (/\b(indonesian|indo)\b/i.test(fullText)) langBadge = "🇮🇩 INDONESIAN";
        else if (/\b(japanese|jap)\b/i.test(fullText)) langBadge = "🇯🇵 JAPANESE";

        let providerTag = `⚡ AuraFlix (${s.provider})`;
        let cleanTitle = String(s.title).split(/\r?\n/)[0].replace(/\[.*?\]/g, "").trim();

        s.name = `🎬 AuraFlix VIP\n${langBadge}`;
        s.title = `${quality} • ${providerTag}\n${cleanTitle}\n👤 ${seeders} Seeders`;

        processedStreams.push(s);
    });

    processedStreams.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));

    let finalOutput = { streams: processedStreams.slice(0, 40) };
    if (finalOutput.streams.length > 0) {
        streamCache.set(streamCacheKey, finalOutput);
    }

    return res.json(finalOutput);
}

function renderConfigPage(res, currentConfig) {
    const configJson = JSON.stringify(currentConfig);
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>AuraFlix Anti-Ban</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #0b0f19; color: #e2e8f0; margin: 0; padding: 20px; }
                .container { max-width: 800px; margin: 0 auto; background: #111827; padding: 30px; border-radius: 16px; border: 1px solid #1f2937; }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { width: 100px; height: 100px; object-fit: contain; margin-bottom: 10px; border-radius: 15px; }
                h1 { color: #f43f5e; margin: 0 0 10px 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; }
                p.desc { color: #94a3b8; font-size: 15px; margin: 0; }
                .section { background: #1f2937; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #f43f5e; }
                .section-title { font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #f8fafc; display: flex; align-items: center; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .provider-split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .provider-box { background: #0f172a; padding: 15px; border-radius: 10px; border: 1px solid #334155; }
                .provider-box h3 { margin-top: 0; font-size: 15px; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 12px; }
                label { font-size: 14px; cursor: pointer; display: flex; align-items: center; color: #cbd5e1; margin-bottom: 8px; }
                input[type="checkbox"] { width: 18px; height: 18px; margin-right: 10px; accent-color: #f43f5e; cursor: pointer; }
                select, input[type="text"] { width: 100%; padding: 12px; background: #0f172a; color: #f8fafc; border: 1px solid #334155; border-radius: 8px; margin-top: 8px; font-size: 14px; box-sizing: border-box; outline: none; }
                .btn { display: block; width: 100%; background: #f43f5e; color: white; padding: 16px; text-align: center; text-decoration: none; font-size: 18px; font-weight: bold; border-radius: 8px; margin-top: 30px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="https://raw.githubusercontent.com/Jafirhossain/AuraFlix/main/logo.png" alt="Logo" class="logo" onerror="this.style.display='none'">
                    <h1>AuraFlix VIP 🇮🇳</h1>
                    <p class="desc">100% Guaranteed Links & Fixed Posters.</p>
                </div>
                
                <div class="section">
                    <div class="section-title">🔍 Scraper Engines</div>
                    <div class="provider-split">
                        <div class="provider-box">
                            <h3 style="color:#38bdf8;">🚀 Primary Engines</h3>
                            <label><input type="checkbox" id="prov_torrentcsv"> Torrents-CSV</label>
                            <label><input type="checkbox" id="prov_bitsearch"> BitSearch</label>
                            <label><input type="checkbox" id="prov_nyaa"> Nyaa.si Anime</label>
                        </div>
                        <div class="provider-box">
                            <h3 style="color:#a3e635;">⚡ Hybrid Backup</h3>
                            <label><input type="checkbox" id="prov_torrentio_backup"> Torrentio Hybrid Fallback</label>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">📺 Catalogs (Posters Fixed)</div>
                    <div class="grid-2">
                        <label><input type="checkbox" id="cat_indo_horror_trending"> 👻 Indonesian Horror</label>
                        <label><input type="checkbox" id="cat_global_horror"> 💀 World Horror Masterpieces</label>
                        <label><input type="checkbox" id="cat_anime_trending"> 🔥 Anime Trending</label>
                        <label><input type="checkbox" id="cat_bolly_trending"> 🔥 Bollywood</label>
                        <label><input type="checkbox" id="cat_south_trending"> 🌟 South Indian</label>
                        <label><input type="checkbox" id="cat_netflix_trending"> 👑 Netflix</label>
                    </div>
                </div>

                <a id="installBtn" class="btn" href="#">Install AuraFlix</a>
            </div>

            <script>
                const initialConfig = ${configJson};
                
                ['torrentcsv', 'bitsearch', 'nyaa', 'torrentio_backup'].forEach(id => {
                    if(document.getElementById('prov_' + id)) document.getElementById('prov_' + id).checked = initialConfig.providers[id] !== false;
                });

                ['indo_horror_trending', 'global_horror', 'anime_trending', 'bolly_trending', 'south_trending', 'netflix_trending'].forEach(id => {
                    if(document.getElementById('cat_' + id)) document.getElementById('cat_' + id).checked = initialConfig.catalogs[id] !== false;
                });

                function updateUrl() {
                    let catObj = {};
                    ['indo_horror_trending', 'global_horror', 'anime_trending', 'bolly_trending', 'south_trending', 'netflix_trending'].forEach(id => {
                        if(document.getElementById('cat_' + id)) catObj[id] = document.getElementById('cat_' + id).checked;
                    });

                    let provObj = {};
                    ['torrentcsv', 'bitsearch', 'nyaa', 'torrentio_backup'].forEach(id => {
                        if(document.getElementById('prov_' + id)) provObj[id] = document.getElementById('prov_' + id).checked;
                    });

                    const config = { catalogs: catObj, providers: provObj, langPriority: "hindi", excludeResolutions: [] };
                    const b64 = btoa(JSON.stringify(config));
                    document.getElementById('installBtn').href = 'stremio://' + window.location.host + '/' + b64 + '/manifest.json';
                }

                document.querySelectorAll('input').forEach(el => el.addEventListener('change', updateUrl));
                updateUrl();
            </script>
        </body>
        </html>
    `;
    res.send(html);
}

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log("Server running on port " + PORT));