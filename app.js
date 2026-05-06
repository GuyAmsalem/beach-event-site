const STORAGE_KEY = "beach-event-checklist-v1";
const CUSTOM_ITEMS_KEY = "beach-event-custom-items-v1";
const DEFAULT_EVENT_ID = "beach-event-2026-shared";

const appConfig = window.__APP_CONFIG__ ?? {};
const SUPABASE_URL = String(appConfig.supabaseUrl ?? "").trim();
const SUPABASE_ANON_KEY = String(appConfig.supabaseAnonKey ?? "").trim();
const EVENT_ID = String(appConfig.eventId ?? DEFAULT_EVENT_ID).trim() || DEFAULT_EVENT_ID;

let checkboxState = {};
let customItemsByArticle = {};
let syncEngine = null;
const boundCheckboxes = new WeakSet();
const MAX_CUSTOM_ITEM_LENGTH = 80;

function checkboxIdForItem(articleKey, itemId) {
  return `custom-${safeIdPart(articleKey)}-${safeIdPart(itemId)}`;
}

function getCheckboxes() {
  return Array.from(document.querySelectorAll('input[type="checkbox"][id]'));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadCustomItems() {
  const raw = localStorage.getItem(CUSTOM_ITEMS_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveCustomItems(itemsByArticle) {
  localStorage.setItem(CUSTOM_ITEMS_KEY, JSON.stringify(itemsByArticle));
}

function safeIdPart(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function normalizeCheckboxState(value) {
  if (!value || typeof value !== "object") {
    return {};
  }
  const result = {};
  Object.entries(value).forEach(([key, checked]) => {
    result[key] = Boolean(checked);
  });
  return result;
}

function normalizeCustomItems(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const normalized = {};
  Object.entries(value).forEach(([articleKey, items]) => {
    if (!Array.isArray(items)) {
      return;
    }
    normalized[articleKey] = items
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id ?? "").trim(),
        text: String(item.text ?? "").trim(),
      }))
      .filter((item) => item.id && item.text);
  });

  return normalized;
}

function snapshotHash(checkboxes, customItems) {
  return JSON.stringify({
    checkbox_state: checkboxes,
    custom_items: customItems,
  });
}

function persistLocalState() {
  saveState(checkboxState);
  saveCustomItems(customItemsByArticle);
}

function pushStateUpdate({ sync = true } = {}) {
  persistLocalState();
  updateProgress();
  if (sync) {
    syncEngine?.schedulePush();
  }
}

function ensureArticleItems(articleKey) {
  if (!Array.isArray(customItemsByArticle[articleKey])) {
    customItemsByArticle[articleKey] = [];
  }
  return customItemsByArticle[articleKey];
}

function addCustomItem(articleKey, rawText) {
  const text = String(rawText ?? "").trim().slice(0, MAX_CUSTOM_ITEM_LENGTH);
  if (!articleKey || !text) {
    return null;
  }

  const itemId = `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const items = ensureArticleItems(articleKey);
  items.push({ id: itemId, text });
  checkboxState[checkboxIdForItem(articleKey, itemId)] = false;
  pushStateUpdate();
  return itemId;
}

function renameCustomItem(articleKey, itemId, rawText) {
  const nextText = String(rawText ?? "").trim().slice(0, MAX_CUSTOM_ITEM_LENGTH);
  if (!articleKey || !itemId || !nextText) {
    return false;
  }

  const items = ensureArticleItems(articleKey);
  const target = items.find((item) => item.id === itemId);
  if (!target || target.text === nextText) {
    return false;
  }

  target.text = nextText;
  pushStateUpdate();
  return true;
}

function deleteCustomItem(articleKey, itemId) {
  if (!articleKey || !itemId) {
    return false;
  }

  const items = ensureArticleItems(articleKey);
  const nextItems = items.filter((item) => item.id !== itemId);
  if (nextItems.length === items.length) {
    return false;
  }

  customItemsByArticle[articleKey] = nextItems;
  delete checkboxState[checkboxIdForItem(articleKey, itemId)];
  pushStateUpdate();
  return true;
}

function toggleCheckboxState(checkboxId, checked) {
  checkboxState[checkboxId] = Boolean(checked);
  pushStateUpdate();
}

function closeAllItemMenus(exceptRow = null) {
  document.querySelectorAll(".custom-item-row.is-menu-open").forEach((row) => {
    if (row !== exceptRow) {
      row.classList.remove("is-menu-open");
    }
  });
}

function createCustomItemRow(article, articleKey, item) {
  const checkboxId = checkboxIdForItem(articleKey, item.id);
  const row = document.createElement("div");
  row.className = "checklist-item-row custom-item-row";
  row.dataset.articleKey = articleKey;
  row.dataset.itemId = item.id;

  const mainLabel = document.createElement("label");
  mainLabel.className = "checklist-item-main";
  mainLabel.setAttribute("for", checkboxId);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = checkboxId;

  const textNode = document.createElement("span");
  textNode.className = "item-text";
  textNode.textContent = item.text;

  mainLabel.append(checkbox, textNode);

  const actions = document.createElement("div");
  actions.className = "item-actions";
  actions.innerHTML = `
    <button type="button" class="item-action-btn edit" data-action="edit">עריכה</button>
    <button type="button" class="item-action-btn delete" data-action="delete">מחיקה</button>
  `;

  const menuTrigger = document.createElement("button");
  menuTrigger.type = "button";
  menuTrigger.className = "item-menu-trigger";
  menuTrigger.setAttribute("aria-label", "פתיחת תפריט פעולות");
  menuTrigger.textContent = "⋮";

  const menu = document.createElement("div");
  menu.className = "item-menu";
  menu.innerHTML = `
    <button type="button" class="item-menu-btn" data-action="edit">עריכה</button>
    <button type="button" class="item-menu-btn danger" data-action="delete">מחיקה</button>
  `;

  row.append(mainLabel, actions, menuTrigger, menu);
  const articleBody = getArticleBody(article);
  if (articleBody) {
    articleBody.append(row);
  } else {
    article.append(row);
  }
  return row;
}

function getChecklistArticles() {
  return Array.from(document.querySelectorAll(".checklist-grid article")).filter(
    (article) => article.querySelectorAll('input[type="checkbox"][id]').length > 0,
  );
}

function getArticleBody(article) {
  return article.querySelector(".article-body");
}

function ensureArticleLayout() {
  getChecklistArticles().forEach((article) => {
    let articleBody = article.querySelector(".article-body");
    if (!articleBody) {
      articleBody = document.createElement("div");
      articleBody.className = "article-body";
    }

    let articleFooter = article.querySelector(".article-footer");
    if (!articleFooter) {
      articleFooter = document.createElement("div");
      articleFooter.className = "article-footer";
    }

    const labels = Array.from(article.querySelectorAll(":scope > label"));
    labels.forEach((label) => articleBody.append(label));

    const progress = article.querySelector(".article-progress");
    const composer = article.querySelector(".item-composer");

    if (progress) {
      progress.insertAdjacentElement("afterend", articleBody);
    } else {
      const title = article.querySelector("h3");
      if (title) {
        title.insertAdjacentElement("afterend", articleBody);
      } else {
        article.prepend(articleBody);
      }
    }

    if (composer) {
      articleFooter.append(composer);
    }

    article.append(articleFooter);
  });
}

function ensureArticleKeys() {
  const sections = Array.from(document.querySelectorAll(".layout > section[id]"));
  sections.forEach((section) => {
    const articles = Array.from(section.querySelectorAll(".checklist-grid article"));
    articles.forEach((article, index) => {
      if (!article.dataset.articleKey) {
        article.dataset.articleKey = `${section.id}::${index}`;
      }
    });
  });
}

function onCheckboxChange(checkbox) {
  toggleCheckboxState(checkbox.id, checkbox.checked);
}

function bindCheckboxPersistence() {
  getCheckboxes().forEach((checkbox) => {
    if (boundCheckboxes.has(checkbox)) {
      return;
    }
    checkbox.addEventListener("change", () => onCheckboxChange(checkbox));
    boundCheckboxes.add(checkbox);
  });
}

function ensureItemComposer() {
  getChecklistArticles().forEach((article) => {
    let composer = article.querySelector(".item-composer");
    if (!composer) {
      composer = document.createElement("form");
      composer.className = "item-composer";
      composer.innerHTML = `
        <input type="text" class="item-composer-input" placeholder="פריט חדש לרשימה..." maxlength="${MAX_CUSTOM_ITEM_LENGTH}" />
        <button type="submit" class="item-composer-btn">הוסף</button>
      `;
      const articleFooter = article.querySelector(".article-footer");
      if (articleFooter) {
        articleFooter.append(composer);
      } else {
        article.append(composer);
      }
    }
  });
}

function clearCustomItemsFromDom() {
  closeAllItemMenus();
  document.querySelectorAll(".custom-item-row").forEach((node) => node.remove());
}

function restoreCustomItemsFromState() {
  clearCustomItemsFromDom();
  getChecklistArticles().forEach((article) => {
    const articleKey = article.dataset.articleKey;
    if (!articleKey) {
      return;
    }

    const items = Array.isArray(customItemsByArticle[articleKey]) ? customItemsByArticle[articleKey] : [];
    items.forEach((item) => {
      createCustomItemRow(article, articleKey, item);
    });
  });
}

function beginInlineEdit(row, articleKey, itemId) {
  if (!row || row.classList.contains("is-editing")) {
    return;
  }

  const textNode = row.querySelector(".item-text");
  if (!textNode) {
    return;
  }

  const originalText = textNode.textContent ?? "";
  row.classList.add("is-editing");
  row.classList.remove("is-menu-open");

  const input = document.createElement("input");
  input.type = "text";
  input.className = "item-edit-input";
  input.maxLength = MAX_CUSTOM_ITEM_LENGTH;
  input.value = originalText;
  textNode.replaceWith(input);

  const finishEdit = (shouldSave) => {
    if (!row.classList.contains("is-editing")) {
      return;
    }
    row.classList.remove("is-editing");
    const nextValue = input.value.trim();
    if (shouldSave && nextValue && nextValue !== originalText) {
      if (renameCustomItem(articleKey, itemId, nextValue)) {
        restoreCustomItemsFromState();
        bindCheckboxPersistence();
        applyCheckboxStateToDom();
      }
    }
    updateProgress();
    closeAllItemMenus();
    if (input.isConnected) {
      const restoredText = document.createElement("span");
      restoredText.className = "item-text";
      restoredText.textContent = nextValue || originalText;
      input.replaceWith(restoredText);
    }
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finishEdit(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finishEdit(false);
    }
  });
  input.addEventListener("blur", () => finishEdit(true));
  input.focus();
  input.select();
}

function handleCustomItemAction(row, action) {
  if (!row) {
    return;
  }
  const articleKey = row.dataset.articleKey;
  const itemId = row.dataset.itemId;
  if (!articleKey || !itemId) {
    return;
  }

  if (action === "edit") {
    beginInlineEdit(row, articleKey, itemId);
    return;
  }

  if (action === "delete" && deleteCustomItem(articleKey, itemId)) {
    restoreCustomItemsFromState();
    bindCheckboxPersistence();
    applyCheckboxStateToDom();
    updateProgress();
  }
}

function bindCustomItemActions() {
  getChecklistArticles().forEach((article) => {
    const body = getArticleBody(article);
    if (!body || body.dataset.customActionsBound === "true") {
      return;
    }

    body.dataset.customActionsBound = "true";
    body.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-action], .item-menu-trigger");
      if (!trigger) {
        return;
      }

      const row = trigger.closest(".custom-item-row");
      if (!row) {
        return;
      }

      if (trigger.classList.contains("item-menu-trigger")) {
        event.preventDefault();
        const willOpen = !row.classList.contains("is-menu-open");
        closeAllItemMenus(row);
        row.classList.toggle("is-menu-open", willOpen);
        return;
      }

      const action = trigger.dataset.action;
      if (!action) {
        return;
      }
      event.preventDefault();
      handleCustomItemAction(row, action);
    });
  });
}

function bindGlobalMenuDismiss() {
  if (document.body.dataset.customMenuDismissBound === "true") {
    return;
  }
  document.body.dataset.customMenuDismissBound = "true";

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      closeAllItemMenus();
      return;
    }
    if (!target.closest(".custom-item-row")) {
      closeAllItemMenus();
    }
  });
}

function bindItemComposer() {
  getChecklistArticles().forEach((article) => {
    const composer = article.querySelector(".item-composer");
    const input = article.querySelector(".item-composer-input");
    if (!composer || !input) {
      return;
    }
    if (composer.dataset.bound === "true") {
      return;
    }

    composer.dataset.bound = "true";
    composer.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) {
        return;
      }

      const articleKey = article.dataset.articleKey;
      if (!articleKey) {
        return;
      }

      if (!addCustomItem(articleKey, text)) {
        return;
      }

      restoreCustomItemsFromState();
      bindCustomItemActions();
      bindCheckboxPersistence();
      applyCheckboxStateToDom();

      input.value = "";
    });
  });
}

function ensureArticleProgressBars() {
  getChecklistArticles().forEach((article) => {
    let progressWrap = article.querySelector(".article-progress");
    if (!progressWrap) {
      progressWrap = document.createElement("div");
      progressWrap.className = "article-progress";
      progressWrap.innerHTML = `
        <div class="article-progress-head">
          <span class="article-progress-label">התקדמות</span>
          <span class="article-progress-text">0%</span>
        </div>
        <div class="article-progress-track" aria-hidden="true">
          <span class="article-progress-fill"></span>
        </div>
        <p class="article-progress-feedback" aria-live="polite"></p>
      `;

      const articleTitle = article.querySelector("h3");
      if (articleTitle) {
        articleTitle.insertAdjacentElement("afterend", progressWrap);
      } else {
        article.prepend(progressWrap);
      }
    }
  });
}

function updateArticleProgressBars() {
  getChecklistArticles().forEach((article) => {
    const articleCheckboxes = Array.from(article.querySelectorAll('input[type="checkbox"][id]'));
    if (!articleCheckboxes.length) {
      return;
    }

    const checkedCount = articleCheckboxes.filter((checkbox) => checkbox.checked).length;
    const totalCount = articleCheckboxes.length;
    const percent = Math.round((checkedCount / totalCount) * 100);

    const progressWrap = article.querySelector(".article-progress");
    if (!progressWrap) {
      return;
    }

    const progressText = progressWrap.querySelector(".article-progress-text");
    const progressFill = progressWrap.querySelector(".article-progress-fill");
    const progressFeedback = progressWrap.querySelector(".article-progress-feedback");

    if (progressText) {
      progressText.textContent = `${checkedCount}/${totalCount} (${percent}%)`;
    }
    if (progressFill) {
      progressFill.style.width = `${percent}%`;
    }
    article.classList.toggle("is-complete", percent === 100);
    if (progressFeedback) {
      if (percent === 100) {
        progressFeedback.textContent = "מעולים! הרשימה הושלמה.";
      } else if (percent >= 70) {
        progressFeedback.textContent = "עוד קצת ואתם שם.";
      } else if (percent >= 35) {
        progressFeedback.textContent = "קצב מעולה, ממשיכים.";
      } else {
        progressFeedback.textContent = "\u00A0";
      }
    }
  });
}

function updateProgress() {
  updateArticleProgressBars();
}

function applyCheckboxStateToDom() {
  getCheckboxes().forEach((checkbox) => {
    checkbox.checked = Boolean(checkboxState[checkbox.id]);
  });
}

function applySnapshot(snapshot) {
  checkboxState = normalizeCheckboxState(snapshot.checkbox_state);
  customItemsByArticle = normalizeCustomItems(snapshot.custom_items);

  persistLocalState();
  restoreCustomItemsFromState();
  bindCustomItemActions();
  bindCheckboxPersistence();
  applyCheckboxStateToDom();
  updateProgress();
}

function collectSnapshot() {
  return {
    checkbox_state: normalizeCheckboxState(checkboxState),
    custom_items: normalizeCustomItems(customItemsByArticle),
  };
}

class RealtimeSyncEngine {
  constructor(client, eventId) {
    this.client = client;
    this.eventId = eventId;
    this.lastSyncedHash = "";
    this.flushTimer = null;
  }

  async init() {
    await this.pullRemoteSnapshot();
    this.subscribeRealtime();
  }

  async pullRemoteSnapshot() {
    const { data, error } = await this.client
      .from("event_state")
      .select("checkbox_state, custom_items")
      .eq("event_id", this.eventId)
      .maybeSingle();

    if (error) {
      console.warn("Supabase initial load failed, using local state.", error.message);
      return;
    }

    if (data) {
      const remoteSnapshot = {
        checkbox_state: data.checkbox_state ?? {},
        custom_items: data.custom_items ?? {},
      };
      applySnapshot(remoteSnapshot);
      this.lastSyncedHash = snapshotHash(checkboxState, customItemsByArticle);
      return;
    }

    await this.pushNow();
  }

  async pushNow() {
    const snapshot = collectSnapshot();
    const nextHash = snapshotHash(snapshot.checkbox_state, snapshot.custom_items);

    if (nextHash === this.lastSyncedHash) {
      return;
    }

    const payload = {
      event_id: this.eventId,
      checkbox_state: snapshot.checkbox_state,
      custom_items: snapshot.custom_items,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.client.from("event_state").upsert(payload, { onConflict: "event_id" });
    if (error) {
      console.warn("Supabase sync failed, state kept locally.", error.message);
      return;
    }

    this.lastSyncedHash = nextHash;
  }

  schedulePush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      this.pushNow();
    }, 220);
  }

  subscribeRealtime() {
    this.client
      .channel(`event_state:${this.eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_state",
          filter: `event_id=eq.${this.eventId}`,
        },
        (payload) => {
          const nextData = payload.new ?? {};
          const remoteSnapshot = {
            checkbox_state: nextData.checkbox_state ?? {},
            custom_items: nextData.custom_items ?? {},
          };
          const remoteHash = snapshotHash(
            normalizeCheckboxState(remoteSnapshot.checkbox_state),
            normalizeCustomItems(remoteSnapshot.custom_items),
          );

          const currentHash = snapshotHash(checkboxState, customItemsByArticle);
          if (remoteHash === currentHash) {
            this.lastSyncedHash = currentHash;
            return;
          }

          applySnapshot(remoteSnapshot);
          this.lastSyncedHash = snapshotHash(checkboxState, customItemsByArticle);
        },
      )
      .subscribe();
  }
}

async function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      "Supabase config missing. Add real values in app-config.js (copy from app-config.example.js).",
    );
    return null;
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (error) {
    console.warn("Supabase client failed to load, using local storage only.", error);
    return null;
  }
}

function bindResetButton() {
  const resetButton = document.getElementById("reset-checklist");
  if (!resetButton) {
    return;
  }

  resetButton.addEventListener("click", () => {
    checkboxState = {};
    persistLocalState();
    applyCheckboxStateToDom();
    updateProgress();
    syncEngine?.schedulePush();
  });
}

function bindActiveSectionNav() {
  const navLinks = Array.from(document.querySelectorAll('.main-nav a[href^="#"]'));
  if (!navLinks.length) {
    return;
  }

  const sectionById = new Map();
  navLinks.forEach((link) => {
    const targetId = link.getAttribute("href")?.slice(1);
    if (!targetId) {
      return;
    }

    const section = document.getElementById(targetId);
    if (section) {
      sectionById.set(targetId, section);
    }
  });

  if (!sectionById.size) {
    return;
  }

  const navElement = document.querySelector(".main-nav");

  const scrollToSection = (section, shouldSmooth = true) => {
    const navHeight = navElement ? navElement.getBoundingClientRect().height : 0;
    const topOffset = navHeight + 16;
    const targetTop = window.scrollY + section.getBoundingClientRect().top - topOffset;

    window.scrollTo({
      top: targetTop,
      behavior: shouldSmooth ? "smooth" : "auto",
    });
  };

  const setActiveLink = (activeId) => {
    navLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${activeId}`;
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href")?.slice(1);
      if (!targetId) {
        return;
      }

      const section = sectionById.get(targetId);
      if (!section) {
        return;
      }

      event.preventDefault();
      scrollToSection(section, true);
      setActiveLink(targetId);

      if (window.location.hash !== `#${targetId}`) {
        window.history.pushState(null, "", `#${targetId}`);
      }
    });
  });

  window.addEventListener("hashchange", () => {
    const hashId = window.location.hash.replace("#", "");
    const section = sectionById.get(hashId);
    if (!section) {
      return;
    }

    setActiveLink(hashId);
    scrollToSection(section, false);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      const visibleEntries = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visibleEntries.length) {
        setActiveLink(visibleEntries[0].target.id);
      }
    },
    {
      root: null,
      rootMargin: "-28% 0px -58% 0px",
      threshold: [0.2, 0.35, 0.5],
    },
  );

  sectionById.forEach((section) => observer.observe(section));

  const initialHashId = window.location.hash.replace("#", "");
  if (sectionById.has(initialHashId)) {
    setActiveLink(initialHashId);
    // Wait one frame so layout/sticky nav size is final.
    requestAnimationFrame(() => scrollToSection(sectionById.get(initialHashId), false));
  } else {
    setActiveLink(sectionById.keys().next().value);
  }
}

async function init() {
  ensureArticleKeys();
  ensureArticleProgressBars();
  ensureArticleLayout();
  ensureItemComposer();
  ensureArticleLayout();

  checkboxState = normalizeCheckboxState(loadState());
  customItemsByArticle = normalizeCustomItems(loadCustomItems());
  restoreCustomItemsFromState();
  bindCustomItemActions();
  bindGlobalMenuDismiss();
  applyCheckboxStateToDom();
  bindCheckboxPersistence();
  bindItemComposer();
  bindResetButton();
  bindActiveSectionNav();
  updateProgress();

  const supabaseClient = await createSupabaseClient();
  if (!supabaseClient) {
    return;
  }

  syncEngine = new RealtimeSyncEngine(supabaseClient, EVENT_ID);
  await syncEngine.init();
}

init();
