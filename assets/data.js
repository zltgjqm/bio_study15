// Biology Second Brain — 기본 샘플 데이터
// 실제 사용자가 홈페이지에서 추가한 Paper/Knowledge는 browser localStorage에 저장됩니다.

window.WIKI_DATA = {
  diseases: [
    {
      id: "pdac",
      name: "PDAC",
      fullName: "Pancreatic ductal adenocarcinoma",
      type: "disease",
      description: "Pancreas에서 발생하는 공격적인 암종으로, stromal niche와 immune microenvironment가 중요한 Disease입니다.",
    },
    {
      id: "fibrotic-lung-disease",
      name: "Fibrotic lung disease",
      type: "disease",
      description: "Fibrosis가 진행된 Lung tissue에서 immune niche와 epithelial remodeling이 함께 관찰되는 Disease context입니다.",
    },
  ],
  genes: [
    {
      id: "cxcl13",
      symbol: "CXCL13",
      name: "C-X-C motif chemokine ligand 13",
      type: "gene",
      description: "B cell recruitment와 tertiary lymphoid structure 형성에 관여하는 chemokine입니다.",
    },
    {
      id: "kras",
      symbol: "KRAS",
      name: "KRAS proto-oncogene",
      type: "gene",
      description: "PDAC를 포함한 여러 cancer에서 자주 변이되는 signaling Gene입니다.",
    },
  ],
  cellTypes: [
    {
      id: "macrophage",
      name: "Macrophage",
      type: "cell_type",
      description: "Tissue-resident 또는 recruited phagocyte로, local immune tone과 tissue remodeling을 조절합니다.",
      markers: ["CD68", "CD163", "CXCL13", "MARCO"],
    },
    {
      id: "caf",
      name: "CAF",
      fullName: "Cancer-associated fibroblast",
      type: "cell_type",
      description: "Tumor microenvironment에서 extracellular matrix, cytokine, immune interaction을 조절하는 stromal Cell Type입니다.",
      markers: ["ACTA2", "COL1A1", "CXCL12"],
    },
  ],
  tissues: [
    {
      id: "lung",
      name: "Lung",
      type: "tissue",
      description: "Gas exchange를 담당하는 Tissue로, single-cell atlas에서 macrophage와 epithelial state가 자주 분석됩니다.",
    },
    {
      id: "pancreas",
      name: "Pancreas",
      type: "tissue",
      description: "Endocrine/exocrine 기능을 가진 Tissue이며 PDAC 연구에서 tumor-stroma interaction이 중요합니다.",
    },
  ],
  papers: [
    {
      id: "paper-001",
      disease: ["Fibrotic lung disease"],
      genes: ["CXCL13"],
      cellTypes: ["Macrophage"],
      tissues: ["Lung"],
      title: "Spatial transcriptomics identifies CXCL13-driven macrophage niches in fibrotic lung",
      authors: "Kim J, Alvarez R, Chen L, et al.",
      journal: "Nature",
      year: 2025,
      doiOrUrl: "",
      tags: ["Spatial", "Lung", "Macrophage"],
      readCycle: "8월 1주차",
      summary: [
        "Fibrotic Lung에서 CXCL13-high Macrophage가 특정 spatial niche에 모여 있음을 보여줍니다.",
        "이 niche는 tertiary lymphoid structure와 가까워 local immune organization과 연결됩니다."
      ],
      newKnowledge: [
        "CXCL13-high Macrophage는 단순 marker가 아니라 immune aggregate 형성과 연결된 spatial signal일 수 있습니다."
      ],
      pathway: [
        "Fibrotic injury signal → CXCL13 발현 유도 → Macrophage 모집 → Tertiary lymphoid structure 형성"
      ],
    },
  ],
  knowledge: [],
};
