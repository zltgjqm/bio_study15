// Biology Second Brain — search + relationship graph
(function () {
  const STORAGE_KEY = "biologySecondBrain.localData.v1";
  const TYPE_LABELS = {
    disease: "Disease",
    gene: "Gene",
    cell_type: "Cell Type",
    tissue: "Tissue",
    paper: "Paper",
    knowledge: "Knowledge",
  };

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "item";
  }
  function norm(value) { return String(value || "").trim().toLowerCase(); }
  function asArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
    return String(value).split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  }
  function unique(values) {
    const seen = new Set();
    return asArray(values).filter((v) => {
      const key = norm(v);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
  }

  function emptyLocalData() { return { papers: [], knowledge: [] }; }
  function loadLocalData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        papers: Array.isArray(parsed.papers) ? parsed.papers : [],
        knowledge: Array.isArray(parsed.knowledge) ? parsed.knowledge : [],
      };
    } catch (e) { return emptyLocalData(); }
  }
  function saveLocalData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ papers: data.papers || [], knowledge: data.knowledge || [] }));
  }
  function collectionName(type) { return type === "knowledge" ? "knowledge" : "papers"; }
  function findLocalItem(type, id) {
    const local = loadLocalData();
    const collection = collectionName(type);
    const index = (local[collection] || []).findIndex((item) => String(item.id) === String(id));
    return { local, collection, index, item: index >= 0 ? local[collection][index] : null };
  }
  function upsertLocalItem(item) {
    const local = loadLocalData();
    const collection = collectionName(item.type);
    local[collection] = local[collection] || [];
    const index = local[collection].findIndex((x) => String(x.id) === String(item.id));
    if (index >= 0) local[collection][index] = item;
    else local[collection].push(item);
    saveLocalData(local);
    return item;
  }
  function deleteLocalItem(type, id) {
    const { local, collection, index } = findLocalItem(type, id);
    if (index < 0) return false;
    local[collection].splice(index, 1);
    saveLocalData(local);
    return true;
  }

  function normalizePaper(p = {}, source = "local", idx = 0) {
    const disease = unique(p.disease || p.diseases);
    const diseaseNotes = p.diseaseNotes && typeof p.diseaseNotes === "object" ? p.diseaseNotes : {};
    return {
      ...p,
      type: "paper",
      source,
      id: p.id || `${source}-paper-${idx + 1}`,
      ownerId: p.ownerId || p.owner_id || "",
      visibility: p.visibility || (source === "static" ? "public" : "members"),
      reviewStatus: p.reviewStatus || p.review_status || (source === "static" ? "approved" : "pending_review"),
      title: String(p.title || "Untitled Paper").trim(),
      displayName: String(p.displayName || p.title || "Untitled Paper").trim(),
      label: TYPE_LABELS.paper,
      disease,
      diseaseNotes,
      genes: unique(p.genes),
      cellTypes: unique(p.cellTypes || p.cell_types),
      tissues: unique(p.tissues),
      datasets: unique(p.datasets),
      markerGenes: unique(p.markerGenes || p.marker_genes),
      summary: Array.isArray(p.summary) ? p.summary.filter(Boolean) : asArray(p.summary),
      newKnowledge: Array.isArray(p.newKnowledge) ? p.newKnowledge.filter(Boolean) : asArray(p.newKnowledge || p.new_knowledge),
      pathway: Array.isArray(p.pathway) ? p.pathway.filter(Boolean) : asArray(p.pathway),
      tags: unique(p.tags),
      readCycle: String(p.readCycle || p.read_cycle || "").trim(),
      addedAt: p.addedAt || p.added_at || idx + 1,
      doiOrUrl: p.doiOrUrl || p.doi_or_url || p.doi || p.url || "",
      description: (Array.isArray(p.summary) ? p.summary[0] : asArray(p.summary)[0]) || `${p.journal || "Paper"} · ${p.year || ""}`,
    };
  }
  function normalizeKnowledge(k = {}, source = "local", idx = 0) {
    return {
      ...k,
      type: "knowledge",
      source,
      id: k.id || `${source}-knowledge-${idx + 1}`,
      ownerId: k.ownerId || k.owner_id || "",
      title: String(k.title || "Untitled Knowledge").trim(),
      displayName: String(k.displayName || k.title || "Untitled Knowledge").trim(),
      label: TYPE_LABELS.knowledge,
      category: String(k.category || "Note").trim(),
      relatedDiseases: unique(k.relatedDiseases || k.related_diseases || k.disease || k.diseases),
      relatedGenes: unique(k.relatedGenes || k.related_genes || k.genes),
      relatedCellTypes: unique(k.relatedCellTypes || k.related_cell_types || k.cellTypes),
      relatedTissues: unique(k.relatedTissues || k.related_tissues || k.tissues),
      knowledge: Array.isArray(k.knowledge) ? k.knowledge.filter(Boolean) : asArray(k.knowledge),
      tags: unique(k.tags),
      readCycle: String(k.readCycle || k.read_cycle || "").trim(),
      addedAt: k.addedAt || k.added_at || idx + 1,
      originalSource: k.originalSource || k.sourceText || k.source || "",
      description: (Array.isArray(k.knowledge) ? k.knowledge[0] : asArray(k.knowledge)[0]) || k.source || "Personal knowledge",
    };
  }
  function splitPathwaySteps(line) {
    return String(line || "")
      .split(/→|->|=>/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function makeEntity(type, raw, source = "static") {
    const displayName = type === "gene" ? (raw.symbol || raw.name || raw.title || raw.id) : (raw.name || raw.symbol || raw.title || raw.id);
    return {
      ...raw,
      source,
      id: raw.id || slugify(displayName),
      type,
      label: TYPE_LABELS[type],
      displayName,
      description: raw.description || raw.fullName || raw.summary?.[0] || raw.knowledge?.[0] || "",
    };
  }
  function entityFromName(type, name) {
    return makeEntity(type, { id: slugify(name), name, symbol: type === "gene" ? name : undefined, description: "" }, "derived");
  }
  function uniqueByKey(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = `${item.type}:${norm(item.displayName)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function buildKnowledgeGraph(staticData = {}, options = {}) {
    const remoteData = options.remoteData || { papers: [], knowledge: [] };
    const includeLocal = options.includeLocal !== false;
    const localData = includeLocal ? loadLocalData() : emptyLocalData();

    const staticPapers = (staticData.papers || []).map((p, idx) => normalizePaper(p, "static", idx));
    const localPapers = (localData.papers || []).map((p, idx) => normalizePaper(p, "local", idx));
    const remotePapers = (remoteData.papers || []).map((p, idx) => normalizePaper(p, "supabase", idx));
    const staticKnowledge = (staticData.knowledge || []).map((k, idx) => normalizeKnowledge(k, "static", idx));
    const localKnowledge = (localData.knowledge || []).map((k, idx) => normalizeKnowledge(k, "local", idx));
    const remoteKnowledge = (remoteData.knowledge || []).map((k, idx) => normalizeKnowledge(k, "supabase", idx));
    const papers = [...staticPapers, ...localPapers, ...remotePapers];
    const knowledge = [...staticKnowledge, ...localKnowledge, ...remoteKnowledge];

    const diseaseNames = [...(staticData.diseases || []).map((d) => d.name), ...papers.flatMap((p) => p.disease), ...knowledge.flatMap((k) => k.relatedDiseases)];
    const geneNames = [...(staticData.genes || []).map((g) => g.symbol || g.name), ...papers.flatMap((p) => p.genes), ...knowledge.flatMap((k) => k.relatedGenes)];
    const cellNames = [...(staticData.cellTypes || []).map((c) => c.name), ...papers.flatMap((p) => p.cellTypes), ...knowledge.flatMap((k) => k.relatedCellTypes)];
    const tissueNames = [...(staticData.tissues || []).map((t) => t.name), ...papers.flatMap((p) => p.tissues), ...knowledge.flatMap((k) => k.relatedTissues)];

    const diseases = uniqueByKey([...(staticData.diseases || []).map((d) => makeEntity("disease", d, "static")), ...unique(diseaseNames).map((n) => entityFromName("disease", n))]);
    const genes = uniqueByKey([...(staticData.genes || []).map((g) => makeEntity("gene", g, "static")), ...unique(geneNames).map((n) => entityFromName("gene", n))]);
    const cellTypes = uniqueByKey([...(staticData.cellTypes || []).map((c) => makeEntity("cell_type", c, "static")), ...unique(cellNames).map((n) => entityFromName("cell_type", n))]);
    const tissues = uniqueByKey([...(staticData.tissues || []).map((t) => makeEntity("tissue", t, "static")), ...unique(tissueNames).map((n) => entityFromName("tissue", n))]);

    return { diseases, genes, cellTypes, tissues, papers, knowledge, all: [...diseases, ...genes, ...cellTypes, ...tissues, ...papers, ...knowledge] };
  }

  function entityUrl(item, basePath = "") {
    const params = new URLSearchParams({ type: item.type, id: item.id || slugify(item.displayName || item.title) });
    if (item.displayName || item.title) params.set("name", item.displayName || item.title);
    return `${basePath}pages/entity.html?${params.toString()}`;
  }
  function addUrl(basePath = "", item = null) {
    if (!item) return `${basePath}pages/add.html`;
    return `${basePath}pages/add.html?edit=${encodeURIComponent(item.id)}&type=${encodeURIComponent(item.type)}`;
  }

  function buildIndex(graph) {
    return graph.all.map((item) => ({
      ...item,
      searchText: [item.displayName, item.title, item.description, item.fullName, item.authors, item.journal, item.readCycle, ...(item.tags || []), ...(item.genes || []), ...(item.cellTypes || []), ...(item.tissues || []), ...(item.disease || []), ...(item.relatedGenes || []), ...(item.relatedDiseases || []), ...Object.values(item.diseaseNotes || {}).flat()].join(" ").toLowerCase(),
    }));
  }
  function score(row, query) {
    const q = query.toLowerCase();
    const name = String(row.displayName || row.title || "").toLowerCase();
    if (name === q) return 100;
    if (name.startsWith(q)) return 82;
    if (name.includes(q)) return 62;
    if (row.searchText.includes(q)) return 28;
    return 0;
  }

  function initSearch({ inputId, resultsId, basePath = "", graph = null } = {}) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    if (!input || !results) return;
    const activeGraph = graph || buildKnowledgeGraph(window.WIKI_DATA || {});
    const index = buildIndex(activeGraph);
    function render(query) {
      if (!query) { results.classList.remove("open"); results.innerHTML = ""; return; }
      const matches = index.map((r) => ({ r, s: score(r, query) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 10);
      if (!matches.length) {
        results.innerHTML = `<div class="search-empty">"${escapeHtml(query)}"에 대한 결과가 없어요.</div>`;
        results.classList.add("open"); return;
      }
      results.innerHTML = matches.map(({ r }) => {
        const rel = relatedFor(r, activeGraph);
        const hint = r.type === "paper" ? `${r.journal || ""} ${r.year || ""}` : `${rel.papers.length} Paper · ${rel.knowledge.length} Knowledge`;
        return `<a class="search-result" href="${entityUrl(r, basePath)}">
          <span class="dot ${r.type}"></span><span class="label">${escapeHtml(r.label)}</span>
          <span class="name">${escapeHtml(r.displayName || r.title)}</span>
          <span class="desc">${escapeHtml(hint || r.description || "")}</span>
        </a>`;
      }).join("");
      results.classList.add("open");
    }
    input.addEventListener("input", (e) => render(e.target.value.trim()));
    input.addEventListener("focus", (e) => { if (e.target.value.trim()) render(e.target.value.trim()); });
    document.addEventListener("click", (e) => { if (!results.contains(e.target) && e.target !== input) results.classList.remove("open"); });
    document.addEventListener("keydown", (e) => { if (e.key === "/" && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); } });
  }

  function relatedFor(item, graph) {
    const name = norm(item.displayName || item.title);
    const contains = (arr) => asArray(arr).some((v) => norm(v) === name);
    const relatedPapers = graph.papers.filter((p) => {
      if (item.type === "disease") return contains(p.disease);
      if (item.type === "gene") return contains(p.genes);
      if (item.type === "cell_type") return contains(p.cellTypes);
      if (item.type === "tissue") return contains(p.tissues);
      return p.id === item.id;
    });
    const relatedKnowledge = graph.knowledge.filter((k) => {
      if (item.type === "disease") return contains(k.relatedDiseases);
      if (item.type === "gene") return contains(k.relatedGenes);
      if (item.type === "cell_type") return contains(k.relatedCellTypes);
      if (item.type === "tissue") return contains(k.relatedTissues);
      return k.id === item.id;
    });
    const fromPapers = (field) => unique(relatedPapers.flatMap((p) => p[field] || []));
    const fromKnowledge = (field) => unique(relatedKnowledge.flatMap((k) => k[field] || []));
    return {
      papers: relatedPapers,
      knowledge: relatedKnowledge,
      diseases: unique([...fromPapers("disease"), ...fromKnowledge("relatedDiseases")]).filter((x) => norm(x) !== name),
      genes: unique([...fromPapers("genes"), ...fromKnowledge("relatedGenes")]).filter((x) => norm(x) !== name),
      cellTypes: unique([...fromPapers("cellTypes"), ...fromKnowledge("relatedCellTypes")]).filter((x) => norm(x) !== name),
      tissues: unique([...fromPapers("tissues"), ...fromKnowledge("relatedTissues")]).filter((x) => norm(x) !== name),
    };
  }
  function recencyFor(item, graph) {
    if (item.type === "paper" || item.type === "knowledge") return Number(item.addedAt || 0);
    const rel = relatedFor(item, graph);
    const times = [...rel.papers.map((p) => Number(p.addedAt || 0)), ...rel.knowledge.map((k) => Number(k.addedAt || 0))];
    return times.length ? Math.max(...times) : 0;
  }
  function groupByCycle(items) {
    const NO_CYCLE = "사이클 미지정";
    const map = new Map();
    items.forEach((it) => {
      const key = (it.readCycle && it.readCycle.trim()) || NO_CYCLE;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    });
    const groups = [...map.entries()].map(([cycle, list]) => ({
      cycle,
      items: list.slice().sort((a, b) => Number(b.addedAt || 0) - Number(a.addedAt || 0)),
      latest: Math.max(...list.map((x) => Number(x.addedAt || 0))),
    }));
    groups.sort((a, b) => {
      if (a.cycle === NO_CYCLE) return 1;
      if (b.cycle === NO_CYCLE) return -1;
      return b.latest - a.latest;
    });
    return groups;
  }
  function diseaseSpecificNote(paper, diseaseName) {
    const notes = paper.diseaseNotes || {};
    const key = Object.keys(notes).find((k) => norm(k) === norm(diseaseName));
    const value = key ? notes[key] : null;
    return Array.isArray(value) ? value.filter(Boolean) : asArray(value);
  }

  window.BiologyWiki = {
    STORAGE_KEY, TYPE_LABELS, slugify, asArray, unique, escapeHtml, norm,
    loadLocalData, saveLocalData, findLocalItem, upsertLocalItem, deleteLocalItem,
    buildKnowledgeGraph, entityUrl, addUrl, initSearch, relatedFor, diseaseSpecificNote,
    normalizePaper, normalizeKnowledge, recencyFor, splitPathwaySteps, groupByCycle,
  };
  window.initWikiSearch = initSearch;
})();
