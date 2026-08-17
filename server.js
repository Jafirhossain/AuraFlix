const express = require("express");
const axios = require("axios");

const TMDB_API_KEY = "3c3e80c4c47b5964923e20e8b2bf3186";

// ----------------------------------------------------
// 1. CONFIGURATION SYSTEM
// ----------------------------------------------------
function getDefaultConfig() {
    return {
        catalogs: {
            anime_airing: true, anime_trending: true, anime_movies: true, anime_popular: true,
            south_trending: true, south_new_releases: true, hindi_webseries: true,
            netflix_prime: true, hotstar_sonyliv: true, bollywood_hub: true, hollywood_hindi: true
        },
        priorityLanguages: ["hindi"],
        excludeResolutions: [],
        sorting: "quality_seeders",
        debridProvider: "none",
        debridToken: "",
        maxResults: 40
    };
}

function parseConfig(configStr) {
    if (!configStr || configStr === "undefined" || configStr === "null") return getDefaultConfig();
    try {
        const decoded = Buffer.from(configStr, 'base64').toString('utf8');
        return { ...getDefaultConfig(), ...JSON.parse(decoded) };
    } catch (e) {
        return getDefaultConfig();
    }
}

// ----------------------------------------------------
// 2. DYNAMIC MANIFEST (All OTTs & Hubs)
// ----------------------------------------------------
function getManifest(config) {
    const allCatalogs = [
        { type: "anime", id: "anime_airing", name: "⚡ Crunchyroll Airing", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "anime", id: "anime_trending", name: "🔥 Trending Anime", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "anime_movies", name: "🎬 Anime Movies", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "anime", id: "anime_popular", name: "🏆 Anime Masterpieces", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "south_trending", name: "💥 Trending South (Hindi)", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "south_new_releases", name: "🆕 New South Releases", extra: [{ name: "search" }, { name: "genre", options: ["Action", "Thriller", "Drama", "Crime", "Comedy", "Horror"] }, { name: "skip" }] },
        { type: "series", id: "hindi_webseries", name: "🇮🇳 Hindi Web Series", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "netflix_prime", name: "👑 Netflix & Prime Hub", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "hotstar_sonyliv", name: "🔥 JioHotstar & SonyLIV", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "bollywood_hub", name: "🍿 Bollywood Blockbusters", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "hollywood_hindi", name: "🎬 Hollywood Hindi Dubbed", extra: [{ name: "search" }, { name: "skip" }] }
    ];

    return {
        id: "org.auraflix.v17.free",
        version: "17.0.0",
        name: "AuraFlix Ultra 🇮🇳",
        description: "100% Free Engine! No Paid APIs. Pure Torrentio & Direct Trackers with Smart TMDB Translation and Zero Buffering.",
        logo: "https://raw.githubusercontent.com/Jafirhossain/auraflix-hub/main/logo.png",
        background: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1920&auto=format&fit=crop",
        resources: ["catalog", "meta", "stream"],
        types: ["movie", "series", "anime"],
        idPrefixes: ["kitsu", "anilist", "tt", "tmdb"],
        behaviorHints: { configurable: true, configurationRequired: false },
        catalogs: allCatalogs.filter(cat => config.catalogs[cat.id] !== false)
    };
}

// ----------------------------------------------------
// 3. SECURE CATALOG FETCHERS
// ----------------------------------------------------
async function fetchAnime(type, search, skip) {
    try {
        let url = `https://kitsu.io/api/edge/anime?page[limit]=20&page[offset]=${skip || 0}`;
        if (search) {
            url += `&filter[text]=${encodeURIComponent(search)}`;
        } else {
            if (type === "anime_trending") url = `https://kitsu.io/api/edge/trending/anime?page[limit]=20`;
            else if (type === "anime_airing") url += `&filter[status]=current&sort=-userCount`;
            else if (type === "anime_movies") url += `&filter[subtype]=movie&sort=-userCount`;
            else if (type === "anime_popular") url += `&sort=popularityRank`;
        }
        const res = await axios.get(url, { timeout: 8000 });
        return (res.data.data || []).map(anime => {
            const attr = anime.attributes;
            return {
                id: `kitsu:${anime.id}`,
                type: type === "anime_movies" ? "movie" : "anime",
                name: attr.canonicalTitle || attr.titles?.en || "Anime",
                poster: attr.posterImage?.large || attr.posterImage?.original,
                description: `⭐ Rating: ${attr.averageRating || "N/A"}% | 📌 Ep: ${attr.episodeCount || 'Ongoing'}\n\n${attr.synopsis}`
            };
        });
    } catch (e) { return []; }
}

async function fetchOTTContent(type, search, skip) {
    try {
        const page = Math.floor((skip || 0) / 20) + 1;
        let isSeries = ["hindi_webseries", "netflix_prime", "hotstar_sonyliv"].includes(type);
        let url = "";

        if (search) {
            url = `https://api.themoviedb.org/3/search/${isSeries ? 'tv' : 'movie'}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(search)}&include_adult=false&page=${page}`;
        } else {
            if (type === "south_trending") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=te|ta|kn|ml&sort_by=popularity.desc&page=${page}`;
            else if (type === "south_new_releases") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=te|ta|kn|ml&sort_by=primary_release_date.desc&page=${page}`;
            else if (type === "hindi_webseries") url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=popularity.desc&page=${page}`;
            else if (type === "netflix_prime") url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_networks=213|119&sort_by=popularity.desc&page=${page}`;
            else if (type === "hotstar_sonyliv") url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_networks=122|220|237|232&sort_by=popularity.desc&page=${page}`;
            else if (type === "bollywood_hub") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=popularity.desc&page=${page}`;
            else if (type === "hollywood_hindi") url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=en&sort_by=popularity.desc&vote_count.gte=200&page=${page}`;
        }

        const res = await axios.get(url, { timeout: 8000 });
        return (res.data.results || []).map(m => ({
            id: `tmdb:${m.id}`,
            type: isSeries ? "series" : "movie",
            name: m.title || m.name,
            poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster',
            description: `⭐ TMDB: ${m.vote_average || "N/A"}/10 | 📅 ${m.release_date || m.first_air_date || "TBA"}\n\n${m.overview}`
        }));
    } catch (e) { return []; }
}

// ----------------------------------------------------
// 4. BULLETPROOF ROUTER (No Empty Content)
// ----------------------------------------------------
const app = express();
app.use((req, res, next) => { 
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next(); 
});

function parseExtra(extraStr) {
    let extra = {};
    if (extraStr) {
        extraStr.replace('.json', '').split('&').forEach(part => {
            const [k, v] = part.split('=');
            if (k && v) extra[k] = decodeURIComponent(v);
        });
    }
    return extra;
}

// Dashboard
app.get("/", (req, res) => { res.setHeader('Content-Type', 'text/html'); res.redirect("/configure"); });
app.get("/configure", (req, res) => { res.setHeader('Content-Type', 'text/html'); renderConfigPage(res, getDefaultConfig()); });
app.get("/:config/configure", (req, res) => { res.setHeader('Content-Type', 'text/html'); renderConfigPage(res, parseConfig(req.params.config)); });

app.get("/manifest.json", (req, res) => res.json(getManifest(getDefaultConfig())));
app.get("/:config/manifest.json", (req, res) => res.json(getManifest(parseConfig(req.params.config))));

// Route Handlers
async function routeCatalog(req, res) {
    const { type, id, extra: extraStr } = req.params;
    const extra = parseExtra(extraStr);
    
    let metas = [];
    if (id.startsWith("anime")) metas = await fetchAnime(id, extra.search, parseInt(extra.skip) || 0);
    else metas = await fetchOTTContent(id, extra.search, parseInt(extra.skip) || 0);
    res.json({ metas });
}

async function routeMeta(req, res) {
    const { id, type } = req.params;

    if (id.startsWith("kitsu:")) {
        try {
            const cleanId = id.replace("kitsu:", "");
            const resData = await axios.get(`https://kitsu.io/api/edge/anime/${cleanId}`, { timeout: 5000 });
            const attr = resData.data.data.attributes;
            const isMovie = attr.subtype === "movie";
            const videos = [];
            
            if (isMovie) {
                videos.push({ id: `kitsu:${cleanId}:1`, title: attr.canonicalTitle || "Movie", released: attr.startDate });
            } else {
                const epCount = attr.episodeCount || 24;
                for (let i = 1; i <= epCount; i++) {
                    videos.push({ id: `kitsu:${cleanId}:${i}`, title: `Episode ${i}`, season: 1, episode: i });
                }
            }
            res.json({ meta: { id, type: isMovie ? "movie" : "anime", name: attr.canonicalTitle || attr.titles?.en, poster: attr.posterImage?.large, description: attr.synopsis, videos } });
        } catch (e) { res.json({ meta: { id, type: "anime", name: "Anime" } }); }
    } 
    else if (id.startsWith("tmdb:")) {
        try {
            const tmdbId = id.split(":")[1]; 
            const isTv = type === "series";
            const resData = await axios.get(`https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`, { timeout: 5000 });
            const m = resData.data;
            const imdbId = m.external_ids?.imdb_id || m.imdb_id || id;
            
            const videos = [];
            if (isTv && m.seasons) {
                m.seasons.forEach(s => {
                    if (s.season_number > 0) {
                        for (let ep = 1; ep <= (s.episode_count || 1); ep++) {
                            videos.push({ id: `tmdb:${tmdbId}:${s.season_number}:${ep}`, title: `S${s.season_number} E${ep}`, season: s.season_number, episode: ep });
                        }
                    }
                });
            }
            res.json({ meta: { id, type, name: m.title || m.name, poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : undefined, description: m.overview, imdb_id: imdbId, videos: videos.length > 0 ? videos : undefined } });
        } catch (e) { res.json({ meta: { id, type, name: "Media" } }); }
    } else {
        res.json({ meta: { id, type, name: "Media" } });
    }
}

async function routeStream(req, res) {
    const config = req.params.config ? parseConfig(req.params.config) : getDefaultConfig();
    const { type, id } = req.params;
    let targetId = id; 
    let isTv = type === "series";
    let isAnime = id.startsWith("kitsu:");
    
    // --- 1. TMDB TO IMDB TRANSLATOR (The Core Fix) ---
    let imdbId = null;
    let season = null;
    let episode = null;

    if (id.startsWith("tmdb:")) {
        const parts = id.split(":");
        const tmdbId = parts[1];
        season = parts[2] || null;
        episode = parts[3] || null;
        try {
            const tRes = await axios.get(`https://api.themoviedb.org/3/${isTv || season ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`, { timeout: 4000 });
            imdbId = tRes.data.external_ids?.imdb_id || tRes.data.imdb_id;
        } catch (e) {}
    }

    // --- 2. 100% FREE PARALLEL ENGINE FETCH ---
    const fetchPromises = [];

    // Engine A: Torrentio (Free Backbone)
    let tId = imdbId ? (season ? `${imdbId}:${season}:${episode}` : imdbId) : id;
    let tUrl = `https://torrentio.strem.fun/stream/${type}/${tId}.json`;
    if (config.debridProvider && config.debridProvider !== "none" && config.debridToken) {
        tUrl = `https://torrentio.strem.fun/${config.debridProvider}=${config.debridToken}/stream/${type}/${tId}.json`;
    }
    fetchPromises.push(axios.get(tUrl, { timeout: 6000 }).catch(() => null));

    // Engine B: AnimeTosho (Free Anime Backbone)
    if (isAnime) {
        fetchPromises.push(axios.get(`https://animetosho.strem.fun/stream/anime/${targetId}.json`, { timeout: 6000 }).catch(() => null));
    }

    // Combine Free Data
    let allStreams = [];
    const responses = await Promise.all(fetchPromises);
    responses.forEach(r => {
        if (r && r.data && r.data.streams) allStreams = allStreams.concat(r.data.streams);
    });

    // --- 3. FILTERING & SORTING ---
    let processedStreams = [];
    let seen = new Set();
    const excludes = config.excludeResolutions || [];
    const priorityLangs = config.priorityLanguages || ["hindi"];

    allStreams.forEach(s => {
        if (!s) return;
        let fullText = ((s.title || "") + " " + (s.name || "")).toLowerCase();
        
        const uniqueKey = s.infoHash || s.url || fullText;
        if (seen.has(uniqueKey)) return;
        seen.add(uniqueKey);

        // Quality Detection
        let quality = "📼 480p SD";
        let qRank = 1;
        let isHDR = fullText.includes("hdr") || fullText.includes("dv") || fullText.includes("dolby");
        
        if (excludes.includes("remux") && fullText.includes("remux")) return;
        if (excludes.includes("hdr") && isHDR) return;

        if (fullText.includes("4k") || fullText.includes("2160p")) { 
            quality = isHDR ? "✨ 4K HDR" : "✨ 4K ULTRA HD"; qRank = 4; 
            if (excludes.includes("4k")) return;
        } else if (fullText.includes("1080p")) { 
            quality = "📺 1080p FULL HD"; qRank = 3; 
            if (excludes.includes("1080p")) return;
        } else if (fullText.includes("720p")) { 
            quality = "📱 720p HD"; qRank = 2; 
            if (excludes.includes("720p")) return;
        } else {
            if (excludes.includes("480p")) return;
        }
        if (excludes.includes("cam") && (fullText.includes("cam") || fullText.includes("ts") || fullText.includes("hdcam"))) return;

        // Language Detection
        let langBadge = "🌐 MULTI AUDIO";
        let langRank = 1;

        if (/\b(hindi|dual\s*audio|multi\s*audio|hin-eng|dubbed\s*in\s*hindi)\b/i.test(fullText)) { langBadge = "🇮🇳 HINDI DUB"; langRank = priorityLangs.includes("hindi") ? 35 : 15; }
        else if (/\b(telugu|tel)\b/i.test(fullText)) { langBadge = "🇮🇳 TELUGU"; langRank = priorityLangs.includes("telugu") ? 35 : 12; }
        else if (/\b(tamil|tam)\b/i.test(fullText)) { langBadge = "🇮🇳 TAMIL"; langRank = priorityLangs.includes("tamil") ? 35 : 11; }
        else if (/\b(bengali|bangla|ben)\b/i.test(fullText)) { langBadge = "🎭 BENGALI"; langRank = priorityLangs.includes("bengali") ? 35 : 10; }
        else if (/\b(english|eng\s*dub|eng\s*audio)\b/i.test(fullText)) { langBadge = "🇬🇧 ENG DUB"; langRank = priorityLangs.includes("eng") ? 35 : 6; }
        else if (/\b(japanese|jap|subbed|raw)\b/i.test(fullText) || isAnime) { langBadge = "🇯🇵 JAP SUB"; langRank = priorityLangs.includes("jap") ? 35 : 4; }

        s.langRank = langRank;
        s.qRank = qRank;
        
        let seedMatch = fullText.match(/👤\s*(\d+)/);
        s.seeders = seedMatch ? parseInt(seedMatch[1]) : (s.url ? 999 : 5);

        let modeTag = s.url ? "⚡ DIRECT/DEBRID" : "🚀 HIGH-SPEED P2P";
        let cleanTitle = s.title ? s.title.split('\n')[0].replace(/\b(Torrentio|Debrid|MediaFusion|AnimeTosho)\b/ig, 'AuraFlix') : 'Instant Play';

        s.name = `🎬 AuraFlix PRO\n${langBadge}`;
        s.title = `${quality} • ${modeTag}\n${cleanTitle}\n👤 ${s.seeders} Seeders`;

        processedStreams.push(s);
    });

    if (config.sorting === "seeders_first") {
        processedStreams.sort((a, b) => b.seeders - a.seeders);
    } else {
        processedStreams.sort((a, b) => {
            if (b.langRank !== a.langRank) return b.langRank - a.langRank;
            if (b.url && !a.url) return 1;
            if (!b.url && a.url) return -1;
            if (b.seeders !== a.seeders) return b.seeders - a.seeders;
            return b.qRank - a.qRank;
        });
    }

    const limit = parseInt(config.maxResults) || 40;
    res.json({ streams: processedStreams.slice(0, limit) });
}

// Routes Bind
app.get("/catalog/:type/:id.json", routeCatalog);
app.get("/catalog/:type/:id/:extra.json", routeCatalog);
app.get("/:config/catalog/:type/:id.json", routeCatalog);
app.get("/:config/catalog/:type/:id/:extra.json", routeCatalog);

app.get("/meta/:type/:id.json", routeMeta);
app.get("/:config/meta/:type/:id.json", routeMeta);

app.get("/stream/:type/:id.json", routeStream);
app.get("/:config/stream/:type/:id.json", routeStream);

// ----------------------------------------------------
// 5. UI HTML DASHBOARD (No Paid Dependencies Mentioned)
// ----------------------------------------------------
function renderConfigPage(res, currentConfig) {
    const configJson = JSON.stringify(currentConfig);
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AuraFlix PRO Configuration</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f1115; color: #e2e8f0; margin: 0; padding: 20px 10px; }
                .container { max-width: 650px; margin: 0 auto; background: #161b22; padding: 25px 30px; border-radius: 12px; border: 1px solid #1e293b; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { width: 80px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 0 20px rgba(79, 70, 229, 0.4); }
                h1 { color: #f8fafc; margin: 0; font-size: 24px; font-weight: 700; }
                .version { display: inline-block; background: #1e293b; color: #818cf8; font-size: 11px; padding: 3px 8px; border-radius: 4px; margin-top: 5px; font-weight: bold; }
                p.desc { color: #94a3b8; font-size: 13px; margin: 10px 0 0; }
                .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin: 25px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #1e293b; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .card-check { background: #1e293b; padding: 12px; border-radius: 8px; border: 1px solid #334155; display: flex; align-items: center; cursor: pointer; user-select: none; transition: border-color 0.2s; font-size: 13px; }
                .card-check:hover { border-color: #6366f1; background: #283548; }
                input[type="checkbox"] { width: 16px; height: 16px; margin-right: 10px; accent-color: #6366f1; cursor: pointer; }
                select, input[type="text"] { width: 100%; padding: 12px; background: #1e293b; color: #f8fafc; border: 1px solid #334155; border-radius: 8px; font-size: 14px; box-sizing: border-box; outline: none; }
                select:focus, input[type="text"]:focus { border-color: #6366f1; }
                .lang-box { max-height: 200px; overflow-y: auto; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 5px; }
                .lang-item { display: flex; align-items: center; padding: 10px; border-radius: 6px; font-size: 13px; cursor: pointer; }
                .lang-item:hover { background: #334155; }
                .debrid-container { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 15px; margin-top: 10px; }
                .btn { display: block; width: 100%; background: #4f46e5; color: white; padding: 15px; text-align: center; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 8px; margin-top: 30px; border: none; cursor: pointer; }
                .btn:hover { background: #4338ca; }
                .btn-copy { background: transparent; border: none; margin-top: 15px; font-size: 13px; color: #818cf8; text-decoration: underline; width: 100%; cursor: pointer;}
                .btn-copy:hover { color: #6366f1; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="https://raw.githubusercontent.com/Jafirhossain/auraflix-hub/main/logo.png" class="logo">
                    <h1>AuraFlix PRO</h1>
                    <span class="version">v17.0.0 Pure Free</span>
                    <p class="desc">100% Free Engine! Zero Buffering & Accurate Hindi/South Hunting. No Paid APIs.</p>
                </div>
                
                <div class="section-title">Stremio Home Catalogues</div>
                <div class="grid-2">
                    <label class="card-check"><input type="checkbox" id="cat_anime_airing"> ⚡ Crunchyroll Airing</label>
                    <label class="card-check"><input type="checkbox" id="cat_anime_trending"> 🔥 Trending Anime</label>
                    <label class="card-check"><input type="checkbox" id="cat_anime_movies"> 🎬 Anime Movies</label>
                    <label class="card-check"><input type="checkbox" id="cat_anime_popular"> 🏆 Anime Masterpieces</label>
                    <label class="card-check"><input type="checkbox" id="cat_south_trending"> 💥 Trending South</label>
                    <label class="card-check"><input type="checkbox" id="cat_south_new_releases"> 🆕 New South Releases</label>
                    <label class="card-check"><input type="checkbox" id="cat_hindi_webseries"> 🇮🇳 Hindi Web Series</label>
                    <label class="card-check"><input type="checkbox" id="cat_netflix_prime"> 👑 Netflix & Prime Hub</label>
                    <label class="card-check"><input type="checkbox" id="cat_hotstar_sonyliv"> 🔥 Hotstar & SonyLIV</label>
                    <label class="card-check"><input type="checkbox" id="cat_bollywood_hub"> 🍿 Bollywood Hub</label>
                </div>

                <div class="section-title">Priority Language</div>
                <div class="lang-box">
                    <label class="lang-item"><input type="checkbox" class="lang-check" value="hindi"> 🇮🇳 Hindi</label>
                    <label class="lang-item"><input type="checkbox" class="lang-check" value="telugu"> 🇮🇳 Telugu</label>
                    <label class="lang-item"><input type="checkbox" class="lang-check" value="tamil"> 🇮🇳 Tamil</label>
                    <label class="lang-item"><input type="checkbox" class="lang-check" value="jap"> 🇯🇵 Japanese</label>
                    <label class="lang-item"><input type="checkbox" class="lang-check" value="eng"> 🇬🇧 English</label>
                    <label class="lang-item"><input type="checkbox" class="lang-check" value="bengali"> 🎭 Bengali</label>
                </div>

                <div class="section-title">Exclude Resolutions</div>
                <div class="grid-3">
                    <label class="card-check"><input type="checkbox" id="ex_remux" value="remux"> BluRay REMUX</label>
                    <label class="card-check"><input type="checkbox" id="ex_hdr" value="hdr"> HDR/DV</label>
                    <label class="card-check"><input type="checkbox" id="ex_4k" value="4k"> 4k</label>
                    <label class="card-check"><input type="checkbox" id="ex_1080p" value="1080p"> 1080p</label>
                    <label class="card-check"><input type="checkbox" id="ex_720p" value="720p"> 720p</label>
                    <label class="card-check"><input type="checkbox" id="ex_480p" value="480p"> 480p / SD</label>
                    <label class="card-check"><input type="checkbox" id="ex_cam" value="cam"> Cam / Screener</label>
                </div>

                <div class="section-title">Default Sorting</div>
                <select id="sorting">
                    <option value="quality_seeders">By quality then seeders (Recommended)</option>
                    <option value="seeders_first">Highest seeders & speed first</option>
                </select>

                <div class="section-title">Debrid Provider (Optional)</div>
                <div class="debrid-container">
                    <select id="debridProvider" onchange="toggleDebridInput()">
                        <option value="none">None (Free High-Speed P2P)</option>
                        <option value="torbox">TorBox (Stremio Integrated)</option>
                        <option value="realdebrid">Real-Debrid</option>
                        <option value="alldebrid">AllDebrid</option>
                        <option value="premiumize">Premiumize</option>
                    </select>
                    <div id="debridInputBox" style="display:none; margin-top:12px;">
                        <input type="text" id="debridToken" placeholder="Paste your API Token / Key here...">
                    </div>
                </div>

                <a id="installBtn" class="btn" href="#">INSTALL ADDON</a>
                <button id="copyBtn" class="btn-copy" onclick="copyManifestLink()">📋 Copy Addon URL Link</button>
            </div>

            <script>
                const initialConfig = ${configJson};

                ['anime_airing', 'anime_trending', 'anime_movies', 'anime_popular', 'south_trending', 'south_new_releases', 'hindi_webseries', 'netflix_prime', 'hotstar_sonyliv', 'bollywood_hub'].forEach(id => {
                    if(document.getElementById('cat_' + id)) {
                        document.getElementById('cat_' + id).checked = initialConfig.catalogs[id] !== false;
                    }
                });

                const pLangs = initialConfig.priorityLanguages || ['hindi'];
                document.querySelectorAll('.lang-check').forEach(el => { el.checked = pLangs.includes(el.value); });

                const exc = initialConfig.excludeResolutions || [];
                if(exc.includes('remux')) document.getElementById('ex_remux').checked = true;
                if(exc.includes('hdr')) document.getElementById('ex_hdr').checked = true;
                if(exc.includes('4k')) document.getElementById('ex_4k').checked = true;
                if(exc.includes('1080p')) document.getElementById('ex_1080p').checked = true;
                if(exc.includes('720p')) document.getElementById('ex_720p').checked = true;
                if(exc.includes('480p')) document.getElementById('ex_480p').checked = true;
                if(exc.includes('cam')) document.getElementById('ex_cam').checked = true;

                document.getElementById('sorting').value = initialConfig.sorting || 'quality_seeders';
                document.getElementById('debridProvider').value = initialConfig.debridProvider || 'none';
                document.getElementById('debridToken').value = initialConfig.debridToken || '';

                function toggleDebridInput() {
                    const val = document.getElementById('debridProvider').value;
                    document.getElementById('debridInputBox').style.display = val === 'none' ? 'none' : 'block';
                }
                toggleDebridInput();

                function updateUrl() {
                    let catObj = {};
                    ['anime_airing', 'anime_trending', 'anime_movies', 'anime_popular', 'south_trending', 'south_new_releases', 'hindi_webseries', 'netflix_prime', 'hotstar_sonyliv', 'bollywood_hub'].forEach(id => {
                        if(document.getElementById('cat_' + id)) catObj[id] = document.getElementById('cat_' + id).checked;
                    });

                    let selectedLangs = [];
                    document.querySelectorAll('.lang-check:checked').forEach(el => selectedLangs.push(el.value));
                    if(selectedLangs.length === 0) selectedLangs.push('hindi');

                    let excArr = [];
                    ['remux', 'hdr', '4k', '1080p', '720p', '480p', 'cam'].forEach(k => {
                        const el = document.getElementById('ex_' + k);
                        if(el && el.checked) excArr.push(k);
                    });

                    const config = {
                        catalogs: catObj,
                        priorityLanguages: selectedLangs,
                        excludeResolutions: excArr,
                        sorting: document.getElementById('sorting').value,
                        debridProvider: document.getElementById('debridProvider').value,
                        debridToken: document.getElementById('debridToken').value.trim()
                    };

                    const b64 = btoa(JSON.stringify(config));
                    const stremioUrl = 'stremio://' + window.location.host + '/' + b64 + '/manifest.json';
                    const manifestUrl = window.location.origin + '/' + b64 + '/manifest.json';

                    document.getElementById('installBtn').href = stremioUrl;
                    window.currentManifestUrl = manifestUrl;
                }

                document.querySelectorAll('input, select').forEach(el => el.addEventListener('change', updateUrl));
                document.getElementById('debridToken').addEventListener('input', updateUrl);
                updateUrl();

                function copyManifestLink() {
                    navigator.clipboard.writeText(window.currentManifestUrl).then(() => {
                        alert('✅ Addon URL Copied! Paste it into Stremio.');
                    });
                }
            </script>
        </body>
        </html>
    `);
}

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`AuraFlix V17 Server running on port ${PORT}`));