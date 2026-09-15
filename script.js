const CONFIG = {
  whatsappNumber: "5527988021747",
  sheetEndpoint:
    "https://script.google.com/macros/s/AKfycbwrCkcX0mvzbihwCQVqYVoKgnTStFOPb6qkco_47DFNLrP6o1LMoOjErDqX5LyYGgH45Q/exec",
  sheetSiteId: "rendaverde-igreen",
  landingVersion: "compacta_instigante_v3",
};

const leadDialog = document.querySelector("#leadDialog");
const leadForm = document.querySelector("#leadForm");
const formError = document.querySelector("#formError");
const mobileCta = document.querySelector(".mobile-cta");
const hero = document.querySelector(".hero");
const offer = document.querySelector(".offer");
const closing = document.querySelector(".closing");

let lastTrigger = null;
let entryPoint = "unknown";
let heroVisible = true;
let conversionSectionVisible = false;

function trackEvent(name, parameters = {}) {
  if (typeof window.gtag === "function") {
    window.gtag("event", name, {
      landing_version: CONFIG.landingVersion,
      ...parameters,
    });
  }

  if (typeof window.clarity === "function") {
    window.clarity("event", name);
  }
}

if (typeof window.clarity === "function") {
  window.clarity("set", "landing_version", CONFIG.landingVersion);
}

function identifyEntryPoint(button) {
  if (button.closest(".nav")) return "navigation";
  if (button.closest(".hero")) return "hero";
  if (button.closest(".reason")) return "opportunity";
  if (button.closest(".offer")) return "offer";
  if (button.closest(".closing")) return "closing";
  if (button.closest(".mobile-cta")) return "mobile_sticky";
  return "unknown";
}

function openLeadDialog(button) {
  lastTrigger = button;
  entryPoint = identifyEntryPoint(button);
  formError.textContent = "";

  if (typeof leadDialog.showModal === "function") {
    leadDialog.showModal();
  } else {
    leadDialog.setAttribute("open", "");
  }

  document.body.classList.add("dialog-open");
  updateMobileCta();
  trackEvent("pre_atendimento_aberto", { entry_point: entryPoint });
  window.setTimeout(() => document.querySelector("#leadName")?.focus(), 80);
}

document.querySelectorAll("[data-open-lead]").forEach((button) => {
  button.addEventListener("click", () => openLeadDialog(button));
});

leadDialog.addEventListener("close", () => {
  document.body.classList.remove("dialog-open");
  updateMobileCta();
  lastTrigger?.focus();
});

leadDialog.addEventListener("click", (event) => {
  if (event.target === leadDialog) {
    leadDialog.close();
  }
});

const phoneInput = document.querySelector("#leadPhone");

phoneInput.addEventListener("input", () => {
  const digits = phoneInput.value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    phoneInput.value = digits ? `(${digits}` : "";
  } else if (digits.length <= 6) {
    phoneInput.value = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  } else if (digits.length <= 10) {
    phoneInput.value = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  } else {
    phoneInput.value = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
});

function createLeadId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getTrackingData() {
  const params = new URLSearchParams(window.location.search);

  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    gclid: params.get("gclid") || "",
    fbclid: params.get("fbclid") || "",
    page_url: window.location.href,
  };
}

async function saveLeadToSheet(data) {
  if (!CONFIG.sheetEndpoint) return false;

  const formData = new URLSearchParams();
  formData.set(
    "payload",
    JSON.stringify({
      site_id: CONFIG.sheetSiteId,
      ...data,
    }),
  );

  if (navigator.sendBeacon?.(CONFIG.sheetEndpoint, formData)) {
    return true;
  }

  try {
    await fetch(CONFIG.sheetEndpoint, {
      method: "POST",
      mode: "no-cors",
      body: formData,
      keepalive: true,
    });
    return true;
  } catch (error) {
    console.error("Falha ao registrar o pré-atendimento:", error);
    return false;
  }
}

function validateLead() {
  const name = document.querySelector("#leadName").value.trim();
  const phone = phoneInput.value.replace(/\D/g, "");
  const city = document.querySelector("#leadCity").value.trim();
  const profile = document.querySelector("#leadProfile").value;
  const consent = document.querySelector("#leadConsent").checked;

  if (name.length < 2) return "Informe seu nome para continuar.";
  if (phone.length < 10 || phone.length > 13) {
    return "Informe um WhatsApp válido, com DDD.";
  }
  if (city.length < 2) return "Informe sua cidade para continuar.";
  if (!profile) return "Selecione o que você busca neste momento.";
  if (!consent) return "Autorize o contato para iniciar o atendimento.";

  return "";
}

function createWhatsappUrl({ name, city, profile }) {
  const message = [
    `Olá! Meu nome é ${name}, sou de ${city}.`,
    `Quero entender se a licença Connect Full faz sentido para o meu perfil (${profile}).`,
    "Vim pela página de pré-atendimento.",
  ].join(" ");

  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

leadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = validateLead();

  if (formError.textContent) return;

  const submitButton = leadForm.querySelector("button[type='submit']");
  const name = document.querySelector("#leadName").value.trim();
  const whatsapp = phoneInput.value.replace(/\D/g, "");
  const city = document.querySelector("#leadCity").value.trim();
  const profile = document.querySelector("#leadProfile").value;

  submitButton.disabled = true;
  submitButton.textContent = "ABRINDO ATENDIMENTO…";

  const lead = {
    lead_id: createLeadId(),
    lead_type: "licenciado",
    destination: "whatsapp",
    source: CONFIG.landingVersion,
    nome: name,
    whatsapp,
    cidade: city,
    perfil: profile,
    entry_point: entryPoint,
    created_at: new Date().toISOString(),
    ...getTrackingData(),
  };

  trackEvent("lead_atendimento_enviado", {
    entry_point: entryPoint,
    profile,
  });

  await Promise.race([
    saveLeadToSheet(lead),
    new Promise((resolve) => window.setTimeout(resolve, 450)),
  ]);

  window.location.href = createWhatsappUrl({ name, city, profile });
});

function updateMobileCta() {
  const smallScreen = window.matchMedia("(max-width: 620px)").matches;
  const shouldShow =
    smallScreen &&
    !heroVisible &&
    !conversionSectionVisible &&
    !document.body.classList.contains("dialog-open");

  mobileCta.classList.toggle("is-visible", shouldShow);
  mobileCta.setAttribute("aria-hidden", String(!shouldShow));

  if (shouldShow) {
    mobileCta.removeAttribute("inert");
  } else {
    mobileCta.setAttribute("inert", "");
  }
}

const heroObserver = new IntersectionObserver(
  ([entry]) => {
    heroVisible = entry.isIntersecting;
    updateMobileCta();
  },
  { threshold: 0.12 },
);

const conversionObserver = new IntersectionObserver(
  (entries) => {
    conversionSectionVisible = entries.some((entry) => entry.isIntersecting);
    updateMobileCta();
  },
  { threshold: 0.08 },
);

heroObserver.observe(hero);
conversionObserver.observe(offer);
conversionObserver.observe(closing);
window.addEventListener("resize", updateMobileCta);

document.querySelector("#currentYear").textContent = new Date().getFullYear();
