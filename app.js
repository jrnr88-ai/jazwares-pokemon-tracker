const STORAGE_KEY = "jazwares-pokemon-collection-v1";
const CLOUD_CODE_KEY = "jazwares-cloud-code-hash-v1";
const CONFIG = window.JAZWARES_CONFIG || {};
const { items: baseItems, summary } = window.JAZWARES_DATA;

const els = {
  caughtCount: document.querySelector("#caughtCount"),
  missingCount: document.querySelector("#missingCount"),
  completionCount: document.querySelector("#completionCount"),
  progressBar: document.querySelector("#progressBar"),
  resultCount: document.querySelector("#resultCount"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  sizeFilter: document.querySelector("#sizeFilter"),
  regionFilter: document.querySelector("#regionFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  grid: document.querySelector("#grid"),
  emptyState: document.querySelector("#emptyState"),
  template: document.querySelector("#cardTemplate"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  resetBtn: document.querySelector("#resetBtn"),
  cloudBtn: document.querySelector("#cloudBtn"),
  cloudPanel: document.querySelector("#cloudPanel"),
  cloudStatus: document.querySelector("#cloudStatus"),
  codeForm: document.querySelector("#codeForm"),
  codeInput: document.querySelector("#codeInput"),
  disconnectBtn: document.querySelector("#disconnectBtn"),
};

const supabaseReady =
  CONFIG.supabaseUrl &&
  CONFIG.supabaseAnonKey &&
  !CONFIG.supabaseUrl.includes("TU-PROYECTO") &&
  !CONFIG.supabaseAnonKey.includes("PEGA_AQUI") &&
  window.supabase;
const db = supabaseReady ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey) : null;

let owned = loadOwnedState();
let cloudKey = localStorage.getItem(CLOUD_CODE_KEY);
let syncTimer = null;

function loadOwnedState() {
  const fallback = Object.fromEntries(baseItems.map((item) => [item.id, item.caught]));
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...fallback, ...(stored?.owned || {}) };
  } catch {
    return fallback;
  }
}

function saveOwnedState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      source: summary.sourceExcel,
      savedAt: new Date().toISOString(),
      owned,
    })
  );
}

async function hashCode(code) {
  const bytes = new TextEncoder().encode(`jazwares:${code.trim()}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function setCloudStatus(message, state = "local") {
  els.cloudStatus.textContent = message;
  els.cloudBtn.textContent = state === "online" ? "Nube activa" : state === "error" ? "Nube error" : "Nube local";
  els.cloudBtn.classList.toggle("is-online", state === "online");
  els.cloudBtn.classList.toggle("is-error", state === "error");
}

async function initCloud() {
  if (!db) {
    setCloudStatus("Configura Supabase para sincronizar entre celular y computadora.");
    return;
  }
  if (!cloudKey) {
    setCloudStatus("Escribe tu codigo privado para sincronizar en la nube.");
    return;
  }
  els.disconnectBtn.hidden = false;
  await loadCloudProgress();
}

async function connectCloud(code) {
  if (!db) {
    setCloudStatus("Primero configura Supabase en config.js.", "error");
    return;
  }
  if (code.trim().length < 6) {
    setCloudStatus("Usa un codigo de al menos 6 caracteres.", "error");
    return;
  }
  cloudKey = await hashCode(code);
  localStorage.setItem(CLOUD_CODE_KEY, cloudKey);
  els.codeInput.value = "";
  els.disconnectBtn.hidden = false;
  setCloudStatus("Conectando con tu codigo privado...");
  await loadCloudProgress();
  await seedCloudProgress();
}

async function loadCloudProgress() {
  if (!db || !cloudKey) return;
  const { data, error } = await db.rpc("get_collection_progress", { p_collection_key: cloudKey });
  if (error) {
    setCloudStatus(`No pude leer Supabase: ${error.message}`, "error");
    return;
  }

  const cloudOwned = Object.fromEntries((data || []).map((row) => [row.item_id, row.caught]));
  owned = { ...owned, ...cloudOwned };
  saveOwnedState();
  render();
  setCloudStatus("Sincronizado con codigo privado.", "online");
}

function queueCloudSave(itemId, caught) {
  saveOwnedState();
  if (!db || !cloudKey) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => saveCloudItem(itemId, caught), 250);
}

async function saveCloudItem(itemId, caught) {
  const { error } = await db.rpc("upsert_collection_progress", {
    p_collection_key: cloudKey,
    p_item_id: itemId,
    p_caught: caught,
  });
  if (error) {
    setCloudStatus(`No pude guardar en Supabase: ${error.message}`, "error");
  } else {
    setCloudStatus("Guardado en la nube.", "online");
  }
}

async function seedCloudProgress() {
  if (!db || !cloudKey) return;
  setCloudStatus("Subiendo progreso local a la nube...");
  for (const [itemId, caught] of Object.entries(owned)) {
    const { error } = await db.rpc("upsert_collection_progress", {
      p_collection_key: cloudKey,
      p_item_id: itemId,
      p_caught: caught,
    });
    if (error) {
      setCloudStatus(`No pude subir tu progreso actual: ${error.message}`, "error");
      return;
    }
  }
  setCloudStatus("Progreso sincronizado en la nube.", "online");
}

function uniqueOptions(key) {
  return [...new Set(baseItems.map((item) => item[key]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "es", { numeric: true })
  );
}

function fillSelect(select, label, values) {
  select.replaceChildren(new Option(label, "all"));
  values.forEach((value) => select.add(new Option(value, value)));
}

function normalized(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function itemMatches(item) {
  const query = normalized(els.searchInput.value);
  const haystack = normalized(
    [item.pokemon, item.size, item.region, item.wave, item.gen, item.packages.join(" ")].join(" ")
  );
  const status = els.statusFilter.value;
  const size = els.sizeFilter.value;
  const region = els.regionFilter.value;
  const isOwned = Boolean(owned[item.id]);

  if (query && !haystack.includes(query)) return false;
  if (status === "caught" && !isOwned) return false;
  if (status === "missing" && isOwned) return false;
  if (status === "pearly" && !item.pearly) return false;
  if (status === "tbd" && !item.pending) return false;
  if (size !== "all" && item.size !== size) return false;
  if (region !== "all" && item.region !== region) return false;
  return true;
}

function sortItems(items) {
  const sortKey = els.sortSelect.value;
  return [...items].sort((a, b) => {
    const first = String(a[sortKey] || "");
    const second = String(b[sortKey] || "");
    const result = first.localeCompare(second, "es", { numeric: true });
    return result || a.pokemon.localeCompare(b.pokemon, "es", { numeric: true });
  });
}

function renderStats(filteredItems) {
  const total = baseItems.length;
  const caught = baseItems.filter((item) => owned[item.id]).length;
  const missing = total - caught;
  const completion = total ? Math.round((caught / total) * 100) : 0;

  els.caughtCount.textContent = caught;
  els.missingCount.textContent = missing;
  els.completionCount.textContent = `${completion}%`;
  els.progressBar.style.width = `${completion}%`;
  els.resultCount.textContent = `${filteredItems.length} de ${total} piezas`;
}

function renderCard(item) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  const checkbox = node.querySelector("input");
  const image = node.querySelector("img");
  const fallback = node.querySelector(".fallback");
  const title = node.querySelector("h3");
  const meta = node.querySelector(".meta");
  const tags = node.querySelector(".tags");
  const packages = node.querySelector(".packages");
  const isOwned = Boolean(owned[item.id]);

  node.classList.toggle("is-caught", isOwned);
  node.classList.toggle("is-pearly", item.pearly);
  checkbox.checked = isOwned;
  checkbox.addEventListener("change", () => {
    owned[item.id] = checkbox.checked;
    queueCloudSave(item.id, checkbox.checked);
    render();
  });

  image.alt = item.pokemon;
  image.title = item.wikiFile || item.pokemon;
  fallback.hidden = true;
  if (!item.wikiImage) {
    image.hidden = true;
    fallback.hidden = false;
  } else {
    image.hidden = false;
    image.src = item.wikiImage;
  }
  image.addEventListener("error", () => {
    image.hidden = true;
    fallback.hidden = false;
  });

  title.textContent = item.pokemon;
  meta.textContent = [item.wave && `Wave ${item.wave}`, item.size, item.region].filter(Boolean).join(" · ");

  [
    item.gen ? `Gen ${item.gen}` : null,
    item.pearly ? "Variante" : null,
    item.pending ? "TBD" : null,
    isOwned ? "Atrapado" : "Falta",
  ]
    .filter(Boolean)
    .forEach((label) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = label;
      tags.append(tag);
    });

  packages.textContent = item.packages.length ? `Paquetes: ${item.packages.join(", ")}` : "Sin paquete registrado";
  return node;
}

function render() {
  const filtered = sortItems(baseItems.filter(itemMatches));
  const fragment = document.createDocumentFragment();
  filtered.forEach((item) => fragment.append(renderCard(item)));
  els.grid.replaceChildren(fragment);
  els.emptyState.hidden = filtered.length > 0;
  renderStats(filtered);
}

function exportProgress() {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          source: summary.sourceExcel,
          exportedAt: new Date().toISOString(),
          owned,
        },
        null,
        2
      ),
    ],
    { type: "application/json" }
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "jazwares-pokemon-progreso.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importProgress(file) {
  if (!file) return;
  const payload = JSON.parse(await file.text());
  if (!payload.owned || typeof payload.owned !== "object") {
    throw new Error("El archivo no tiene un progreso valido.");
  }
  owned = { ...owned, ...payload.owned };
  saveOwnedState();
  render();
  await seedCloudProgress();
}

async function resetToExcel() {
  owned = Object.fromEntries(baseItems.map((item) => [item.id, item.caught]));
  saveOwnedState();
  render();
  await seedCloudProgress();
}

fillSelect(els.sizeFilter, "Todos", uniqueOptions("size"));
fillSelect(els.regionFilter, "Todas", uniqueOptions("region"));

[els.searchInput, els.statusFilter, els.sizeFilter, els.regionFilter, els.sortSelect].forEach((control) => {
  control.addEventListener("input", render);
});

els.cloudBtn.addEventListener("click", () => {
  els.cloudPanel.hidden = !els.cloudPanel.hidden;
});
els.codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await connectCloud(els.codeInput.value);
});
els.disconnectBtn.addEventListener("click", () => {
  cloudKey = null;
  localStorage.removeItem(CLOUD_CODE_KEY);
  els.disconnectBtn.hidden = true;
  setCloudStatus("Desconectado. Guardando solo en este dispositivo.");
});
els.exportBtn.addEventListener("click", exportProgress);
els.importInput.addEventListener("change", async (event) => {
  try {
    await importProgress(event.target.files[0]);
  } catch (error) {
    alert(error.message);
  } finally {
    event.target.value = "";
  }
});
els.resetBtn.addEventListener("click", resetToExcel);

render();
initCloud();
