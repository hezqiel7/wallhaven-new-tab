(() => {
  "use strict";

  const CACHE_KEY = "wh_newtab_cache_v2";
  const SETTINGS_KEY = "wh_newtab_settings_v1";
  const HISTORY_KEY = "wh_newtab_history_v1";
  const HISTORY_LIMIT = 120;
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
    fitMode: "smart",
    position: "center center"
  };

  const bgA = document.getElementById("bgA");
  const bgB = document.getElementById("bgB");
  const bgLayers = [bgA, bgB];
  const nextBtn = document.getElementById("nextBtn");
  const saveBtn = document.getElementById("saveBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsPanel = document.getElementById("settingsPanel");
  const settingsForm = document.getElementById("settingsForm");
  const cancelSettingsBtn = document.getElementById("cancelSettingsBtn");

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
  let activeLayerIndex = 0;
  let currentSettings = null;

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

  function getHistory() {
    const raw = safeParse(localStorage.getItem(HISTORY_KEY));
    if (!Array.isArray(raw)) return [];
    return raw.filter((id) => typeof id === "string" && id.length);
  }

  function setHistory(ids) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(ids.slice(-HISTORY_LIMIT)));
  }

  function rememberWallpaper(id) {
    if (!id) return;
    const history = getHistory().filter((value) => value !== id);
    history.push(id);
    setHistory(history);
  }

  function clearHistory(keepId) {
    if (keepId) {
      setHistory([keepId]);
      return;
    }
    localStorage.removeItem(HISTORY_KEY);
  }

  function mergeSettings(raw) {
    const src = raw || {};
    const categories = src.categories || {};
    const purity = src.purity || {};
    return {
      apiKey: typeof src.apiKey === "string" ? src.apiKey.trim() : DEFAULT_SETTINGS.apiKey,
      query: typeof src.query === "string" && src.query.trim() ? src.query.trim() : DEFAULT_SETTINGS.query,
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
    const validFitModes = ["smart", "cover", "contain", "none"];
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
    const viewportW = window.innerWidth || 1920;
    const viewportH = window.innerHeight || 1080;
    const hasSize = imageMeta && Number(imageMeta.width) > 0 && Number(imageMeta.height) > 0;

    if (mode === "none") {
      return { size: "auto", position, repeat: "no-repeat" };
    }
    if (mode === "cover") {
      return { size: "cover", position, repeat: "no-repeat" };
    }
    if (mode === "contain") {
      return { size: "contain", position, repeat: "no-repeat" };
    }

    if (hasSize) {
      const imageRatio = Number(imageMeta.width) / Number(imageMeta.height);
      const viewRatio = viewportW / viewportH;
      if (Math.abs(imageRatio - viewRatio) <= 0.01) {
        return { size: "100% 100%", position, repeat: "no-repeat" };
      }
    }

    return { size: "contain", position, repeat: "no-repeat" };
  }

  function applyLayerRender(layer, settings, imageMeta) {
    const render = backgroundRenderOptions(settings, imageMeta);
    layer.style.backgroundSize = render.size;
    layer.style.backgroundPosition = render.position;
    layer.style.backgroundRepeat = render.repeat;
  }

  function applyWallpaper(imageUrl, fileName, wallpaperId, imageMeta) {
    currentImageUrl = imageUrl;
    currentFileName = fileName || `wallhaven-${Date.now()}.jpg`;
    currentWallpaperId = wallpaperId || "";

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
    rememberWallpaper(currentWallpaperId);
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

  async function applyWallpaperSmooth(imageUrl, fileName, wallpaperId, imageMeta) {
    const preloaded = await preloadImage(imageUrl);
    applyWallpaper(imageUrl, fileName, wallpaperId, imageMeta || preloaded);
  }

  function reapplyVisualSettings() {
    if (!currentSettings) return;
    const activeLayer = bgLayers[activeLayerIndex];
    applyLayerRender(activeLayer, currentSettings, {
      width: activeLayer.dataset.imageWidth,
      height: activeLayer.dataset.imageHeight
    });
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

  function buildSearchUrl(settings, page) {
    const params = new URLSearchParams();
    if (settings.query) {
      params.set("q", settings.query);
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

  function pickItem(items, avoidUrl, seenIds) {
    if (!Array.isArray(items) || !items.length) {
      return null;
    }

    const candidates = items.filter((item) => {
      if (!item || !item.path) return false;
      if (avoidUrl && item.path === avoidUrl) return false;
      if (item.id && seenIds && seenIds.has(item.id)) return false;
      return true;
    });

    const source = candidates.length ? candidates : items;
    const index = Math.floor(Math.random() * source.length);
    return source[index] || null;
  }

  function randomInt(min, max) {
    if (max <= min) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pickPage(attempt, lastPage) {
    if (lastPage <= 1) return 1;
    if (attempt === 0) return randomInt(1, Math.min(10, lastPage));
    return randomInt(1, lastPage);
  }

  async function requestSearchPage(settings, headers, page) {
    const res = await fetch(buildSearchUrl(settings, page), {
      method: "GET",
      cache: "no-store",
      headers
    });

    if (!res.ok) {
      throw new Error(`Wallhaven API error: ${res.status}`);
    }

    return res.json();
  }

  async function fetchWallpaper(settings, settingsSig, avoidUrl) {
    const headers = {};
    if (settings.apiKey) {
      headers["X-API-Key"] = settings.apiKey;
    }

    const seenIds = new Set(getHistory());
    if (currentWallpaperId) {
      seenIds.add(currentWallpaperId);
    }

    let lastPage = 1;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const page = pickPage(attempt, lastPage);
      const json = await requestSearchPage(settings, headers, page);
      const parsedLastPage = Number(json?.meta?.last_page);
      if (Number.isFinite(parsedLastPage) && parsedLastPage > 0) {
        lastPage = Math.min(parsedLastPage, 1000);
      }

      const item = pickItem(json?.data, avoidUrl, seenIds);
      if (!item?.path) {
        continue;
      }

      const imageUrl = item.path;
      const fileName = fileNameFromUrl(imageUrl);

      const payload = {
        ts: now(),
        imageUrl,
        fileName,
        wallpaperId: item.id || "",
        width: Number(item.dimension_x) || 0,
        height: Number(item.dimension_y) || 0,
        settingsSig
      };

      setCache(payload);
      return payload;
    }

    clearHistory(currentWallpaperId);
    const fallbackJson = await requestSearchPage(settings, headers, 1);
    const fallbackItem = pickItem(fallbackJson?.data, avoidUrl, new Set());

    if (!fallbackItem?.path) {
      throw new Error("No wallpaper returned by Wallhaven");
    }

    const imageUrl = fallbackItem.path;
    const fileName = fileNameFromUrl(imageUrl);

    const payload = {
      ts: now(),
      imageUrl,
      fileName,
      wallpaperId: fallbackItem.id || "",
      width: Number(fallbackItem.dimension_x) || 0,
      height: Number(fallbackItem.dimension_y) || 0,
      settingsSig
    };

    setCache(payload);
    return payload;
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
      applyWallpaper(cache.imageUrl, cache.fileName, cache.wallpaperId, {
        width: cache.width,
        height: cache.height
      });
      return;
    }

    try {
      const fresh = await fetchWallpaper(currentSettings, settingsSig, force ? currentImageUrl : "");
      await applyWallpaperSmooth(fresh.imageUrl, fresh.fileName, fresh.wallpaperId, {
        width: fresh.width,
        height: fresh.height
      });
    } catch {
      if (cache?.imageUrl && cache.settingsSig === settingsSig) {
        applyWallpaper(cache.imageUrl, cache.fileName, cache.wallpaperId, {
          width: cache.width,
          height: cache.height
        });
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
    setSettings(currentSettings);
    closeSettings();

    if (visualSettingsSignature(currentSettings) !== previousVisualSig) {
      reapplyVisualSettings();
    }
    if (settingsSignature(currentSettings) !== previousSearchSig) {
      await loadWallpaper(true);
    }
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
    saveBtn.disabled = true;
    nextBtn.disabled = true;
    await loadWallpaper(false);
    nextBtn.disabled = false;
  }

  init();

})();
