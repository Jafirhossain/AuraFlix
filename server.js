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
            anime_trending: true, anime_airing: true, anime_movies: true,
            bolly_trending: true, bolly_latest: true,
            south_trending: true, south_latest: true,
            netflix_trending: true, netflix_latest: true,
            prime_trending: true, prime_latest: true,
            hotstar_trending: true, hotstar_latest: true,
            sonyliv_trending: true, zee5_trending: true,
            holly_trending: true, holly_latest: true
        },
        providers: {
            torrentio: true, bitsearch: true, nyaa: true, yts: true,
            mediafusion: true, hdhub: true, desiflix: true, tamilmv: true, tamilblasters: true
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
        { type: "movie", id: "bolly_latest", name: "🆕 Bollywood: Latest Releases", extra: extraParams },
        { type: "movie", id: "south_trending", name: "🌟 South Indian: Trending", extra: extraParams },
        { type: "movie", id: "south_latest", name: "💥 South Indian: Latest Releases", extra: extraParams },
        { type: "series", id: "netflix_trending", name: "👑 Netflix: Trending", extra: extraParams },
        { type: "series", id: "netflix_latest", name: "👑 Netflix: Latest", extra: extraParams },
        { type: "series", id: "prime_trending", name: "📦 Amazon Prime: Trending", extra: extraParams },
        { type: "series", id: "prime_latest", name: "📦 Amazon Prime: Latest", extra: extraParams },
        { type: "series", id: "hotstar_trending", name: "✨ Disney+ Hotstar: Trending", extra: extraParams },
        { type: "series", id: "hotstar_latest", name: "✨ Disney+ Hotstar: Latest", extra: extraParams },
        { type: "series", id: "sonyliv_trending", name: "🍿 SonyLIV: Trending", extra: extraParams },
        { type: "series", id: "zee5_trending", name: "🍿 Zee5: Trending", extra: extraParams },
        { type: "movie", id: "holly_trending", name: "🌍 Hollywood (Hindi): Trending", extra: extraParams },
        { type: "movie", id: "holly_latest", name: "🌍 Hollywood (Hindi): Latest", extra: extraParams }
    ];

    return {
        id: "org.auraflix.pro",
        version: "29.0.0",
        name: "AuraFlix PRO 🇮🇳",
        description: "Professional Engine: Fully Separated Platform Catalogs + Ultimate Universal Link Scraper.",
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
        let isSeries = catalogId.includes("series") || catalogId.includes("netflix") || catalogId.includes("prime") || catalogId.includes("hotstar") || catalogId.includes("sonyliv") || catalogId.includes("zee5");
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
        } else if (catalogId === "sonyliv_trending") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=237&watch_region=IN&sort_by=popularity.desc&page=${page}`;
        } else if (catalogId === "zee5_trending") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_watch_providers=232&watch_region=IN&sort_by=popularity.desc&page=${page}`;
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
            description: "⭐ TMDB: " + (m.vote_average || "N/A") + "/10 | 📅 " + (m.release_date || m.first_air_date || "TBA") + "\n\n" + (m.overview || "")
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
            
            const tRes = await axios.get(`https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`, { timeout: 4500 });
            mediaTitle = tRes.data.title || tRes.data.name;
            const imdbId = tRes.data.external_ids?.imdb_id || tRes.data.imdb_id;
            
            if (imdbId) targetId = (seasonNum && episodeNum) ? `${imdbId}:${seasonNum}:${episodeNum}` : imdbId;
        } else if (targetId.startsWith("tt")) {
            const parts = targetId.split(":");
            targetId = parts[0]; 
            if(parts.length > 1) {
                seasonNum = parts[1];
                episodeNum = parts[2];
                targetId = `${parts[0]}:${parts[1]}:${parts[2]}`;
            }
        }
    } catch (e) { }

    let allStreams = [];
    const scraperType = isAnime ? "anime" : (seasonNum ? "series" : "movie");

    // 1. PRIMARY FETCH: Torrentio & MediaFusion
    const providersList = [
        `https://torrentio.strem.fun/stream/${scraperType}/${targetId}.json`,
        `https://mediafusion.elfhosted.com/stream/${scraperType}/${targetId}.json`
    ];

    await Promise.allSettled(providersList.map(async (providerUrl) => {
        try {
            let r = await axios.get(providerUrl, { timeout: 6000 }); 
            if (r.data && r.data.streams && Array.isArray(r.data.streams)) {
                const validStreams = r.data.streams.filter(s => s.url || s.infoHash);
                allStreams.push(...validStreams);
            }
        } catch(e) { }
    }));

    // 2. BULLETPROOF BACKUP: If primary fails, query BitSearch directly using media title!
    if (allStreams.length === 0 && mediaTitle) {
        let searchQuery = isAnime ? `${mediaTitle} ${episodeNum}` : (seasonNum ? `${mediaTitle} S${seasonNum.padStart(2, '0')}E${episodeNum.padStart(2, '0')}` : mediaTitle);
        
        try {
            let bitRes = await axios.get(`https://bitsearch.info/api/v1/search?q=${encodeURIComponent(searchQuery)}&limit=30`, { headers: SCRAPER_HEADERS, timeout: 5000 });
            if (bitRes.data && bitRes.data.data && Array.isArray(bitRes.data.data)) {
                bitRes.data.data.forEach(t => {
                    allStreams.push({ 
                        title: t.name, 
                        infoHash: t.infohash, 
                        seeders: parseInt(t.seeders) || 15, 
                        isNative: true, 
                        provider: "BitSearch" 
                    });
                });
            }
        } catch(e) {}
    }

    // 3. ANIME BACKUP: Nyaa RSS
    if (isAnime && allStreams.length === 0 && mediaTitle) {
        try {
            let nyaaRes = await axios.get(`https://nyaa.si/?page=rss&q=${encodeURIComponent(mediaTitle + " " + episodeNum)}&c=0_0&f=0`, { timeout: 4000 });
            const items = nyaaRes.data.match(/<item>([\s\S]*?)<\/item>/g) || [];
            items.forEach(item => {
                const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
                const hashMatch = item.match(/<nyaa:infoHash>(.*?)<\/nyaa:infoHash>/);
                const seedsMatch = item.match(/<nyaa:seeders>(.*?)<\/nyaa:seeders>/);
                if (titleMatch && hashMatch) {
                    allStreams.push({ 
                        title: titleMatch[1], 
                        infoHash: hashMatch[1], 
                        seeders: parseInt(seedsMatch ? seedsMatch[1] : 25), 
                        isNative: true, 
                        provider: "Nyaa" 
                    });
                }
            });
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

        // PROFESSIONAL MULTI-LANGUAGE FLAGS DETECTOR
        let langBadge = "🌐 MULTI AUDIO";
        let langRank = 1;

        if (/\b(hindi|hin)\b/i.test(fullText)) { langBadge = "🇮🇳 HINDI DUB"; langRank = 40; }
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
        if (fullText.includes("mediafusion") || rawName.includes("mediafusion")) providerTag = "🔥 MEDIAFUSION";
        if (s.isNative) providerTag = `⚡ ${s.provider.toUpperCase()} (Scraper)`;
        
        let modeTag = isDirect ? "⚡ DIRECT LINK" : providerTag;
        if (fullText.includes("pixeldrain")) modeTag = "⚡ PIXELDRAIN DIRECT";
        if (fullText.includes("mega")) modeTag = "⚡ MEGA DIRECT";

        s.langRank = langRank;
        s.qRank = qRank;
        s.seeders = seeders;

        let rawTitleStr = String(s.title || "Play Now");
        let cleanTitle = rawTitleStr.split(/\r?\n/)[0].replace(/\b(Torrentio|Debrid|MediaFusion)\b/ig, 'AuraFlix');

        s.name = `🎬 AuraFlix VIP\n${langBadge}`;
        s.title = `${quality} • ${modeTag}\n${cleanTitle}\n👤 ${seeders} Seeders`;

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
            <title>AuraFlix PRO Settings</title>
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
                    <h1>AuraFlix PRO 🇮🇳</h1>
                    <p class="desc">Professional Multi-Platform Engine & Universal Scraper.</p>
                </div>
                
                <div class="section">
                    <div class="section-title">🔍 Select Streaming Providers</div>
                    <div class="provider-split">
                        <div class="provider-box">
                            <h3 style="color:#38bdf8;">🚀 Torrent Providers (P2P)</h3>
                            <label><input type="checkbox" id="prov_torrentio"> Torrentio (1337x, PirateBay)</label>
                            <label><input type="checkbox" id="prov_bitsearch"> BitSearch Engine (Backup)</label>
                            <label><input type="checkbox" id="prov_nyaa"> Nyaa.si (Anime Torrents)</label>
                            <label><input type="checkbox" id="prov_yts"> YTS (Movies Torrents)</label>
                        </div>
                        <div class="provider-box">
                            <h3 style="color:#a3e635;">⚡ Direct Web Streaming</h3>
                            <label><input type="checkbox" id="prov_hdhub"> HDHub (Direct WebRips)</label>
                            <label><input type="checkbox" id="prov_desiflix"> DesiFlix (Indian Series)</label>
                            <label><input type="checkbox" id="prov_tamilmv"> TamilMV (South Direct)</label>
                            <label><input type="checkbox" id="prov_tamilblasters"> TamilBlasters (Regional)</label>
                            <label><input type="checkbox" id="prov_mediafusion"> MediaFusion (Mega/Pixeldrain)</label>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">📺 Professional Separated Catalogs</div>
                    <div class="grid-2">
                        <label><input type="checkbox" id="cat_anime_trending"> 🔥 Anime: Trending</label>
                        <label><input type="checkbox" id="cat_anime_airing"> ⚡ Anime: Latest Airing</label>
                        <label><input type="checkbox" id="cat_anime_movies"> 🎬 Anime: Movies</label>
                        
                        <label><input type="checkbox" id="cat_bolly_trending"> 🔥 Bollywood: Trending</label>
                        <label><input type="checkbox" id="cat_bolly_latest"> 🆕 Bollywood: Latest</label>
                        
                        <label><input type="checkbox" id="cat_south_trending"> 🌟 South Indian: Trending</label>
                        <label><input type="checkbox" id="cat_south_latest"> 💥 South Indian: Latest</label>
                        
                        <label><input type="checkbox" id="cat_netflix_trending"> 👑 Netflix: Trending</label>
                        <label><input type="checkbox" id="cat_netflix_latest"> 👑 Netflix: Latest</label>
                        
                        <label><input type="checkbox" id="cat_prime_trending"> 📦 Amazon Prime: Trending</label>
                        <label><input type="checkbox" id="cat_prime_latest"> 📦 Amazon Prime: Latest</label>
                        
                        <label><input type="checkbox" id="cat_hotstar_trending"> ✨ Disney+ Hotstar: Trending</label>
                        <label><input type="checkbox" id="cat_hotstar_latest"> ✨ Disney+ Hotstar: Latest</label>
                        
                        <label><input type="checkbox" id="cat_sonyliv_trending"> 🍿 SonyLIV: Trending</label>
                        <label><input type="checkbox" id="cat_zee5_trending"> 🍿 Zee5: Trending</label>
                        
                        <label><input type="checkbox" id="cat_holly_trending"> 🌍 Hollywood (Hindi): Trending</label>
                        <label><input type="checkbox" id="cat_holly_latest"> 🌍 Hollywood (Hindi): Latest</label>
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

                <a id="installBtn" class="btn" href="#">Install AuraFlix PRO</a>
            </div>

            <script>
                const initialConfig = ` + configJson + `;
                
                ['torrentio', 'bitsearch', 'nyaa', 'yts', 'mediafusion', 'hdhub', 'desiflix', 'tamilmv', 'tamilblasters'].forEach(id => {
                    if(document.getElementById('prov_' + id)) {
                        document.getElementById('prov_' + id).checked = initialConfig.providers[id] !== false;
                    }
                });

                ['anime_trending', 'anime_airing', 'anime_movies', 'bolly_trending', 'bolly_latest', 'south_trending', 'south_latest', 'netflix_trending', 'netflix_latest', 'prime_trending', 'prime_latest', 'hotstar_trending', 'hotstar_latest', 'sonyliv_trending', 'zee5_trending', 'holly_trending', 'holly_latest'].forEach(id => {
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
                    ['anime_trending', 'anime_airing', 'anime_movies', 'bolly_trending', 'bolly_latest', 'south_trending', 'south_latest', 'netflix_trending', 'netflix_latest', 'prime_trending', 'prime_latest', 'hotstar_trending', 'hotstar_latest', 'sonyliv_trending', 'zee5_trending', 'holly_trending', 'holly_latest'].forEach(id => {
                        if(document.getElementById('cat_' + id)) catObj[id] = document.getElementById('cat_' + id).checked;
                    });

                    let provObj = {};
                    ['torrentio', 'bitsearch', 'nyaa', 'yts', 'mediafusion', 'hdhub', 'desiflix', 'tamilmv', 'tamilblasters'].forEach(id => {
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