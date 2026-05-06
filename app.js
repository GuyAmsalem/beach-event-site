const STORAGE_KEY = "beach-event-checklist-v1";

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

function getChecklistArticles() {
  return Array.from(document.querySelectorAll(".checklist-grid article")).filter(
    (article) => article.querySelectorAll('input[type="checkbox"][id]').length > 0,
  );
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
    if (progressFeedback) {
      if (percent === 100) {
        progressFeedback.textContent = "מעולים! הרשימה הושלמה.";
      } else if (percent >= 70) {
        progressFeedback.textContent = "עוד קצת ואתם שם.";
      } else if (percent >= 35) {
        progressFeedback.textContent = "קצב מעולה, ממשיכים.";
      } else {
        progressFeedback.textContent = "";
      }
    }
  });
}

function updateProgress() {
  updateArticleProgressBars();
}

function hydrateCheckboxes() {
  const state = loadState();
  getCheckboxes().forEach((checkbox) => {
    checkbox.checked = Boolean(state[checkbox.id]);
  });
  updateProgress();
}

function bindCheckboxPersistence() {
  const state = loadState();
  getCheckboxes().forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      state[checkbox.id] = checkbox.checked;
      saveState(state);
      updateProgress();
    });
  });
}

function bindResetButton() {
  const resetButton = document.getElementById("reset-checklist");
  if (!resetButton) {
    return;
  }

  resetButton.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    getCheckboxes().forEach((checkbox) => {
      checkbox.checked = false;
    });
    updateProgress();
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

hydrateCheckboxes();
ensureArticleProgressBars();
updateArticleProgressBars();
bindCheckboxPersistence();
bindResetButton();
bindActiveSectionNav();
