(() => {
  "use strict";

  const CACHE_KEY = "wh_newtab_cache_v2";
  const SETTINGS_KEY = "wh_newtab_settings_v1";
  const HISTORY_KEY = "wh_newtab_history_v1";
  const CANDIDATE_POOL_KEY = "wh_newtab_pool_v1";
  const QUERY_GROUP_STATE_KEY = "wh_newtab_group_state_v1";
  const HISTORY_LIMIT = 200;
  const MAX_QUERY_GROUPS = 5;
  const POOL_LOW_WATERMARK = 8;
  const POOL_MAX_ITEMS = 240;
  const HISTORY_RELAX_STEP = 24;
  const API_BASE_URL = "https://wallhaven.cc/api/v1/search";
  const DEFAULT_SETTINGS = {
    apiKey: "",
    query: "scenery -logo -text",
    categories: {
      general: true,
      anime: true,
      people: false
    },
    purity: {
      sfw: true,
      sketchy: false,
      nsfw: false
    },
    sorting: "toplist",
    topRange: "1M",
    atleast: "1920x1080",
    ratios: "16x9",
    cacheMinutes: 5,
    fitMode: "contain",
    position: "center center"
  };

  const bgA = document.getElementById("bgA");
  const bgB = document.getElementById("bgB");
  const bgLayers = [bgA, bgB];
  const nextBtn = document.getElementById("nextBtn");
  const saveBtn = document.getElementById("saveBtn");
  const favBtn = document.getElementById("favBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const statusMessage = document.getElementById("statusMessage");
  const favoritesDock = document.getElementById("favoritesDock");
  const favoritesMenu = document.getElementById("favoritesMenu");
  const settingsPanel = document.getElementById("settingsPanel");
  const settingsForm = document.getElementById("settingsForm");
  const cancelSettingsBtn = document.getElementById("cancelSettingsBtn");
  const resultsInfo = document.getElementById("resultsInfo");

  const apiKeyInput = document.getElementById("apiKeyInput");
  const queryInput = document.getElementById("queryInput");
  const catGeneral = document.getElementById("catGeneral");
  const catAnime = document.getElementById("catAnime");
  const catPeople = document.getElementById("catPeople");
  const puritySfw = document.getElementById("puritySfw");
  const puritySketchy = document.getElementById("puritySketchy");
  const purityNsfw = document.getElementById("purityNsfw");
  const sortingInput = document.getElementById("sortingInput");
  const topRangeInput = document.getElementById("topRangeInput");
  const atleastInput = document.getElementById("atleastInput");
  const ratiosInput = document.getElementById("ratiosInput");
  const cacheMinutesInput = document.getElementById("cacheMinutesInput");
  const fitModeInput = document.getElementById("fitModeInput");
  const positionInput = document.getElementById("positionInput");

  let currentImageUrl = "";
  let currentFileName = "";
  let currentWallpaperId = "";
  let currentWallpaperPageUrl = "";
  let activeLayerIndex = 0;
  let currentSettings = null;
  let prefetchedWallpaper = null;
  let prefetchPromise = null;
  let autoResultsTimer = null;
  let lastResultsCheckSig = "";
  const MAX_BOOKMARK_NODES = 400;

  function now() {
    return Date.now();
  }

  function safeParse(json) {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function getCache() {
    return safeParse(localStorage.getItem(CACHE_KEY));
  }

  function setCache(data) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  }

  function getCandidatePoolState() {
    const raw = safeParse(localStorage.getItem(CANDIDATE_POOL_KEY));
    if (!raw || typeof raw !== "object") {
      return { settingsSig: "", items: [] };
    }
    const items = Array.isArray(raw.items) ? raw.items : [];
    return {
      settingsSig: typeof raw.settingsSig === "string" ? raw.settingsSig : "",
      items
    };
  }

  function setCandidatePoolState(settingsSig, items) {
    localStorage.setItem(CANDIDATE_POOL_KEY, JSON.stringify({
      settingsSig,
      items: Array.isArray(items) ? items.slice(0, POOL_MAX_ITEMS) : []
    }));
  }

  function getCandidatePool(settingsSig) {
    const state = getCandidatePoolState();
    if (state.settingsSig !== settingsSig) {
      return [];
    }
    return state.items;
  }

  function setCandidatePool(settingsSig, items) {
    setCandidatePoolState(settingsSig, items);
  }

  function clearCandidatePool() {
    localStorage.removeItem(CANDIDATE_POOL_KEY);
  }

  function getQueryGroupState() {
    const raw = safeParse(localStorage.getItem(QUERY_GROUP_STATE_KEY));
    if (!raw || typeof raw !== "object") {
      return { settingsSig: "", groups: [] };
    }
    return {
      settingsSig: typeof raw.settingsSig === "string" ? raw.settingsSig : "",
      groups: Array.isArray(raw.groups) ? raw.groups : []
    };
  }

  function setQueryGroupState(settingsSig, groups) {
    localStorage.setItem(QUERY_GROUP_STATE_KEY, JSON.stringify({
      settingsSig,
      groups: Array.isArray(groups) ? groups : []
    }));
  }

  function clearQueryGroupState() {
    localStorage.removeItem(QUERY_GROUP_STATE_KEY);
  }

  function getHistory() {
    const raw = safeParse(localStorage.getItem(HISTORY_KEY));
    if (!Array.isArray(raw)) return [];
    return raw.filter((id) => typeof id === "string" && id.length);
  }

  function setHistory(ids) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(ids.slice(-HISTORY_LIMIT)));
  }

  function wallpaperHistoryKey(id, url) {
    if (id) return `id:${id}`;
    if (url) return `url:${url}`;
    return "";
  }

  function rememberWallpaper(id, url) {
    const key = wallpaperHistoryKey(id, url);
    if (!key) return;

    const history = getHistory().filter((value) => value !== key);
    history.push(key);
    setHistory(history);
  }

  function relaxHistory(step = HISTORY_RELAX_STEP) {
    const history = getHistory();
    if (history.length <= step) {
      return false;
    }
    setHistory(history.slice(step));
    return true;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function bookmarksGetChildren(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getChildren(id, (nodes) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(Array.isArray(nodes) ? nodes : []);
      });
    });
  }

  async function buildBookmarkTree(nodes, budgetRef) {
    if (!Array.isArray(nodes) || !nodes.length || budgetRef.count <= 0) {
      return [];
    }

    const out = [];
    for (const node of nodes) {
      if (!node || budgetRef.count <= 0) {
        continue;
      }

      if (node.url) {
        out.push({
          title: node.title || node.url,
          url: node.url
        });
        budgetRef.count -= 1;
        continue;
      }

      if (!node.id) {
        continue;
      }

      try {
        const childrenRaw = await bookmarksGetChildren(node.id);
        const children = await buildBookmarkTree(childrenRaw, budgetRef);
        if (children.length) {
          out.push({
            title: node.title || "Carpeta",
            children
          });
        }
      } catch {
        // ignore folder read errors
      }
    }

    return out;
  }

  function renderFavoritesMenu(nodes) {
    if (!Array.isArray(nodes) || !nodes.length) {
      return "";
    }

    return nodes.map((node) => {
      if (node.url) {
        const title = escapeHtml(node.title || node.url);
        const url = escapeHtml(node.url);
        return `<li><a class="favorites-link" href="${url}" title="${title}">${title}</a></li>`;
      }

      const title = escapeHtml(node.title || "Carpeta");
      const children = renderFavoritesMenu(node.children || []);
      if (!children) {
        return "";
      }

      return `<li class="favorites-folder"><span class="favorites-folder-label" title="${title}">${title}</span><ul class="favorites-menu">${children}</ul></li>`;
    }).join("");
  }

  async function loadFavorites() {
    try {
      const topLevel = await bookmarksGetChildren("1");
      const budgetRef = { count: MAX_BOOKMARK_NODES };
      const tree = await buildBookmarkTree(topLevel, budgetRef);
      const html = renderFavoritesMenu(tree);

      if (!html) {
        favoritesDock.classList.add("hidden");
        favoritesMenu.innerHTML = "";
        return;
      }

      favoritesMenu.innerHTML = html;
      favoritesDock.classList.remove("hidden");
    } catch {
      favoritesDock.classList.add("hidden");
      favoritesMenu.innerHTML = "";
    }
  }

  function mergeSettings(raw) {
    const src = raw || {};
    const categories = src.categories || {};
    const purity = src.purity || {};
    return {
      apiKey: typeof src.apiKey === "string" ? src.apiKey.trim() : DEFAULT_SETTINGS.apiKey,
      query: typeof src.query === "string" ? src.query.trim() : DEFAULT_SETTINGS.query,
      categories: {
        general: categories.general !== false,
        anime: !!categories.anime,
        people: !!categories.people
      },
      purity: {
        sfw: purity.sfw !== false,
        sketchy: !!purity.sketchy,
        nsfw: !!purity.nsfw
      },
      sorting: typeof src.sorting === "string" ? src.sorting : DEFAULT_SETTINGS.sorting,
      topRange: typeof src.topRange === "string" ? src.topRange : DEFAULT_SETTINGS.topRange,
      atleast: typeof src.atleast === "string" ? src.atleast.trim() : DEFAULT_SETTINGS.atleast,
      ratios: typeof src.ratios === "string" ? src.ratios.trim() : DEFAULT_SETTINGS.ratios,
      cacheMinutes: Number.isFinite(Number(src.cacheMinutes)) ? Number(src.cacheMinutes) : DEFAULT_SETTINGS.cacheMinutes,
      fitMode: typeof src.fitMode === "string" ? src.fitMode : DEFAULT_SETTINGS.fitMode,
      position: typeof src.position === "string" ? src.position : DEFAULT_SETTINGS.position
    };
  }

  function sanitizeSettings(raw) {
    const merged = mergeSettings(raw);
    const validSorting = ["date_added", "relevance", "random", "views", "favorites", "toplist"];
    const validTopRange = ["1d", "3d", "1w", "1M", "3M", "6M", "1y"];
    const validFitModes = ["cover", "contain", "none"];
    const validPositions = [
      "left top", "center top", "right top",
      "left center", "center center", "right center",
      "left bottom", "center bottom", "right bottom"
    ];

    if (!merged.categories.general && !merged.categories.anime && !merged.categories.people) {
      merged.categories.general = true;
    }
    if (!merged.purity.sfw && !merged.purity.sketchy && !merged.purity.nsfw) {
      merged.purity.sfw = true;
    }
    if (!validSorting.includes(merged.sorting)) {
      merged.sorting = DEFAULT_SETTINGS.sorting;
    }
    if (!validTopRange.includes(merged.topRange)) {
      merged.topRange = DEFAULT_SETTINGS.topRange;
    }
    if (!/^\d+x\d+$/i.test(merged.atleast)) {
      merged.atleast = DEFAULT_SETTINGS.atleast;
    }
    if (merged.ratios && !/^\d+x\d+(,\d+x\d+)*$/i.test(merged.ratios.replace(/\s+/g, ""))) {
      merged.ratios = DEFAULT_SETTINGS.ratios;
    }
    merged.cacheMinutes = Math.min(1440, Math.max(1, Math.round(merged.cacheMinutes)));
    if (!validFitModes.includes(merged.fitMode)) {
      merged.fitMode = DEFAULT_SETTINGS.fitMode;
    }
    if (!validPositions.includes(merged.position)) {
      merged.position = DEFAULT_SETTINGS.position;
    }

    merged.ratios = merged.ratios.replace(/\s+/g, "");
    return merged;
  }

  function getSettings() {
    const raw = safeParse(localStorage.getItem(SETTINGS_KEY));
    return sanitizeSettings(raw);
  }

  function setSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function settingsSignature(settings) {
    return JSON.stringify({
      query: settings.query,
      categories: settings.categories,
      purity: settings.purity,
      sorting: settings.sorting,
      topRange: settings.topRange,
      atleast: settings.atleast,
      ratios: settings.ratios
    });
  }

  function visualSettingsSignature(settings) {
    return JSON.stringify({
      fitMode: settings.fitMode,
      position: settings.position
    });
  }

  function cacheTtlMs(settings) {
    return settings.cacheMinutes * 60 * 1000;
  }

  function isFresh(cache, settingsSig, ttlMs) {
    return !!cache
      && typeof cache.ts === "number"
      && (now() - cache.ts < ttlMs)
      && !!cache.imageUrl
      && cache.settingsSig === settingsSig;
  }

  function backgroundRenderOptions(settings, imageMeta) {
    const mode = settings.fitMode;
    const position = settings.position;

    if (mode === "none") {
      return { size: "auto", position, repeat: "no-repeat" };
    }
    if (mode === "cover") {
      return { size: "cover", position, repeat: "no-repeat" };
    }
    if (mode === "contain") {
      return { size: "contain", position, repeat: "no-repeat" };
    }

    return { size: "contain", position, repeat: "no-repeat" };
  }

  function applyLayerRender(layer, settings, imageMeta) {
    const render = backgroundRenderOptions(settings, imageMeta);
    layer.style.backgroundSize = render.size;
    layer.style.backgroundPosition = render.position;
    layer.style.backgroundRepeat = render.repeat;
  }

  function applyWallpaper(imageUrl, fileName, wallpaperId, wallpaperPageUrl, imageMeta) {
    currentImageUrl = imageUrl;
    currentFileName = fileName || `wallhaven-${Date.now()}.jpg`;
    currentWallpaperId = wallpaperId || "";
    currentWallpaperPageUrl = wallpaperPageUrl || (currentWallpaperId ? `https://wallhaven.cc/w/${currentWallpaperId}` : "");

    const nextLayerIndex = activeLayerIndex === 0 ? 1 : 0;
    const activeLayer = bgLayers[activeLayerIndex];
    const nextLayer = bgLayers[nextLayerIndex];

    applyLayerRender(nextLayer, currentSettings, imageMeta);
    nextLayer.dataset.imageWidth = String(Number(imageMeta?.width) || 0);
    nextLayer.dataset.imageHeight = String(Number(imageMeta?.height) || 0);
    nextLayer.style.backgroundImage = `url("${imageUrl}")`;
    nextLayer.classList.add("active");
    activeLayer.classList.remove("active");
    activeLayerIndex = nextLayerIndex;

    saveBtn.disabled = false;
    updateFavButtonVisibility();
    rememberWallpaper(currentWallpaperId, currentImageUrl);
  }

  function updateFavButtonVisibility() {
    const hasApiKey = !!(currentSettings && currentSettings.apiKey);
    const hasPageUrl = !!currentWallpaperPageUrl;
    if (hasApiKey && hasPageUrl) {
      favBtn.classList.remove("hidden");
      return;
    }
    favBtn.classList.add("hidden");
  }

  function preloadImage(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let done = false;

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error("Image preload timeout"));
      }, timeoutMs);

      img.onload = async () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          if (typeof img.decode === "function") {
            await img.decode();
          }
        } catch {
          // noop
        }
        resolve({
          width: Number(img.naturalWidth) || 0,
          height: Number(img.naturalHeight) || 0
        });
      };

      img.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error("Image preload error"));
      };

      img.src = url;
    });
  }

  async function applyWallpaperSmooth(imageUrl, fileName, wallpaperId, wallpaperPageUrl, imageMeta) {
    const preloaded = await preloadImage(imageUrl);
    applyWallpaper(imageUrl, fileName, wallpaperId, wallpaperPageUrl, imageMeta || preloaded);
  }

  function reapplyVisualSettings() {
    if (!currentSettings) return;
    const activeLayer = bgLayers[activeLayerIndex];
    applyLayerRender(activeLayer, currentSettings, {
      width: activeLayer.dataset.imageWidth,
      height: activeLayer.dataset.imageHeight
    });
  }

  function clearPrefetchQueue() {
    prefetchedWallpaper = null;
  }

  function setResultsInfo(text) {
    resultsInfo.textContent = text;
  }

  function setResultsInfoTone(tone) {
    resultsInfo.classList.remove("pool-none", "pool-low", "pool-medium", "pool-good");
    if (tone) {
      resultsInfo.classList.add(tone);
    }
  }

  function poolTone(total) {
    if (total <= 0) return "pool-none";
    if (total < 50) return "pool-low";
    if (total < 300) return "pool-medium";
    return "pool-good";
  }

  function resultsCheckSignature(settings) {
    return JSON.stringify({
      apiKey: settings.apiKey,
      query: settings.query,
      categories: settings.categories,
      purity: settings.purity,
      sorting: settings.sorting,
      topRange: settings.topRange,
      atleast: settings.atleast,
      ratios: settings.ratios
    });
  }

  async function updateSearchResultsInfo(settings, force = false) {
    const sig = resultsCheckSignature(settings);
    if (!force && sig === lastResultsCheckSig) {
      return;
    }

    lastResultsCheckSig = sig;
    setResultsInfoTone("");
    setResultsInfo("Resultados estimados: comprobando...");

    const headers = {};
    if (settings.apiKey) {
      headers["X-API-Key"] = settings.apiKey;
    }

    try {
      const queries = parseQueryGroups(settings.query);
      let combinedTotal = 0;
      let hasTotal = false;

      for (const query of queries) {
        const json = await requestSearchPage(settings, headers, 1, query);
        const total = Number(json?.meta?.total);
        if (Number.isFinite(total) && total >= 0) {
          hasTotal = true;
          combinedTotal += total;
        }
      }

      if (!hasTotal) {
        setResultsInfoTone("");
        setResultsInfo("Resultados estimados: no disponible");
        return;
      }

      const text = combinedTotal.toLocaleString("es-ES");
      setResultsInfoTone(poolTone(combinedTotal));
      setResultsInfo(`Resultados estimados: ${text}`);
    } catch {
      setResultsInfoTone("");
      setResultsInfo("Resultados estimados: error de consulta");
    }
  }

  function scheduleAutoResultsCheck(immediate = false) {
    if (autoResultsTimer) {
      clearTimeout(autoResultsTimer);
      autoResultsTimer = null;
    }

    if (settingsPanel.classList.contains("hidden")) {
      return;
    }

    const run = async () => {
      const settings = getSettingsFromForm();
      await updateSearchResultsInfo(settings);
    };

    if (immediate) {
      run();
      return;
    }

    autoResultsTimer = setTimeout(() => {
      autoResultsTimer = null;
      run();
    }, 500);
  }

  function showStatusMessage(text) {
    statusMessage.textContent = text;
    statusMessage.classList.remove("hidden");
  }

  function hideStatusMessage() {
    statusMessage.textContent = "";
    statusMessage.classList.add("hidden");
  }

  function createNoResultsError() {
    const error = new Error("No wallpapers returned for current query");
    error.code = "NO_RESULTS";
    return error;
  }

  function makeCandidateFromItem(item, settingsSig) {
    if (!item || !item.path) {
      return null;
    }
    return {
      imageUrl: item.path,
      fileName: fileNameFromUrl(item.path),
      wallpaperId: item.id || "",
      wallpaperPageUrl: item.url || "",
      width: Number(item.dimension_x) || 0,
      height: Number(item.dimension_y) || 0,
      settingsSig
    };
  }

  function candidateKey(candidate) {
    if (!candidate) return "";
    return wallpaperHistoryKey(candidate.wallpaperId, candidate.imageUrl);
  }

  function shuffleInPlace(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
  }

  function getSeenHistoryKeys() {
    const set = new Set();
    const history = getHistory();
    for (const entry of history) {
      if (!entry) continue;
      set.add(entry);
      if (!entry.startsWith("id:") && !entry.startsWith("url:")) {
        set.add(`id:${entry}`);
      }
    }
    return set;
  }

  function getOrCreateGroupState(settings, settingsSig) {
    const queries = parseQueryGroups(settings.query);
    const stored = getQueryGroupState();

    const canReuse = stored.settingsSig === settingsSig
      && Array.isArray(stored.groups)
      && stored.groups.length === queries.length
      && stored.groups.every((group, index) => group && group.query === queries[index]);

    if (canReuse) {
      const normalized = queries.map((query, index) => {
        const prev = stored.groups[index] || {};
        return {
          query,
          pageCursor: Number.isFinite(Number(prev.pageCursor)) && Number(prev.pageCursor) > 0 ? Number(prev.pageCursor) : 1,
          lastPage: Number.isFinite(Number(prev.lastPage)) && Number(prev.lastPage) > 0 ? Number(prev.lastPage) : 1
        };
      });
      return normalized;
    }

    return queries.map((query) => ({
      query,
      pageCursor: 1,
      lastPage: 1
    }));
  }

  async function refillCandidatePool(settings, settingsSig) {
    const headers = {};
    if (settings.apiKey) {
      headers["X-API-Key"] = settings.apiKey;
    }

    const groups = getOrCreateGroupState(settings, settingsSig);
    const pool = getCandidatePool(settingsSig);
    const poolKeys = new Set(pool.map((item) => candidateKey(item)).filter(Boolean));

    const seenKeys = getSeenHistoryKeys();
    const currentKey = wallpaperHistoryKey(currentWallpaperId, currentImageUrl);
    if (currentKey) {
      seenKeys.add(currentKey);
    }
    if (prefetchedWallpaper) {
      const prefetchKey = candidateKey(prefetchedWallpaper);
      if (prefetchKey) {
        seenKeys.add(prefetchKey);
      }
    }

    let hasAnyResults = false;
    const additions = [];

    for (const group of groups) {
      const page = group.pageCursor;
      const json = await requestSearchPage(settings, headers, page, group.query);

      const total = Number(json?.meta?.total);
      if (Number.isFinite(total) && total > 0) {
        hasAnyResults = true;
      }

      const parsedLastPage = Number(json?.meta?.last_page);
      if (Number.isFinite(parsedLastPage) && parsedLastPage > 0) {
        group.lastPage = Math.min(parsedLastPage, 1000);
      } else {
        group.lastPage = 1;
      }
      group.pageCursor = page >= group.lastPage ? 1 : (page + 1);

      const items = Array.isArray(json?.data) ? json.data : [];
      for (const item of items) {
        const candidate = makeCandidateFromItem(item, settingsSig);
        if (!candidate || !candidate.imageUrl) continue;
        if (candidate.imageUrl === currentImageUrl) continue;

        const key = candidateKey(candidate);
        if (!key) continue;
        if (seenKeys.has(key)) continue;
        if (poolKeys.has(key)) continue;

        poolKeys.add(key);
        additions.push(candidate);
      }
    }

    setQueryGroupState(settingsSig, groups);

    if (additions.length) {
      shuffleInPlace(additions);
      const merged = pool.concat(additions).slice(0, POOL_MAX_ITEMS);
      setCandidatePool(settingsSig, merged);
    }

    return {
      added: additions.length,
      hasAnyResults
    };
  }

  function popCandidateFromPool(settingsSig) {
    const pool = getCandidatePool(settingsSig);
    if (!pool.length) {
      return null;
    }
    const [first, ...rest] = pool;
    setCandidatePool(settingsSig, rest);
    return first;
  }

  async function getNextCandidate(settings, settingsSig) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const fromPool = popCandidateFromPool(settingsSig);
      if (fromPool) {
        return fromPool;
      }

      const refill = await refillCandidatePool(settings, settingsSig);
      if (!refill.hasAnyResults) {
        throw createNoResultsError();
      }

      if (refill.added === 0) {
        if (!relaxHistory()) {
          break;
        }
      }
    }

    throw new Error("No wallpaper candidate available");
  }

  async function ensurePoolLevel(settings, settingsSig, targetSize = POOL_LOW_WATERMARK) {
    let pool = getCandidatePool(settingsSig);
    let safety = 0;
    while (pool.length < targetSize && safety < 4) {
      safety += 1;
      let refill;
      try {
        refill = await refillCandidatePool(settings, settingsSig);
      } catch {
        break;
      }
      pool = getCandidatePool(settingsSig);
      if (refill.added === 0) {
        break;
      }
    }
  }

  function canUsePrefetched(settingsSig) {
    return !!prefetchedWallpaper
      && prefetchedWallpaper.settingsSig === settingsSig
      && !!prefetchedWallpaper.imageUrl
      && prefetchedWallpaper.imageUrl !== currentImageUrl;
  }

  function ensurePrefetch(settingsSig) {
    if (prefetchPromise || !currentSettings || prefetchedWallpaper) {
      return;
    }

    const snapshot = currentSettings;
    const snapshotSig = settingsSig || settingsSignature(snapshot);

    prefetchPromise = (async () => {
      try {
        const payload = await getNextCandidate(snapshot, snapshotSig);
        const preloadedMeta = await preloadImage(payload.imageUrl);
        if (!currentSettings || settingsSignature(currentSettings) !== snapshotSig) {
          return;
        }
        prefetchedWallpaper = {
          ...payload,
          preloadedMeta
        };
      } catch {
        prefetchedWallpaper = null;
      } finally {
        prefetchPromise = null;
      }
    })();
  }

  function fileNameFromUrl(url) {
    try {
      const clean = url.split("?")[0];
      return clean.substring(clean.lastIndexOf("/") + 1) || `wallhaven-${Date.now()}.jpg`;
    } catch {
      return `wallhaven-${Date.now()}.jpg`;
    }
  }

  function categoryBits(categories) {
    return `${categories.general ? "1" : "0"}${categories.anime ? "1" : "0"}${categories.people ? "1" : "0"}`;
  }

  function purityBits(purity) {
    return `${purity.sfw ? "1" : "0"}${purity.sketchy ? "1" : "0"}${purity.nsfw ? "1" : "0"}`;
  }

  function parseQueryGroups(query) {
    if (typeof query !== "string") {
      return [""];
    }

    const groups = query
      .split(",")
      .map((value) => value.trim().replace(/\s+/g, " "))
      .filter((value) => value.length > 0)
      .slice(0, MAX_QUERY_GROUPS);

    return groups.length ? groups : [""];
  }

  function buildSearchUrl(settings, page, queryOverride) {
    const params = new URLSearchParams();
    const effectiveQuery = typeof queryOverride === "string" ? queryOverride : settings.query;
    if (effectiveQuery) {
      params.set("q", effectiveQuery);
    }
    params.set("categories", categoryBits(settings.categories));
    params.set("purity", purityBits(settings.purity));
    params.set("sorting", settings.sorting);
    params.set("order", "desc");
    params.set("atleast", settings.atleast);
    if (page && Number.isInteger(page) && page > 0) {
      params.set("page", String(page));
    }

    if (settings.ratios) {
      params.set("ratios", settings.ratios);
    }
    if (settings.sorting === "toplist") {
      params.set("topRange", settings.topRange);
    }

    return `${API_BASE_URL}?${params.toString()}`;
  }

  async function requestSearchPage(settings, headers, page, queryOverride) {
    const res = await fetch(buildSearchUrl(settings, page, queryOverride), {
      method: "GET",
      cache: "no-store",
      headers
    });

    if (!res.ok) {
      throw new Error(`Wallhaven API error: ${res.status}`);
    }

    return res.json();
  }

  saveBtn.addEventListener("click", () => {
    if (!currentImageUrl) return;

    chrome.downloads.download({
      url: currentImageUrl,
      filename: `Wallhaven/${currentFileName}`,
      saveAs: false,
      conflictAction: "uniquify"
    });
  }, { passive: true });

  favBtn.addEventListener("click", () => {
    if (!currentWallpaperPageUrl) return;
    window.open(currentWallpaperPageUrl, "_blank", "noopener,noreferrer");
  }, { passive: true });

  function setFormFromSettings(settings) {
    apiKeyInput.value = settings.apiKey;
    queryInput.value = settings.query;
    catGeneral.checked = settings.categories.general;
    catAnime.checked = settings.categories.anime;
    catPeople.checked = settings.categories.people;
    puritySfw.checked = settings.purity.sfw;
    puritySketchy.checked = settings.purity.sketchy;
    purityNsfw.checked = settings.purity.nsfw;
    sortingInput.value = settings.sorting;
    topRangeInput.value = settings.topRange;
    atleastInput.value = settings.atleast;
    ratiosInput.value = settings.ratios;
    cacheMinutesInput.value = String(settings.cacheMinutes);
    fitModeInput.value = settings.fitMode;
    positionInput.value = settings.position;
    topRangeInput.disabled = settings.sorting !== "toplist";
  }

  function getSettingsFromForm() {
    return sanitizeSettings({
      apiKey: apiKeyInput.value,
      query: queryInput.value,
      categories: {
        general: catGeneral.checked,
        anime: catAnime.checked,
        people: catPeople.checked
      },
      purity: {
        sfw: puritySfw.checked,
        sketchy: puritySketchy.checked,
        nsfw: purityNsfw.checked
      },
      sorting: sortingInput.value,
      topRange: topRangeInput.value,
      atleast: atleastInput.value,
      ratios: ratiosInput.value,
      cacheMinutes: cacheMinutesInput.value,
      fitMode: fitModeInput.value,
      position: positionInput.value
    });
  }

  function openSettings() {
    setFormFromSettings(currentSettings);
    updateSearchResultsInfo(currentSettings, true);
    settingsPanel.classList.remove("hidden");
  }

  function closeSettings() {
    settingsPanel.classList.add("hidden");
  }

  async function loadWallpaper(force = false) {
    const cache = getCache();
    const settingsSig = settingsSignature(currentSettings);
    const ttlMs = cacheTtlMs(currentSettings);

    if (!force && isFresh(cache, settingsSig, ttlMs)) {
      hideStatusMessage();
      applyWallpaper(cache.imageUrl, cache.fileName, cache.wallpaperId, cache.wallpaperPageUrl, {
        width: cache.width,
        height: cache.height
      });
      await ensurePoolLevel(currentSettings, settingsSig, POOL_LOW_WATERMARK);
      ensurePrefetch(settingsSig);
      return;
    }

    if (force && canUsePrefetched(settingsSig)) {
      const queued = prefetchedWallpaper;
      prefetchedWallpaper = null;
      hideStatusMessage();
      applyWallpaper(queued.imageUrl, queued.fileName, queued.wallpaperId, queued.wallpaperPageUrl, queued.preloadedMeta);
      setCache({
        ts: now(),
        imageUrl: queued.imageUrl,
        fileName: queued.fileName,
        wallpaperId: queued.wallpaperId,
        wallpaperPageUrl: queued.wallpaperPageUrl || "",
        width: Number(queued.width) || Number(queued.preloadedMeta?.width) || 0,
        height: Number(queued.height) || Number(queued.preloadedMeta?.height) || 0,
        settingsSig
      });
      await ensurePoolLevel(currentSettings, settingsSig, POOL_LOW_WATERMARK);
      ensurePrefetch(settingsSig);
      return;
    }

    try {
      const fresh = await getNextCandidate(currentSettings, settingsSig);
      await applyWallpaperSmooth(fresh.imageUrl, fresh.fileName, fresh.wallpaperId, fresh.wallpaperPageUrl, {
        width: fresh.width,
        height: fresh.height
      });
      setCache({
        ts: now(),
        imageUrl: fresh.imageUrl,
        fileName: fresh.fileName,
        wallpaperId: fresh.wallpaperId,
        wallpaperPageUrl: fresh.wallpaperPageUrl || "",
        width: Number(fresh.width) || 0,
        height: Number(fresh.height) || 0,
        settingsSig
      });
      hideStatusMessage();
      await ensurePoolLevel(currentSettings, settingsSig, POOL_LOW_WATERMARK);
      ensurePrefetch(settingsSig);
    } catch (error) {
      if (error && error.code === "NO_RESULTS") {
        showStatusMessage("Sin resultados para esa busqueda. Ajusta q o relaja filtros.");
      }
      if (cache?.imageUrl && cache.settingsSig === settingsSig) {
        applyWallpaper(cache.imageUrl, cache.fileName, cache.wallpaperId, cache.wallpaperPageUrl, {
          width: cache.width,
          height: cache.height
        });
        await ensurePoolLevel(currentSettings, settingsSig, POOL_LOW_WATERMARK);
        ensurePrefetch(settingsSig);
      }
    }
  }

  settingsBtn.addEventListener("click", openSettings, { passive: true });
  cancelSettingsBtn.addEventListener("click", closeSettings, { passive: true });

  settingsPanel.addEventListener("click", (event) => {
    if (event.target === settingsPanel) {
      closeSettings();
    }
  });

  sortingInput.addEventListener("change", () => {
    topRangeInput.disabled = sortingInput.value !== "toplist";
  });

  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const previousSearchSig = settingsSignature(currentSettings);
    const previousVisualSig = visualSettingsSignature(currentSettings);

    currentSettings = getSettingsFromForm();
    const nextSearchSig = settingsSignature(currentSettings);
    setSettings(currentSettings);
    closeSettings();

    if (nextSearchSig !== previousSearchSig) {
      clearPrefetchQueue();
      clearCandidatePool();
      clearQueryGroupState();
    }

    if (visualSettingsSignature(currentSettings) !== previousVisualSig) {
      reapplyVisualSettings();
    }
    updateFavButtonVisibility();
    if (nextSearchSig !== previousSearchSig) {
      await loadWallpaper(true);
    }
  });

  settingsForm.addEventListener("input", () => {
    lastResultsCheckSig = "";
    setResultsInfoTone("");
    setResultsInfo("Resultados estimados: cambios sin comprobar");
    scheduleAutoResultsCheck();
  });

  settingsForm.addEventListener("change", () => {
    scheduleAutoResultsCheck();
  });

  window.addEventListener("resize", () => {
    reapplyVisualSettings();
  }, { passive: true });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !settingsPanel.classList.contains("hidden")) {
      closeSettings();
    }
  });

  nextBtn.addEventListener("click", async () => {
    nextBtn.disabled = true;
    try {
      await loadWallpaper(true);
    } finally {
      nextBtn.disabled = false;
    }
  });

  async function init() {
    currentSettings = getSettings();
    updateFavButtonVisibility();
    loadFavorites();
    saveBtn.disabled = true;
    nextBtn.disabled = true;
    await loadWallpaper(false);
    nextBtn.disabled = false;
  }

  init();

})();
