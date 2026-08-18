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

// BYPASS ENGINE WITH STRICT TIMEOUTS
async function fetchWithBypass(url, useHeaders = false) {
    let cachedResponse = apiCache.get(url);
    if (cachedResponse) return cachedResponse;

    try {
        let reqConfig = { timeout: 4000 }; 
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
        { type: "movie", id: "global_horror", name: "💀 World Horror Masterpieces", extra: extraParams },
        { type: "series", id: "anime_trending", name: "🔥 Anime: Trending", extra: extraParams },
        { type: "movie", id: "bolly_trending", name: "🔥 Bollywood: Trending", extra: extraParams },
        { type: "movie", id: "south_trending", name: "🌟 South Indian: Trending", extra: extraParams },
        { type: "series", id: "netflix_trending", name: "👑 Netflix: Trending", extra: extraParams }
    ];

    return {
        id: "org.auraflix.mastermind", version: "35.0.0",
        name: "AuraFlix Anti-Ban 🇮🇳",
        description: "8-Second Speed Engine & Smart Cache. Addon will never disappear.",
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
        const res = await axios.get(url, { timeout: 8000 });
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
        let isSeries = catalogId.includes("series") || catalogId.includes("netflix");
        let url = "";
        if (search) url = `https://api.themoviedb.org/3/search/${isSeries ? 'tv' : 'movie'}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(search)}&page=${page}`;
        else if (catalogId === "indo_horror_trending") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27&with_origin_country=ID&sort_by=popularity.desc&page=${page}`;
        else if (catalogId === "global_horror") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27&sort_by=vote_average.desc&vote_count.gte=500&page=${page}`;
        else if (catalogId === "bolly_trending") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=popularity.desc&page=${page}`;
        else if (catalogId === "south_trending") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=te|ta|ml|kn&sort_by=popularity.desc&page=${page}`;
        else if (catalogId === "netflix_trending") url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=8&watch_region=IN&sort_by=popularity.desc&page=${page}`;

        if (!url) return [];
        const res = await axios.get(url, { timeout: 8000 });
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

app.get("/catalog/:type/:id.json", async (req, res) => {
    let { type, id } = req.params;
    let metas = id.startsWith("anime") ? await fetchAnime(id) : await fetchOTTContent(id);
    return res.json({ metas });
});

app.get("/meta/:type/:id.json", async (req, res) => {
    const { id } = req.params;
    if (id.startsWith("kitsu:")) {
        try {
            const cleanId = id.replace("kitsu:", "");
            const resData = await axios.get(`https://kitsu.io/api/edge/anime/${cleanId}`, { timeout: 6000 });
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
});

// ----------------------------------------------------
// THE 8-SECOND RACE ENGINE + CACHE
// ----------------------------------------------------
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

app.get("/stream/:type/:id.json", async (req, res) => {
    let config = getDefaultConfig();
    const type = req.params.type;
    let targetId = req.params.id.replace(".json", "");
    
    // CACHE CHECK: If we found this exact stream recently, serve it instantly!
    const streamCacheKey = `stream_${type}_${targetId}`;
    let cachedStreams = streamCache.get(streamCacheKey);
    if (cachedStreams) {
        console.log(`[CACHE HIT] 0.1s Delivery for ${targetId}`);
        return res.json(cachedStreams);
    }

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

    // 💣 THE 8-SECOND TIME BOMB (GLOBAL TIMEOUT)
    // अगर कोई वेबसाइट अटकी हुई है, तो 8 सेकंड बाद सर्वर उसे छोड़ देगा और जो मिला है वो Stremio को दे देगा।
    const maxWaitTimer = new Promise(resolve => setTimeout(() => resolve("TIMEOUT"), 8000));
    
    // Race Condition: या तो सारे स्क्रैपर काम खत्म कर लें, या 8 सेकंड पूरे हो जाएं। जो पहले होगा, हम आगे बढ़ जाएंगे!
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

    // FINAL OUTPUT & CACHE SAVE
    let finalOutput = { streams: processedStreams.slice(0, 40) };
    
    // सिर्फ तभी सेव करो जब कम से कम 1 लिंक मिला हो
    if (finalOutput.streams.length > 0) {
        streamCache.set(streamCacheKey, finalOutput);
    }

    return res.json(finalOutput);
});

function renderConfigPage(res, currentConfig) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>AuraFlix Anti-Ban</title>
            <style>
                body { font-family: sans-serif; background: #0b0f19; color: white; padding: 20px; text-align: center;}
                .btn { display: inline-block; background: #f43f5e; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin-top: 30px; }
            </style>
        </head>
        <body>
            <h1>AuraFlix 🇮🇳 (Anti-Ban Enabled)</h1>
            <p>8-Second Race Engine is Active. Your addon will never disappear!</p>
            <a id="installBtn" class="btn" href="#">Install Addon</a>
            <script>
                const b64 = btoa(JSON.stringify({}));
                document.getElementById('installBtn').href = 'stremio://' + window.location.host + '/' + b64 + '/manifest.json';
            </script>
        </body>
        </html>
    `;
    res.send(html);
}

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log("Server running on port " + PORT));