const express = require("express");
const axios = require("axios");

const TMDB_API_KEY = "15d2ea6d0dc1d476efbca3eba2b9bbfb"; 

const SCRAPER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*"
};

function getDefaultConfig() {
    return {
        catalogs: {
            indo_horror_trending: true, indo_horror_latest: true,
            global_horror: true,
            anime_trending: true, anime_airing: true, anime_movies: true,
            bolly_trending: true, bolly_latest: true,
            south_trending: true, south_latest: true,
            netflix_trending: true, prime_trending: true,
            hotstar_trending: true, holly_trending: true
        },
        providers: {
            bitsearch: true, nyaa: true, yts: true, mediafusion: true
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
    
    // INDEPENDENT PROFESSIONAL CATALOGS WITH INDONESIAN HORROR VAULT
    const allCatalogs = [
        // 🇮🇩 INDONESIAN HORROR VAULT
        { type: "movie", id: "indo_horror_trending", name: "👻 Indonesian Horror: Trending", extra: extraParams },
        { type: "movie", id: "indo_horror_latest", name: "👻 Indonesian Horror: Latest & Upcoming", extra: extraParams },

        // 💀 GLOBAL HORROR
        { type: "movie", id: "global_horror", name: "💀 World Horror Masterpieces", extra: extraParams },

        // ⚡ ANIME
        { type: "series", id: "anime_trending", name: "🔥 Anime: Trending", extra: extraParams },
        { type: "series", id: "anime_airing", name: "⚡ Anime: Latest Airing", extra: extraParams },
        { type: "movie", id: "anime_movies", name: "🎬 Anime: Movies", extra: extraParams },

        // 🇮🇳 BOLLYWOOD & SOUTH
        { type: "movie", id: "bolly_trending", name: "🔥 Bollywood: Trending", extra: extraParams },
        { type: "movie", id: "bolly_latest", name: "🆕 Bollywood: Latest", extra: extraParams },
        { type: "movie", id: "south_trending", name: "🌟 South Indian: Trending", extra: extraParams },
        { type: "movie", id: "south_latest", name: "💥 South Indian: Latest", extra: extraParams },

        // 👑 OTT PLATFORMS
        { type: "series", id: "netflix_trending", name: "👑 Netflix: Trending", extra: extraParams },
        { type: "series", id: "prime_trending", name: "📦 Amazon Prime: Trending", extra: extraParams },
        { type: "series", id: "hotstar_trending", name: "✨ Disney+ Hotstar: Trending", extra: extraParams },

        // 🌍 HOLLYWOOD
        { type: "movie", id: "holly_trending", name: "🌍 Hollywood (Hindi): Trending", extra: extraParams }
    ];

    return {
        id: "org.auraflix.independent",
        version: "30.0.0",
        name: "AuraFlix Independent 🇮🇳",
        description: "Self-Hosted Independent Engine with Indonesian Horror Vault & Direct Multi-Source Scraper.",
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
        } else if (catalogId === "indo_horror_trending") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27&with_origin_country=ID&sort_by=popularity.desc&page=${page}`;
        } else if (catalogId === "indo_horror_latest") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27&with_origin_country=ID&sort_by=primary_release_date.desc&primary_release_date.lte=${today}&page=${page}`;
        } else if (catalogId === "global_horror") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27&sort_by=vote_average.desc&vote_count.gte=500&page=${page}`;
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
        } else if (catalogId === "prime_trending") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=119&watch_region=IN&sort_by=popularity.desc&page=${page}`;
        } else if (catalogId === "hotstar_trending") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=122&watch_region=IN&sort_by=popularity.desc&page=${page}`;
        } else if (catalogId === "holly_trending") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=en&sort_by=popularity.desc&page=${page}`;
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
    let skip = 0;
    let search = null;

    if (extra) {
        let parsed = extra.replace('.json', '');
        let parts = parsed.split('&');
        parts.forEach(p => {
            let [k, v] = p.split('=');
            if (k === 'skip') skip = parseInt(v) || 0;
            if (k === 'search') search = decodeURIComponent(v);
        });
    }

    let metas = [];
    if (id.startsWith("anime")) metas = await fetchAnime(id, search, skip);
    else metas = await fetchOTTContent(id, search, skip);
    
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
// INDEPENDENT DIRECT SCRAPER ENGINE (NO DEPENDENCY)
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
    let releaseYear = "";
    
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
            releaseYear = (tRes.data.release_date || tRes.data.first_air_date || "").substring(0, 4);
        } else if (targetId.startsWith("tt")) {
            const parts = targetId.split(":");
            const imdbId = parts[0];
            seasonNum = parts[1];
            episodeNum = parts[2];
            
            const findRes = await axios.get(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`, { timeout: 4500 });
            const movieObj = findRes.data.movie_results?.[0];
            const tvObj = findRes.data.tv_results?.[0];
            const item = movieObj || tvObj;
            if (item) {
                mediaTitle = item.title || item.name;
                releaseYear = (item.release_date || item.first_air_date || "").substring(0, 4);
            }
        }
    } catch (e) { 
        console.log("Resolution error:", e.message);
    }

    let allStreams = [];
    
    let cleanQuery = mediaTitle;
    if (releaseYear) cleanQuery += ` ${releaseYear}`;
    if (seasonNum && episodeNum) {
        cleanQuery += ` S${seasonNum.padStart(2, '0')}E${episodeNum.padStart(2, '0')}`;
    }

    const queriesToRun = [
        cleanQuery,
        mediaTitle + (seasonNum ? ` S${seasonNum}` : "")
    ];

    // INDEPENDENT SCRAPER 1: BitSearch Direct API Scraper
    if (config.providers.bitsearch && cleanQuery) {
        for (let q of queriesToRun) {
            try {
                let bitRes = await axios.get(`https://bitsearch.info/api/v1/search?q=${encodeURIComponent(q)}&sort=seeders&limit=30`, { headers: SCRAPER_HEADERS, timeout: 5000 });
                if (bitRes.data && bitRes.data.data && Array.isArray(bitRes.data.data)) {
                    bitRes.data.data.forEach(t => {
                        allStreams.push({
                            title: t.name,
                            infoHash: t.infohash,
                            seeders: parseInt(t.seeders) || 10,
                            size: t.size,
                            isNative: true,
                            provider: "BitSearch"
                        });
                    });
                }
            } catch(e) {}
            if (allStreams.length > 15) break;
        }
    }

    // INDEPENDENT SCRAPER 2: YTS API for Movies
    if (config.providers.yts && !isAnime && mediaTitle && type === "movie") {
        try {
            let ytsRes = await axios.get(`https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(mediaTitle)}`, { timeout: 4000 });
            if (ytsRes.data && ytsRes.data.data && ytsRes.data.data.movies) {
                ytsRes.data.data.movies.forEach(m => {
                    if (m.torrents && Array.isArray(m.torrents)) {
                        m.torrents.forEach(t => {
                            allStreams.push({
                                title: `${m.title} [${t.quality}] [${t.type}] • ${t.size}`,
                                infoHash: t.hash,
                                seeders: t.seeds || 25,
                                isNative: true,
                                provider: "YTS"
                            });
                        });
                    }
                });
            }
        } catch(e) {}
    }

    // INDEPENDENT SCRAPER 3: Nyaa.si RSS for Anime
    if (config.providers.nyaa && isAnime && mediaTitle) {
        try {
            let animeQuery = mediaTitle + (episodeNum ? ` ${episodeNum}` : "");
            let nyaaRes = await axios.get(`https://nyaa.si/?page=rss&q=${encodeURIComponent(animeQuery)}&c=0_0&f=0`, { timeout: 4000 });
            const items = nyaaRes.data.match(/<item>([\s\S]*?)<\/item>/g) || [];
            items.forEach(item => {
                const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
                const hashMatch = item.match(/<nyaa:infoHash>(.*?)<\/nyaa:infoHash>/);
                const seedsMatch = item.match(/<nyaa:seeders>(.*?)<\/nyaa:seeders>/);
                if (titleMatch && hashMatch) {
                    allStreams.push({
                        title: titleMatch[1],
                        infoHash: hashMatch[1],
                        seeders: parseInt(seedsMatch ? seedsMatch[1] : 20),
                        isNative: true,
                        provider: "Nyaa"
                    });
                }
            });
        } catch(e) {}
    }

    // INDEPENDENT SCRAPER 4: MediaFusion Public Direct Instance (As fallback)
    if (config.providers.mediafusion) {
        try {
            let mfRes = await axios.get(`https://mediafusion.elfhosted.com/stream/${isAnime ? "anime" : type}/${targetId}.json`, { timeout: 5000 });
            if (mfRes.data && mfRes.data.streams && Array.isArray(mfRes.data.streams)) {
                mfRes.data.streams.forEach(s => {
                    if (s.url || s.infoHash) allStreams.push(s);
                });
            }
        } catch(e) {}
    }

    let processedStreams = [];
    let seen = new Set();
    const excludes = config.excludeResolutions || [];

    allStreams.forEach(s => {
        if (!s || typeof s !== 'object') return; 
        
        let rawTitle = (s.title || "").toLowerCase();
        let rawName = (s.name || "").toLowerCase();
        let fullText = rawTitle + " " + rawName + " " + (s.description || "").toLowerCase();

        let seedMatch = rawTitle.match(/👤\s*(\d+)/) || rawTitle.match(/seeds:\s*(\d+)/i);
        let seeders = s.seeders || (seedMatch ? parseInt(seedMatch[1]) : 15); 
        
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

        // MULTI-LANGUAGE FLAGS & COUNTRY DETECTION (🇮🇩 INDONESIAN, 🇮🇳 HINDI, etc.)
        let langBadge = "🌐 MULTI AUDIO";
        let langRank = 1;

        if (/\b(indonesian|indo)\b/i.test(fullText)) { langBadge = "🇮🇩 INDONESIAN"; langRank = 50; }
        else if (/\b(hindi|hin)\b/i.test(fullText)) { langBadge = "🇮🇳 HINDI DUB"; langRank = 40; }
        else if (/\b(tamil|tam)\b/i.test(fullText)) { langBadge = "🇮🇳 TAMIL"; langRank = 25; }
        else if (/\b(telugu|tel)\b/i.test(fullText)) { langBadge = "🇮🇳 TELUGU"; langRank = 25; }
        else if (/\b(malayalam|mal)\b/i.test(fullText)) { langBadge = "🇮🇳 MALAYALAM"; langRank = 20; }
        else if (/\b(kannada|kan)\b/i.test(fullText)) { langBadge = "🇮🇳 KANNADA"; langRank = 20; }
        else if (/\b(japanese|jap)\b/i.test(fullText)) { langBadge = "🇯🇵 JAPANESE"; langRank = 15; }
        else if (/\b(english|eng)\b/i.test(fullText)) { langBadge = "🇺🇸 ENGLISH"; langRank = 10; }
        else if (/\b(korean|kor)\b/i.test(fullText)) { langBadge = "🇰🇷 KOREAN"; langRank = 10; }

        if (config.langPriority === "hindi" && /\b(hindi|hin)\b/i.test(fullText)) {
            langRank = 60; 
        }

        let providerTag = "🚀 P2P STREAM";
        if (s.isNative) providerTag = `⚡ ${s.provider.toUpperCase()} (Scraper)`;
        if (isDirect) providerTag = "⚡ DIRECT WEB LINK";

        s.langRank = langRank;
        s.qRank = qRank;
        s.seeders = seeders;

        let rawTitleStr = String(s.title || "Play Now");
        let cleanTitle = rawTitleStr.split(/\r?\n/)[0];

        s.name = `🎬 AuraFlix Independent\n${langBadge}`;
        s.title = `${quality} • ${providerTag}\n${cleanTitle}\n👤 ${seeders} Seeders`;

        processedStreams.push(s);
    });

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
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AuraFlix Independent Settings</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: #0b0f19; color: #e2e8f0; margin: 0; padding: 20px; }
                .container { max-width: 800px; margin: 0 auto; background: #111827; padding: 30px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #1f2937; }
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
                @media (max-width: 600px) { .provider-split { grid-template-columns: 1fr; } }
                label { font-size: 14px; cursor: pointer; display: flex; align-items: center; color: #cbd5e1; margin-bottom: 8px; }
                input[type="checkbox"] { width: 18px; height: 18px; margin-right: 10px; accent-color: #f43f5e; cursor: pointer; }
                select, input[type="text"] { width: 100%; padding: 12px; background: #0f172a; color: #f8fafc; border: 1px solid #334155; border-radius: 8px; margin-top: 8px; font-size: 14px; box-sizing: border-box; outline: none; transition: border 0.2s; }
                select:focus, input[type="text"]:focus { border-color: #f43f5e; }
                .btn { display: block; width: 100%; background: #f43f5e; color: white; padding: 16px; text-align: center; text-decoration: none; font-size: 18px; font-weight: bold; border-radius: 8px; margin-top: 30px; transition: background 0.3s; border: none; cursor: pointer; }
                .btn:hover { background: #e11d48; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="https://raw.githubusercontent.com/Jafirhossain/AuraFlix/main/logo.png" alt="AuraFlix Logo" class="logo" onerror="this.style.display='none'">
                    <h1>AuraFlix Independent 🇮🇳</h1>
                    <p class="desc">Self-Hosted Engine with Indonesian Horror Vault & Multi-Source Scraper.</p>
                </div>
                
                <div class="section">
                    <div class="section-title">🔍 Independent Scraper Engines</div>
                    <div class="provider-split">
                        <div class="provider-box">
                            <h3 style="color:#38bdf8;">🚀 P2P & Torrent Scrapers</h3>
                            <label><input type="checkbox" id="prov_bitsearch"> BitSearch Direct API Scraper</label>
                            <label><input type="checkbox" id="prov_nyaa"> Nyaa.si Anime RSS Scraper</label>
                            <label><input type="checkbox" id="prov_yts"> YTS Movie API Scraper</label>
                        </div>
                        <div class="provider-box">
                            <h3 style="color:#a3e635;">⚡ Web Stream Engines</h3>
                            <label><input type="checkbox" id="prov_mediafusion"> MediaFusion Direct Fallback</label>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">📺 Professional Catalogs (Includes Indonesian Horror Vault)</div>
                    <div class="grid-2">
                        <label><input type="checkbox" id="cat_indo_horror_trending"> 👻 Indonesian Horror: Trending</label>
                        <label><input type="checkbox" id="cat_indo_horror_latest"> 👻 Indonesian Horror: Latest</label>
                        <label><input type="checkbox" id="cat_global_horror"> 💀 World Horror Masterpieces</label>
                        
                        <label><input type="checkbox" id="cat_anime_trending"> 🔥 Anime: Trending</label>
                        <label><input type="checkbox" id="cat_anime_airing"> ⚡ Anime: Latest Airing</label>
                        <label><input type="checkbox" id="cat_anime_movies"> 🎬 Anime: Movies</label>
                        
                        <label><input type="checkbox" id="cat_bolly_trending"> 🔥 Bollywood: Trending</label>
                        <label><input type="checkbox" id="cat_bolly_latest"> 🆕 Bollywood: Latest</label>
                        
                        <label><input type="checkbox" id="cat_south_trending"> 🌟 South Indian: Trending</label>
                        <label><input type="checkbox" id="cat_south_latest"> 💥 South Indian: Latest</label>
                        
                        <label><input type="checkbox" id="cat_netflix_trending"> 👑 Netflix: Trending</label>
                        <label><input type="checkbox" id="cat_prime_trending"> 📦 Amazon Prime: Trending</label>
                        <label><input type="checkbox" id="cat_hotstar_trending"> ✨ Disney+ Hotstar: Trending</label>
                        <label><input type="checkbox" id="cat_holly_trending"> 🌍 Hollywood (Hindi)</label>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">🚫 Exclude Resolutions</div>
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

                <a id="installBtn" class="btn" href="#">Install AuraFlix Independent</a>
            </div>

            <script>
                const initialConfig = ` + configJson + `;
                
                ['bitsearch', 'nyaa', 'yts', 'mediafusion'].forEach(id => {
                    if(document.getElementById('prov_' + id)) {
                        document.getElementById('prov_' + id).checked = initialConfig.providers[id] !== false;
                    }
                });

                ['indo_horror_trending', 'indo_horror_latest', 'global_horror', 'anime_trending', 'anime_airing', 'anime_movies', 'bolly_trending', 'bolly_latest', 'south_trending', 'south_latest', 'netflix_trending', 'prime_trending', 'hotstar_trending', 'holly_trending'].forEach(id => {
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

                function updateUrl() {
                    let catObj = {};
                    ['indo_horror_trending', 'indo_horror_latest', 'global_horror', 'anime_trending', 'anime_airing', 'anime_movies', 'bolly_trending', 'bolly_latest', 'south_trending', 'south_latest', 'netflix_trending', 'prime_trending', 'hotstar_trending', 'holly_trending'].forEach(id => {
                        if(document.getElementById('cat_' + id)) catObj[id] = document.getElementById('cat_' + id).checked;
                    });

                    let provObj = {};
                    ['bitsearch', 'nyaa', 'yts', 'mediafusion'].forEach(id => {
                        if(document.getElementById('prov_' + id)) provObj[id] = document.getElementById('prov_' + id).checked;
                    });

                    let exc = [];
                    if(document.getElementById('ex_4k').checked) exc.push('4k');
                    if(document.getElementById('ex_1080p').checked) exc.push('1080p');
                    if(document.getElementById('ex_720p').checked) exc.push('720p');
                    if(document.getElementById('ex_480p').checked) exc.push('480p');
                    if(document.getElementById('ex_cam').checked) exc.push('cam'); 

                    const config = {
                        catalogs: catObj,
                        providers: provObj,
                        langPriority: document.getElementById('langPriority').value,
                        debridProvider: "none",
                        debridToken: "",
                        excludeResolutions: exc
                    };

                    const b64 = btoa(JSON.stringify(config));
                    document.getElementById('installBtn').href = 'stremio://' + window.location.host + '/' + b64 + '/manifest.json';
                }

                document.querySelectorAll('input, select').forEach(el => el.addEventListener('change', updateUrl));
                updateUrl();
            </script>
        </body>
        </html>
    `;
    res.send(html);
}

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log("Server running on port " + PORT));