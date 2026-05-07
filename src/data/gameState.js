/**
 * Central Game State Store
 * Single source of truth — all modules read/write through this object.
 * No UI logic lives here.
 */

"use strict";

const GameState = (() => {
  const state = {
    // Module 1 – Star Map
    stars: [],
    selectedStar: null,
    discoveredPlanets: [],   // array of { star, planet } objects

    // Scoring & rewards
    score: 0,
    missionLog: [],          // strings shown in the mission log panel

    // Module 2 – Analysis results (set when player analyses a transit)
    analysisResult: null,

    // Module 3 – Travel configuration
    travelConfig: null,
    travelResult: null,

    // Game phase: "starmap" | "analysis" | "travel" | "arrival"
    phase: "starmap",
  };

  function get(key) {
    return state[key];
  }

  function set(key, value) {
    state[key] = value;
  }

  function addToScore(points, reason) {
    state.score += points;
    log(`+${points} pts — ${reason}`);
  }

  function log(message) {
    const entry = { time: Date.now(), message };
    state.missionLog.unshift(entry);
    if (state.missionLog.length > 50) state.missionLog.pop();
    // Notify listeners
    document.dispatchEvent(new CustomEvent("gamestate:log", { detail: entry }));
  }

  function discoverPlanet(star, planet) {
    state.discoveredPlanets.push({ star, planet });
    addToScore(500, `Exoplanet entdeckt um ${star.name}`);
    document.dispatchEvent(new CustomEvent("gamestate:discovery", { detail: { star, planet } }));
  }

  return { get, set, addToScore, log, discoverPlanet };
})();

if (typeof module !== "undefined") module.exports = { GameState };
