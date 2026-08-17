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
    if (!configStr) return getDefaultConfig();
    try {
        const decoded = Buffer.from(configStr, 'base64').toString('utf8');
        return { ...getDefaultConfig(), ...JSON.parse(decoded) };
    } catch (e) {
        return getDefaultConfig();
    }
}

// ----------------------------------------------------
// 2. DYNAMIC MANIFEST (All OTTs & Crunchyroll)
// ----------------------------------------------------
function getManifest(config) {
    const allCatalogs = [
        // CRUNCHYROLL & JAPAN ANIME
        { type: "anime", id: "anime_airing", name: "⚡ Crunchyroll Airing Anime", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "anime", id: "anime_trending", name: "🔥 Trending Anime (Dub/Sub)", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "anime", id: "anime_movies", name: "🎬 Anime Movies & OVAs", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "anime", id: "anime_popular", name: "🏆 All-Time Masterpieces", extra: [{ name: "search" }, { name: "skip" }] },
        
        // SOUTH MOVIES (Hindi Dubbed)
        { type: "movie", id: "south_trending", name: "💥 Trending South Movies (Hindi Dub)", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "south_new_releases", name: "🆕 New South Releases (Just Released)", extra: [{ name: "search" }, { name: "genre", options: ["Action", "Thriller", "Drama", "Crime", "Comedy", "Horror"] }, { name: "skip" }] },
        
        // INDIAN OTT HUBS
        { type: "series", id: "hindi_webseries", name: "🇮🇳 All Hindi Web Series", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "netflix_prime", name: "👑 Netflix & Prime Hub (Hindi)", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "series", id: "hotstar_sonyliv", name: "🔥 JioHotstar, SonyLIV & Zee5", extra: [{ name: "search" }, { name: "skip" }] },
        
        // BOLLYWOOD & HOLLYWOOD
        { type: "movie", id: "bollywood_hub", name: "🍿 Bollywood Blockbusters", extra: [{ name: "search" }, { name: "skip" }] },
        { type: "movie", id: "hollywood_hindi", name: "🎬 Hollywood Hindi Dubbed", extra: [{ name: "search" }, { name: "skip" }] }
    ];

    const enabledCatalogs = allCatalogs.filter(cat => config.catalogs[cat.id] !== false);

    return {
        id: "org.auraflix.pro.hub",
        version: "14.0.0",
        name: "AuraFlix PRO 🇮🇳",
        description: "Zero Buffering Engine! Full Indian OTTs (Netflix, Prime, Hotstar, South Hindi, Crunchyroll) with Custom Filters & High-Speed P2P/Debrid.",
        logo: "https://raw.githubusercontent.com/Jafirhossain/auraflix-hub/main/logo.png",
        background: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1920&auto=format&fit=crop",
        resources: ["catalog", "meta", "stream"],
        types: ["movie", "series", "anime"],
        idPrefixes: ["kitsu", "anilist", "tt", "tmdb"],
        behaviorHints: { configurable: true, configurationRequired: false },
        catalogs: enabledCatalogs
    };
}

// ----------------------------------------------------
// 3. ZERO-BLANK CATALOG FETCHERS
// ----------------------------------------------------
async function fetchAnime(type, search = null, genre = null, skip = 0) {
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
                background: attr.coverImage?.large || attr.coverImage?.original,
                description: `⭐ Score: ${attr.averageRating || "N/A"}% | 📌 Ep: ${attr.episodeCount || 'Ongoing'}\n\n${attr.synopsis}`
            };
        });
    } catch (e) { return []; }
}

async function fetchOTTContent(type, genre = null, search = null, skip = 0) {
    try {
        const page = Math.floor((skip || 0) / 20) + 1;
        let isSeries = type === "hindi_webseries" || type === "netflix_prime" || type === "hotstar_sonyliv";
        let url = "";
        const today = new Date().toISOString().split('T')[0];

        if (search) {
            url = `https://api.themoviedb.org/3/search/${isSeries ? 'tv' : 'movie'}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(search)}&include_adult=false&page=${page}`;
        } else if (type === "south_trending") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=te|ta|kn|ml&sort_by=popularity.desc&vote_count.gte=5&page=${page}`;
        } else if (type === "south_new_releases") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=te|ta|kn|ml&sort_by=primary_release_date.desc&vote_count.gte=5&page=${page}`;
        } else if (type === "hindi_webseries") {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=popularity.desc&page=${page}`;
        } else if (type === "netflix_prime") {
            // Highly robust Hindi & International Web Series Hub
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_networks=213|1024|2552&sort_by=popularity.desc&page=${page}`;
        } else if (type === "hotstar_sonyliv") {
            // Hotstar/SonyLIV/Zee5 Top Rated Indian Web Series
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=vote_count.desc&vote_count.gte=10&page=${page}`;
        } else if (type === "bollywood_hub") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=hi&sort_by=popularity.desc&page=${page}`;
        } else if (type === "hollywood_hindi") {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=en&sort_by=popularity.desc&vote_count.gte=50&page=${page}`;
        }

        const res = await axios.get(url, { timeout: 8000 });
        return (res.data.results || []).map(m => ({
            id: `tmdb:${m.id}`,
            type: isSeries ? "series" : "movie",
            name: m.title || m.name,
            poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster',
            background: m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : undefined,
            description: `⭐ TMDB: ${m.vote_average || "N/A"}/10 | 📅 ${m.release_date || m.first_air_date || "TBA"}\n\n${m.overview}`
        }));
    } catch (e) { return []; }
}

const app = express();
app.use((req, res, next) => { 
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Headers', '*'); 
    next(); 
});

// UI Configuration Page
app.get("/", (req, res) => res.redirect("/configure"));
app.get("/configure", (req, res) => renderConfigPage(res, getDefaultConfig()));
app.get("/:config/configure", (req, res) => renderConfigPage(res, parseConfig(req.params.config)));

app.get("/manifest.json", (req, res) => res.json(getManifest(getDefaultConfig())));
app.get("/:config/manifest.json", (req, res) => res.json(getManifest(parseConfig(req.params.config))));

// ----------------------------------------------------
// 4. CATALOG & SEARCH ROUTING
// ----------------------------------------------------
function parseExtra(extraStr, query) {
    let extra = { ...query };
    if (extraStr) {
        const clean = extraStr.replace(/\.json$/, "");
        clean.split("&").forEach(part => {
            const [k, v] = part.split("=");
            if (k && v) extra[k] = decodeURIComponent(v);
        });
    }
    return extra;
}

async function handleCatalog(req, res, configStr) {
    const { type, id, extra: extraParam } = req.params;
    const extra = parseExtra(extraParam, req.query);
    const search = extra.search || null;
    const genre = extra.genre || null;
    const skip = parseInt(extra.skip) || 0;

    let metas = [];
    if (id.startsWith("anime")) metas = await fetchAnime(id, search, genre, skip);
    else metas = await fetchOTTContent(id, genre, search, skip);

    return res.json({ metas });
}

app.get("/catalog/:type/:id.json", (req, res) => handleCatalog(req, res, null));
app.get("/catalog/:type/:id/:extra.json", (req, res) => handleCatalog(req, res, null));
app.get("/:config/catalog/:type/:id.json", (req, res) => handleCatalog(req, res, req.params.config));
app.get("/:config/catalog/:type/:id/:extra.json", (req, res) => handleCatalog(req, res, req.params.config));

// ----------------------------------------------------
// 5. META HANDLER (Full Series & Anime Episodes)
// ----------------------------------------------------
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
            } else {
                const epCount = attr.episodeCount || 24;
                for (let i = 1; i <= epCount; i++) {
                    videos.push({ id: `kitsu:${cleanId}:${i}`, title: `Episode ${i}`, season: 1, episode: i });
                }
            }
            return res.json({ 
                meta: { 
                    id, 
                    type: isMovie ? "movie" : "anime", 
                    name: attr.canonicalTitle || attr.titles?.en, 
                    poster: attr.posterImage?.large, 
                    background: attr.coverImage?.large, 
                    description: attr.synopsis, 
                    videos 
                } 
            });
        } catch (e) { return res.json({ meta: { id, type: "anime", name: "Anime" } }); }
    } else if (id.startsWith("tmdb:")) {
        try {
            const tmdbId = id.replace("tmdb:", "");
            const isTv = type === "series";
            const resData = await axios.get(`https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`, { timeout: 5000 });
            const m = resData.data;
            const imdbId = m.external_ids?.imdb_id || m.imdb_id || id;
            const videos = [];

            if (isTv && m.seasons) {
                m.seasons.forEach(s => {
                    if (s.season_number > 0) {
                        for (let ep = 1; ep <= (s.episode_count || 1); ep++) {
                            videos.push({
                                id: `tmdb:${tmdbId}:${s.season_number}:${ep}`,
                                title: `Season ${s.season_number} Episode ${ep}`,
                                season: s.season_number,
                                episode: ep,
                                released: s.air_date ? new Date(s.air_date).toISOString() : new Date().toISOString()
                            });
                        }
                    }
                });
            }

            return res.json({ 
                meta: { 
                    id, 
                    type, 
                    name: m.title || m.name, 
                    poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : undefined, 
                    background: m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : undefined, 
                    description: m.overview, 
                    imdb_id: imdbId,
                    videos: videos.length > 0 ? videos : undefined
                } 
            });
        } catch (e) { return res.json({ meta: { id, type: "movie", name: "Media Item" } }); }
    }
}

app.get("/meta/:type/:id.json", (req, res) => handleMeta(req, res));
app.get("/:config/meta/:type/:id.json", (req, res) => handleMeta(req, res));

// ----------------------------------------------------
// 6. DUAL ENGINE STREAMS (Nyaa/Apibay + Torrentio/Debrid)
// ----------------------------------------------------
async function handleStream(req, res, configStr) {
    const config = parseConfig(configStr);
    const { type, id } = req.params;
    let targetId = id;
    let isAnime = targetId.startsWith("kitsu:") || type === "anime";
    let mediaTitle = "";
    let episodeNum = null;
    let seasonNum = null;
    let allStreams = [];

    // Parse IDs
    try {
        if (targetId.startsWith("kitsu:")) {
            const parts = targetId.split(":");
            const kId = parts[1];
            episodeNum = parts[2] || "1";
            const kRes = await axios.get(`https://kitsu.io/api/edge/anime/${kId}`, { timeout: 4000 });
            mediaTitle = kRes.data.data.attributes.canonicalTitle || kRes.data.data.attributes.titles.en;
        } else if (targetId.startsWith("tmdb:")) {
            const parts = targetId.split(":");
            const tmdbId = parts[1];
            seasonNum = parts[2] || null;
            episodeNum = parts[3] || null;
            const isTv = type === "series" || Boolean(seasonNum);

            const tRes = await axios.get(`https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`, { timeout: 4000 });
            mediaTitle = tRes.data.title || tRes.data.name;
            const imdbId = tRes.data.external_ids?.imdb_id || tRes.data.imdb_id;
            
            if (imdbId) {
                targetId = (isTv && seasonNum && episodeNum) ? `${imdbId}:${seasonNum}:${episodeNum}` : imdbId;
            }
        }
    } catch (e) {}

    // ENGINE 1: Direct Tracker Scraping
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
                                allStreams.push({
                                    title: `${titleMatch[1]}\n👤 ${seedsMatch ? seedsMatch[1] : '100+'} Seeders`,
                                    infoHash: hashMatch[1],
                                    seeders: parseInt(seedsMatch ? seedsMatch[1] : 50),
                                    source: "⚡ AuraFlix Direct"
                                });
                            }
                        });
                        if (allStreams.length > 5) break;
                    }
                }
            } else {
                const queries = [`${mediaTitle} Hindi`, mediaTitle];
                for (let q of queries) {
                    let apiBayRes = await axios.get(`https://apibay.org/q.php?q=${encodeURIComponent(q)}`, { timeout: 4000 }).catch(() => null);
                    if (apiBayRes && apiBayRes.data && apiBayRes.data[0].id !== "0") {
                        apiBayRes.data.forEach(t => {
                            allStreams.push({
                                title: `${t.name}\n👤 ${t.seeders} Seeders 💾 ${((t.size || 0)/(1024*1024*1024)).toFixed(2)}GB`,
                                infoHash: t.info_hash,
                                seeders: parseInt(t.seeders) || 1,
                                source: "⚡ Direct Tracker"
                            });
                        });
                    }
                    if (allStreams.length > 6) break;
                }
            }
        } catch (e) {}
    }

    // ENGINE 2: Torrentio + Debrid Engine (RealDebrid, AllDebrid, TorBox)
    try {
        let upstreamUrl = "https://torrentio.strem.fun";
        if (config.debridProvider && config.debridProvider !== "none" && config.debridToken) {
            upstreamUrl += `/${config.debridProvider}=${config.debridToken}`;
        }
        upstreamUrl += `/stream/${isAnime ? 'anime' : type}/${targetId}.json`;

        const resTorrentio = await axios.get(upstreamUrl, { timeout: 7000 }).catch(() => null);
        if (resTorrentio && resTorrentio.data && resTorrentio.data.streams) {
            resTorrentio.data.streams.forEach(s => {
                let seedMatch = (s.title || "").match(/👤\s*(\d+)/);
                s.seeders = seedMatch ? parseInt(seedMatch[1]) : (s.url ? 999 : 20);
                allStreams.push(s);
            });
        }
    } catch (e) {}

    let processedStreams = [];
    let seen = new Set();
    const excludes = config.excludeResolutions || [];
    const priorityLangs = config.priorityLanguages || ["hindi"];

    allStreams.forEach(s => {
        if (!s) return;
        let fullText = ((s.title || "") + " " + (s.name || "")).toLowerCase();

        const uniqueKey = s.infoHash || s.url || fullText;
        if (uniqueKey && seen.has(uniqueKey)) return;
        if (uniqueKey) seen.add(uniqueKey);

        // Quality Detection
        let quality = "📼 480p SD";
        let qRank = 1;
        let isHDR = fullText.includes("hdr") || fullText.includes("dv") || fullText.includes("dolby");
        let isRemux = fullText.includes("remux");

        if (isRemux && excludes.includes("remux")) return;
        if (isHDR && (excludes.includes("hdr") || excludes.includes("dv"))) return;

        if (fullText.includes("4k") || fullText.includes("2160p")) { 
            quality = isHDR ? "✨ 4K ULTRA HD • HDR" : "✨ 4K ULTRA HD"; 
            qRank = 4; 
            if (excludes.includes("4k")) return;
        } else if (fullText.includes("1080p")) { 
            quality = "📺 1080p FULL HD"; 
            qRank = 3; 
            if (excludes.includes("1080p")) return;
        } else if (fullText.includes("720p")) { 
            quality = "📱 720p HD"; 
            qRank = 2; 
            if (excludes.includes("720p")) return;
        } else {
            if (excludes.includes("480p")) return;
        }

        if (excludes.includes("cam") && (fullText.includes("cam") || fullText.includes("ts") || fullText.includes("hdcam"))) return;

        // Multi-Language Flag Detection
        let isHindi = /\b(hindi|dual\s*audio|multi\s*audio|hin-eng|dubbed\s*in\s*hindi)\b/i.test(fullText);
        let isTelugu = /\b(telugu|tel)\b/i.test(fullText);
        let isTamil = /\b(tamil|tam)\b/i.test(fullText);
        let isJap = /\b(japanese|jap|subbed|raw)\b/i.test(fullText) || isAnime;
        let isEng = /\b(english|eng\s*dub|eng\s*audio)\b/i.test(fullText);
        let isBengali = /\b(bengali|bangla|ben)\b/i.test(fullText);
        let isKorean = /\b(korean|kor)\b/i.test(fullText);

        let langBadge = "🌐 MULTI AUDIO";
        let langRank = 1;

        if (isHindi) { langBadge = "🇮🇳 HINDI DUB"; langRank = 15; }
        else if (isTelugu) { langBadge = "🇮🇳 TELUGU"; langRank = 12; }
        else if (isTamil) { langBadge = "🇮🇳 TAMIL"; langRank = 11; }
        else if (isBengali) { langBadge = "🎭 BENGALI"; langRank = 10; }
        else if (isEng) { langBadge = "🇬🇧 ENG DUB"; langRank = 6; }
        else if (isKorean) { langBadge = "🇰🇷 KOREAN"; langRank = 5; }
        else if (isJap) { langBadge = "🇯🇵 JAP SUB"; langRank = 4; }

        if (priorityLangs.includes("hindi") && isHindi) langRank = 35;
        if (priorityLangs.includes("telugu") && isTelugu) langRank = 35;
        if (priorityLangs.includes("tamil") && isTamil) langRank = 35;
        if (priorityLangs.includes("jap") && isJap) langRank = 35;
        if (priorityLangs.includes("eng") && isEng) langRank = 35;

        let modeTag = s.url ? "⚡ PREMIUM DEBRID" : (s.source || "🚀 HIGH-SPEED P2P");

        s.langRank = langRank;
        s.qRank = qRank;
        s.seeders = s.seeders || 10;

        let cleanTitle = s.title ? s.title.split('\n')[0].replace(/\b(Torrentio|Debrid)\b/ig, 'AuraFlix') : 'Play Now';

        s.name = `🎬 AuraFlix PRO\n${langBadge}`;
        s.title = `${quality} • ${modeTag}\n${cleanTitle}\n👤 ${s.seeders} Seeders`;

        processedStreams.push(s);
    });

    // Custom Sorting Engine
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
    return res.json({ streams: processedStreams.slice(0, limit) });
}

app.get("/stream/:type/:id.json", (req, res) => handleStream(req, res, null));
app.get("/:config/stream/:type/:id.json", (req, res) => handleStream(req, res, req.params.config));

// ----------------------------------------------------
// 7. TORRENTIO/HDHUB STYLE UI DASHBOARD (Exact Dark Theme)
// ----------------------------------------------------
function renderConfigPage(res, currentConfig) {
    const configJson = JSON.stringify(currentConfig);
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AuraFlix PRO - Settings Dashboard</title>
            <style>
                body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; background: #0c101b; color: #cbd5e1; margin: 0; padding: 20px 10px; }
                .container { max-width: 600px; margin: 0 auto; background: #111827; padding: 25px; border-radius: 16px; border: 1px solid #1f2937; box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
                .header { text-align: center; margin-bottom: 25px; }
                .logo { width: 90px; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 0 20px rgba(99, 102, 241, 0.5); }
                h1 { color: #f8fafc; margin: 0; font-size: 26px; font-weight: 800; }
                .version { display: inline-block; background: #1e293b; color: #818cf8; font-size: 12px; padding: 2px 8px; border-radius: 6px; margin-top: 5px; }
                p.desc { color: #94a3b8; font-size: 13px; margin: 10px 0 0; }
                
                .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin: 22px 0 10px; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
                
                .card-check { background: #1f2937; padding: 12px; border-radius: 10px; border: 1px solid #374151; display: flex; align-items: center; cursor: pointer; user-select: none; transition: border-color 0.2s, background 0.2s; font-size: 13px; color: #f1f5f9; }
                .card-check:hover { border-color: #6366f1; background: #283548; }
                input[type="checkbox"] { width: 16px; height: 16px; margin-right: 8px; accent-color: #6366f1; cursor: pointer; }
                
                select, input[type="text"] { width: 100%; padding: 12px; background: #1f2937; color: #f8fafc; border: 1px solid #374151; border-radius: 10px; font-size: 14px; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
                select:focus, input[type="text"]:focus { border-color: #6366f1; }
                
                .lang-box { max-height: 180px; overflow-y: auto; background: #1f2937; border: 1px solid #374151; border-radius: 10px; padding: 8px; }
                .lang-item { display: flex; align-items: center; padding: 8px; border-radius: 6px; font-size: 13px; cursor: pointer; color: #f8fafc; }
                .lang-item:hover { background: #283548; }
                
                .debrid-container { background: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 16px; margin-top: 10px; }
                
                .btn { display: block; width: 100%; background: #4f46e5; color: white; padding: 15px; text-align: center; text-decoration: none; font-size: 16px; font-weight: 700; border-radius: 10px; margin-top: 25px; transition: background 0.2s; border: none; cursor: pointer; box-sizing: border-box; }
                .btn:hover { background: #4338ca; }
                .btn-copy { background: #1f2937; border: 1px solid #374151; margin-top: 10px; font-size: 14px; padding: 10px; color: #94a3b8; }
                .btn-copy:hover { background: #374151; color: white; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="https://raw.githubusercontent.com/Jafirhossain/auraflix-hub/main/logo.png" class="logo">
                    <h1>AuraFlix PRO</h1>
                    <span class="version">v14.0.0</span>
                    <p class="desc">Ultra-Optimized Anime, South Hindi & Multi-OTT Hub with Zero-Buffer P2P & Debrid.</p>
                </div>
                
                <!-- 1. Stremio Home Catalogues -->
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
                    <label class="card-check"><input type="checkbox" id="cat_hollywood_hindi"> 🎬 Hollywood Hindi</label>
                </div>

                <!-- 2. Priority Languages -->
                <div class="section-title">Priority Language</div>
                <div class="lang-box">
                    <label class="lang-item"><input type="checkbox" class="lang-check" value="hindi"> 🇮🇳 Hindi Dubbed</label>
                    <label class="lang-item"><input type="checkbox" class="lang-check" value="telugu"> 🇮🇳 Telugu</label>
                    <label class="lang-item"><input type="checkbox" class="lang-check" value="tamil"> 🇮🇳 Tamil</label>
                    <label class="lang-item"><input type="checkbox" class="lang-check" value="jap"> 🇯🇵 Japanese (Sub/Dub)</label>
                    <label class="lang-item"><input type="checkbox" class="lang-check" value="eng"> 🇬🇧 English</label>
                    <label class="lang-item"><input type="checkbox" class="lang-check" value="bengali"> 🎭 Bengali</label>
                    <label class="lang-item"><input type="checkbox" class="lang-check" value="korean"> 🇰🇷 Korean</label>
                </div>

                <!-- 3. Exclude Resolutions -->
                <div class="section-title">Exclude Resolutions</div>
                <div class="grid-3">
                    <label class="card-check"><input type="checkbox" id="ex_remux" value="remux"> BluRay REMUX</label>
                    <label class="card-check"><input type="checkbox" id="ex_hdr" value="hdr"> HDR/DV</label>
                    <label class="card-check"><input type="checkbox" id="ex_4k" value="4k"> 4k</label>
                    <label class="card-check"><input type="checkbox" id="ex_1080p" value="1080p"> 1080p</label>
                    <label class="card-check"><input type="checkbox" id="ex_720p" value="720p"> 720p</label>
                    <label class="card-check"><input type="checkbox" id="ex_480p" value="480p"> 480p / SD</label>
                    <label class="card-check"><input type="checkbox" id="ex_cam" value="cam"> CAM / Screener</label>
                </div>

                <!-- 4. Default Sorting -->
                <div class="section-title">Default Sorting</div>
                <select id="sorting">
                    <option value="quality_seeders">By quality then seeders (Recommended)</option>
                    <option value="seeders_first">Highest seeders & speed first</option>
                </select>

                <!-- 5. Debrid Integration -->
                <div class="section-title">Debrid Provider</div>
                <div class="debrid-container">
                    <select id="debridProvider" onchange="toggleDebridInput()">
                        <option value="none">None (100% Free P2P & Direct Trackers)</option>
                        <option value="realdebrid">Real-Debrid</option>
                        <option value="torbox">TorBox</option>
                        <option value="alldebrid">AllDebrid</option>
                        <option value="premiumize">Premiumize</option>
                    </select>
                    
                    <div id="debridInputBox" style="display:none; margin-top:12px;">
                        <input type="text" id="debridToken" placeholder="Paste your API Token / Key here...">
                    </div>
                </div>

                <a id="installBtn" class="btn" href="#">INSTALL ADDON</a>
                <button id="copyBtn" class="btn btn-copy" onclick="copyManifestLink()">📋 Copy Addon Manifest Link</button>
            </div>

            <script>
                const initialConfig = ${configJson};

                // Catalogs Check
                ['anime_airing', 'anime_trending', 'anime_movies', 'anime_popular', 'south_trending', 'south_new_releases', 'hindi_webseries', 'netflix_prime', 'hotstar_sonyliv', 'hollywood_hindi'].forEach(id => {
                    if(document.getElementById('cat_' + id)) {
                        document.getElementById('cat_' + id).checked = initialConfig.catalogs[id] !== false;
                    }
                });

                // Languages Check
                const pLangs = initialConfig.priorityLanguages || ['hindi'];
                document.querySelectorAll('.lang-check').forEach(el => {
                    el.checked = pLangs.includes(el.value);
                });

                // Excludes Check
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
                    ['anime_airing', 'anime_trending', 'anime_movies', 'anime_popular', 'south_trending', 'south_new_releases', 'hindi_webseries', 'netflix_prime', 'hotstar_sonyliv', 'hollywood_hindi'].forEach(id => {
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
                        alert('✅ Manifest URL Copied! You can paste it into Stremio Addons search bar.');
                    });
                }
            </script>
        </body>
        </html>
    `);
}

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`AuraFlix PRO Server running on port ${PORT}`));