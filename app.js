// Firebase SDK - conexión inicial
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// Configuración de Firebase del proyecto fpa-assessment-mvp
const firebaseConfig = {
  apiKey: "AIzaSyAyHWPnALB5regOMmeR3C-vVLDTmh6fEio",
  authDomain: "fpa-assessment-mvp.firebaseapp.com",
  databaseURL: "https://fpa-assessment-mvp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fpa-assessment-mvp",
  storageBucket: "fpa-assessment-mvp.firebasestorage.app",
  messagingSenderId: "690455183937",
  appId: "1:690455183937:web:e9be8095b43f341589fcc0",
  measurementId: "G-XBHVPCJFFD",
};

// Inicialización de Firebase
const firebaseApp = initializeApp(firebaseConfig);
const firebaseDatabase = getDatabase(firebaseApp);

console.log("Firebase conectado correctamente:", firebaseConfig.projectId);



// Escenario compartido leído desde la URL
const scenarioId = getScenarioIdFromUrl();
const scenarioDatabaseRef = scenarioId ? ref(firebaseDatabase, `scenarios/${scenarioId}`) : null;

console.log("Modo escenario compartido:", scenarioId || "modo local sin scenario");



const DATA_URL = "data/fpa_assessment.json";
const STORAGE_KEY = "f3m-fpa-assessment-scenario";

const LEVERS = [
  { key: "procesos", label: "Procesos" },
  { key: "tecnologia", label: "Tecnología" },
  { key: "organizacion", label: "Organización" },
];

const PRIORITY_ORDER = {
  Alta: 1,
  Media: 2,
  Baja: 3,
  Pendiente: 4,
};

const STATUS_OPTIONS = ["No iniciado", "En curso", "Completado", "Bloqueado"];


const AI_INITIATIVES_BY_CAPABILITY = {
  "Presupuestos y previsiones": {
    subcapacidad: "1.1-1.4",
    cases:
      "Develop guided workflows for creating budgets; On demand forecasting and scenario modeling; AI-supported budget allocation",
    advanced:
      "Planificación driver-based, rolling forecast, escenarios automatizados y workflows colaborativos",
    source: "F3M_AI_Mapping_Consolidado_v1.xlsx",
  },
  "Informes de gestión del rendimiento": {
    subcapacidad: "2.1-2.4",
    cases:
      "Mgmt Reporting Actuals Plan Variance + Commentary; Generate account variance analysis and intelligent explanations; FinanceAI Insights Platform",
    advanced:
      "Reporting automatizado con commentary, insights, alertas y explicación de desviaciones",
    source: "F3M_AI_Mapping_Consolidado_v1.xlsx",
  },
  "Evaluación business case": {
    subcapacidad: "3.1-3.4",
    cases: "Summarize and score project proposals; Project-level recommendations",
    advanced:
      "Scoring de iniciativas, priorización dinámica y seguimiento de beneficios",
    source: "F3M_AI_Mapping_Consolidado_v1.xlsx",
  },
  "Información y apoyo a la toma de decisiones": {
    subcapacidad: "4.1-4.4",
    cases:
      "Perform analysis and investigation and provide insights on demand; Data access for all; Enterprise-wide data search and access",
    advanced:
      "Decision intelligence, insights predictivos y autoservicio gobernado",
    source: "F3M_AI_Mapping_Consolidado_v1.xlsx",
  },
  "Planificación largo plazo": {
    subcapacidad: "5.1-5.4",
    cases:
      "Generate investing strategies; Identify patterns to predict future financial performance; Integrated business planning",
    advanced:
      "Planificación estratégica continua, simulación avanzada y asignación dinámica de recursos",
    source: "F3M_AI_Mapping_Consolidado_v1.xlsx",
  },
};


const state = {
  meta: null,
  items: [],
};

let capabilityRadarCharts = {
  procesos: null,
  tecnologia: null,
  organizacion: null,
};


const expandedHeatmapCapabilities = new Set(); // NUEVO: mantiene abiertas las capacidades desplegadas del heatmap entre renders


let isApplyingRemoteScenario = false; // NUEVO: evita guardar de vuelta mientras estamos cargando datos remotos


const els = {};

document.addEventListener("DOMContentLoaded", init);


async function init() {
  cacheElements();
  bindGlobalEvents();
  setInitialLoading(true); // NUEVO: muestra estado de carga mientras se inicializa la app
  showScenarioModeNotice();

  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`No se pudo cargar ${DATA_URL}`);
    }

    const data = await response.json();

    state.meta = data.meta;
    state.items = data.subcapacities.map(normalizeItem);

    if (!scenarioId) {
      applyStoredScenario();
    }

    await initializeSharedScenario();

    populateCapacityFilter();
    renderAll();
  } catch (error) {
    showNotice(
      "No se pudo cargar el JSON de datos. Abre esta carpeta con un servidor local simple, por ejemplo: python -m http.server 8000, y entra en http://localhost:8000/.",
      true,
    );
    console.error(error);
  } finally {
    setInitialLoading(false); // NUEVO: oculta el estado de carga al terminar, incluso si hay error
  }
}


function cacheElements() {
  [
    "loadNotice",
    "initialLoadingState", // NUEVO: estado visual de carga inicial
    "sourceNote",
    "kpiGrid",
    "priorityBars",
    "leverBars",
    "summaryTable",
    "capabilityRadarProcessesChart",
    "capabilityRadarTechnologyChart",
    "capabilityRadarOrganizationChart",
    "capacityFilter",
    "priorityFilter",
    "searchInput",
    "assessmentList",
    "heatmapTable",
    "heatmapExpandToggle",
    "roadmapTable",
    "assessmentTabBadge",
    "roadmapTabBadge",
    "aiInitiativeModal",
    "closeAiInitiativeModalButton",
    "aiModalCapability",
    "aiModalSubcapability",
    "aiModalCases",
    "aiModalAdvanced",
    "aiModalSource",
    "scoringCriteriaModal", // NUEVO: modal de criterios F3M
    "closeScoringCriteriaModalButton", // NUEVO: botón cerrar modal
    "saveStatus", // NUEVO: indicador visual de guardado
    "importJsonButton",
    "exportJsonButton",
    "exportCsvButton",
    "exportPdfButton", // NUEVO: botón de exportación PDF
    "resetButton",
    "scenarioFileInput",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindGlobalEvents() {
  els.capacityFilter.addEventListener("change", renderAll);
  els.priorityFilter.addEventListener("change", renderAll);
  els.searchInput.addEventListener("input", renderAll);
  els.importJsonButton.addEventListener("click", () => els.scenarioFileInput.click());
  els.scenarioFileInput.addEventListener("change", importScenario);
  els.exportJsonButton.addEventListener("click", exportScenarioJson);
  els.exportCsvButton.addEventListener("click", exportCsv);
  els.exportPdfButton.addEventListener("click", exportPdfReport); // NUEVO: genera informe imprimible/PDF
  els.resetButton.addEventListener("click", resetScenario);
  els.heatmapExpandToggle?.addEventListener("click", handleHeatmapExpandToggleAll);
  setupActiveTabObserver(); // NUEVO: marca automáticamente la pestaña activa según la sección visible
  setupScoringCriteriaModal(); // NUEVO: configura modal de criterios F3M
  setupAiInitiativeModal();
}

function normalizeItem(item) {
  return {
    ...item,
    scores: {
      procesos: toScore(item.scores?.procesos),
      tecnologia: toScore(item.scores?.tecnologia),
      organizacion: toScore(item.scores?.organizacion),
    },
    owner: item.owner || "",
    status: item.status || "No iniciado",
    comentario: item.comentario || item.comentariosHallazgos || "",
  };
}

function toScore(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 5 ? number : null;
}

function calculate(item) {
  const values = LEVERS.map((lever) => item.scores[lever.key]).filter((value) => Number.isFinite(value));
  if (!values.length) {
    return {
      isPending: true,
      scoreMedio: null,
      nivel: "",
      gap: null,
      prioridad: "Pendiente",
      oleada: "Pendiente",
    };
  }

  const scoreMedio = round2(values.reduce((sum, value) => sum + value, 0) / values.length);
  const nivel = getMaturityLevel(scoreMedio);
  const gap = round2(Math.max(0, state.meta.targetMaturity - scoreMedio));
  const prioridad = gap >= 2 ? "Alta" : gap >= 1 ? "Media" : "Baja";
  const oleada = prioridad === "Alta" ? "Oleada 1" : prioridad === "Media" ? "Oleada 2" : "Oleada 3";

  return {
    isPending: false,
    scoreMedio,
    nivel,
    gap,
    prioridad,
    oleada,
  };
}

function getMaturityLevel(score) {
  if (score < 1.5) return "1 - Inicial";
  if (score < 2.5) return "2 - Estructurado";
  if (score < 3.5) return "3 - Estandarizado";
  if (score < 4.5) return "4 - Optimizado";
  return "5 - Avanzado/Referente";
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}


function setupActiveTabObserver() {
  const tabLinks = [...document.querySelectorAll(".tabs a")]; // MODIFICADO: obtiene los links de navegación
  const sections = tabLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean); // MODIFICADO: evita errores si alguna sección no existe

  if (!tabLinks.length || !sections.length) {
    return;
  }

  const setActiveTab = (sectionId) => {
    tabLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${sectionId}`;
      link.classList.toggle("active", isActive);
    });
  };

  const updateActiveTab = () => {
    const scrollPosition = window.scrollY + 130; // MODIFICADO: compensa header/tabs sticky

    let currentSectionId = sections[0].id;

    sections.forEach((section) => {
      if (section.offsetTop <= scrollPosition) {
        currentSectionId = section.id;
      }
    });

    setActiveTab(currentSectionId);
  };

  window.addEventListener("scroll", updateActiveTab, { passive: true }); // MODIFICADO: actualiza al hacer scroll
  window.addEventListener("resize", updateActiveTab); // MODIFICADO: recalcula si cambia el tamaño de pantalla

  updateActiveTab(); // MODIFICADO: estado inicial al cargar
}


function setInitialLoading(isLoading) {
  if (!els.initialLoadingState) {
    return;
  }

  els.initialLoadingState.hidden = !isLoading;
}


function setupScoringCriteriaModal() {
  if (!els.scoringCriteriaModal) {
    return;
  }

  els.assessmentList.addEventListener("click", (event) => {
    const button = event.target.closest(".scoring-criteria-button");

    if (!button) {
      return;
    }

    openScoringCriteriaModal();
  });

  els.closeScoringCriteriaModalButton?.addEventListener("click", closeScoringCriteriaModal);

  els.scoringCriteriaModal.addEventListener("click", (event) => {
    if (event.target === els.scoringCriteriaModal) {
      closeScoringCriteriaModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.scoringCriteriaModal.hidden) {
      closeScoringCriteriaModal();
    }
  });

  els.scoringCriteriaModal.querySelectorAll(".criteria-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateScoringCriteriaTab(tab.dataset.criteriaTab);
    });
  });
}

function openScoringCriteriaModal() {
  els.scoringCriteriaModal.hidden = false;
  activateScoringCriteriaTab("procesos");
  els.closeScoringCriteriaModalButton?.focus();
}

function closeScoringCriteriaModal() {
  els.scoringCriteriaModal.hidden = true;
}

function activateScoringCriteriaTab(tabKey) {
  els.scoringCriteriaModal.querySelectorAll(".criteria-tab").forEach((tab) => {
    const isActive = tab.dataset.criteriaTab === tabKey;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  els.scoringCriteriaModal.querySelectorAll(".criteria-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.criteriaPanel === tabKey);
  });
}


function setupAiInitiativeModal() {
  if (!els.aiInitiativeModal) {
    return;
  }

  els.roadmapTable.addEventListener("click", (event) => {
    const button = event.target.closest(".roadmap-ai-button");

    if (!button) {
      return;
    }

    openAiInitiativeModal(button.dataset.capability);
  });

  els.closeAiInitiativeModalButton?.addEventListener("click", closeAiInitiativeModal);

  els.aiInitiativeModal.addEventListener("click", (event) => {
    if (event.target === els.aiInitiativeModal) {
      closeAiInitiativeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.aiInitiativeModal.hidden) {
      closeAiInitiativeModal();
    }
  });
}

function openAiInitiativeModal(capability) {
  const initiative = AI_INITIATIVES_BY_CAPABILITY[capability];

  if (!initiative) {
    showNotice("No hay iniciativa IA asociada a esta capacidad.", true);
    return;
  }

  els.aiModalCapability.textContent = capability;
  els.aiModalSubcapability.textContent = `Subcapacidades relacionadas: ${initiative.subcapacidad}`;
  els.aiModalCases.textContent = initiative.cases;
  els.aiModalAdvanced.textContent = initiative.advanced;
  els.aiModalSource.textContent = `Fuente: ${initiative.source}`;

  els.aiInitiativeModal.hidden = false;
  els.closeAiInitiativeModalButton?.focus();
}

function closeAiInitiativeModal() {
  els.aiInitiativeModal.hidden = true;
}


function updateNavigationBadges() {
  if (!els.assessmentTabBadge || !els.roadmapTabBadge || !state.items.length) {
    return;
  }

  const metrics = state.items.map((item) => calculate(item));
  const scoredCount = metrics.filter((entry) => !entry.isPending).length;
  const totalCount = state.items.length;
  const highPriorityCount = metrics.filter((entry) => entry.prioridad === "Alta").length;

  els.assessmentTabBadge.textContent = `${scoredCount}/${totalCount}`;
  els.roadmapTabBadge.textContent = `${highPriorityCount} Alta`;

  els.roadmapTabBadge.classList.toggle("tab-badge-alert", highPriorityCount > 0);
}



function renderAll() {
  if (!state.items.length) return;
  els.sourceNote.textContent = `Fuente: ${state.meta.sourceFile} · Objetivo de madurez ${state.meta.targetMaturity}`;
  renderDashboard();
  renderAssessments();
  renderHeatmap();
  renderRoadmap();
  updateNavigationBadges();
}

function populateCapacityFilter() {
  const capacities = unique(state.items.map((item) => item.capacidad));
  els.capacityFilter.innerHTML = [
    `<option value="all">Todas</option>`,
    ...capacities.map((capability) => `<option value="${escapeAttr(capability)}">${escapeHtml(capability)}</option>`),
  ].join("");
}

function getVisibleItems() {
  const capacity = els.capacityFilter.value;
  const priority = els.priorityFilter.value;
  const query = els.searchInput.value.trim().toLowerCase();

  return state.items.filter((item) => {
    const metrics = calculate(item);
    const matchesCapacity = capacity === "all" || item.capacidad === capacity;
    const matchesPriority = priority === "all" || metrics.prioridad === priority;
    const haystack = [
      item.capacidad,
      item.subcapacidad,
      item.objetivoEvaluacion,
      item.preguntasClave,
      item.evidencias,
      item.iniciativaSugerida,
    ]
      .join(" ")
      .toLowerCase();
    return matchesCapacity && matchesPriority && (!query || haystack.includes(query));
  });
}

function renderDashboard() {
  const metrics = state.items.map((item) => ({ item, metrics: calculate(item) }));
  const scored = metrics.filter((entry) => !entry.metrics.isPending);
  const scoreGlobal = average(scored.map((entry) => entry.metrics.scoreMedio));
  const gapMedio = average(scored.map((entry) => entry.metrics.gap));
  const highCount = scored.filter((entry) => entry.metrics.prioridad === "Alta").length;

  els.kpiGrid.innerHTML = [
    kpiCard("Score global dominio", formatNumber(scoreGlobal), scored.length ? "Promedio de subcapacidades puntuadas" : "Pendiente de scoring"),
    kpiCard("Gap medio vs objetivo", formatNumber(gapMedio), `Objetivo actual: ${state.meta.targetMaturity} - Optimizado`),
    kpiCard("Subcapacidades puntuadas", `${scored.length}/${state.items.length}`, `${Math.round((scored.length / state.items.length) * 100)}% de avance`),
    kpiCard("Prioridad alta", String(highCount), "Subcapacidades con gap igual o superior a 2"),
  ].join("");

  renderPriorityBars(metrics);
  renderLeverBars();
  renderSummaryTable();
  renderCapabilityRadar(); // NUEVO: actualiza radar al recalcular dashboard
}

function kpiCard(label, value, note) {
  return `
    <article class="kpi-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(note)}</p>
    </article>
  `;
}

function renderPriorityBars(entries) {
  const counts = { Alta: 0, Media: 0, Baja: 0, Pendiente: 0 };
  entries.forEach((entry) => {
    counts[entry.metrics.prioridad] += 1;
  });
  const max = Math.max(...Object.values(counts), 1);
  els.priorityBars.innerHTML = Object.entries(counts)
    .map(([label, count]) => {
      const width = Math.round((count / max) * 100);
      return barRow(label, count, width, priorityColor(label));
    })
    .join("");
}

function renderLeverBars() {
  const rows = LEVERS.map((lever) => {
    const avg = average(state.items.map((item) => item.scores[lever.key]).filter((value) => Number.isFinite(value)));
    const width = avg ? Math.round((avg / 5) * 100) : 0;
    return barRow(lever.label, formatNumber(avg), width, "#007c89");
  });
  els.leverBars.innerHTML = rows.join("");
}

function barRow(label, value, width, color) {
  return `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${width}%;background:${color}"></span></span>
      <span class="bar-value">${escapeHtml(String(value))}</span>
    </div>
  `;
}

function renderSummaryTable() {
  const capacities = unique(state.items.map((item) => item.capacidad));
  const rows = capacities.map((capability) => {
    const items = state.items.filter((item) => item.capacidad === capability);
    const entries = items.map((item) => ({ item, metrics: calculate(item) }));
    const scored = entries.filter((entry) => !entry.metrics.isPending);
    const scoreMedio = average(scored.map((entry) => entry.metrics.scoreMedio));
    const gap = scoreMedio === null ? null : round2(Math.max(0, state.meta.targetMaturity - scoreMedio));
    const prioridad = priorityFromGap(gap);
    return `
      <tr>
        <td>${escapeHtml(capability)}</td>
        <td class="number">${formatNumber(average(items.map((item) => item.scores.procesos).filter(Number.isFinite)))}</td>
        <td class="number">${formatNumber(average(items.map((item) => item.scores.tecnologia).filter(Number.isFinite)))}</td>
        <td class="number">${formatNumber(average(items.map((item) => item.scores.organizacion).filter(Number.isFinite)))}</td>
        <td class="number">${formatNumber(scoreMedio)}</td>
        <td class="number">${formatNumber(gap)}</td>
        <td>${priorityBadge(prioridad)}</td>
        <td class="number">${scored.length}/${items.length}</td>
      </tr>
    `;
  });

  els.summaryTable.innerHTML = `
    <thead>
      <tr>
        <th>Capacidad</th>
        <th class="number">Procesos</th>
        <th class="number">Tecnología</th>
        <th class="number">Organización</th>
        <th class="number">Score medio</th>
        <th class="number">Gap</th>
        <th>Prioridad</th>
        <th class="number">Avance</th>
      </tr>
    </thead>
    <tbody>${rows.join("")}</tbody>
  `;
}



function renderCapabilityRadar() {
  if (typeof Chart === "undefined") {
    return;
  }

  const radarData = buildCapabilityRadarData();

  renderSingleCapabilityRadar({
  key: "procesos",
  canvas: els.capabilityRadarProcessesChart,
  label: "Procesos",
  values: radarData.procesos,
  color: "#86BC25",
  backgroundColor: "rgba(134, 188, 37, 0.24)",
  radarData,
});

renderSingleCapabilityRadar({
  key: "tecnologia",
  canvas: els.capabilityRadarTechnologyChart,
  label: "Tecnología",
  values: radarData.tecnologia,
  color: "#ED8B00",
  backgroundColor: "rgba(237, 139, 0, 0.22)",
  radarData,
});

renderSingleCapabilityRadar({
  key: "organizacion",
  canvas: els.capabilityRadarOrganizationChart,
  label: "Organización",
  values: radarData.organizacion,
  color: "#012169",
  backgroundColor: "rgba(1, 33, 105, 0.18)",
  radarData,
});
}

function renderSingleCapabilityRadar({ key, canvas, label, values, color, backgroundColor, radarData }) {
  if (!canvas) {
    return;
  }

  const chartData = {
    labels: radarData.displayLabels,
    datasets: [
      {
        label,
        data: values,
        fill: true,
        backgroundColor,
        borderColor: color,
        pointBackgroundColor: color,
        pointBorderColor: "#ffffff",
        pointHoverBackgroundColor: "#ffffff",
        pointHoverBorderColor: color,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 4,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            const index = items[0]?.dataIndex ?? 0;
            return radarData.originalLabels[index] || "";
          },
          label: (context) => `${context.dataset.label}: ${formatNumber(context.parsed.r)}`,
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 5,
        ticks: {
          stepSize: 1,
          backdropColor: "transparent",
          color: "#5c665e",
          font: {
            size: 11,
            weight: "700",
          },
        },
        pointLabels: {
          color: "#323a35",
          padding: 8,
          font: {
            size: 11,
            weight: "800",
          },
        },
        grid: {
          color: "#d9dfd4",
        },
        angleLines: {
          color: "#d9dfd4",
        },
      },
    },
    elements: {
      line: {
        borderWidth: 2.5,
      },
      point: {
        radius: 3.5,
        hoverRadius: 6,
      },
    },
  };

  if (capabilityRadarCharts[key]) {
    capabilityRadarCharts[key].data = chartData;
    capabilityRadarCharts[key].options = chartOptions;
    capabilityRadarCharts[key].update();
    return;
  }

  capabilityRadarCharts[key] = new Chart(canvas, {
    type: "radar",
    data: chartData,
    options: chartOptions,
  });
}




function buildCapabilityRadarData() {
  const rows = buildSummaryRows();

  return {
    originalLabels: rows.map((row) => row.Capacidad),
    displayLabels: rows.map((row) => getRadarShortLabel(row.Capacidad)),
    procesos: rows.map((row) => toRadarNumber(row.Procesos)),
    tecnologia: rows.map((row) => toRadarNumber(row.Tecnologia)),
    organizacion: rows.map((row) => toRadarNumber(row.Organizacion)),
  };
}

function toRadarNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}


function getRadarShortLabel(label) {
  const shortLabels = {
    "Presupuestos y previsiones": ["Presupuestos", "y previsiones"],
    "Informes de gestión del rendimiento": ["Informes", "gestión"],
    "Evaluación business case": ["Business", "case"],
    "Información y apoyo a la toma de decisiones": ["Apoyo", "decisiones"],
    "Planificación largo plazo": ["Planificación", "largo plazo"],
  };

  return shortLabels[label] || wrapRadarLabel(label);
}


function wrapRadarLabel(label) {
  const words = String(label).split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length > 18) {
      if (currentLine) {
        lines.push(currentLine);
      }

      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}


function renderAssessments() {
  const items = getVisibleItems();
  if (!items.length) {
    els.assessmentList.innerHTML = `<div class="empty-state">No hay subcapacidades que coincidan con los filtros actuales.</div>`;
    return;
  }

  const template = document.getElementById("assessmentCardTemplate");
  els.assessmentList.innerHTML = "";
  items.forEach((item) => {
    const metrics = calculate(item);
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".assessment-card");
    card.dataset.id = item.id;
    fragment.querySelector(".capability-chip").textContent = item.capacidad;
    fragment.querySelector("h3").textContent = item.subcapacidad;
    fragment.querySelector(".card-title-block p").textContent = item.objetivoEvaluacion;
    fragment.querySelector(".score-controls").innerHTML = LEVERS.map((lever) => scoreControl(item, lever)).join("");
    fragment.querySelector(".score-result").innerHTML = scoreResult(metrics);
    fragment.querySelector(".maturity-list").innerHTML = Object.entries(item.maturity)
      .map(([, text]) => `<li>${escapeHtml(text)}</li>`) // MODIFICADO: el <ol> ya numera automáticamente los niveles
      .join("");
    fragment.querySelector(".question-list").innerHTML = item.preguntasClave
      .split("\n")
      .map((question) => `<li>${escapeHtml(question)}</li>`)
      .join("");
    fragment.querySelector(".evidence-text").textContent = item.evidencias;
    els.assessmentList.appendChild(fragment);
  });

  els.assessmentList.querySelectorAll(".score-select").forEach((select) => {
    select.addEventListener("change", handleScoreChange);
  });
}

function scoreControl(item, lever) {
  const current = item.scores[lever.key];
  const options = [`<option value="">Sin puntuar</option>`]
    .concat([1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${current === value ? "selected" : ""}>${value}</option>`))
    .join("");
  return `
    <label class="score-field">
      <span>${escapeHtml(lever.label)}</span>
      <select class="score-select" data-id="${escapeAttr(item.id)}" data-lever="${lever.key}">
        ${options}
      </select>
    </label>
  `;
}

function scoreResult(metrics) {
  if (metrics.isPending) {
    return `
      ${priorityBadge("Pendiente")}
      <span class="metric-line"><strong>-</strong> score medio</span>
      <span class="metric-line">Pendiente de scoring</span>
    `;
  }

  return `
    ${priorityBadge(metrics.prioridad)}
    <span class="metric-line"><strong>${formatNumber(metrics.scoreMedio)}</strong> score medio</span>
    <span class="metric-line"><strong>${formatNumber(metrics.gap)}</strong> gap · ${escapeHtml(metrics.oleada)}</span>
    <span class="level-badge">${escapeHtml(metrics.nivel)}</span>
  `;
}

function handleScoreChange(event) {
  const item = state.items.find((entry) => entry.id === event.target.dataset.id);
  item.scores[event.target.dataset.lever] = toScore(event.target.value);
  persistScenario();
  renderAll();
}


function renderHeatmap() {
  const visibleItems = getVisibleItems();
  const capabilityRows = buildHeatmapCapabilityRows(visibleItems);

  const rows = capabilityRows
    .map((entry) => {
      const isExpanded = expandedHeatmapCapabilities.has(entry.capability);

      const detailRows = entry.items
        .map((item) => {
          const metrics = calculate(item);

          return `
            <tr class="heatmap-detail-row ${isExpanded ? "" : "is-hidden"}" data-capability-detail="${escapeAttr(entry.capability)}">
              <td class="heatmap-detail-capability">${escapeHtml(item.capacidad)}</td>
              <td>${escapeHtml(item.subcapacidad)}</td>
              ${LEVERS.map((lever) => heatScoreCell(item.scores[lever.key])).join("")}
              ${heatScoreCell(metrics.scoreMedio)}
              <td class="heat-cell ${gapClass(metrics.gap)}">${formatNumber(metrics.gap)}</td>
              <td>${priorityBadge(metrics.prioridad)}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <tr class="heatmap-capability-row">
          <td>
            <strong>${escapeHtml(entry.capability)}</strong>
          </td>
          <td>
            <button
              class="heatmap-toggle"
              type="button"
              data-capability-toggle="${escapeAttr(entry.capability)}"
              aria-expanded="${String(isExpanded)}"
            >
              ${isExpanded ? "Ocultar subcapacidades" : `Ver subcapacidades (${entry.items.length})`}
            </button>
          </td>
          ${heatScoreCell(entry.procesos)}
          ${heatScoreCell(entry.tecnologia)}
          ${heatScoreCell(entry.organizacion)}
          ${heatScoreCell(entry.scoreMedio)}
          <td class="heat-cell ${gapClass(entry.gap)}">${formatNumber(entry.gap)}</td>
          <td>${priorityBadge(entry.prioridad)}</td>
        </tr>
        ${detailRows}
      `;
    })
    .join("");

  els.heatmapTable.innerHTML = `
    <thead>
      <tr>
        <th>Capacidad</th>
        <th>Subcapacidades</th>
        <th class="number">Procesos</th>
        <th class="number">Tecnología</th>
        <th class="number">Organización</th>
        <th class="number">Score medio</th>
        <th class="number">Gap</th>
        <th>Prioridad</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="8">No hay datos para los filtros actuales.</td></tr>`}
    </tbody>
  `;

  els.heatmapTable.querySelectorAll(".heatmap-toggle").forEach((button) => {
    button.addEventListener("click", handleHeatmapToggle);
  });

  updateHeatmapExpandAllButton(capabilityRows); // NUEVO: sincroniza texto Expandir/Colapsar todo

}


function buildHeatmapCapabilityRows(items) {
  const capabilities = unique(items.map((item) => item.capacidad));

  return capabilities.map((capability) => {
    const capabilityItems = items.filter((item) => item.capacidad === capability);
    const calculatedItems = capabilityItems.map((item) => calculate(item));
    const scoredItems = calculatedItems.filter((metrics) => !metrics.isPending);

    const procesos = average(
      capabilityItems.map((item) => item.scores.procesos).filter(Number.isFinite),
    );

    const tecnologia = average(
      capabilityItems.map((item) => item.scores.tecnologia).filter(Number.isFinite),
    );

    const organizacion = average(
      capabilityItems.map((item) => item.scores.organizacion).filter(Number.isFinite),
    );

    const scoreMedio = average(scoredItems.map((metrics) => metrics.scoreMedio));
    const gap = scoreMedio === null ? null : round2(Math.max(0, state.meta.targetMaturity - scoreMedio));
    const prioridad = priorityFromGap(gap);

    return {
      capability,
      items: capabilityItems,
      procesos,
      tecnologia,
      organizacion,
      scoreMedio,
      gap,
      prioridad,
    };
  });
}


function handleHeatmapToggle(event) {
  const button = event.currentTarget;
  const capability = button.dataset.capabilityToggle;
  const isExpanded = button.getAttribute("aria-expanded") === "true";
  const nextExpanded = !isExpanded;

  if (nextExpanded) {
    expandedHeatmapCapabilities.add(capability);
  } else {
    expandedHeatmapCapabilities.delete(capability);
  }

  const detailRows = els.heatmapTable.querySelectorAll(
    `[data-capability-detail="${CSS.escape(capability)}"]`,
  );

  button.setAttribute("aria-expanded", String(nextExpanded));
  button.textContent = nextExpanded
    ? "Ocultar subcapacidades"
    : `Ver subcapacidades (${detailRows.length})`;

  detailRows.forEach((row) => {
    row.classList.toggle("is-hidden", !nextExpanded);
  });
}


function handleHeatmapExpandToggleAll() {
  const capabilityRows = buildHeatmapCapabilityRows(getVisibleItems());
  const visibleCapabilities = capabilityRows.map((entry) => entry.capability);

  if (!visibleCapabilities.length) {
    return;
  }

  const allExpanded = visibleCapabilities.every((capability) =>
    expandedHeatmapCapabilities.has(capability),
  );

  if (allExpanded) {
    visibleCapabilities.forEach((capability) => {
      expandedHeatmapCapabilities.delete(capability);
    });
  } else {
    visibleCapabilities.forEach((capability) => {
      expandedHeatmapCapabilities.add(capability);
    });
  }

  renderHeatmap();
}

function updateHeatmapExpandAllButton(capabilityRows) {
  if (!els.heatmapExpandToggle) {
    return;
  }

  const visibleCapabilities = capabilityRows.map((entry) => entry.capability);
  const allExpanded =
    visibleCapabilities.length > 0 &&
    visibleCapabilities.every((capability) => expandedHeatmapCapabilities.has(capability));

  els.heatmapExpandToggle.textContent = allExpanded ? "Colapsar todo" : "Expandir todo";
  els.heatmapExpandToggle.disabled = visibleCapabilities.length === 0;
}


function renderRoadmap() {
  const roadmapItems = getVisibleItems(); // Roadmap respeta filtros activos

  const rows = roadmapItems
    .map((item) => ({ item, metrics: calculate(item) }))
    .sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.metrics.prioridad] - PRIORITY_ORDER[b.metrics.prioridad];

      if (priorityDiff) {
        return priorityDiff;
      }

      return (b.metrics.gap || 0) - (a.metrics.gap || 0);
    })
    .map(({ item, metrics }) => `
      <tr>
        <td>${escapeHtml(item.capacidad)}</td>
        <td>${escapeHtml(item.subcapacidad)}</td>
        <td class="number">${formatNumber(metrics.gap)}</td>
        <td>${priorityBadge(metrics.prioridad)}</td>
        <td>${escapeHtml(item.iniciativaSugerida)}</td>
        <td>
          <button
            class="roadmap-ai-button"
            type="button"
            data-capability="${escapeAttr(item.capacidad)}"
            aria-label="Ver iniciativa IA para ${escapeAttr(item.capacidad)}"
          >
            IA
          </button>
        </td>
        <td><span class="status-chip">${escapeHtml(metrics.oleada)}</span></td>
        <td>
          <input
            class="inline-input roadmap-owner"
            data-id="${escapeAttr(item.id)}"
            value="${escapeAttr(item.owner)}"
            placeholder="Owner"
          >
        </td>
        <td>${statusSelect(item)}</td>
        <td>
          <textarea
            class="roadmap-comment"
            data-id="${escapeAttr(item.id)}"
            placeholder="Comentarios"
          >${escapeHtml(item.comentario)}</textarea>
        </td>
      </tr>
    `)
    .join("");

  els.roadmapTable.innerHTML = `
    <thead>
      <tr>
        <th>Capacidad</th>
        <th>Subcapacidad</th>
        <th class="number">Gap</th>
        <th>Prioridad</th>
        <th>Iniciativa sugerida</th>
        <th>IA</th>
        <th>Oleada</th>
        <th>Owner</th>
        <th>Estado</th>
        <th>Comentarios</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="10">No hay iniciativas para los filtros actuales.</td></tr>`}
    </tbody>
  `;

  els.roadmapTable.querySelectorAll(".roadmap-owner").forEach((input) => {
    input.addEventListener("input", handleRoadmapFieldChange);
  });

  els.roadmapTable.querySelectorAll(".roadmap-status").forEach((select) => {
    select.addEventListener("change", handleRoadmapFieldChange);
  });

  els.roadmapTable.querySelectorAll(".roadmap-comment").forEach((textarea) => {
    textarea.addEventListener("input", handleRoadmapFieldChange);
  });
}


function statusSelect(item) {
  return `
    <select class="inline-input roadmap-status" data-id="${escapeAttr(item.id)}">
      ${STATUS_OPTIONS.map((status) => `<option value="${escapeAttr(status)}" ${item.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
    </select>
  `;
}

function handleRoadmapFieldChange(event) {
  const item = state.items.find((entry) => entry.id === event.target.dataset.id);
  if (event.target.classList.contains("roadmap-owner")) item.owner = event.target.value;
  if (event.target.classList.contains("roadmap-status")) item.status = event.target.value;
  if (event.target.classList.contains("roadmap-comment")) item.comentario = event.target.value;
  persistScenario();
}

function heatScoreCell(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return `<td class="heat-cell heat-blank">-</td>`;
  }
  return `<td class="heat-cell heat-${Math.max(1, Math.min(5, Math.round(number)))}">${formatNumber(number)}</td>`;
}

function gapClass(value) {
  if (!Number.isFinite(value)) return "heat-blank";
  if (value >= 2) return "gap-high";
  if (value >= 1) return "gap-mid";
  return "gap-low";
}

function priorityBadge(priority) {
  const safePriority = priority || "Pendiente";
  return `<span class="priority-badge ${safePriority.toLowerCase()}">${escapeHtml(safePriority)}</span>`;
}

function priorityColor(priority) {
  if (priority === "Alta") return "#bb3128";
  if (priority === "Media") return "#c87900";
  if (priority === "Baja") return "#3e6f11";
  return "#8a9189";
}

function priorityFromGap(gap) {
  if (!Number.isFinite(gap)) return "Pendiente";
  if (gap >= 2) return "Alta";
  if (gap >= 1) return "Media";
  return "Baja";
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return null;
  return round2(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
}

function unique(values) {
  return [...new Set(values)];
}


async function initializeSharedScenario() {
  if (!scenarioDatabaseRef) {
    return;
  }

  try {
    const snapshot = await get(scenarioDatabaseRef);

    if (snapshot.exists()) {
      applyScenarioPayload(snapshot.val());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildScenarioPayload()));
      showNotice(`Escenario compartido cargado: ${scenarioId}`);
      updateSaveStatus("saved", "Sincronizado ✓"); // NUEVO: indica que el escenario remoto se cargó correctamente
    } else {
      await set(scenarioDatabaseRef, buildScenarioPayload());
      showNotice(`Escenario compartido creado: ${scenarioId}`);
    }

    subscribeToSharedScenario();
  } catch (error) {
    showNotice("No se pudo conectar con el escenario compartido. Se mantiene el modo local.", true);
    updateSaveStatus("saved", "Guardado ✓"); // NUEVO: indica que el escenario se creó correctamente en Firebase
    console.error(error);
  }
}

function subscribeToSharedScenario() {
  if (!scenarioDatabaseRef) {
    return;
  }

  onValue(scenarioDatabaseRef, (snapshot) => {
    if (!snapshot.exists()) {
      return;
    }

    try {
      isApplyingRemoteScenario = true;

      applyScenarioPayload(snapshot.val());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildScenarioPayload()));
      renderAll();
    } catch (error) {
      console.error("No se pudo aplicar el escenario remoto.", error);
    } finally {
      isApplyingRemoteScenario = false;
    }
  });
}


function updateSaveStatus(status, message) {
  if (!els.saveStatus) {
    return;
  }

  els.saveStatus.className = `save-status ${status || ""}`.trim();
  els.saveStatus.textContent = message;
}



function persistScenario() {
  const payload = buildScenarioPayload();

  updateSaveStatus("saving", "Guardando…"); // NUEVO: feedback inmediato

  // Modo local: guardado solo en este navegador
  if (!scenarioDatabaseRef) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    updateSaveStatus("saved", "Guardado ✓"); // NUEVO: confirmación en modo local
    return;
  }

  // Modo compartido: guardado en Firebase
  if (!isApplyingRemoteScenario) {
    set(scenarioDatabaseRef, payload)
      .then(() => {
        updateSaveStatus("saved", "Guardado ✓"); // NUEVO: confirmación tras guardar en Firebase
      })
      .catch((error) => {
        updateSaveStatus("error", "Error al guardar"); // NUEVO: feedback si Firebase falla
        showNotice("No se pudo guardar el escenario compartido en Firebase.", true);
        console.error(error);
      });
  }
}


function applyStoredScenario() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    applyScenarioPayload(JSON.parse(raw));
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
    console.warn("Stored scenario ignored", error);
  }
}

function buildScenarioPayload() {
  return {
    meta: {
      app: "F3M FP&A Assessment MVP",
      exportedAt: new Date().toISOString(),
      sourceFile: state.meta.sourceFile,
      targetMaturity: state.meta.targetMaturity,
    },
    scores: state.items.map((item) => ({
      id: item.id,
      subcapacidad: item.subcapacidad,
      scores: { ...item.scores },
      owner: item.owner,
      status: item.status,
      comentario: item.comentario,
    })),
  };
}

function applyScenarioPayload(payload) {
  const updates = Array.isArray(payload.scores)
    ? payload.scores
    : Array.isArray(payload.subcapacities)
      ? payload.subcapacities
      : null;
  if (!updates) {
    throw new Error("El JSON no tiene formato de escenario válido.");
  }

  const byId = new Map(updates.map((item) => [String(item.id), item]));
  state.items = state.items.map((item) => {
    const update = byId.get(item.id);
    if (!update) return item;
    const sourceScores = update.scores || {};
    return {
      ...item,
      scores: {
        procesos: toScore(sourceScores.procesos),
        tecnologia: toScore(sourceScores.tecnologia),
        organizacion: toScore(sourceScores.organizacion),
      },
      owner: update.owner ?? item.owner,
      status: STATUS_OPTIONS.includes(update.status) ? update.status : item.status,
      comentario: update.comentario ?? item.comentario,
    };
  });
}

function importScenario(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      applyScenarioPayload(JSON.parse(reader.result));
      persistScenario();
      renderAll();
      showNotice("Escenario importado correctamente.");
    } catch (error) {
      showNotice("El archivo no parece un escenario válido para este MVP.");
      console.error(error);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function exportScenarioJson() {
  downloadFile(
    "f3m_fpa_assessment_scenario.json",
    JSON.stringify(buildScenarioPayload(), null, 2),
    "application/json",
  );
}

function exportCsv() {
  const summaryRows = buildSummaryRows();
  const roadmapRows = state.items
    .map((item) => {
      const metrics = calculate(item);
      return {
        Tipo: "Roadmap",
        Capacidad: item.capacidad,
        Subcapacidad: item.subcapacidad,
        Procesos: item.scores.procesos ?? "",
        Tecnologia: item.scores.tecnologia ?? "",
        Organizacion: item.scores.organizacion ?? "",
        ScoreMedio: metrics.scoreMedio ?? "",
        Nivel: metrics.nivel,
        Gap: metrics.gap ?? "",
        Prioridad: metrics.prioridad,
        Oleada: metrics.oleada,
        IniciativaSugerida: item.iniciativaSugerida,
        Owner: item.owner,
        Estado: item.status,
        Comentarios: item.comentario,
      };
    });
  downloadFile("f3m_fpa_assessment_export.csv", toCsv([...summaryRows, ...roadmapRows]), "text/csv;charset=utf-8");
}


function exportPdfReport() {
  const reportWindow = window.open("", "_blank");

  if (!reportWindow) {
    showNotice("El navegador ha bloqueado la ventana del informe. Permite pop-ups para exportar el PDF.", true);
    return;
  }

  const reportHtml = buildPdfReportHtml();

  reportWindow.document.open();
  reportWindow.document.write(reportHtml);
  reportWindow.document.close();

  reportWindow.onload = () => {
    reportWindow.focus();
    reportWindow.print();
  };
}

function buildPdfReportHtml() {
  const generatedAt = new Date().toLocaleString("es-ES");
  const scenarioLabel = scenarioId || "Modo local";
  const metrics = state.items.map((item) => ({ item, metrics: calculate(item) }));
  const scored = metrics.filter((entry) => !entry.metrics.isPending);

  const scoreGlobal = average(scored.map((entry) => entry.metrics.scoreMedio));
  const gapMedio = average(scored.map((entry) => entry.metrics.gap));
  const highCount = scored.filter((entry) => entry.metrics.prioridad === "Alta").length;

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Informe FP&A Assessment</title>
        <style>
          ${getPdfReportStyles()}
        </style>
      </head>
      <body>
        <main class="report">
          ${buildPdfCover(generatedAt, scenarioLabel)}
          ${buildPdfExecutiveSummary(scoreGlobal, gapMedio, scored.length, highCount)}
          ${buildPdfSummaryTable()}
          ${buildPdfHeatmapTable()}
          ${buildPdfRoadmapTable()}
        </main>
      </body>
    </html>
  `;
}


function buildPdfCover(generatedAt, scenarioLabel) {
  return `
    <section class="page cover-page">
      <p class="eyebrow">Finance Strategy · F3M</p>
      <h1>FP&A Assessment</h1>
      <p class="subtitle">Informe ejecutivo de madurez FP&A</p>

      <div class="cover-meta">
        <p><strong>Fecha de generación:</strong> ${escapeHtml(generatedAt)}</p>
        <p><strong>Escenario:</strong> ${escapeHtml(scenarioLabel)}</p>
        <p><strong>Fuente:</strong> ${escapeHtml(state.meta?.sourceFile || "-")}</p>
        <p><strong>Objetivo de madurez:</strong> ${escapeHtml(String(state.meta?.targetMaturity || "-"))}</p>
      </div>
    </section>
  `;
}

function buildPdfExecutiveSummary(scoreGlobal, gapMedio, scoredCount, highCount) {
  return `
    <section class="page">
      <h2>1. Resumen ejecutivo</h2>
      <p>
        Este informe resume el resultado del assessment FP&A, mostrando el nivel de madurez actual,
        los principales gaps frente al objetivo y las iniciativas sugeridas para priorizar el roadmap.
      </p>

      <div class="kpi-grid">
        <article>
          <span>Score global</span>
          <strong>${escapeHtml(formatNumber(scoreGlobal))}</strong>
        </article>
        <article>
          <span>Gap medio</span>
          <strong>${escapeHtml(formatNumber(gapMedio))}</strong>
        </article>
        <article>
          <span>Subcapacidades puntuadas</span>
          <strong>${scoredCount}/${state.items.length}</strong>
        </article>
        <article>
          <span>Prioridad alta</span>
          <strong>${highCount}</strong>
        </article>
      </div>
    </section>
  `;
}

function buildPdfSummaryTable() {
  const rows = buildSummaryRows()
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.Capacidad)}</td>
        <td>${escapeHtml(row.Procesos)}</td>
        <td>${escapeHtml(row.Tecnologia)}</td>
        <td>${escapeHtml(row.Organizacion)}</td>
        <td>${escapeHtml(row.ScoreMedio)}</td>
        <td>${escapeHtml(row.Gap)}</td>
        <td>${escapeHtml(row.Prioridad)}</td>
      </tr>
    `)
    .join("");

  return `
    <section class="page">
      <h2>2. Resumen por capacidad</h2>
      <table>
        <thead>
          <tr>
            <th>Capacidad</th>
            <th>Procesos</th>
            <th>Tecnología</th>
            <th>Organización</th>
            <th>Score medio</th>
            <th>Gap</th>
            <th>Prioridad</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>
  `;
}


function buildPdfHeatmapTable() {
  const rows = state.items
    .map((item) => {
      const metrics = calculate(item);

      return `
        <tr>
          <td>${escapeHtml(item.capacidad)}</td>
          <td>${escapeHtml(item.subcapacidad)}</td>
          <td>${escapeHtml(formatNumber(item.scores.procesos))}</td>
          <td>${escapeHtml(formatNumber(item.scores.tecnologia))}</td>
          <td>${escapeHtml(formatNumber(item.scores.organizacion))}</td>
          <td>${escapeHtml(formatNumber(metrics.scoreMedio))}</td>
          <td>${escapeHtml(formatNumber(metrics.gap))}</td>
          <td>${escapeHtml(metrics.prioridad)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <section class="page">
      <h2>3. Heatmap de madurez</h2>
      <table>
        <thead>
          <tr>
            <th>Capacidad</th>
            <th>Subcapacidad</th>
            <th>Procesos</th>
            <th>Tecnología</th>
            <th>Organización</th>
            <th>Score medio</th>
            <th>Gap</th>
            <th>Prioridad</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>
  `;
}

function buildPdfRoadmapTable() {
  const rows = [...state.items]
    .map((item) => ({ item, metrics: calculate(item) }))
    .sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.metrics.prioridad] - PRIORITY_ORDER[b.metrics.prioridad];
      if (priorityDiff) return priorityDiff;
      return (b.metrics.gap || 0) - (a.metrics.gap || 0);
    })
    .map(({ item, metrics }) => `
      <tr>
        <td>${escapeHtml(item.capacidad)}</td>
        <td>${escapeHtml(item.subcapacidad)}</td>
        <td>${escapeHtml(formatNumber(metrics.gap))}</td>
        <td>${escapeHtml(metrics.prioridad)}</td>
        <td>${escapeHtml(metrics.oleada)}</td>
        <td>${escapeHtml(item.iniciativaSugerida)}</td>
        <td>${escapeHtml(item.owner)}</td>
        <td>${escapeHtml(item.status)}</td>
        <td>${escapeHtml(item.comentario)}</td>
      </tr>
    `)
    .join("");

  return `
    <section class="page">
      <h2>4. Roadmap e iniciativas sugeridas</h2>
      <table>
        <thead>
          <tr>
            <th>Capacidad</th>
            <th>Subcapacidad</th>
            <th>Gap</th>
            <th>Prioridad</th>
            <th>Oleada</th>
            <th>Iniciativa sugerida</th>
            <th>Owner</th>
            <th>Estado</th>
            <th>Comentarios</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>
  `;
}


function getPdfReportStyles() {
  return `
    :root {
      --green: #86bc25;
      --ink: #161a18;
      --muted: #5c665e;
      --line: #d9dfd4;
      --surface-muted: #f6f7f3;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: var(--ink);
      font-family: "Segoe UI", Arial, sans-serif;
      background: #ffffff;
      line-height: 1.4;
    }

    .report {
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px;
    }

    .page {
      page-break-after: always;
      padding: 24px 0;
    }

    .page:last-child {
      page-break-after: auto;
    }

    .cover-page {
      min-height: 90vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      border-bottom: 8px solid var(--green);
    }

    .eyebrow {
      color: var(--green);
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0 0 12px;
      font-size: 3rem;
      line-height: 1.05;
    }

    h2 {
      margin: 0 0 18px;
      font-size: 1.5rem;
      border-bottom: 3px solid var(--green);
      padding-bottom: 8px;
    }

    .subtitle {
      color: var(--muted);
      font-size: 1.2rem;
    }

    .cover-meta {
      margin-top: 36px;
      padding: 20px;
      background: var(--surface-muted);
      border: 1px solid var(--line);
    }

    .cover-meta p {
      margin: 8px 0;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-top: 24px;
    }

    .kpi-grid article {
      padding: 16px;
      border: 1px solid var(--line);
      background: var(--surface-muted);
    }

    .kpi-grid span {
      display: block;
      margin-bottom: 8px;
      color: var(--muted);
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .kpi-grid strong {
      display: block;
      font-size: 1.8rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      font-size: 0.78rem;
    }

    th,
    td {
      border: 1px solid var(--line);
      padding: 7px 8px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: var(--surface-muted);
      font-size: 0.7rem;
      text-transform: uppercase;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .report {
        max-width: none;
        padding: 18mm;
      }

      .page {
        page-break-after: always;
      }

      h1 {
        font-size: 32pt;
      }

      h2 {
        font-size: 16pt;
      }

      table {
        font-size: 8pt;
      }

      th,
      td {
        padding: 4px 5px;
      }
    }
  `;
}


function buildSummaryRows() {
  return unique(state.items.map((item) => item.capacidad)).map((capability) => {
    const items = state.items.filter((item) => item.capacidad === capability);
    const scored = items.map(calculate).filter((metrics) => !metrics.isPending);
    const scoreMedio = average(scored.map((metrics) => metrics.scoreMedio));
    const gap = scoreMedio === null ? null : round2(Math.max(0, state.meta.targetMaturity - scoreMedio));
    return {
      Tipo: "Resumen",
      Capacidad: capability,
      Subcapacidad: "",
      Procesos: average(items.map((item) => item.scores.procesos).filter(Number.isFinite)) ?? "",
      Tecnologia: average(items.map((item) => item.scores.tecnologia).filter(Number.isFinite)) ?? "",
      Organizacion: average(items.map((item) => item.scores.organizacion).filter(Number.isFinite)) ?? "",
      ScoreMedio: scoreMedio ?? "",
      Nivel: scoreMedio === null ? "" : getMaturityLevel(scoreMedio),
      Gap: gap ?? "",
      Prioridad: priorityFromGap(gap),
      Oleada: "",
      IniciativaSugerida: "",
      Owner: "",
      Estado: "",
      Comentarios: "",
    };
  });
}

function toCsv(rows) {
  const headers = Object.keys(rows[0]);
  const csvRows = [headers.join(",")];
  rows.forEach((row) => {
    csvRows.push(headers.map((header) => csvEscape(row[header])).join(","));
  });
  return csvRows.join("\n");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


function resetScenario() {
  const confirmed = window.confirm(
    "¿Seguro que quieres restaurar la base? Se perderán los cambios guardados localmente en este navegador.",
  ); // NUEVO: pide confirmación antes de borrar datos locales

  if (!confirmed) {
    return; // NUEVO: si el usuario cancela, no se borra nada
  }

  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}


function showNotice(message, persistent = false) {
  els.loadNotice.textContent = message;
  els.loadNotice.hidden = false;
  if (persistent) return;
  window.setTimeout(() => {
    if (els.loadNotice.textContent === message) {
      els.loadNotice.hidden = true;
    }
  }, 7000);
}



function getScenarioIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const rawScenarioId = params.get("scenario");

  if (!rawScenarioId) {
    return null;
  }

  const cleanScenarioId = rawScenarioId.trim();

  // Permitimos letras, números, guiones y guiones bajos para evitar rutas raras en Firebase
  const isValidScenarioId = /^[a-zA-Z0-9_-]{6,120}$/.test(cleanScenarioId);

  if (!isValidScenarioId) {
    console.warn("Scenario ID inválido. Se usará modo local:", cleanScenarioId);
    return null;
  }

  return cleanScenarioId;
}


function showScenarioModeNotice() {
  if (!scenarioId) {
    return;
  }

  showNotice(
    `Escenario compartido activo: ${scenarioId}. Los cambios se guardan automáticamente y se sincronizan con cualquier navegador que use este mismo enlace.`,
  ); // MODIFICADO: el mensaje refleja que Firebase ya guarda y sincroniza datos

}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
