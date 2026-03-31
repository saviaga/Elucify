(function () {
  const ELUCIFY_URL = "https://elucify-clausaviaga.replit.app";

  function getArxivId() {
    const match = window.location.pathname.match(/\/abs\/(.+)/);
    return match ? match[1].replace(/v\d+$/, "") : null;
  }

  function buildElucifyUrl(arxivId, section) {
    const base = `${ELUCIFY_URL}/?arxiv=${encodeURIComponent(arxivId)}`;
    return section ? `${base}&section=${section}` : base;
  }

  function getText(selector) {
    const el = document.querySelector(selector);
    if (!el) return "";
    return el.textContent.trim().replace(/^\s*(Abstract:|Title:)\s*/i, "").trim();
  }

  const SECTIONS = [
    { label: "Paper Overview", key: "paper",                   icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>' },
    { label: "Summary",        key: "summary",                  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/></svg>' },
    { label: "Simplification", key: "conceptual-simplification",icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>' },
    { label: "Glossary",       key: "glossary",                 icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/></svg>' },
    { label: "FAQs",           key: "faqs",                     icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>' },
    { label: "Research Gap",   key: "research-gap",             icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>' },
    { label: "Prerequisites",  key: "prerequisites",            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>' },
    { label: "Figures",        key: "figures",                  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>' },
    { label: "Chat",           key: "chat",                     icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>' },
  ];

  function injectPanel() {
    if (document.getElementById("elucify-panel")) return;

    const arxivId = getArxivId();
    if (!arxivId) return;

    const elucifyUrl = buildElucifyUrl(arxivId);

    // Extract page content
    const title = getText("h1.title") || getText(".title");
    const dateline = getText(".dateline") || "";
    const dateMatch = dateline.match(/\[Submitted[^\]]*\]/);
    const dateText = dateMatch ? dateMatch[0] : dateline.split("\n")[0];
    const abstract = getText("blockquote.abstract");
    const abstractSnippet = abstract.length > 320 ? abstract.slice(0, 320) + "…" : abstract;

    const sectionLinks = SECTIONS.map(s =>
      `<a class="elucify-section-link" href="${buildElucifyUrl(arxivId, s.key)}" target="_blank" rel="noopener">
        <span class="elucify-section-icon">${s.icon}</span>
        ${s.label}
      </a>`
    ).join("");

    const panel = document.createElement("div");
    panel.id = "elucify-panel";
    panel.innerHTML = `
      <div id="elucify-header">
        <div id="elucify-header-left">
          <svg id="elucify-logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <span id="elucify-header-name">Elucify</span>
        </div>
        <a id="elucify-view-link" href="${elucifyUrl}" target="_blank" rel="noopener">
          Analyze in Elucify
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
        </a>
      </div>
      <div id="elucify-body">
        <div id="elucify-left">
          <div id="elucify-paper-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.5"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
            <span>${title || "arXiv:" + arxivId}</span>
          </div>
          ${dateText ? `<div id="elucify-date">${dateText} &nbsp;|&nbsp; ${arxivId}</div>` : `<div id="elucify-date">${arxivId}</div>`}
          ${abstractSnippet ? `<div id="elucify-abstract"><strong>Abstract:</strong> ${abstractSnippet}</div>` : ""}
        </div>
        <div id="elucify-right">
          <div id="elucify-content-label">CONTENT</div>
          <div id="elucify-section-list">${sectionLinks}</div>
        </div>
      </div>
    `;

    const abstract_el = document.querySelector("blockquote.abstract");
    const insertTarget = abstract_el ? abstract_el.parentElement : document.querySelector("#abs");
    if (insertTarget) {
      insertTarget.insertAdjacentElement("afterend", panel);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectPanel);
  } else {
    injectPanel();
  }
})();
