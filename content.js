(() => {
  "use strict";

  const TOOLBAR_ID = "lems-toolbar";
  const NUMBER = "(?:[1-9]\\d{0,2}(?:[,. \\u00a0\\u202f\\u2009'’]\\d{3})+|[1-9]\\d{0,5})";
  const DIMENSIONS = new RegExp(`(?<![\\d.,])(${NUMBER})\\s*[x×]\\s*(${NUMBER})(?![\\d.,])`, "i");
  const state = { direction: "desc", records: [], groups: 0, toolbar: null, timer: null };
  const origins = new Map();
  let lastURL = location.href;
  let observer;

  function dimensions(text) {
    const match = String(text || "").match(DIMENSIONS);
    if (!match) return null;
    const width = Number(match[1].replace(/\D/g, ""));
    const height = Number(match[2].replace(/\D/g, ""));
    return Number.isSafeInteger(width * height) ? { width, height, pixels: width * height } : null;
  }

  function httpURL(value) {
    try {
      const url = new URL(value, location.href);
      return ["https:", "http:"].includes(url.protocol) ? url : null;
    } catch {
      return null;
    }
  }

  function isGoogle(url) {
    return /(^|\.)google\.(?:com|[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/i.test(url.hostname);
  }

  function sourceURL(anchor) {
    const href = anchor.getAttribute("href");
    let url = href && httpURL(href);
    if (!url) return null;
    if (isGoogle(url) && ["/url", "/imgres"].includes(url.pathname)) {
      const target = url.searchParams.get("imgrefurl") || url.searchParams.get("url") || url.searchParams.get("q");
      url = target ? httpURL(target) : null;
    }
    return url && !isGoogle(url) ? url.href : null;
  }

  function isExactPage() {
    const selected = document.querySelectorAll('[aria-current="page"], [aria-current="true"], [aria-selected="true"], a[selected], [role="tab"][selected]');
    let otherTab = false;
    for (const tab of selected) {
      if (tab.closest(`#${TOOLBAR_ID}`)) continue;
      const text = tab.textContent.trim();
      if (/^exact\s+matches(?:\s*\(\d+\))?$/i.test(text)) return true;
      if (/^(all|images|visual matches|shopping|products)$/i.test(text)) otherTab = true;
    }
    return !otherTab && new URLSearchParams(location.search).get("udm") === "48";
  }

  function visible(element, root) {
    for (let node = element; node; node = node.parentElement) {
      if (node.hidden || node.getAttribute("aria-hidden") === "true") return false;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (node === root) break;
    }
    return true;
  }

  function preview(card) {
    return Array.from(card.querySelectorAll("img")).find(img => {
      const src = img.currentSrc || img.getAttribute("src") || "";
      const width = Number(img.getAttribute("width"));
      const height = Number(img.getAttribute("height"));
      return src && !/favicon|gstatic\.com\/images\/branding/i.test(src) && !(width > 0 && width < 32) && !(height > 0 && height < 32);
    });
  }

  function sizeLabels(root) {
    return Array.from(root.querySelectorAll("span, small, p, div"))
      .filter(node => !node.closest(`#${TOOLBAR_ID}, h1, h2, h3, [role="heading"], .ZhosBf, [style*="-webkit-line-clamp"]`))
      .filter(node => node.textContent.length <= 160 && dimensions(node.textContent))
      .filter(node => !Array.from(node.children).some(child => dimensions(child.textContent)));
  }

  function links(card) {
    const anchors = Array.from(card.querySelectorAll("a[href]"));
    if (card.matches("a[href]")) anchors.unshift(card);
    return anchors.map(sourceURL).filter(Boolean);
  }

  function candidate(label, root) {
    let fallback = null;
    for (let card = label.parentElement; card && card !== root; card = card.parentElement) {
      if (card.closest(`#${TOOLBAR_ID}`)) return null;
      const sources = links(card);
      if (preview(card) && sources.length) {
        if (new Set(sources).size > 1) return fallback;
        if (fallback && Array.from(card.querySelectorAll("img")).some(img => !fallback.contains(img) && preview(img.parentElement) === img)) return fallback;
        fallback = card;
        if (card.matches('.ULSxyf, .MjjYud, [role="listitem"], article, li') || card.querySelector('h3, h2, [role="heading"], .ZhosBf')) return card;
      }
    }
    return fallback;
  }

  function collect(root) {
    const cards = new Set();
    for (const label of sizeLabels(root)) {
      const card = candidate(label, root);
      if (card) cards.add(card);
    }
    const wrappers = root.querySelectorAll('.ULSxyf, .MjjYud, [role="listitem"], article, li');
    for (const card of wrappers) {
      if (card.closest(`#${TOOLBAR_ID}`) || Array.from(cards).some(found => card.contains(found) || found.contains(card))) continue;
      if (Array.from(wrappers).some(other => other !== card && card.contains(other) && preview(other) && links(other).length)) continue;
      if (preview(card) && links(card).length) cards.add(card);
    }
    return Array.from(cards).sort(documentOrder).flatMap(card => {
      const sources = links(card);
      if (!visible(card, root) || !preview(card) || new Set(sources).size !== 1) return [];
      const labels = sizeLabels(card).filter(node => visible(node, root));
      const label = labels.find(node => node.closest(".cyspcb, .oYQBg")) || labels[0];
      return [{ card, url: sources[0], size: dimensions(label?.textContent) }];
    });
  }

  function documentOrder(a, b) {
    if (a === b) return 0;
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  }

  function move(parent, node, before) {
    if (node === before) return;
    // Modern Chrome can move connected cards without resetting their DOM state.
    if (typeof parent.moveBefore === "function") parent.moveBefore(node, before);
    else parent.insertBefore(node, before);
  }

  function validOrigin(unit, origin) {
    return unit.isConnected && origin.marker.isConnected && unit.parentNode === origin.currentParent
      && origin.marker.parentNode === origin.parent && origin.root.contains(unit)
      && origin.root.contains(origin.marker) && unit.contains(origin.card)
      && links(origin.card).includes(origin.url);
  }

  function restore() {
    for (const [unit, origin] of origins) {
      if (validOrigin(unit, origin) && origin.marker.nextSibling !== unit) move(origin.parent, unit, origin.marker.nextSibling);
      origin.marker.remove();
    }
    origins.clear();
  }

  function resultUnits(root) {
    const counts = new Map();
    const tracked = new Map();
    const markers = new Set();
    for (const [unit, origin] of origins) {
      tracked.set(origin.card, unit);
      markers.add(origin.marker);
    }
    for (const { card } of state.records) {
      for (let node = card; node && node !== root; node = node.parentElement) counts.set(node, (counts.get(node) || 0) + 1);
    }
    return state.records.map(item => {
      // Keep the same complete result wrapper after moving it between Google batches.
      let unit = tracked.get(item.card) || item.card;
      while (!tracked.has(item.card) && unit.parentElement && unit.parentElement !== root && counts.get(unit.parentElement) === 1) {
        const parent = unit.parentElement;
        const onlyWrapper = Array.from(parent.childNodes).every(node => node === unit
          || (node.nodeType === Node.COMMENT_NODE && !markers.has(node))
          || (node.nodeType === Node.TEXT_NODE && !node.textContent.trim())
          || (node.nodeType === Node.ELEMENT_NODE && node.matches("script, style")));
        if (!onlyWrapper) break;
        unit = parent;
      }
      return { ...item, unit };
    }).sort((a, b) => documentOrder(a.unit, b.unit));
  }

  function sortResults(root) {
    for (const [unit, origin] of origins) {
      if (!validOrigin(unit, origin) || origin.root !== root) {
        origin.marker.remove();
        origins.delete(unit);
      }
    }
    const items = resultUnits(root);
    state.groups = new Set(items.map(({ unit }) => unit.parentNode)).size;
    for (const item of items) {
      if (origins.has(item.unit)) continue;
      const parent = item.unit.parentNode;
      const marker = document.createComment("lems-original-position");
      parent.insertBefore(marker, item.unit);
      origins.set(item.unit, { marker, parent, currentParent: parent, root, card: item.card, url: item.url });
    }
    const sorted = [...items].sort((a, b) => {
      if (!a.size || !b.size) {
        if (a.size) return -1;
        if (b.size) return 1;
      } else {
        const difference = a.size.pixels - b.size.pixels;
        if (difference) return state.direction === "asc" ? difference : -difference;
      }
      return documentOrder(origins.get(a.unit).marker, origins.get(b.unit).marker);
    });
    if (items.every((item, index) => item.unit === sorted[index].unit)) return;
    const active = document.activeElement;
    // Rank all results together, then fill their existing slots across every batch.
    // Non-result siblings and loading sentinels stay in their original containers.
    const slots = items.map(({ unit }) => {
      const slot = document.createComment("lems-sort-slot");
      unit.parentNode.insertBefore(slot, unit);
      return slot;
    });
    slots.forEach((slot, index) => {
      const unit = sorted[index].unit;
      const parent = slot.parentNode;
      move(parent, unit, slot);
      origins.get(unit).currentParent = parent;
      slot.remove();
    });
    if (active && active !== document.body && active.isConnected && document.activeElement !== active) active.focus({ preventScroll: true });
  }

  function ensureToolbar(root) {
    if (!state.toolbar?.isConnected) {
      const bar = document.createElement("div");
      bar.id = TOOLBAR_ID;
      bar.setAttribute("role", "group");
      bar.setAttribute("aria-label", "Sort exact matches by image size");
      bar.title = "Sort loaded results by Google-reported width × height. Original file dimensions are not independently verified. Unknown sizes stay last.";
      const label = document.createElement("span");
      label.textContent = "Image size";
      bar.append(label);
      for (const [direction, text] of [["desc", "Largest first"], ["asc", "Smallest first"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.id = `lems-${direction}`;
        button.textContent = text;
        button.addEventListener("click", () => setDirection(direction));
        bar.append(button);
      }
      const status = document.createElement("span");
      status.id = "lems-status";
      status.setAttribute("role", "status");
      bar.append(status);
      state.toolbar = bar;
    }
    // Stay in the document flow immediately above Google's native result list.
    if (root.previousElementSibling !== state.toolbar) root.before(state.toolbar);
    for (const direction of ["desc", "asc"]) {
      const button = state.toolbar.querySelector(`#lems-${direction}`);
      const pressed = String(state.direction === direction);
      if (button.getAttribute("aria-pressed") !== pressed) button.setAttribute("aria-pressed", pressed);
    }
    const known = state.records.filter(item => item.size).length;
    const text = state.records.length
      ? `${state.records.length} loaded matches · ${known} reported sizes · sorted across all loaded matches`
      : "Waiting for supported exact-match results";
    const status = state.toolbar.querySelector("#lems-status");
    if (status.textContent !== text) status.textContent = text;
  }

  function observe() {
    observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ["href", "src", "aria-selected", "aria-current", "selected", "hidden", "aria-hidden", "style", "class"] });
  }

  function process() {
    clearTimeout(state.timer);
    state.timer = null;
    observer.disconnect();
    try {
      if (!document.body || !isExactPage()) {
        restore();
        state.toolbar?.remove();
        state.toolbar = null;
        state.records = [];
        state.groups = 0;
        return;
      }
      const root = document.querySelector("#rso") || document.querySelector("#search") || document.querySelector('main, [role="main"]');
      if (!root) {
        restore();
        state.toolbar?.remove();
        state.toolbar = null;
        state.records = [];
        state.groups = 0;
        return;
      }
      state.records = collect(root);
      sortResults(root);
      ensureToolbar(root);
    } finally {
      observe();
    }
  }

  function schedule() {
    if (state.timer === null) state.timer = setTimeout(process, 180);
  }

  function setDirection(direction) {
    if (!["asc", "desc"].includes(direction)) return;
    state.direction = direction;
    process();
  }

  function status() {
    return { exact: isExactPage(), count: state.records.length, known: state.records.filter(item => item.size).length, direction: state.direction, groups: state.groups };
  }

  function init() {
    observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => !((mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement)?.closest(`#${TOOLBAR_ID}`)))) schedule();
    });
    process();
    window.addEventListener("popstate", schedule);
    window.addEventListener("hashchange", schedule);
    // SPA navigation can change the URL without a DOM mutation or popstate event.
    setInterval(() => {
      if (location.href !== lastURL) {
        lastURL = location.href;
        schedule();
      }
    }, 1000);
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
      if (message?.action === "sort") setDirection(message.direction);
      if (message?.action === "status" || message?.action === "sort") respond(status());
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
