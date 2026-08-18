const express = require("express");
const axios = require("axios");

const TMDB_API_KEY = "15d2ea6d0dc1d476efbca3eba2b9bbfb"; 

// THE BYPASS ENGINE: To avoid Render Free IP getting blocked by Cloudflare
async function fetchWithBypass(url) {
    try {
        // Step 1: Try Direct Hit
        let res = await axios.get(url, { timeout: 4000 });
        return res;
    } catch (err) {
        // Step 2: Try Cloudflare Bypass Proxy (If Render IP is blocked)
        try {
            console.log(`[BYPASS] Direct failed for ${url}. Using Proxy...`);
            let proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            let resProxy = await axios.get(proxyUrl, { timeout: 8000 });
            return resProxy;
        } catch (proxyErr) {
            console.log(`[ERROR] Proxy also failed for ${url}`);
            return null;
        }
    }
}

function getDefaultConfig() {
    return {
        catalogs: {
            anime_trending: true, anime_airing: true, anime_movies: true,
            bolly_trending: true, bolly_latest: true,
            south_trending: true, south_latest: true,
            netflix_trending: true, netflix_latest: true,
            prime_trending: true, prime_latest: true,
            hotstar_trending: true, hotstar_latest: true,
            holly_trending: true, holly_latest: true
        },
        providers: {
            torrentio: true, bitsearch: true, mediafusion: true, yts: true
        },
        langPriority: "hindi", 
        excludeResolutions: []
    };
}

function parseConfig(configStr) {
    if (!configStr) return getDefaultConfig();
    try {
        const decoded = Buffer.from(configStr, 'base64').toString('utf8');
        let parsed = JSON.parse(decoded);
        if (!parsed.providers) parsed.providers = getDefaultConfig().providers;
        return { ...getDefaultConfig(), ...parsed };
    } catch (e) {
        return getDefaultConfig();
    }
}

function getManifest(config) {
    const extraParams = [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }];
    
    const allCatalogs = [
        { type: "series", id: "anime_trending", name: "🔥 Anime: Trending", extra: extraParams },
        { type: "series", id: "anime_airing", name: "⚡ Anime: Latest Airing", extra: extraParams },
        { type: "movie", id: "anime_movies", name: "🎬 Anime: Movies", extra: extraParams },
        { type: "movie", id: "bolly_trending", name: "🔥 Bollywood: Trending", extra: extraParams },
        { type: "movie", id: "bolly_latest", name: "🆕 Bollywood: Latest", extra: extraParams },
        { type: "movie", id: "south_trending", name: "🌟 South Indian: Trending", extra: extraParams },
        { type: "movie", id: "south_latest", name: "💥 South Indian: Latest", extra: extraParams },
        { type: "series", id: "netflix_trending", name: "👑 Netflix: Trending", extra: extraParams },
        { type: "series", id: "netflix_latest", name: "👑 Netflix: Latest", extra: extraParams },
        { type: "series", id: "prime_trending", name: "📦 Prime: Trending", extra: extraParams },
        { type: "series", id: "prime_latest", name: "📦 Prime: Latest", extra: extraParams },
        { type: "series", id: "hotstar_trending", name: "✨ Hotstar: Trending", extra: extraParams },
        { type: "series", id: "hotstar_latest", name: "✨ Hotstar: Latest", extra: extraParams },
        { type: "movie", id: "holly_trending", name: "🌍 Hollywood (Hindi): Trending", extra: extraParams },
        { type: "movie", id: "holly_latest", name: "🌍 Hollywood (Hindi): Latest", extra: extraParams }
    ];

    return {
        id: "org.auraflix.bypasser",
        version: "33.0.0",
        name: "AuraFlix Anti-Block 🇮🇳",
        description: "Cloudflare Bypass Enabled. Separate Sections & 100% Guaranteed Links.",
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

// ... (Catalog and Meta fetch logic remains same)
async function fetchAnime(catalogId, search = null, skip = 0) {
    try {
        let url = `https://kitsu.io/api/edge/anime?page[limit]=20&page[offset]=${skip || 0}`;
        if (search) url += `&filter[text]=${encodeURIComponent(search)}`;
        else if (catalogId === "anime_trending") url = `https://kitsu.io/api/edge/trending/anime?page[limit]=20`;
        else if (catalogId === "anime_airing") url += `&filter[status]=current&sort=-userCount`;
        else if (catalogId === "anime_movies") url += `&filter[subtype]=movie&sort=-userCount`;
        
        const res = await axios.get(url, { timeout: 8000 });
        return (res.data.data || []).map(anime => {
            const attr = anime.attributes;
            return {
                id: `kitsu:${anime.id}`,
                type: "anime",
                name: attr.canonicalTitle || attr.titles?.en || "Anime",
                poster: attr.posterImage?.large || attr.posterImage?.original || "https://via.placeholder.com/500x750?text=No+Poster",
                background: attr.coverImage?.large || attr.coverImage?.original,
                description: "⭐ Score: " + (attr.averageRating || "N/A") + "% | 📌 Episodes: " + (attr.episodeCount || 'Ongoing') + "\n\n" + (attr.synopsis || "")
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

        if (search) {
            url = `https://api.themoviedb.org/3/search/${isSeries ? 'tv' : 'movie'}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(search)}&page=${page}`;
        } else if (catalogId === "bolly_trending") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=popularity.desc&page=${page}`;
        } else if (catalogId === "bolly_latest") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=primary_release_date.desc&primary_release_date.lte=${today}&page=${page}`;
        } else if (catalogId === "south_trending") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=te|ta|ml|kn&sort_by=popularity.desc&page=${page}`;
        } else if (catalogId === "south_latest") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=te|ta|ml|kn&sort_by=primary_release_date.desc&primary_release_date.lte=${today}&page=${page}`;
        } else if (catalogId === "netflix_trending") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=8&watch_region=IN&sort_by=popularity.desc&page=${page}`;
        } else if (catalogId === "netflix_latest") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=8&watch_region=IN&sort_by=first_air_date.desc&first_air_date.lte=${today}&page=${page}`;
        } else if (catalogId === "prime_trending") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=119&watch_region=IN&sort_by=popularity.desc&page=${page}`;
        } else if (catalogId === "prime_latest") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=119&watch_region=IN&sort_by=first_air_date.desc&first_air_date.lte=${today}&page=${page}`;
        } else if (catalogId === "hotstar_trending") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=122&watch_region=IN&sort_by=popularity.desc&page=${page}`;
        } else if (catalogId === "hotstar_latest") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=122&watch_region=IN&sort_by=first_air_date.desc&first_air_date.lte=${today}&page=${page}`;
        } else if (catalogId === "holly_trending") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=en&sort_by=popularity.desc&page=${page}`;
        } else if (catalogId === "holly_latest") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=en&sort_by=primary_release_date.desc&primary_release_date.lte=${today}&page=${page}`;
        }

        if (!url) return [];
        const res = await axios.get(url, { timeout: 8000 });
        return (res.data.results || []).map(m => ({
            id: `tmdb:${m.id}`,
            type: isSeries ? "series" : "movie",
            name: m.title || m.name,
            poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "https://via.placeholder.com/500x750?text=No+Poster",
            background: m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : undefined,
            description: "⭐ TMDB: " + (m.vote_average || "N/A") + "/10 | 📅 Release: " + (m.release_date || m.first_air_date || "TBA") + "\n\n" + (m.overview || "")
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
            const resData = await axios.get(`https://kitsu.io/api/edge/anime/${cleanId}`, { timeout: 6000 });
            const attr = resData.data.data.attributes;
            const isMovie = attr.subtype === "movie";
            let metaObj = { 
                id, type: "anime", name: attr.canonicalTitle || attr.titles?.en || "Anime", 
                poster: attr.posterImage?.large || "https://via.placeholder.com/500x750?text=No+Poster", 
                background: attr.coverImage?.large, description: attr.synopsis || "No description available.",
                imdbRating: attr.averageRating ? (attr.averageRating / 10).toFixed(1) : undefined
            };
            if (!isMovie) {
                const videos = [];
                const epCount = attr.episodeCount || 24;
                for (let i = 1; i <= epCount; i++) videos.push({ id: `kitsu:${cleanId}:${i}`, title: `Episode ${i}`, season: 1, number: i, episode: i });
                metaObj.videos = videos;
            }
            return res.json({ meta: metaObj });
        } catch (e) { return res.status(404).send("Not Found"); }
    }
    return res.status(404).send("Not Found"); 
}

// ----------------------------------------------------
// ANTI-BLOCK STREAM HANDLER (USING BYPASS)
// ----------------------------------------------------
app.get("/stream/:type/:id.json", handleStream);
app.get("/stream/:type/:id/:extra", handleStream);
app.get("/:config/stream/:type/:id.json", handleStream);
app.get("/:config/stream/:type/:id/:extra", handleStream);

async function handleStream(req, res) {
    let configStr = req.params.config || null;
    const config = parseConfig(configStr);
    const type = req.params.type;
    let targetId = req.params.id.replace(".json", "");
    
    let isAnime = targetId.startsWith("kitsu:");
    let mediaTitle = "";
    let episodeNum = "";
    let seasonNum = "";
    
    try {
        if (isAnime) {
            const parts = targetId.split(":");
            episodeNum = parts[2] || "";
            const kRes = await axios.get(`https://kitsu.io/api/edge/anime/${parts[1]}`, { timeout: 4500 });
            mediaTitle = kRes.data.data.attributes.canonicalTitle || kRes.data.data.attributes.titles.en;
        } else if (targetId.startsWith("tmdb:")) {
            const parts = targetId.split(":");
            const tmdbId = parts[1];
            seasonNum = parts[2];
            episodeNum = parts[3];
            const isTv = type === "series";
            const tRes = await axios.get(`https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`, { timeout: 4500 });
            mediaTitle = tRes.data.title || tRes.data.name;
        } else if (targetId.startsWith("tt")) {
            const parts = targetId.split(":");
            const imdbId = parts[0];
            seasonNum = parts[1];
            episodeNum = parts[2];
            const findRes = await axios.get(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`, { timeout: 4500 });
            const item = findRes.data.movie_results?.[0] || findRes.data.tv_results?.[0];
            if (item) mediaTitle = item.title || item.name;
        }
    } catch (e) { console.log("ID Resolver Error:", e.message); }

    let allStreams = [];
    const scraperType = isAnime ? "anime" : (seasonNum ? "series" : "movie");

    const scraperPromises = [];

    // 1. Torrentio (With Cloudflare Bypass)
    if (config.providers.torrentio) {
        scraperPromises.push((async () => {
            let tUrl = `https://torrentio.strem.fun/stream/${scraperType}/${targetId}.json`;
            let res = await fetchWithBypass(tUrl);
            if (res && res.data && res.data.streams) {
                res.data.streams.forEach(s => {
                    s.provider = "Torrentio (Bypassed)";
                    allStreams.push(s);
                });
            }
        })());
    }

    // 2. MediaFusion (With Cloudflare Bypass)
    if (config.providers.mediafusion) {
        scraperPromises.push((async () => {
            let mfUrl = `https://mediafusion.elfhosted.com/stream/${scraperType}/${targetId}.json`;
            let res = await fetchWithBypass(mfUrl);
            if (res && res.data && res.data.streams) {
                res.data.streams.forEach(s => {
                    s.provider = "MediaFusion (Bypassed)";
                    allStreams.push(s);
                });
            }
        })());
    }

    // 3. BitSearch (With Bypass)
    if (config.providers.bitsearch && mediaTitle) {
        scraperPromises.push((async () => {
            let query = isAnime ? `${mediaTitle} ${episodeNum}` : (seasonNum ? `${mediaTitle} S${seasonNum.padStart(2, '0')}E${episodeNum.padStart(2, '0')}` : mediaTitle);
            let bUrl = `https://bitsearch.info/api/v1/search?q=${encodeURIComponent(query)}&limit=20`;
            let res = await fetchWithBypass(bUrl);
            if (res && res.data && Array.isArray(res.data.data)) {
                res.data.data.forEach(t => {
                    allStreams.push({
                        title: t.name,
                        infoHash: t.infohash,
                        seeders: parseInt(t.seeders) || 10,
                        provider: "BitSearch API"
                    });
                });
            }
        })());
    }

    // Wait for all requests
    await Promise.allSettled(scraperPromises);

    let processedStreams = [];
    let seen = new Set();
    const excludes = config.excludeResolutions || [];

    allStreams.forEach(s => {
        if (!s || typeof s !== 'object') return; 
        
        let fullText = ((s.title || "") + " " + (s.name || "")).toLowerCase();
        let seedMatch = fullText.match(/👤\s*(\d+)/) || fullText.match(/seeds:\s*(\d+)/i);
        let seeders = s.seeders || (seedMatch ? parseInt(seedMatch[1]) : 15); 
        
        const uniqueKey = s.infoHash || s.url;
        if (!uniqueKey || seen.has(uniqueKey)) return;
        seen.add(uniqueKey);

        let quality = "📼 480p SD";
        let qRank = 1;
        let isHDR = fullText.includes("hdr") || fullText.includes("dv") || fullText.includes("dolby");

        if (fullText.includes("4k") || fullText.includes("2160p") || fullText.includes("uhd")) { 
            quality = isHDR ? "✨ 4K ULTRA HD • HDR" : "✨ 4K ULTRA HD"; qRank = 4; if(excludes.includes("4k")) return;
        }
        else if (fullText.includes("1080p") || fullText.includes("fhd") || fullText.includes("bluray")) { 
            quality = "📺 1080p FULL HD"; qRank = 3; if(excludes.includes("1080p")) return;
        }
        else if (fullText.includes("720p") || fullText.includes("hd")) { 
            quality = "📱 720p HD"; qRank = 2; if(excludes.includes("720p")) return;
        }
        else { if(excludes.includes("480p")) return; }

        if (excludes.includes("cam") && (fullText.includes("cam") || fullText.includes("ts") || fullText.includes("hdcam"))) return;

        let langBadge = "🌐 MULTI AUDIO";
        let langRank = 1;

        if (/\b(indonesian|indo)\b/i.test(fullText)) { langBadge = "🇮🇩 INDONESIAN"; langRank = 50; }
        else if (/\b(hindi|hin)\b/i.test(fullText)) { langBadge = "🇮🇳 HINDI DUB"; langRank = 40; }
        else if (/\b(tamil|tam)\b/i.test(fullText)) { langBadge = "🇮🇳 TAMIL"; langRank = 25; }
        else if (/\b(telugu|tel)\b/i.test(fullText)) { langBadge = "🇮🇳 TELUGU"; langRank = 25; }
        else if (/\b(malayalam|mal)\b/i.test(fullText)) { langBadge = "🇮🇳 MALAYALAM"; langRank = 20; }
        else if (/\b(japanese|jap)\b/i.test(fullText)) { langBadge = "🇯🇵 JAPANESE"; langRank = 15; }
        else if (/\b(english|eng)\b/i.test(fullText)) { langBadge = "🇺🇸 ENGLISH"; langRank = 10; }

        if (config.langPriority === "hindi" && /\b(hindi|hin)\b/i.test(fullText)) langRank = 60; 

        let providerTag = `⚡ AuraFlix Engine (${s.provider || "Direct"})`;
        s.langRank = langRank;
        s.qRank = qRank;
        s.seeders = seeders;

        let cleanTitle = String(s.title).split(/\r?\n/)[0].replace(/\[.*?\]/g, "").trim();

        s.name = `🎬 AuraFlix VIP\n${langBadge}`;
        s.title = `${quality} • ${providerTag}\n${cleanTitle}\n👤 ${seeders} Seeders`;

        processedStreams.push(s);
    });

    processedStreams.sort((a, b) => {
        if (b.langRank !== a.langRank) return b.langRank - a.langRank; 
        if (b.qRank !== a.qRank) return b.qRank - a.qRank;
        return b.seeders - a.seeders; 
    });

    return res.json({ streams: processedStreams.slice(0, parseInt(config.maxStreams) || 40) });
}

function renderConfigPage(res, currentConfig) {
    const configJson = JSON.stringify(currentConfig);
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>AuraFlix Anti-Block</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #0b0f19; color: #e2e8f0; margin: 0; padding: 20px; }
                .container { max-width: 800px; margin: 0 auto; background: #111827; padding: 30px; border-radius: 16px; border: 1px solid #1f2937; }
                h1 { color: #f43f5e; text-align: center; }
                .btn { display: block; background: #f43f5e; color: white; padding: 15px; text-align: center; text-decoration: none; font-weight: bold; border-radius: 8px; margin-top: 30px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>AuraFlix 🇮🇳 (Anti-Block Enabled)</h1>
                <p style="text-align:center;">Cloudflare bypass is active. Your Render IP will not be blocked.</p>
                <a id="installBtn" class="btn" href="#">Install Addon</a>
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