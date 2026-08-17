const express = require("express");
const axios = require("axios");

const TMDB_API_KEY = "15d2ea6d0dc1d476efbca3eba2b9bbfb"; 

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

    return {
        id: "org.auraflix.ultravip",
        version: "16.0.0",
        name: "AuraFlix Ultra VIP 🇮🇳",
        description: "ULTIMATE FIX: Blank Pages & Missing Play Button 100% FIXED. Multi-Engine Scraper (Torrentio + KnightCrawler + MediaFusion) for Mega/Pixeldrain Direct Links.",
        logo: "https://raw.githubusercontent.com/Jafirhossain/auraflix-hub/main/logo.png",
        background: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1920&auto=format&fit=crop",
        resources: [
            "catalog",
            // CRUCIAL FIX: We ONLY handle meta for Anime (Kitsu). 
            // TMDB/IMDb will be handled perfectly by Stremio's native Cinemeta. Zero blank pages!
            { name: "meta", types: ["anime", "series", "movie"], idPrefixes: ["kitsu"] },
            { name: "stream", types: ["anime", "series", "movie"], idPrefixes: ["kitsu", "tmdb", "tt"] }
        ],
        types: ["series", "movie", "anime"], 
        behaviorHints: { configurable: true, configurationRequired: false },
        catalogs: allCatalogs.filter(cat => config.catalogs[cat.id] !== false)
    };
}

async function fetchAnime(catalogId, search = null, genre = null, skip = 0) {
    try {
        let url = `https://kitsu.io/api/edge/anime?page[limit]=20&page[offset]=${skip || 0}`;
        if (search) url += `&filter[text]=${encodeURIComponent(search)}`;
        else {
            if (catalogId === "anime_trending") url = `https://kitsu.io/api/edge/trending/anime?page[limit]=20`;
            else if (catalogId === "anime_airing") url += `&filter[status]=current&sort=-userCount`;
            else if (catalogId === "anime_movies") url += `&filter[subtype]=movie&sort=-userCount`;
            else if (catalogId === "anime_popular") url += `&sort=popularityRank`;
        }
        const res = await axios.get(url, { timeout: 8000 });
        return (res.data.data || []).map(anime => {
            const attr = anime.attributes;
            return {
                id: `kitsu:${anime.id}`,
                name: attr.canonicalTitle || attr.titles?.en || "Anime",
                poster: attr.posterImage?.large || attr.posterImage?.original || "https://via.placeholder.com/500x750?text=No+Poster",
                background: attr.coverImage?.large || attr.coverImage?.original,
                description: `⭐ Score: ${attr.averageRating || "N/A"}% | 📌 Episodes: ${attr.episodeCount || 'Ongoing'}\n\n${attr.synopsis}`
            };
        });
    } catch (e) { return []; }
}

async function fetchOTTContent(catalogId, genre = null, search = null, skip = 0) {
    try {
        const page = Math.floor((skip || 0) / 20) + 1;
        let isSeries = catalogId.includes("series") || catalogId.includes("netflix") || catalogId.includes("hotstar");
        let url = "";
        const today = new Date().toISOString().split('T')[0];

        if (search) {
            url = `https://api.themoviedb.org/3/search/${isSeries ? 'tv' : 'movie'}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(search)}&page=${page}`;
        } else if (catalogId === "hindi_webseries") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=popularity.desc&page=${page}`;
        } else if (catalogId === "netflix_prime") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=8|119&watch_region=IN&sort_by=popularity.desc&page=${page}`;
        } else if (catalogId === "hotstar_sonyliv") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=122|220|237|232&watch_region=IN&sort_by=popularity.desc&page=${page}`;
        } else if (catalogId === "south_trending") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=te&sort_by=popularity.desc&page=${page}`;
        } else if (catalogId === "south_new_releases") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=ta&primary_release_date.lte=${today}&sort_by=primary_release_date.desc&page=${page}`;
        } else if (catalogId === "hollywood_hindi") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=en&sort_by=popularity.desc&page=${page}`;
        }

        if (!url) return [];
        
        const res = await axios.get(url, { timeout: 8000 });
        return (res.data.results || []).map(m => ({
            id: `tmdb:${m.id}`,
            name: m.title || m.name,
            poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "https://via.placeholder.com/500x750?text=No+Poster",
            background: m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : undefined,
            description: `⭐ TMDB: ${m.vote_average || "N/A"}/10 | 📅 ${m.release_date || m.first_air_date || "TBA"}\n\n${m.overview}`
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

// Meta is ONLY for Kitsu now. Cinemeta handles TMDB beautifully!
app.get("/meta/:type/:id.json", async (req, res) => handleMeta(req, res));
app.get("/:config/meta/:type/:id.json", async (req, res) => handleMeta(req, res));

async function handleMeta(req, res) {
    const { id, type } = req.params;
    if (id.startsWith("kitsu:")) {
        try {
            const cleanId = id.replace("kitsu:", "");
            const resData = await axios.get(`https://kitsu.io/api/edge/anime/${cleanId}`, { timeout: 6000 });
            const attr = resData.data.data.attributes;
            const isMovie = attr.subtype === "movie";
            
            let metaObj = { 
                id, type, name: attr.canonicalTitle || attr.titles?.en || "Anime", 
                poster: attr.posterImage?.large || "https://via.placeholder.com/500x750?text=No+Poster", 
                background: attr.coverImage?.large, 
                description: attr.synopsis || "No description available.",
                imdbRating: attr.averageRating ? (attr.averageRating / 10).toFixed(1) : undefined
            };

            if (!isMovie) {
                const videos = [];
                const epCount = attr.episodeCount || 24;
                for (let i = 1; i <= epCount; i++) {
                    videos.push({ id: `kitsu:${cleanId}:${i}`, title: `Episode ${i}`, season: 1, number: i, episode: i });
                }
                metaObj.videos = videos;
            }
            return res.json({ meta: metaObj });
        } catch (e) { return res.status(404).send("Not Found"); }
    }
    return res.status(404).send("Not Found"); 
}

// ----------------------------------------------------
// MULTI-ENGINE SCRAPER (Torrentio + KnightCrawler + MediaFusion)
// ----------------------------------------------------
app.get("/stream/:type/:id.json", async (req, res) => handleStream(req, res, null));
app.get("/:config/stream/:type/:id.json", async (req, res) => handleStream(req, res, req.params.config));

async function handleStream(req, res, configStr) {
    const config = parseConfig(configStr);
    const { type, id } = req.params;
    let targetId = id;
    let isAnime = targetId.startsWith("kitsu:");
    let mediaTitle = "";
    let episodeNum = "";
    let seasonNum = "";
    
    // Resolve IDs
    try {
        if (isAnime) {
            const parts = targetId.split(":");
            episodeNum = parts[2] || "";
            const kRes = await axios.get(`https://kitsu.io/api/edge/anime/${parts[1]}`, { timeout: 4000 });
            mediaTitle = kRes.data.data.attributes.canonicalTitle || kRes.data.data.attributes.titles.en;
        } else if (targetId.startsWith("tmdb:")) {
            const parts = targetId.split(":");
            const tmdbId = parts[1];
            seasonNum = parts[2];
            episodeNum = parts[3];
            const isTv = type === "series";
            
            const tRes = await axios.get(`https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`, { timeout: 4000 });
            mediaTitle = tRes.data.title || tRes.data.name;
            const imdbId = tRes.data.external_ids?.imdb_id || tRes.data.imdb_id;
            
            if (imdbId) targetId = (seasonNum && episodeNum) ? `${imdbId}:${seasonNum}:${episodeNum}` : imdbId;
        } else if (targetId.startsWith("tt")) {
            const parts = targetId.split(":");
            seasonNum = parts[1];
            episodeNum = parts[2];
        }
    } catch (e) {}

    let allStreams = [];
    const torrentioType = isAnime ? "anime" : type;

    // Build Debrid URLs
    const buildProviderUrl = (baseUrl) => {
        let u = baseUrl;
        if (config.debridProvider && config.debridProvider !== "none" && config.debridToken) {
            u += `/${config.debridProvider}=${config.debridToken}`;
        }
        return `${u}/stream/${torrentioType}/${targetId}.json`;
    };

    // Parallel Request to all 3 Major Engines!
    const providers = [
        "https://torrentio.strem.fun", 
        "https://knightcrawler.elfhosted.com", 
        "https://mediafusion.elfhosted.com"
    ];

    await Promise.all(providers.map(async (provider) => {
        try {
            let r = await axios.get(buildProviderUrl(provider), { timeout: 6500 });
            if (r.data && r.data.streams) allStreams.push(...r.data.streams);
        } catch(e) {}
    }));

    // Native Scraper Fallback
    if (allStreams.length < 3 && mediaTitle) {
        if (isAnime) {
            const queries = [`${mediaTitle} Hindi`, `${mediaTitle} ${episodeNum}`.trim(), mediaTitle];
            for (let q of queries) {
                try {
                    let nyaaRes = await axios.get(`https://nyaa.si/?page=rss&q=${encodeURIComponent(q)}&c=0_0&f=0`, { timeout: 4000 });
                    const items = nyaaRes.data.match(/<item>([\s\S]*?)<\/item>/g) || [];
                    items.forEach(item => {
                        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
                        const hashMatch = item.match(/<nyaa:infoHash>(.*?)<\/nyaa:infoHash>/);
                        const seedsMatch = item.match(/<nyaa:seeders>(.*?)<\/nyaa:seeders>/);
                        if (titleMatch && hashMatch) {
                            allStreams.push({ title: titleMatch[1], infoHash: hashMatch[1], seeders: parseInt(seedsMatch ? seedsMatch[1] : 20) });
                        }
                    });
                } catch(e) {}
                if (allStreams.length > 5) break;
            }
        } else {
            try {
                let apiBayRes = await axios.get(`https://apibay.org/q.php?q=${encodeURIComponent(mediaTitle)}`, { timeout: 4000 });
                if (apiBayRes.data && apiBayRes.data[0].id !== "0") {
                    apiBayRes.data.forEach(t => allStreams.push({ title: t.name, infoHash: t.info_hash, seeders: parseInt(t.seeders) || 5 }));
                }
            } catch(e) {}
        }
    }

    let processedStreams = [];
    let seen = new Set();
    const excludes = config.excludeResolutions || [];

    allStreams.forEach(s => {
        if (!s) return;
        
        let rawTitle = (s.title || "").toLowerCase();
        let rawName = (s.name || "").toLowerCase();
        let fullText = rawTitle + " " + rawName + " " + (s.description || "").toLowerCase();

        let seedMatch = rawTitle.match(/👤\s*(\d+)/) || rawTitle.match(/seeds:\s*(\d+)/i);
        let seeders = s.seeders || (seedMatch ? parseInt(seedMatch[1]) : (s.url ? 999 : 5)); 
        
        // Detect Mega/Pixeldrain from MediaFusion
        let isDirect = Boolean(s.url) || fullText.includes("pixeldrain") || fullText.includes("mega") || fullText.includes("direct");

        const uniqueKey = s.infoHash || s.url || fullText;
        if (uniqueKey && seen.has(uniqueKey)) return;
        if (uniqueKey) seen.add(uniqueKey);

        let quality = "📼 480p SD";
        let qRank = 1;
        let isHDR = fullText.includes("hdr") || fullText.includes("dv") || fullText.includes("dolby");

        if (fullText.includes("4k") || fullText.includes("2160p") || fullText.includes("uhd")) { 
            quality = isHDR ? "✨ 4K ULTRA HD • HDR" : "✨ 4K ULTRA HD"; 
            qRank = 4; 
            if(excludes.includes("4k")) return;
        }
        else if (fullText.includes("1080p") || fullText.includes("fhd") || fullText.includes("blu-ray") || fullText.includes("bluray")) { 
            quality = "📺 1080p FULL HD" + (fullText.includes("blu") ? " (BluRay)" : ""); 
            qRank = 3; 
            if(excludes.includes("1080p")) return;
        }
        else if (fullText.includes("720p") || fullText.includes("hd")) { 
            quality = "📱 720p HD"; 
            qRank = 2; 
            if(excludes.includes("720p")) return;
        }
        else {
            if(excludes.includes("480p")) return;
        }

        if (excludes.includes("cam") && (fullText.includes("cam") || fullText.includes("ts") || fullText.includes("hdcam"))) return;

        let isHindi = /(hindi|dual\s*audio|multi\s*audio|hin-eng|dubbed\s*in\s*hindi|hin)/i.test(fullText);
        let isSouth = /(telugu|tamil|malayalam|kannada|tam|tel|mal)/i.test(fullText);

        let langBadge = "🌐 MULTI AUDIO";
        let langRank = 1;

        if (isHindi) { langBadge = "🇮🇳 HINDI DUB"; langRank = 15; }
        else if (isSouth) { langBadge = "🇮🇳 SOUTH ORIGINAL"; langRank = 10; }
        
        if (config.langPriority === "hindi" && isHindi) langRank = 50;

        let providerTag = "🚀 P2P STREAM";
        if (fullText.includes("mediafusion") || rawName.includes("mediafusion")) providerTag = "🔥 MEDIAFUSION";
        if (fullText.includes("knightcrawler") || rawName.includes("knightcrawler")) providerTag = "🕷️ KNIGHTCRAWLER";
        
        let modeTag = isDirect ? "⚡ DIRECT LINK" : providerTag;
        if (fullText.includes("pixeldrain")) modeTag = "⚡ PIXELDRAIN DIRECT";
        if (fullText.includes("mega")) modeTag = "⚡ MEGA DIRECT";

        s.langRank = langRank;
        s.qRank = qRank;
        s.seeders = seeders;

        let cleanTitle = s.title ? s.title.split('
')[0].replace(/(Torrentio|Debrid|MediaFusion|KnightCrawler)/ig, 'AuraFlix') : 'Play Now';

        s.name = `🎬 AuraFlix VIP
${langBadge}`;
        s.title = `${quality} • ${modeTag}
${cleanTitle}
👤 ${seeders} Seeders`;

        processedStreams.push(s);
    });

    // ABSOLUTE GOD-MODE SORTING:
    // 1. Priority Language (Hindi) 2. 4K/1080p Quality 3. Direct Links 4. High Seeders
    processedStreams.sort((a, b) => {
        if (b.langRank !== a.langRank) return b.langRank - a.langRank; 
        if (b.qRank !== a.qRank) return b.qRank - a.qRank;
        if (b.url && !a.url) return 1; 
        if (!b.url && a.url) return -1;
        return b.seeders - a.seeders; 
    });

    return res.json({ streams: processedStreams.slice(0, parseInt(config.maxStreams) || 50) });
}

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
                    <h1>AuraFlix Ultra VIP</h1>
                    <p class="desc">Integrated with MediaFusion & Torrentio for Direct Links (Pixeldrain/Mega) & P2P. Perfect Meta Fixed.</p>
                </div>
                
                <div class="section">
                    <div class="section-title">📺 Stremio Home Catalogues</div>
                    <div class="grid-2">
                        <label><input type="checkbox" id="cat_anime_airing"> ⚡ Japan Airing Anime</label>
                        <label><input type="checkbox" id="cat_anime_trending"> 🔥 Trending Anime</label>
                        <label><input type="checkbox" id="cat_anime_movies"> 🎬 Anime Movies</label>
                        <label><input type="checkbox" id="cat_anime_popular"> 🏆 Anime Masterpieces</label>
                        <label><input type="checkbox" id="cat_south_trending"> 💥 Trending South (Hindi)</label>
                        <label><input type="checkbox" id="cat_south_new_releases"> 🆕 New South Releases</label>
                        <label><input type="checkbox" id="cat_hindi_webseries"> 🇮🇳 Hindi Web Series</label>
                        <label><input type="checkbox" id="cat_netflix_prime"> 👑 Netflix & Prime Hub</label>
                        <label><input type="checkbox" id="cat_hotstar_sonyliv"> 🔥 Hotstar, SonyLIV & Zee5</label>
                        <label><input type="checkbox" id="cat_hollywood_hindi"> 🎬 Hollywood Hindi Dub</label>
                    </div>
                </div>

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

                <div class="section">
                    <div class="section-title">🌐 Priority Language</div>
                    <select id="langPriority">
                        <option value="hindi">🇮🇳 Hindi (Default - Highly Prioritized)</option>
                        <option value="all">🌐 No Priority (By Quality Only)</option>
                    </select>
                </div>

                <div class="section">
                    <div class="section-title">🚀 Debrid Provider (Optional)</div>
                    <select id="debridProvider" onchange="toggleDebridInput()">
                        <option value="none">None (Free Direct/Mega & P2P)</option>
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
                
                ['anime_airing', 'anime_trending', 'anime_movies', 'anime_popular', 'south_trending', 'south_new_releases', 'hindi_webseries', 'netflix_prime', 'hotstar_sonyliv', 'hollywood_hindi'].forEach(id => {
                    if(document.getElementById('cat_' + id)) {
                        document.getElementById('cat_' + id).checked = initialConfig.catalogs[id] !== false;
                    }
                });

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
                    ['anime_airing', 'anime_trending', 'anime_movies', 'anime_popular', 'south_trending', 'south_new_releases', 'hindi_webseries', 'netflix_prime', 'hotstar_sonyliv', 'hollywood_hindi'].forEach(id => {
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
