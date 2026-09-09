// Biology Second Brain — Supabase data access layer
(function () {
  function client() {
    if (!window.BiologySupabase || !window.BiologySupabase.client) throw new Error("Supabase client missing");
    return window.BiologySupabase.client;
  }
  function wiki() { return window.BiologyWiki || {}; }
  function newId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  function asJsonArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
      } catch (e) {
        // JSON 파싱 실패시 쉼표/줄바꿈 구분 처리
      }
    }
    return String(value).split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  }
  function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function ms(value) {
    if (typeof value === "number") return value;
    const n = Date.parse(value || "");
    return Number.isFinite(n) ? n : Date.now();
  }

  function rowToPaper(row) {
    return {
      type: "paper",
      source: "supabase",
      id: row.id,
      ownerId: row.owner_id,
      addedAt: Number(row.added_at || ms(row.created_at)),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      readCycle: row.read_cycle || "",
      visibility: row.visibility || "members",
      reviewStatus: row.review_status || "pending_review",
      disease: asJsonArray(row.disease),
      diseaseNotes: asObject(row.disease_notes),
      genes: asJsonArray(row.genes),
      cellTypes: asJsonArray(row.cell_types),
      tissues: asJsonArray(row.tissues),
      datasets: asJsonArray(row.datasets),
      markerGenes: asJsonArray(row.marker_genes),
      title: row.title || "Untitled Paper",
      journal: row.journal || "",
      year: row.year || "",
      authors: row.authors || "",
      doiOrUrl: row.doi_or_url || "",
      summary: asJsonArray(row.summary),
      newKnowledge: asJsonArray(row.new_knowledge),
      pathway: asJsonArray(row.pathway),
      tags: asJsonArray(row.tags),
    };
  }

  function rowToKnowledge(row) {
    return {
      type: "knowledge",
      source: "supabase",
      id: row.id,
      ownerId: row.owner_id,
      addedAt: Number(row.added_at || ms(row.created_at)),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      readCycle: row.read_cycle || "",
      category: row.category || "Note",
      title: row.title || "Untitled Knowledge",
      relatedDiseases: asJsonArray(row.related_diseases),
      relatedGenes: asJsonArray(row.related_genes),
      relatedCellTypes: asJsonArray(row.related_cell_types),
      relatedTissues: asJsonArray(row.related_tissues),
      knowledge: asJsonArray(row.knowledge),
      sourceText: row.source || "",
      source: "supabase",
      originalSource: row.source || "",
      tags: asJsonArray(row.tags),
    };
  }

  function paperToRow(item, auth, isEdit = false) {
    const isOwner = auth?.isOwner;
    const row = {
      id: isEdit ? item.id : newId("paper"),
      owner_id: item.ownerId || auth.user.id,
      added_at: item.addedAt || Date.now(),
      read_cycle: item.readCycle || "",
      visibility: isOwner ? (item.visibility || "members") : "members",
      review_status: isOwner ? (item.reviewStatus || "approved") : "pending_review",
      disease: asJsonArray(item.disease || item.diseases),
      disease_notes: asObject(item.diseaseNotes),
      genes: asJsonArray(item.genes),
      cell_types: asJsonArray(item.cellTypes),
      tissues: asJsonArray(item.tissues),
      datasets: asJsonArray(item.datasets),
      marker_genes: asJsonArray(item.markerGenes),
      title: String(item.title || "Untitled Paper").trim(),
      journal: item.journal || "",
      year: item.year ? Number(item.year) : null,
      authors: item.authors || "",
      doi_or_url: item.doiOrUrl || item.doi || item.url || "",
      summary: asJsonArray(item.summary),
      new_knowledge: asJsonArray(item.newKnowledge),
      pathway: asJsonArray(item.pathway),
      tags: asJsonArray(item.tags),
    };
    if (isEdit) delete row.added_at;
    return row;
  }

  function knowledgeToRow(item, auth, isEdit = false) {
    const row = {
      id: isEdit ? item.id : newId("knowledge"),
      owner_id: item.ownerId || auth.user.id,
      added_at: item.addedAt || Date.now(),
      read_cycle: item.readCycle || "",
      category: item.category || "Note",
      title: String(item.title || "Untitled Knowledge").trim(),
      related_diseases: asJsonArray(item.relatedDiseases || item.disease || item.diseases),
      related_genes: asJsonArray(item.relatedGenes || item.genes),
      related_cell_types: asJsonArray(item.relatedCellTypes || item.cellTypes),
      related_tissues: asJsonArray(item.relatedTissues || item.tissues),
      knowledge: asJsonArray(item.knowledge),
      source: item.originalSource || item.sourceText || item.source || "",
      tags: asJsonArray(item.tags),
    };
    if (isEdit) delete row.added_at;
    return row;
  }

  async function fetchAll() {
    const supabase = client();
    const [papersRes, knowledgeRes] = await Promise.all([
      supabase.from("papers").select("*").order("added_at", { ascending: false }),
      supabase.from("knowledge").select("*").order("added_at", { ascending: false }),
    ]);
    if (papersRes.error) throw papersRes.error;
    if (knowledgeRes.error) throw knowledgeRes.error;
    return {
      papers: (papersRes.data || []).map(rowToPaper),
      knowledge: (knowledgeRes.data || []).map(rowToKnowledge),
    };
  }

  async function savePaper(item, auth, isEdit = false) {
    const supabase = client();
    const row = paperToRow(item, auth, isEdit);
    const query = isEdit
      ? supabase.from("papers").update(row).eq("id", item.id).select().single()
      : supabase.from("papers").insert(row).select().single();
    const { data, error } = await query;
    if (error) throw error;
    return rowToPaper(data);
  }

  async function saveKnowledge(item, auth, isEdit = false) {
    if (!auth?.isOwner) throw new Error("Knowledge는 owner만 저장할 수 있습니다.");
    const supabase = client();
    const row = knowledgeToRow(item, auth, isEdit);
    const query = isEdit
      ? supabase.from("knowledge").update(row).eq("id", item.id).select().single()
      : supabase.from("knowledge").insert(row).select().single();
    const { data, error } = await query;
    if (error) throw error;
    return rowToKnowledge(data);
  }

  async function deletePaper(id) {
    const { error } = await client().from("papers").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  async function deleteKnowledge(id) {
    const { error } = await client().from("knowledge").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  async function setPaperFields(id, fields = {}) {
    const update = {};
    if (fields.visibility) update.visibility = fields.visibility;
    if (fields.reviewStatus) update.review_status = fields.reviewStatus;
    const { data, error } = await client().from("papers").update(update).eq("id", id).select().single();
    if (error) throw error;
    return rowToPaper(data);
  }

  async function fetchProfiles() {
    const { data, error } = await client().from("profiles").select("id,email,role,created_at,updated_at").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function updateProfileRole(id, role) {
    const { data, error } = await client().from("profiles").update({ role }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }

  function rowToNote(row) {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityName: row.entity_name,
      authorId: row.author_id,
      content: row.content,
      visibility: row.visibility || "public",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async function fetchNotesFor(entityType, entityName) {
    const { data, error } = await client()
      .from("entity_notes")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_name", entityName)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToNote);
  }

  async function addNote({ entityType, entityName, content, visibility }, auth) {
    const row = {
      id: newId("note"),
      entity_type: entityType,
      entity_name: entityName,
      author_id: auth.user.id,
      content: String(content || "").trim(),
      visibility: visibility === "private" ? "private" : "public",
    };
    const { data, error } = await client().from("entity_notes").insert(row).select().single();
    if (error) throw error;
    return rowToNote(data);
  }

  async function deleteNote(id) {
    const { error } = await client().from("entity_notes").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  function buildGraph(remoteData, includeLocal = false) {
    return wiki().buildKnowledgeGraph(window.WIKI_DATA || {}, { remoteData, includeLocal });
  }

  /* ---------- diseases: 암 8종 허브 뷰용 큐레이션 데이터 ---------- */
  function rowToDisease(row) {
    const keyGenes = asJsonArray(row.key_genes || row.elements);
    const keyMechanisms = asJsonArray(row.key_mechanisms);

    return {
      id: row.id,
      name: row.name || "",
      description: row.description || "",
      keyGenes: keyGenes,
      keyMechanisms: keyMechanisms,
      elements: keyGenes, // UI/Map 뷰 호환성을 위해 elements 속성 추가
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function diseaseToRow(item, auth, isEdit = false) {
    const row = {
      id: isEdit ? item.id : String(item.id || "").trim() || newId("disease"),
      name: String(item.name || "").trim(),
      description: item.description || "",
      key_genes: asJsonArray(item.keyGenes || item.elements),
      key_mechanisms: asJsonArray(item.keyMechanisms),
    };
    if (!isEdit) row.created_by = auth?.user?.id;
    return row;
  }

  async function fetchDiseases() {
    const { data, error } = await client().from("diseases").select("*").order("name", { ascending: true });
    if (error) throw error;
    return (data || []).map(rowToDisease);
  }

  async function saveDisease(item, auth, isEdit = false) {
    const supabase = client();
    const row = diseaseToRow(item, auth, isEdit);
    const query = isEdit
      ? supabase.from("diseases").update(row).eq("id", item.id).select().single()
      : supabase.from("diseases").insert(row).select().single();
    const { data, error } = await query;
    if (error) throw error;
    return rowToDisease(data);
  }

  async function deleteDisease(id) {
    const { error } = await client().from("diseases").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  /* ---------- disease_links: 사람이 직접 만든 암-암 커스텀 관계 ---------- */
  function rowToDiseaseLink(row) {
    return {
      id: row.id,
      diseaseAId: row.disease_a_id,
      diseaseBId: row.disease_b_id,
      relationNote: row.relation_note || "",
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function diseaseLinkToRow(item, auth) {
    // disease_a_id < disease_b_id로 항상 정렬해서 저장 (A-B / B-A 중복 방지, DB check 제약과 맞춤)
    const [a, b] = [String(item.diseaseAId || ""), String(item.diseaseBId || "")].sort();
    return {
      id: newId("dlink"),
      disease_a_id: a,
      disease_b_id: b,
      relation_note: String(item.relationNote || "").trim(),
      created_by: auth?.user?.id,
    };
  }

  async function fetchDiseaseLinks() {
    const { data, error } = await client().from("disease_links").select("*");
    if (error) throw error;
    return (data || []).map(rowToDiseaseLink);
  }

  async function saveDiseaseLink(item, auth) {
    const supabase = client();
    const row = diseaseLinkToRow(item, auth);
    const { data, error } = await supabase.from("disease_links").insert(row).select().single();
    if (error) throw error;
    return rowToDiseaseLink(data);
  }

  async function deleteDiseaseLink(id) {
    const { error } = await client().from("disease_links").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  async function fetchHubData() {
    const [diseasesRes, linksRes] = await Promise.all([fetchDiseases(), fetchDiseaseLinks()]);
    return { diseases: diseasesRes, links: linksRes };
  }

  window.BioDB = {
    newId,
    rowToPaper,
    rowToKnowledge,
    fetchAll,
    savePaper,
    saveKnowledge,
    deletePaper,
    deleteKnowledge,
    setPaperFields,
    fetchProfiles,
    updateProfileRole,
    fetchNotesFor,
    addNote,
    deleteNote,
    buildGraph,
    fetchDiseases,
    saveDisease,
    deleteDisease,
    fetchDiseaseLinks,
    saveDiseaseLink,
    deleteDiseaseLink,
    fetchHubData,
  };
})();
