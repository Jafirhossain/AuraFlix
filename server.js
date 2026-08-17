const express = require("express");
const axios = require("axios");

const TMDB_API_KEY = "3c3e80c4c47b5964923e20e8b2bf3186";

function getDefaultConfig() {
    return {
        catalogs: {
            anime_airing: true,
            anime_trending: true,
            anime_cartoons_classic: true,
            anime_movies: true,
            anime_popular: true,
            south_trending: true,
            south_new_releases: true,
            hindi_webseries: true,
            netflix_prime: true,
            hotstar_sonyliv: true,
            bollywood_hub: true,
            hollywood_hindi: true,
            bengali_hub: true,
            kdrama_hub: true
        },
        langPriority: "hindi", 
        streamMode: "both",    
        maxQuality: "all",     
        hideLowQuality: true,  
        maxStreams: 40
    };
}

function parseConfig(configStr) {
    if (!configStr) return getDefaultConfig();
    try {
        const decoded = Buffer.from(configStr, 'base64').toString('utf8');
        return { ...getDefaultConfig(), ...JSON.parse(decoded) };
    } catch (e) {
        return getDefaultConfig();
    }
}

// ----------------------------------------------------
// MANIFEST: Changed all Anime types to "series" or "movie" 
// so Stremio can never hide them!
// ----------------------------------------------------
function getManifest(config) {
    const allCatalogs = [
        { type: "series", id: "anime_airing", name: "⚡ Japan Airing Anime", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "anime_trending", name: "🔥 Trending Anime Series", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "anime_cartoons_classic", name: "🌟 Classic Cartoons (Hindi)", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "anime_movies", name: "🎬 Anime Movies & OVAs", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "anime_popular", name: "🏆 All-Time Anime Masterpieces", extra: [{ name: "search" }, { name: "skip" }] },
        
        { type: "movie", id: "south_trending", name: "💥 Trending South Movies (Hindi)", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "south_new_releases", name: "🆕 New South Releases", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "hindi_webseries", name: "🇮🇳 All Hindi Web Series", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "netflix_prime", name: "👑 Netflix & Prime Hub", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "hotstar_sonyliv", name: "🔥 Hotstar, SonyLIV & Zee5", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "bollywood_hub", name: "🍿 Bollywood Movies", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "hollywood_hindi", name: "🎬 Hollywood Hindi Dubbed", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "bengali_hub", name: "🎭 Bengali Movies", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "kdrama_hub", name: "🇰🇷 K-Dramas & Asian", extra: [{ name: "search" }, { name: "skip" }] }
    ];

    const enabledCatalogs = allCatalogs.filter(cat => config.catalogs[cat.id] !== false);

    return {
        id: "org.auraflix.master.pro",
        version: "11.0.0",
        name: "AuraFlix Master VIP 🇮🇳",
        description: "Fixed Edition! Anime and Cartoons will now correctly show on your home screen. Powered by Dual-Mode Streaming (Direct + Torrent).",
        logo: "https://raw.githubusercontent.com/Jafirhossain/auraflix-hub/main/logo.png",
        background: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1920&auto=format&fit=crop",
        resources: ["catalog", "meta", "stream"],
        types: ["series", "movie"], 
        idPrefixes: ["kitsu", "anilist", "tt", "tmdb"],
        behaviorHints: { configurable: true, configurationRequired: false },
        catalogs: enabledCatalogs
    };
}

async function fetchAnime(type, search = null, genre = null, skip = 0) {
    try {
        let url = `https://kitsu.io/api/edge/anime?page[limit]=20&page[offset]=${skip || 0}`;
        if (search) url += `&filter[text]=${encodeURIComponent(search)}`;
        else {
            if (type === "anime_trending") url = `https://kitsu.io/api/edge/trending/anime?page[limit]=20`;
            else if (type === "anime_airing") url += `&filter[status]=current&sort=-userCount`;
            else if (type === "anime_cartoons_classic") url += `&sort=popularityRank&page[offset]=${(skip || 0) + 120}`;
            else if (type === "anime_movies") url += `&filter[subtype]=movie&sort=-userCount`;
            else if (type === "anime_popular") url += `&sort=popularityRank`;
        }
        const res = await axios.get(url, { timeout: 8000 });
        return (res.data.data || []).map(anime => {
            const attr = anime.attributes;
            return {
                id: `kitsu:${anime.id}`,
                name: attr.canonicalTitle || attr.titles?.en || "Anime",
                poster: attr.posterImage?.large || attr.posterImage?.original,
                background: attr.coverImage?.large || attr.coverImage?.original,
                description: `⭐ Score: ${attr.averageRating || "N/A"}% | 📌 Episodes: ${attr.episodeCount || 'Ongoing'}\n\n${attr.synopsis}`
            };
        });
    } catch (e) { return []; }
}

async function fetchOTTContent(type, genre = null, search = null, skip = 0) {
    try {
        const page = Math.floor((skip || 0) / 20) + 1;
        let isSeries = type.includes("series") || type.includes("kdrama") || type.includes("netflix") || type.includes("hotstar");
        let url = "";
        const today = new Date().toISOString().split('T')[0];

        if (search) {
            url = `https://api.themoviedb.org/3/search/${isSeries ? 'tv' : 'movie'}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(search)}&page=${page}`;
        } else if (type === "hindi_webseries") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=popularity.desc&page=${page}`;
        } else if (type === "netflix_prime") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=8|119&watch_region=IN&sort_by=popularity.desc&page=${page}`;
        } else if (type === "hotstar_sonyliv") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=122|220|237|232&watch_region=IN&sort_by=popularity.desc&page=${page}`;
        } else if (type === "south_trending") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=te|ta|kn|ml&sort_by=popularity.desc&page=${page}`;
        } else if (type === "south_new_releases") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=te|ta|kn|ml&primary_release_date.lte=${today}&sort_by=primary_release_date.desc&page=${page}`;
        } else if (type === "bollywood_hub") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=popularity.desc&page=${page}`;
        } else if (type === "hollywood_hindi") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=en&sort_by=popularity.desc&page=${page}`;
        } else if (type === "bengali_hub") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=bn&sort_by=popularity.desc&page=${page}`;
        } else if (type === "kdrama_hub") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=ko&sort_by=popularity.desc&page=${page}`;
        }

        const res = await axios.get(url, { timeout: 8000 });
        return (res.data.results || []).map(m => ({
            id: `tmdb:${m.id}`,
            name: m.title || m.name,
            poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : undefined,
            background: m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : undefined,
            description: `⭐ TMDB: ${m.vote_average || "N/A"}/10 | 📅 ${m.release_date || m.first_air_date || "TBA"}\n\n${m.overview}`
        }));
    } catch (e) { return []; }
}

const app = express();
app.use((req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); });

// ----------------------------------------------------
// UI Dashboard (Settings)
// ----------------------------------------------------
app.get("/", (req, res) => res.redirect("/configure"));
app.get("/configure", (req, res) => renderConfigPage(res, getDefaultConfig()));
app.get("/:config/configure", (req, res) => renderConfigPage(res, parseConfig(req.params.config)));

app.get("/manifest.json", (req, res) => res.json(getManifest(getDefaultConfig())));
app.get("/:config/manifest.json", (req, res) => res.json(getManifest(parseConfig(req.params.config))));

// ----------------------------------------------------
// CATALOG ROUTE (Forces type to match Stremio's request)
// ----------------------------------------------------
app.get("/catalog/:type/:id.json", async (req, res) => handleCatalog(req, res, null));
app.get("/:config/catalog/:type/:id.json", async (req, res) => handleCatalog(req, res, req.params.config));

async function handleCatalog(req, res, configStr) {
    const { type, id } = req.params;
    const { search, genre, skip } = req.query;

    let metas = [];
    if (id.startsWith("anime")) {
        metas = await fetchAnime(id, search, genre, parseInt(skip) || 0);
    } else {
        metas = await fetchOTTContent(id, genre, search, parseInt(skip) || 0);
    }
    
    // FIX: Force type to match Stremio UI request so it never hides
    metas.forEach(m => m.type = type); 
    return res.json({ metas });
}

// ----------------------------------------------------
// META ROUTE
// ----------------------------------------------------
app.get("/meta/:type/:id.json", async (req, res) => handleMeta(req, res));
app.get("/:config/meta/:type/:id.json", async (req, res) => handleMeta(req, res));

async function handleMeta(req, res) {
    const { id, type } = req.params;
    if (id.startsWith("kitsu:")) {
        try {
            const cleanId = id.replace("kitsu:", "");
            const resData = await axios.get(`https://kitsu.io/api/edge/anime/${cleanId}`, { timeout: 5000 });
            const attr = resData.data.data.attributes;
            const isMovie = attr.subtype === "movie";
            const videos = [];
            if (isMovie) {
                videos.push({ id: `kitsu:${cleanId}:1`, title: attr.canonicalTitle, released: attr.startDate });
            } else if (attr.status !== "tba" && attr.status !== "unreleased") {
                 for (let i = 1; i <= (attr.episodeCount || 24); i++) videos.push({ id: `kitsu:${cleanId}:${i}`, title: `Episode ${i}`, season: 1, number: i, episode: i });
            }
            return res.json({ meta: { id, type: type, name: attr.canonicalTitle || attr.titles?.en, poster: attr.posterImage?.large, background: attr.coverImage?.large, description: attr.synopsis, videos } });
        } catch (e) { return res.json({ meta: { id, type: "anime", name: "Anime" } }); }
    } else if (id.startsWith("tmdb:")) {
        try {
            const tmdbId = id.replace("tmdb:", "");
            const isTv = type === "series";
            const resData = await axios.get(`https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`, { timeout: 5000 });
            const m = resData.data;
            const imdbId = m.external_ids?.imdb_id || m.imdb_id || id;
            return res.json({ meta: { id, type, name: m.title || m.name, poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : undefined, background: m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : undefined, description: m.overview, imdb_id: imdbId } });
        } catch (e) { return res.json({ meta: { id, type, name: "Media Item" } }); }
    }
}

// ----------------------------------------------------
// STREAM ROUTE (Direct Web + High Speed P2P)
// ----------------------------------------------------
app.get("/stream/:type/:id.json", async (req, res) => handleStream(req, res, null));
app.get("/:config/stream/:type/:id.json", async (req, res) => handleStream(req, res, req.params.config));

async function handleStream(req, res, configStr) {
    const config = parseConfig(configStr);
    const { type, id } = req.params;
    let targetId = id;
    let isAnime = targetId.startsWith("kitsu:");
    let mediaTitle = "";
    let episodeNum = isAnime ? targetId.split(":")[2] : null;
    let allStreams = [];

    // Title resolution
    try {
        if (isAnime) {
            const kId = targetId.split(":")[1];
            const kRes = await axios.get(`https://kitsu.io/api/edge/anime/${kId}`, { timeout: 5000 });
            mediaTitle = kRes.data.data.attributes.canonicalTitle || kRes.data.data.attributes.titles.en;
        } else if (targetId.startsWith("tmdb:")) {
            const tmdbId = targetId.replace("tmdb:", "");
            const isTv = type === "series";
            const tRes = await axios.get(`https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`, { timeout: 5000 });
            mediaTitle = tRes.data.title || tRes.data.name;
            const imdbId = tRes.data.external_ids?.imdb_id || tRes.data.imdb_id;
            if (imdbId) targetId = imdbId;
        }
    } catch (e) {}

    // 1. Scraper 
    if (mediaTitle) {
        try {
            if (isAnime) {
                const queries = [`${mediaTitle} Hindi ${episodeNum || ''}`.trim(), `${mediaTitle} ${episodeNum || ''}`.trim()];
                for (let q of queries) {
                    let nyaaRes = await axios.get(`https://nyaa.si/?page=rss&q=${encodeURIComponent(q)}&c=0_0&f=0`, { timeout: 4000 }).catch(() => null);
                    if (nyaaRes && nyaaRes.data) {
                        const items = nyaaRes.data.match(/<item>([\s\S]*?)<\/item>/g) || [];
                        items.forEach(item => {
                            const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
                            const hashMatch = item.match(/<nyaa:infoHash>(.*?)<\/nyaa:infoHash>/);
                            const seedsMatch = item.match(/<nyaa:seeders>(.*?)<\/nyaa:seeders>/);
                            if (titleMatch && hashMatch) {
                                allStreams.push({ title: `${titleMatch[1]}`, infoHash: hashMatch[1], seeders: parseInt(seedsMatch ? seedsMatch[1] : 50), isDirect: false });
                            }
                        });
                        if (allStreams.length > 5) break;
                    }
                }
            } else {
                let apiBayRes = await axios.get(`https://apibay.org/q.php?q=${encodeURIComponent(mediaTitle)}`, { timeout: 4000 }).catch(() => null);
                if (apiBayRes && apiBayRes.data && apiBayRes.data[0].id !== "0") {
                    apiBayRes.data.forEach(t => allStreams.push({ title: t.name, infoHash: t.info_hash, seeders: parseInt(t.seeders) || 1, isDirect: false }));
                }
            }
        } catch (e) {}
    }

    // 2. HTTP/Direct Backup via Torrentio Base
    try {
        const resTorrentio = await axios.get(`https://torrentio.strem.fun/stream/${type}/${targetId}.json`, { timeout: 6000 }).catch(() => null);
        if (resTorrentio && resTorrentio.data && resTorrentio.data.streams) {
            resTorrentio.data.streams.forEach(s => {
                let seedMatch = (s.title || "").match(/👤\s*(\d+)/);
                s.seeders = seedMatch ? parseInt(seedMatch[1]) : 25;
                s.isDirect = Boolean(s.url);
                allStreams.push(s);
            });
        }
    } catch (e) {}

    let processedStreams = [];
    let seenHashes = new Set();

    allStreams.forEach(s => {
        if (!s) return;
        const uniqueKey = s.infoHash || s.url;
        if (uniqueKey && seenHashes.has(uniqueKey)) return;
        if (uniqueKey) seenHashes.add(uniqueKey);

        let fullText = ((s.title || "") + " " + (s.name || "")).toLowerCase();
        let isHindi = /(hindi|dual\s*audio|multi\s*audio|hin-eng|dubbed\s*in\s*hindi)/i.test(fullText);
        let isSouth = /(telugu|tamil|malayalam|kannada|tam|tel|mal)/i.test(fullText);

        let langBadge = "🌐 MULTI AUDIO";
        let langRank = 1;

        if (isHindi) { langBadge = "🇮🇳 HINDI DUB"; langRank = 15; }
        else if (isSouth) { langBadge = "🇮🇳 SOUTH ORIGINAL"; langRank = 10; }
        
        if (config.langPriority === "hindi" && isHindi) langRank = 30;

        let quality = "📼 SD";
        let qRank = 1;
        if (fullText.includes("4k") || fullText.includes("2160p")) { quality = "✨ 4K ULTRA HD"; qRank = 4; }
        else if (fullText.includes("1080p")) { quality = "📺 1080p FULL HD"; qRank = 3; }
        else if (fullText.includes("720p")) { quality = "📱 720p HD"; qRank = 2; }

        if (config.hideLowQuality && qRank <= 1) return;
        if (config.maxQuality === "1080p" && qRank > 3) return;

        let modeTag = s.isDirect ? "⚡ DIRECT WEB" : "🚀 P2P STREAM";
        if (config.streamMode === "direct_only" && !s.isDirect) return;
        if (config.streamMode === "p2p_only" && s.isDirect) return;

        s.langRank = langRank;
        s.qRank = qRank;
        s.seeders = s.seeders || 5;

        s.name = `🎬 AuraFlix VIP
${langBadge}`;
        s.title = `${quality} • ${modeTag}
${s.title ? s.title.split('
')[0] : 'Play Now'}`;

        processedStreams.push(s);
    });

    processedStreams.sort((a, b) => {
        if (b.langRank !== a.langRank) return b.langRank - a.langRank;
        if (b.isDirect !== a.isDirect) return b.isDirect ? 1 : -1;
        if (b.seeders !== a.seeders) return b.seeders - a.seeders;
        return b.qRank - a.qRank;
    });

    return res.json({ streams: processedStreams.slice(0, parseInt(config.maxStreams) || 40) });
}

// ----------------------------------------------------
// UI HTML DASHBOARD FUNCTION
// ----------------------------------------------------
function renderConfigPage(res, currentConfig) {
    const configJson = JSON.stringify(currentConfig);
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AuraFlix Master VIP Dashboard</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #060606; color: #fff; margin: 0; padding: 20px; }
                .container { max-width: 780px; margin: 0 auto; background: rgba(15, 15, 15, 0.98); padding: 35px; border-radius: 20px; border: 1px solid #252525; }
                .header { text-align: center; margin-bottom: 25px; }
                h1 { color: #e50914; margin: 12px 0 5px; font-size: 30px; font-weight: 900; }
                .section { background: #111; padding: 22px; border-radius: 14px; margin-bottom: 18px; border-left: 5px solid #e50914; }
                .section-title { font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #ffeb3b; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                label { font-size: 14px; cursor: pointer; display: flex; align-items: center; }
                input[type="checkbox"] { width: 18px; height: 18px; margin-right: 8px; }
                select { width: 100%; padding: 12px; background: #1c1c1c; color: white; border: 1px solid #444; border-radius: 8px; margin-top: 6px; }
                .btn { display: block; width: 100%; background: linear-gradient(90deg, #e50914, #b20710); color: white; padding: 16px; text-align: center; text-decoration: none; font-size: 18px; font-weight: bold; border-radius: 10px; margin-top: 25px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>AuraFlix Master VIP</h1>
                    <p>Anime Categories fixed. Direct Links + Fast Torrents combined.</p>
                </div>
                
                <div class="section">
                    <div class="section-title">📺 Choose Home Screen Categories:</div>
                    <div class="grid-2">
                        <label><input type="checkbox" id="cat_anime_airing"> ⚡ Japan Airing Anime</label>
                        <label><input type="checkbox" id="cat_anime_trending"> 🔥 Trending Anime</label>
                        <label><input type="checkbox" id="cat_anime_cartoons_classic"> 🌟 Classic Cartoons</label>
                        <label><input type="checkbox" id="cat_anime_movies"> 🎬 Anime Movies</label>
                        <label><input type="checkbox" id="cat_anime_popular"> 🏆 Anime Masterpieces</label>
                        <label><input type="checkbox" id="cat_south_trending"> 💥 Trending South (Hindi)</label>
                        <label><input type="checkbox" id="cat_hindi_webseries"> 🇮🇳 Hindi Web Series</label>
                        <label><input type="checkbox" id="cat_netflix_prime"> 👑 Netflix & Prime Hub</label>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">⚡ Play Mode & Audio Priority:</div>
                    <select id="streamMode">
                        <option value="both">⚡ Dual-Mode: Direct Web Play + P2P</option>
                        <option value="direct_only">🔗 Direct Web Play Only</option>
                    </select>
                    <select id="langPriority" style="margin-top:10px;">
                        <option value="hindi">🇮🇳 Priority: Hindi Dubbed</option>
                        <option value="all">🌐 Priority: Speed & Quality</option>
                    </select>
                </div>

                <a id="installBtn" class="btn" href="#">⚡ SAVE & INSTALL IN STREMIO</a>
            </div>

            <script>
                const initialConfig = ${configJson};
                
                ['anime_airing', 'anime_trending', 'anime_cartoons_classic', 'anime_movies', 'anime_popular', 'south_trending', 'hindi_webseries', 'netflix_prime'].forEach(id => {
                    if(document.getElementById('cat_' + id)) {
                        document.getElementById('cat_' + id).checked = initialConfig.catalogs[id] !== false;
                    }
                });

                document.getElementById('streamMode').value = initialConfig.streamMode || 'both';
                document.getElementById('langPriority').value = initialConfig.langPriority || 'hindi';

                function updateUrl() {
                    let catObj = {};
                    ['anime_airing', 'anime_trending', 'anime_cartoons_classic', 'anime_movies', 'anime_popular', 'south_trending', 'hindi_webseries', 'netflix_prime'].forEach(id => {
                        if(document.getElementById('cat_' + id)) catObj[id] = document.getElementById('cat_' + id).checked;
                    });

                    const config = {
                        catalogs: catObj,
                        streamMode: document.getElementById('streamMode').value,
                        langPriority: document.getElementById('langPriority').value,
                        maxQuality: "all",
                        hideLowQuality: true,
                        maxStreams: 40
                    };

                    const b64 = btoa(JSON.stringify(config));
                    document.getElementById('installBtn').href = 'stremio://' + window.location.host + '/' + b64 + '/manifest.json';
                }

                document.querySelectorAll('input, select').forEach(el => el.addEventListener('change', updateUrl));
                updateUrl();
            </script>
        </body>
        </html>
    `);
}

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
