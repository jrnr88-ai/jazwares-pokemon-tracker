const STORAGE_KEY = "jazwares-pokemon-collection-v1";
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
  loginForm: document.querySelector("#loginForm"),
  emailInput: document.querySelector("#emailInput"),
  logoutBtn: document.querySelector("#logoutBtn"),
};

const supabaseReady =
  CONFIG.supabaseUrl &&
  CONFIG.supabaseAnonKey &&
  !CONFIG.supabaseUrl.includes("TU-PROYECTO") &&
  window.supabase;
const db = supabaseReady ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey) : null;

let owned = loadOwnedState();
let cloudUser = null;
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

  const { data } = await db.auth.getSession();
  cloudUser = data.session?.user || null;
  updateAuthUi();

  db.auth.onAuthStateChange((_event, session) => {
    cloudUser = session?.user || null;
    updateAuthUi();
    if (cloudUser) loadCloudProgress();
  });

  if (cloudUser) {
    await loadCloudProgress();
  } else {
    setCloudStatus("Inicia sesion con email para sincronizar en la nube.");
  }
}

function updateAuthUi() {
  els.loginForm.hidden = Boolean(cloudUser);
  els.logoutBtn.hidden = !cloudUser;
  if (cloudUser) {
    setCloudStatus(`Sincronizando como ${cloudUser.email}.`, "online");
  }
}

async function loadCloudProgress() {
  if (!db || !cloudUser) return;
  const { data, error } = await db.from("collection_progress").select("item_id,caught");
  if (error) {
    setCloudStatus(`No pude leer Supabase: ${error.message}`, "error");
    return;
  }

  const cloudOwned = Object.fromEntries(data.map((row) => [row.item_id, row.caught]));
  owned = { ...owned, ...cloudOwned };
  saveOwnedState();
  render();
  setCloudStatus(`Sincronizado como ${cloudUser.email}.`, "online");
}

function queueCloudSave(itemId, caught) {
  saveOwnedState();
  if (!db || !cloudUser) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => saveCloudItem(itemId, caught), 250);
}

async function saveCloudItem(itemId, caught) {
  const { error } = await db.from("collection_progress").upsert(
    {
      item_id: itemId,
      caught,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_id" }
  );
  if (error) {
    setCloudStatus(`No pude guardar en Supabase: ${error.message}`, "error");
  } else {
    setCloudStatus(`Guardado en la nube como ${cloudUser.email}.`, "online");
  }
}

async function seedCloudProgress() {
  if (!db || !cloudUser) return;
  const rows = Object.entries(owned).map(([itemId, caught]) => ({
    item_id: itemId,
    caught,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await db.from("collection_progress").upsert(rows, { onConflict: "user_id,item_id" });
  if (error) {
    setCloudStatus(`No pude subir tu progreso actual: ${error.message}`, "error");
  } else {
    setCloudStatus("Progreso local subido a la nube.", "online");
  }
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
els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!db) {
    setCloudStatus("Primero configura Supabase en config.js.", "error");
    return;
  }
  const email = els.emailInput.value.trim();
  if (!email) return;
  const { error } = await db.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split("#")[0] },
  });
  setCloudStatus(error ? `No pude enviar el enlace: ${error.message}` : "Revisa tu email para entrar.", error ? "error" : "local");
});
els.logoutBtn.addEventListener("click", async () => {
  if (db) await db.auth.signOut();
  cloudUser = null;
  setCloudStatus("Sesion cerrada. Guardando solo en este dispositivo.");
  updateAuthUi();
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
