/**
 * Application Bootstrap
 * Initialises all three modules after the DOM is ready.
 */

"use strict";

// Global panel switcher used by all UI modules
function showPanel(id) {
  document.querySelectorAll(".game-panel").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
  const tab = document.querySelector(`.nav-tab[data-panel="${id}"]`);
  if (tab) tab.classList.add("active");
}

document.addEventListener("DOMContentLoaded", () => {
  // Navigation tabs
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const panelId = tab.dataset.panel;
      showPanel(panelId);
    });
  });

  // Live mission log listener
  document.addEventListener("gamestate:log", e => {
    const list = document.getElementById("mission-log-list");
    const item = document.createElement("li");
    item.textContent = e.detail.message;
    list.prepend(item);
    if (list.children.length > 20) list.lastChild.remove();
  });

  // Discovery listener
  document.addEventListener("gamestate:discovery", e => {
    const counter = document.getElementById("discovery-count");
    counter.textContent = GameState.get("discoveredPlanets").length;
  });

  // Init all modules
  StarMapUI.init("star-map-canvas", "light-curve-canvas");
  AnalysisPanelUI.init("orbit-canvas");
  TravelPlannerUI.init();

  // Start on star map
  showPanel("starmap-panel");
  GameState.log("Willkommen! Teleskop bereit. Wähle einen Stern.");
});
