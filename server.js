const express = require("express");
const axios = require("axios");
const NodeCache = require("node-cache");

// SMART CACHE (Anti-Ban & Fast Loading)
const apiCache = new NodeCache({ stdTTL: 7200 }); // 2 Hours memory for APIs
const streamCache = new NodeCache({ stdTTL: 21600 }); // 6 Hours memory for Streams

const TMDB_API_KEY = "15d2ea6d0dc1d476efbca3eba2b9bbfb"; 

// 1. FAST BYPASS ENGINE (Only used for blocked sites like TorrentCSV/BitSearch)
async function fetchScraperBypass(url) {
    let cached = apiCache.get(url);
    if (cached) return cached;

    try {
        let res = await axios.get(url, { timeout: 4000 });
        apiCache.set(url, res.data); 
        return res.data;
    } catch (err) {
        try {
            let proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            let resProxy = await axios.get(proxyUrl, { timeout: 6000 });
            apiCache.set(url, resProxy.data); 
            return resProxy.data;
        } catch (proxyErr) {
            return null;
        }
    }
}

// 2. STREMIO MANIFEST & CONFIG
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
        id: "org.auraflix.masterpiece", version: "40.0.0",
        name: "AuraFlix VIP 🇮🇳",
        description: "100% Fixed Engine. All Posters, Meta, & Fast Links Guaranteed.",
        logo: "https://raw.githubusercontent.com/Jafirhossain/AuraFlix/main/logo.png",
        background: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1920&auto=format&fit=crop",
        resources: ["catalog", "meta", "stream"],
        types: ["series", "movie", "anime"], 
        idPrefixes: ["kitsu", "tmdb", "tt"],
        behaviorHints: { configurable: true, configurationRequired: false },
        catalogs: allCatalogs.filter(cat => config.catalogs[cat.id] !== false)
    };
}

const app = express();
app.use((req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); });

// 3. CATALOG FETCHER (Fetches Posters for Homepage)
async function fetchAnimeCatalog(catalogId, search = null, skip = 0) {
    try {
        let url = `https://kitsu.io/api/edge/anime?page[limit]=20&page[offset]=${skip || 0}`;
        if (search) url += `&filter[text]=${encodeURIComponent(search)}`;
        else if (catalogId === "anime_trending") url = `https://kitsu.io/api/edge/trending/anime?page[limit]=20`;
        else if (catalogId === "anime_airing") url += `&filter[status]=current&sort=-userCount`;
        
        let res = await axios.get(url, { timeout: 6000 });
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

async function fetchTMDBArch(catalogId, search = null, skip = 0) {
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
        let res = await axios.get(url, { timeout: 6000 });
        return (res.data.results || []).map(m => ({
            id: `tmdb:${m.id}`, type: isSeries ? "series" : "movie", // ID TMDB bheja hai
            name: m.title || m.name,
            poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "https://via.placeholder.com/500x750?text=No+Poster",
            description: "⭐ TMDB: " + (m.vote_average || "N/A") + "/10\n" + (m.overview || "")
        }));
    } catch (e) { return []; }
}

app.get("/catalog/:type/:id.json", handleCatalog);
app.get("/catalog/:type/:id/:extra", handleCatalog);
app.get("/:config/catalog/:type/:id.json", handleCatalog);
app.get("/:config/catalog/:type/:id/:extra", handleCatalog);

async function handleCatalog(req, res) {
    let { id, extra } = req.params;
    let skip = 0, search = null;
    if (extra) {
        let parsed = extra.replace('.json', '');
        parsed.split('&').forEach(p => {
            let [k, v] = p.split('=');
            if (k === 'skip') skip = parseInt(v) || 0;
            if (k === 'search') search = decodeURIComponent(v);
        });
    }
    let metas = id.startsWith("anime") ? await fetchAnimeCatalog(id, search, skip) : await fetchTMDBArch(id, search, skip);
    return res.json({ metas });
}

// 4. META HANDLER (THIS WAS MISSING! Fixes Blank Pages & Missing Titles)
app.get("/meta/:type/:id.json", async (req, res) => {
    const { id, type } = req.params;
    
    // YEH BLOCK ANIME KE LIYE HAI
    if (id.startsWith("kitsu:")) {
        try {
            const cleanId = id.replace("kitsu:", "").replace(".json", "");
            let resData = await axios.get(`https://kitsu.io/api/edge/anime/${cleanId}`, { timeout: 6000 });
            const attr = resData.data.data.attributes;
            let metaObj = { 
                id: id.replace('.json',''), type: "anime", name: attr.canonicalTitle || attr.titles?.en || "Anime", 
                poster: attr.posterImage?.large || "https://via.placeholder.com/500x750?text=No+Poster", 
                background: attr.coverImage?.large, description: attr.synopsis || ""
            };
            if (attr.subtype !== "movie") {
                const videos = [];
                for (let i = 1; i <= (attr.episodeCount || 24); i++) videos.push({ id: `kitsu:${cleanId}:${i}`, title: `Episode ${i}`, season: 1, episode: i });
                metaObj.videos = videos;
            }
            return res.json({ meta: metaObj });
        } catch (e) { return res.status(404).send("Not Found"); }
    }
    
    // YEH BLOCK MOVIES/SERIES/HORROR KE LIYE HAI (THE FIX)
    if (id.startsWith("tmdb:")) {
        try {
            const cleanId = id.replace("tmdb:", "").replace(".json", "");
            let realType = type === "series" ? "tv" : "movie";
            let url = `https://api.themoviedb.org/3/${realType}/${cleanId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
            let resData = await axios.get(url, { timeout: 6000 });
            const m = resData.data;
            
            let metaObj = {
                id: id.replace('.json',''),
                type: type,
                name: m.title || m.name,
                poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "https://via.placeholder.com/500x750?text=No+Poster",
                background: m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : undefined,
                description: m.overview || "No Description.",
                releaseInfo: m.release_date || m.first_air_date ? (m.release_date || m.first_air_date).substring(0, 4) : undefined,
                imdbRating: m.vote_average ? m.vote_average.toFixed(1) : undefined
            };
            return res.json({ meta: metaObj });
        } catch (e) { return res.status(404).send("Not Found"); }
    }

    return res.status(404).send("Not Found"); 
});

// 5. THE FAST 8-SECOND STREAM ENGINE
app.get("/stream/:type/:id.json", handleStream);
app.get("/stream/:type/:id/:extra", handleStream);
app.get("/:config/stream/:type/:id.json", handleStream);
app.get("/:config/stream/:type/:id/:extra", handleStream);

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '';
    const k = 1024; const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function handleStream(req, res) {
    let configStr = req.params.config || null;
    const config = parseConfig(configStr);
    const type = req.params.type;
    let targetId = req.params.id.replace(".json", "");
    
    // CACHE CHECK: If loaded before, return in 0.1s!
    const streamCacheKey = `stream_${type}_${targetId}`;
    let cachedStreams = streamCache.get(streamCacheKey);
    if (cachedStreams) {
        console.log(`[CACHE HIT] Delivering instantly for ${targetId}`);
        return res.json(cachedStreams);
    }

    let isAnime = targetId.startsWith("kitsu:");
    let mediaTitle = ""; let episodeNum = ""; let seasonNum = "";
    
    // TITLE RESOLVER
    try {
        if (isAnime) {
            const parts = targetId.split(":");
            episodeNum = parts[2] || "";
            let kRes = await axios.get(`https://kitsu.io/api/edge/anime/${parts[1]}`);
            if(kRes) mediaTitle = kRes.data.data.attributes.canonicalTitle || kRes.data.data.attributes.titles.en;
        } else if (targetId.startsWith("tmdb:")) {
            const parts = targetId.split(":");
            seasonNum = parts[2]; episodeNum = parts[3];
            let tRes = await axios.get(`https://api.themoviedb.org/3/${type === "series" ? 'tv' : 'movie'}/${parts[1]}?api_key=${TMDB_API_KEY}`);
            if(tRes) mediaTitle = tRes.data.title || tRes.data.name;
        } else if (targetId.startsWith("tt")) {
            const parts = targetId.split(":");
            seasonNum = parts[1]; episodeNum = parts[2];
            let findRes = await axios.get(`https://api.themoviedb.org/3/find/${parts[0]}?api_key=${TMDB_API_KEY}&external_source=imdb_id`);
            if(findRes) {
                const item = findRes.data.movie_results?.[0] || findRes.data.tv_results?.[0];
                if (item) mediaTitle = item.title || item.name;
            }
        }
    } catch (e) {}

    let allStreams = [];
    const scraperPromises = [];

    // DIRECT APIs
    if (mediaTitle) {
        let safeTitle = mediaTitle.replace(/[^a-zA-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
        let query = isAnime ? `${safeTitle} ${episodeNum}` : (seasonNum ? `${safeTitle} S${seasonNum.padStart(2, '0')}E${episodeNum.padStart(2, '0')}` : safeTitle);

        scraperPromises.push((async () => {
            let resData = await fetchScraperBypass(`https://torrents-csv.com/service/search?q=${encodeURIComponent(query)}&size=30`);
            if (resData && resData.torrents) {
                resData.torrents.forEach(t => allStreams.push({ title: t.name, infoHash: t.infohash, seeders: t.seeders || 15, sizeFormatted: formatBytes(t.size_bytes), provider: "TorrentCSV" }));
            }
        })());

        scraperPromises.push((async () => {
            let resData = await fetchScraperBypass(`https://bitsearch.info/api/v1/search?q=${encodeURIComponent(query)}&limit=15`);
            if (resData && resData.data) {
                resData.data.forEach(t => allStreams.push({ title: t.name, infoHash: t.infohash, seeders: parseInt(t.seeders) || 10, sizeFormatted: t.size, provider: "BitSearch" }));
            }
        })());
    }

    // TORRENTIO BACKUP (The Savior)
    scraperPromises.push((async () => {
        let tUrl = `https://torrentio.strem.fun/stream/${isAnime ? "anime" : type}/${targetId}.json`;
        let resData = await fetchScraperBypass(tUrl);
        if (resData && resData.streams) {
            resData.streams.forEach(s => { s.provider = "Torrentio API"; allStreams.push(s); });
        }
    })());

    // 💣 8-SECOND TIMEOUT (Never let Stremio loading icon hang)
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

// 6. SETUP & UI ROUTING
app.get("/", (req, res) => res.redirect("/configure"));
app.get("/configure", (req, res) => renderConfigPage(res, getDefaultConfig()));
app.get("/:config/configure", (req, res) => renderConfigPage(res, parseConfig(req.params.config)));
app.get("/manifest.json", (req, res) => res.json(getManifest(getDefaultConfig())));
app.get("/:config/manifest.json", (req, res) => res.json(getManifest(parseConfig(req.params.config))));

function renderConfigPage(res, currentConfig) {
    const configJson = JSON.stringify(currentConfig);
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>AuraFlix Masterpiece</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #0b0f19; color: #e2e8f0; margin: 0; padding: 20px; }
                .container { max-width: 800px; margin: 0 auto; background: #111827; padding: 30px; border-radius: 16px; border: 1px solid #1f2937; text-align: center; }
                h1 { color: #f43f5e; margin-bottom: 10px; font-size: 32px; }
                p { color: #94a3b8; font-size: 16px; margin-bottom: 30px; }
                .btn { display: inline-block; background: #f43f5e; color: white; padding: 15px 40px; text-decoration: none; font-size: 18px; font-weight: bold; border-radius: 8px; transition: 0.3s; }
                .btn:hover { background: #e11d48; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>AuraFlix VIP 🇮🇳</h1>
                <p>Posters Fixed. Meta Fixed. 8-Second High-Speed Links Fixed.</p>
                <a id="installBtn" class="btn" href="#">Install Fresh Update</a>
            </div>
            <script>
                const config = ${configJson};
                const b64 = btoa(JSON.stringify(config));
                document.getElementById('installBtn').href = 'stremio://' + window.location.host + '/' + b64 + '/manifest.json';
            </script>
        </body>
        </html>
    `;
    res.send(html);
}

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log("Server running on port " + PORT));