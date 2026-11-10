(function () {
  "use strict";

  const supportedLanguages = ["en", "vi"];
  let activeLanguage = "en";
  let controlsBound = false;

  function normalizeLanguage(language) {
    const normalized = String(language || "").toLowerCase().split("-")[0];
    return supportedLanguages.includes(normalized) ? normalized : "en";
  }

  function readStoredLanguage() {
    try {
      return window.localStorage.getItem("lang");
    } catch (error) {
      return null;
    }
  }

  function storeLanguage(language) {
    try {
      window.localStorage.setItem("lang", language);
    } catch (error) {
      // Storage may be unavailable when the page is opened in a restricted context.
    }
  }

  function resolveLanguage() {
    const queryLanguage = new URLSearchParams(window.location.search).get("lang");
    if (supportedLanguages.includes(normalizeLanguage(queryLanguage)) && queryLanguage) {
      return normalizeLanguage(queryLanguage);
    }

    const storedLanguage = readStoredLanguage();
    if (supportedLanguages.includes(normalizeLanguage(storedLanguage)) && storedLanguage) {
      return normalizeLanguage(storedLanguage);
    }

    return navigator.language && navigator.language.toLowerCase().startsWith("vi")
      ? "vi"
      : "en";
  }

  function getDictionary(language) {
    return language === "vi" ? window.I18N_VI : window.I18N_EN;
  }

  function getValue(dictionary, key) {
    return key.split(".").reduce((value, part) => {
      return value && Object.prototype.hasOwnProperty.call(value, part)
        ? value[part]
        : undefined;
    }, dictionary);
  }

  function translate(key, language) {
    const dictionary = getDictionary(language);
    const englishDictionary = getDictionary("en");
    const value = getValue(dictionary, key);

    if (value !== undefined) {
      return value;
    }

    const fallback = getValue(englishDictionary, key);
    console.warn("Missing translation key:", key, "for", language);
    return fallback === undefined ? "" : fallback;
  }

  function updateUrl(language) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", language);
      window.history.replaceState(null, "", url.toString());
    } catch (error) {
      // History updates can be restricted in some file:// environments.
    }
  }

  function setAttributeTranslations(language) {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = translate(element.dataset.i18n, language);
    });

    document.querySelectorAll("[data-i18n-html]").forEach((element) => {
      element.innerHTML = translate(element.dataset.i18nHtml, language);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.setAttribute(
        "placeholder",
        translate(element.dataset.i18nPlaceholder, language)
      );
    });

    document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
      element.setAttribute("alt", translate(element.dataset.i18nAlt, language));
    });

    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.setAttribute("title", translate(element.dataset.i18nTitle, language));
    });

    document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
      element.setAttribute(
        "aria-label",
        translate(element.dataset.i18nAria, language)
      );
    });

    document.querySelectorAll("[data-i18n-meta]").forEach((element) => {
      element.setAttribute(
        "content",
        translate(element.dataset.i18nMeta, language)
      );
    });

    document.title = translate("meta.title", language);
  }

  function updateLanguageControls(language) {
    document.querySelectorAll("[data-language]").forEach((button) => {
      const isActive = button.dataset.language === language;
      button.setAttribute("aria-pressed", String(isActive));
      button.classList.toggle("active", isActive);
    });
  }

  function setLanguage(language) {
    activeLanguage = normalizeLanguage(language);
    document.documentElement.lang = activeLanguage;
    setAttributeTranslations(activeLanguage);
    updateLanguageControls(activeLanguage);
    storeLanguage(activeLanguage);
    updateUrl(activeLanguage);
    window.dispatchEvent(
      new CustomEvent("languagechange", {
        detail: { language: activeLanguage },
      })
    );
  }

  function initialize() {
    if (!controlsBound) {
      document.querySelectorAll("[data-language]").forEach((button) => {
        button.addEventListener("click", () => setLanguage(button.dataset.language));
      });
      controlsBound = true;
    }
    setLanguage(resolveLanguage());
  }

  activeLanguage = resolveLanguage();
  document.documentElement.lang = activeLanguage;

  window.I18N = {
    get language() {
      return activeLanguage;
    },
    get: (key, language = activeLanguage) => translate(key, language),
    setLanguage,
  };

  setAttributeTranslations(activeLanguage);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
