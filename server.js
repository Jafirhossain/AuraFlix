const express = require("express");
const axios = require("axios");

const TMDB_API_KEY = "3c3e80c4c47b5964923e20e8b2bf3186";

function getDefaultConfig() {
    return {
        catalogs: {
            anime_airing: true, anime_trending: true, anime_movies: true, anime_popular: true,
            south_trending: true, south_new_releases: true, hindi_webseries: true,
            netflix_prime: true, hotstar_sonyliv: true, hollywood_hindi: true
        },
        langPriority: "hindi", 
        debridProvider: "none",
        debridToken: "",
        excludeResolutions: []
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

function getManifest(config) {
    const allCatalogs = [
        { type: "series", id: "anime_airing", name: "⚡ Japan Airing Anime", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "anime_trending", name: "🔥 Trending Anime Series", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "anime_movies", name: "🎬 Anime Movies & OVAs", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "anime_popular", name: "🏆 All-Time Anime Masterpieces", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "south_trending", name: "💥 Trending South Movies (Hindi)", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "south_new_releases", name: "🆕 New South Releases", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "hindi_webseries", name: "🇮🇳 All Hindi Web Series", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "netflix_prime", name: "👑 Netflix & Prime Hub", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "hotstar_sonyliv", name: "🔥 Hotstar, SonyLIV & Zee5", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "hollywood_hindi", name: "🎬 Hollywood Hindi Dubbed", extra: [{ name: "search" }, { name: "skip" }] }
    ];

    const enabledCatalogs = allCatalogs.filter(cat => config.catalogs[cat.id] !== false);

    return {
        id: "org.auraflix.ultimate",
        version: "12.0.0",
        name: "AuraFlix Ultimate VIP 🇮🇳",
        description: "Zero Buffering Engine! Integrated with Real-Debrid/AllDebrid for instant 4K/1080p playback. Advanced filtering and custom Hindi/South Priority.",
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
        let isSeries = type.includes("series") || type.includes("netflix") || type.includes("hotstar");
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
        } else if (type === "hollywood_hindi") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=en&sort_by=popularity.desc&page=${page}`;
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
// CATALOG & META
// ----------------------------------------------------
app.get("/catalog/:type/:id.json", async (req, res) => handleCatalog(req, res, null));
app.get("/:config/catalog/:type/:id.json", async (req, res) => handleCatalog(req, res, req.params.config));

async function handleCatalog(req, res, configStr) {
    const { type, id } = req.params;
    const { search, genre, skip } = req.query;
    let metas = [];
    if (id.startsWith("anime")) metas = await fetchAnime(id, search, genre, parseInt(skip) || 0);
    else metas = await fetchOTTContent(id, genre, search, parseInt(skip) || 0);
    metas.forEach(m => m.type = type); 
    return res.json({ metas });
}

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
// MEGA STREAM ENGINE (Torrentio Proxy + Debrid + Filtering)
// ----------------------------------------------------
app.get("/stream/:type/:id.json", async (req, res) => handleStream(req, res, null));
app.get("/:config/stream/:type/:id.json", async (req, res) => handleStream(req, res, req.params.config));

async function handleStream(req, res, configStr) {
    const config = parseConfig(configStr);
    const { type, id } = req.params;
    let targetId = id;
    let isAnime = targetId.startsWith("kitsu:");

    // Resolve IDs for Torrentio
    try {
        if (!isAnime && targetId.startsWith("tmdb:")) {
            const tmdbId = targetId.replace("tmdb:", "");
            const isTv = type === "series";
            const tRes = await axios.get(`https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`, { timeout: 4000 });
            const imdbId = tRes.data.external_ids?.imdb_id || tRes.data.imdb_id;
            if (imdbId) targetId = imdbId;
        }
    } catch (e) {}

    // Construct Powerful Upstream URL (Debrid Integration)
    let upstreamUrl = "https://torrentio.strem.fun";
    
    // Add Debrid if configured
    if (config.debridProvider && config.debridProvider !== "none" && config.debridToken) {
        upstreamUrl += `/${config.debridProvider}=${config.debridToken}`;
    }
    
    upstreamUrl += `/stream/${type}/${targetId}.json`;

    let allStreams = [];
    try {
        const resTorrentio = await axios.get(upstreamUrl, { timeout: 8000 });
        if (resTorrentio && resTorrentio.data && resTorrentio.data.streams) {
            allStreams = resTorrentio.data.streams;
        }
    } catch (e) {
        // Fallback for strict timeouts
        console.log("Upstream timeout");
    }

    let processedStreams = [];
    let seen = new Set();
    const excludes = config.excludeResolutions || [];

    allStreams.forEach(s => {
        if (!s) return;
        
        let rawTitle = (s.title || "").toLowerCase();
        let rawName = (s.name || "").toLowerCase();
        let fullText = rawTitle + " " + rawName;

        // Extract Seeders
        let seedMatch = rawTitle.match(/👤\s*(\d+)/);
        let seeders = seedMatch ? parseInt(seedMatch[1]) : (s.url ? 999 : 5); // Direct/Debrid links get max priority
        let isDirect = Boolean(s.url);

        // Deduplication
        const uniqueKey = s.infoHash || s.url || fullText;
        if (uniqueKey && seen.has(uniqueKey)) return;
        if (uniqueKey) seen.add(uniqueKey);

        // Quality Detection & Exclusion
        let quality = "📼 480p SD";
        let qRank = 1;
        let isHDR = fullText.includes("hdr") || fullText.includes("dv") || fullText.includes("dolby");

        if (fullText.includes("4k") || fullText.includes("2160p")) { 
            quality = isHDR ? "✨ 4K ULTRA HD • HDR" : "✨ 4K ULTRA HD"; 
            qRank = 4; 
            if(excludes.includes("4k")) return;
        }
        else if (fullText.includes("1080p")) { 
            quality = "📺 1080p FULL HD"; 
            qRank = 3; 
            if(excludes.includes("1080p")) return;
        }
        else if (fullText.includes("720p")) { 
            quality = "📱 720p HD"; 
            qRank = 2; 
            if(excludes.includes("720p")) return;
        }
        else {
            if(excludes.includes("480p")) return;
        }

        if (excludes.includes("cam") && (fullText.includes("cam") || fullText.includes("ts"))) return;

        // Language Detection
        let isHindi = /\b(hindi|dual\s*audio|multi\s*audio|hin-eng|dubbed\s*in\s*hindi)\b/i.test(fullText);
        let isSouth = /\b(telugu|tamil|malayalam|kannada|tam|tel|mal)\b/i.test(fullText);

        let langBadge = "🌐 MULTI AUDIO";
        let langRank = 1;

        if (isHindi) { langBadge = "🇮🇳 HINDI DUB"; langRank = 15; }
        else if (isSouth) { langBadge = "🇮🇳 SOUTH ORIGINAL"; langRank = 10; }
        
        if (config.langPriority === "hindi" && isHindi) langRank = 30;

        let modeTag = isDirect ? "⚡ PREMIUM DIRECT" : "🚀 P2P STREAM";

        s.langRank = langRank;
        s.qRank = qRank;
        s.seeders = seeders;

        // Clean up title to look professional
        let cleanTitle = s.title ? s.title.split('\n')[0].replace(/\b(Torrentio|Debrid)\b/ig, 'AuraFlix') : 'Play Now';

        s.name = `🎬 AuraFlix VIP\n${langBadge}`;
        s.title = `${quality} • ${modeTag}\n${cleanTitle}\n👤 ${seeders} Seeders`;

        processedStreams.push(s);
    });

    // Zero Buffering Sort Logic
    processedStreams.sort((a, b) => {
        if (b.langRank !== a.langRank) return b.langRank - a.langRank; // Hindi first
        if (b.url && !a.url) return 1; // Debrid/Direct links absolute first
        if (!b.url && a.url) return -1;
        if (b.seeders !== a.seeders) return b.seeders - a.seeders; // Highest seeds
        return b.qRank - a.qRank; // Highest quality
    });

    return res.json({ streams: processedStreams });
}

// ----------------------------------------------------
// UI HTML DASHBOARD FUNCTION (Advanced Interface)
// ----------------------------------------------------
function renderConfigPage(res, currentConfig) {
    const configJson = JSON.stringify(currentConfig);
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AuraFlix Advanced Settings</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #0b0f19; color: #e2e8f0; margin: 0; padding: 20px; }
                .container { max-width: 800px; margin: 0 auto; background: #111827; padding: 30px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #1f2937; }
                .header { text-align: center; margin-bottom: 30px; }
                h1 { color: #f43f5e; margin: 0 0 10px 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; }
                p.desc { color: #94a3b8; font-size: 15px; margin: 0; }
                
                .section { background: #1f2937; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #f43f5e; }
                .section-title { font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #f8fafc; display: flex; align-items: center; }
                
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                
                label { font-size: 14px; cursor: pointer; display: flex; align-items: center; color: #cbd5e1; }
                input[type="checkbox"] { width: 18px; height: 18px; margin-right: 10px; accent-color: #f43f5e; cursor: pointer; }
                
                select, input[type="text"] { width: 100%; padding: 12px; background: #0f172a; color: #f8fafc; border: 1px solid #334155; border-radius: 8px; margin-top: 8px; font-size: 14px; box-sizing: border-box; outline: none; transition: border 0.2s; }
                select:focus, input[type="text"]:focus { border-color: #f43f5e; }
                
                .debrid-box { background: #0f172a; padding: 15px; border-radius: 8px; margin-top: 15px; border: 1px dashed #334155; }
                .debrid-hint { font-size: 12px; color: #64748b; margin-top: 5px; }
                
                .btn { display: block; width: 100%; background: #f43f5e; color: white; padding: 16px; text-align: center; text-decoration: none; font-size: 18px; font-weight: bold; border-radius: 8px; margin-top: 30px; transition: background 0.3s; border: none; cursor: pointer; }
                .btn:hover { background: #e11d48; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>AuraFlix Ultimate</h1>
                    <p class="desc">Configure your quality preferences and attach your Debrid API key for smooth, zero-buffering playback.</p>
                </div>
                
                <!-- Catalogs -->
                <div class="section">
                    <div class="section-title">📺 Stremio Home Catalogues</div>
                    <div class="grid-2">
                        <label><input type="checkbox" id="cat_anime_airing"> ⚡ Japan Airing Anime</label>
                        <label><input type="checkbox" id="cat_anime_trending"> 🔥 Trending Anime</label>
                        <label><input type="checkbox" id="cat_anime_movies"> 🎬 Anime Movies</label>
                        <label><input type="checkbox" id="cat_anime_popular"> 🏆 Anime Masterpieces</label>
                        <label><input type="checkbox" id="cat_south_trending"> 💥 Trending South (Hindi)</label>
                        <label><input type="checkbox" id="cat_hindi_webseries"> 🇮🇳 Hindi Web Series</label>
                        <label><input type="checkbox" id="cat_netflix_prime"> 👑 Netflix & Prime Hub</label>
                        <label><input type="checkbox" id="cat_hollywood_hindi"> 🎬 Hollywood Hindi Dub</label>
                    </div>
                </div>

                <!-- Exclude Resolutions -->
                <div class="section">
                    <div class="section-title">🚫 Exclude Resolutions</div>
                    <p class="desc" style="margin-bottom:10px; font-size:12px;">Check the boxes for qualities you DO NOT want to see.</p>
                    <div class="grid-3">
                        <label><input type="checkbox" id="ex_4k" value="4k"> 4K / 2160p</label>
                        <label><input type="checkbox" id="ex_1080p" value="1080p"> 1080p</label>
                        <label><input type="checkbox" id="ex_720p" value="720p"> 720p</label>
                        <label><input type="checkbox" id="ex_480p" value="480p"> 480p / SD</label>
                        <label><input type="checkbox" id="ex_cam" value="cam"> CAM / Screener</label>
                    </div>
                </div>

                <!-- Language Priority -->
                <div class="section">
                    <div class="section-title">🌐 Priority Language</div>
                    <select id="langPriority">
                        <option value="hindi">🇮🇳 Hindi (Default)</option>
                        <option value="all">🌐 No Priority (By Quality Only)</option>
                    </select>
                </div>

                <!-- Debrid Integration -->
                <div class="section">
                    <div class="section-title">🚀 Debrid Provider (Zero Buffering)</div>
                    <select id="debridProvider" onchange="toggleDebridInput()">
                        <option value="none">None (Free P2P Torrents)</option>
                        <option value="realdebrid">Real-Debrid</option>
                        <option value="alldebrid">AllDebrid</option>
                        <option value="premiumize">Premiumize</option>
                    </select>
                    
                    <div class="debrid-box" id="debridInputBox" style="display:none;">
                        <label style="color:#f8fafc; font-weight:bold; margin-bottom:5px; display:block;">Debrid API Key:</label>
                        <input type="text" id="debridToken" placeholder="Enter your API Token here...">
                        <p class="debrid-hint">Your token will be securely encoded in your unique Addon URL. It is never stored on our servers.</p>
                    </div>
                </div>

                <a id="installBtn" class="btn" href="#">Install Addon</a>
            </div>

            <script>
                const initialConfig = ${configJson};
                
                // Set Checkboxes
                ['anime_airing', 'anime_trending', 'anime_movies', 'anime_popular', 'south_trending', 'hindi_webseries', 'netflix_prime', 'hollywood_hindi'].forEach(id => {
                    if(document.getElementById('cat_' + id)) {
                        document.getElementById('cat_' + id).checked = initialConfig.catalogs[id] !== false;
                    }
                });

                // Set Excludes
                const excludes = initialConfig.excludeResolutions || [];
                if(excludes.includes('4k')) document.getElementById('ex_4k').checked = true;
                if(excludes.includes('1080p')) document.getElementById('ex_1080p').checked = true;
                if(excludes.includes('720p')) document.getElementById('ex_720p').checked = true;
                if(excludes.includes('480p')) document.getElementById('ex_480p').checked = true;
                if(excludes.includes('cam')) document.getElementById('ex_cam').checked = true;

                document.getElementById('langPriority').value = initialConfig.langPriority || 'hindi';
                document.getElementById('debridProvider').value = initialConfig.debridProvider || 'none';
                document.getElementById('debridToken').value = initialConfig.debridToken || '';

                function toggleDebridInput() {
                    const val = document.getElementById('debridProvider').value;
                    document.getElementById('debridInputBox').style.display = val === 'none' ? 'none' : 'block';
                }
                toggleDebridInput();

                function updateUrl() {
                    let catObj = {};
                    ['anime_airing', 'anime_trending', 'anime_movies', 'anime_popular', 'south_trending', 'hindi_webseries', 'netflix_prime', 'hollywood_hindi'].forEach(id => {
                        if(document.getElementById('cat_' + id)) catObj[id] = document.getElementById('cat_' + id).checked;
                    });

                    let exc = [];
                    if(document.getElementById('ex_4k').checked) exc.push('4k');
                    if(document.getElementById('ex_1080p').checked) exc.push('1080p');
                    if(document.getElementById('ex_720p').checked) exc.push('720p');
                    if(document.getElementById('ex_480p').checked) exc.push('480p');
                    if(document.getElementById('ex_cam').checked) exc.push('cam');

                    const config = {
                        catalogs: catObj,
                        langPriority: document.getElementById('langPriority').value,
                        debridProvider: document.getElementById('debridProvider').value,
                        debridToken: document.getElementById('debridToken').value.trim(),
                        excludeResolutions: exc
                    };

                    const b64 = btoa(JSON.stringify(config));
                    document.getElementById('installBtn').href = 'stremio://' + window.location.host + '/' + b64 + '/manifest.json';
                }

                document.querySelectorAll('input, select').forEach(el => el.addEventListener('change', updateUrl));
                document.getElementById('debridToken').addEventListener('input', updateUrl);
                updateUrl();
            </script>
        </body>
        </html>
    `);
}

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
