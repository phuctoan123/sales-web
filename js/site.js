(function () {
  "use strict";

  const siteNav = document.querySelector(".site-nav");
  let menuToggle = document.querySelector(".menu-toggle");

  if (siteNav && !menuToggle) {
    if (!siteNav.id) siteNav.id = "site-nav";
    menuToggle = document.createElement("button");
    menuToggle.className = "menu-toggle";
    menuToggle.type = "button";
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-controls", siteNav.id || "site-nav");
    menuToggle.setAttribute("aria-label", document.documentElement.lang === "en" ? "Open menu" : "Mở menu");
    menuToggle.textContent = "☰";
    siteNav.before(menuToggle);
  }

  if (menuToggle && siteNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = siteNav.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    siteNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        siteNav.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  document.querySelectorAll("[data-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });

  const consultationForm = document.querySelector("[data-consultation-form]");
  const formStatus = document.querySelector("[data-form-status]");
  const isEnglish = document.documentElement.lang === "en";
  const copy = isEnglish
    ? {
        sending: "Sending your request...",
        fallback: "Something went wrong. Please contact us directly.",
        success: "Thank you. I will get back to you as soon as possible.",
      }
    : {
        sending: "Đang gửi thông tin...",
        fallback: "Có lỗi xảy ra. Vui lòng liên hệ trực tiếp qua email hoặc Zalo.",
        success: "Cảm ơn bạn. Tôi sẽ phản hồi trong thời gian sớm nhất.",
      };

  if (consultationForm && formStatus) {
    consultationForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      formStatus.className = "form-status";
      formStatus.textContent = copy.sending;

      const formData = new FormData(consultationForm);
      const payload = Object.fromEntries(formData.entries());
      payload.language = document.documentElement.lang;
      payload.source_page = window.location.pathname;

      try {
        const response = await fetch("/api/consultation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || "Không thể gửi thông tin.");
        }

        formStatus.className = "form-status success";
        formStatus.textContent = isEnglish ? copy.success : result.message;
        consultationForm.reset();

        if (typeof window.gtag === "function") {
          window.gtag("event", "generate_lead", { method: "consultation_form" });
        }
      } catch (error) {
        formStatus.className = "form-status error";
        formStatus.textContent =
          isEnglish ? copy.fallback : error.message || copy.fallback;
      }
    });
  }
})();
