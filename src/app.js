(function initializeApp() {
  const workbookInput = document.getElementById('workbookInput');
  const rampMonthsInput = document.getElementById('rampMonths');
  const defaultRampMonthInput = document.getElementById('defaultRampMonth');
  const statusMessage = document.getElementById('statusMessage');
  const warningList = document.getElementById('warningList');
  const summaryCards = document.getElementById('summaryCards');
  const profitabilityCards = document.getElementById('profitabilityCards');
  const roleTableBody = document.getElementById('roleTableBody');
  const roleDetailBody = document.getElementById('roleDetailBody');
  const selectedRoleLabel = document.getElementById('selectedRoleLabel');
  const tributosPyramid = document.getElementById('tributosPyramid');
  const sancionesPyramid = document.getElementById('sancionesPyramid');
  const projectTableBody = document.getElementById('projectTableBody');

  const state = {
    currentRows: [],
    detailRows: [],
    dashboard: null,
    sheetNames: {
      current: '',
      detail: '',
    },
    selectedRole: null,
  };

  function formatCurrency(value) {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  function formatPercent(value) {
    return `${new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value || 0)}%`;
  }

  function setWarnings(messages) {
    warningList.innerHTML = '';
    if (!messages.length) {
      return;
    }

    messages.forEach((message) => {
      const item = document.createElement('li');
      item.textContent = message;
      warningList.appendChild(item);
    });
  }

  function renderCards(container, cards) {
    container.classList.remove('empty-state');
    container.innerHTML = '';

    cards.forEach((card) => {
      const article = document.createElement('article');
      article.className = 'card';
      article.innerHTML = `
        <span class="card-label">${card.label}</span>
        <span class="card-value ${card.tone || ''}">${card.value}</span>
      `;
      container.appendChild(article);
    });
  }

  function renderRoleTable() {
    const roles = state.dashboard.currentSummary.roleSummary;
    if (!roles.length) {
      roleTableBody.innerHTML =
        '<tr><td colspan="5" class="muted">No hay recursos activos para mostrar.</td></tr>';
      return;
    }

    roleTableBody.innerHTML = '';
    roles.forEach((role) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${role.role}</td>
        <td>${role.headcount}</td>
        <td>${formatCurrency(role.amount)}</td>
        <td>${formatPercent(role.percentage)}</td>
        <td><button type="button" class="secondary" data-role="${role.role}">Ver detalle</button></td>
      `;
      roleTableBody.appendChild(row);
    });

    roleTableBody.querySelectorAll('button[data-role]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedRole = button.dataset.role;
        renderRoleDetail();
      });
    });
  }

  function renderRoleDetail() {
    const role =
      state.dashboard.currentSummary.roleSummary.find(
        (entry) => entry.role === state.selectedRole,
      ) || state.dashboard.currentSummary.roleSummary[0];

    if (!role) {
      selectedRoleLabel.textContent = 'Selecciona un rol en la tabla anterior.';
      roleDetailBody.innerHTML =
        '<tr><td colspan="7" class="muted">Sin detalle seleccionado.</td></tr>';
      return;
    }

    state.selectedRole = role.role;
    selectedRoleLabel.textContent = `${role.role} · ${role.headcount} persona(s) · ${formatCurrency(role.amount)}`;

    roleDetailBody.innerHTML = '';
    role.members.forEach((member) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${member.name}</td>
        <td>${member.family}</td>
        <td>${member.group || '—'}</td>
        <td>${formatCurrency(member.csr)}</td>
        <td>${formatPercent(member.totalDedicationPct)}</td>
        <td>${formatCurrency(member.allocatedCost)}</td>
        <td>${member.projectAssignments.map((assignment) => `${assignment.project} (${formatPercent(assignment.dedicationPct)})`).join(', ') || '—'}</td>
      `;
      roleDetailBody.appendChild(row);
    });
  }

  function renderPyramid(container, familyName) {
    const rows = state.dashboard.currentSummary.pyramidByFamily[familyName] || [];
    container.innerHTML = '';

    if (!rows.length) {
      container.classList.add('empty-state');
      container.innerHTML = '<p>Sin datos para esta familia.</p>';
      return;
    }

    container.classList.remove('empty-state');
    const maxCount = Math.max(...rows.map((row) => row.count), 1);

    rows.forEach((row) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'pyramid-row';
      wrapper.innerHTML = `
        <div class="pyramid-meta">
          <span>${row.role}</span>
          <strong>${row.count}</strong>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${(row.count / maxCount) * 100}%"></div>
        </div>
      `;
      container.appendChild(wrapper);
    });
  }

  function renderProjects() {
    const projects = state.dashboard.detailSummary.projects;
    if (!projects.length) {
      projectTableBody.innerHTML =
        '<tr><td colspan="5" class="muted">No se han identificado proyectos en la pestaña Detalle.</td></tr>';
      return;
    }

    projectTableBody.innerHTML = '';
    projects.forEach((project) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${project.project}</td>
        <td>${formatCurrency(project.cost)}</td>
        <td>${formatCurrency(project.revenue)}</td>
        <td class="${project.margin >= 0 ? 'positive' : 'negative'}">${formatCurrency(project.margin)}</td>
        <td>${project.marginPct === null ? '—' : formatPercent(project.marginPct)}</td>
      `;
      projectTableBody.appendChild(row);
    });
  }

  function buildSummaryCards() {
    const current = state.dashboard.currentSummary;
    return [
      {
        label: 'Recursos activos',
        value: String(current.activeMembers.length),
      },
      {
        label: 'Coste imputado total',
        value: formatCurrency(current.totalAllocatedCost),
      },
      {
        label: 'Roles detectados',
        value: String(current.roleSummary.length),
      },
      {
        label: 'Proyectos detectados',
        value: String(current.projectKeys.length),
      },
    ];
  }

  function buildProfitabilityCards() {
    const profitability = state.dashboard.profitability;
    return [
      {
        label: 'Ingresos',
        value: formatCurrency(profitability.totalRevenue),
      },
      {
        label: 'Coste base',
        value: formatCurrency(profitability.baselineCost),
      },
      {
        label: 'Margen base',
        value: `${formatCurrency(profitability.baselineMargin)}${profitability.baselineMarginPct === null ? '' : ` · ${formatPercent(profitability.baselineMarginPct)}`}`,
        tone: profitability.baselineMargin >= 0 ? 'positive' : 'negative',
      },
      {
        label: 'Impacto rampa escuela',
        value: formatCurrency(profitability.totalRampImpact),
        tone: profitability.totalRampImpact > 0 ? 'negative' : '',
      },
      {
        label: 'Margen ajustado',
        value: `${formatCurrency(profitability.adjustedMargin)}${profitability.adjustedMarginPct === null ? '' : ` · ${formatPercent(profitability.adjustedMarginPct)}`}`,
        tone: profitability.adjustedMargin >= 0 ? 'positive' : 'negative',
      },
      {
        label: 'Productividad media escuela',
        value: `${formatPercent(profitability.averageProductivity)} · ${profitability.escuelaHeadcount} persona(s)`,
      },
    ];
  }

  function renderDashboard() {
    renderCards(summaryCards, buildSummaryCards());
    renderCards(profitabilityCards, buildProfitabilityCards());
    renderRoleTable();
    renderRoleDetail();
    renderPyramid(tributosPyramid, 'Tributos');
    renderPyramid(sancionesPyramid, 'Sanciones');
    renderProjects();

    const sheetInfo = [
      `Pestaña operativa: ${state.sheetNames.current || 'no detectada'}`,
      `Pestaña detalle: ${state.sheetNames.detail || 'no detectada'}`,
    ];
    if (state.dashboard.profitability.estimatedMembers > 0) {
      sheetInfo.push(
        `${state.dashboard.profitability.estimatedMembers} perfil(es) escuela calculados con el mes por defecto.`,
      );
    }
    statusMessage.textContent = sheetInfo.join(' · ');
    setWarnings(state.dashboard.warnings);
  }

  function pickSheetName(sheetNames, preferredTerms, fallbackIndex) {
    const normalizedSheets = sheetNames.map((name) => ({
      name,
      normalized: TeamAnalytics.normalizeText(name),
    }));

    for (const term of preferredTerms) {
      const match = normalizedSheets.find((sheet) =>
        sheet.normalized.includes(TeamAnalytics.normalizeText(term)),
      );
      if (match) {
        return match.name;
      }
    }

    return sheetNames[fallbackIndex] || '';
  }

  function recalculate() {
    if (!state.currentRows.length && !state.detailRows.length) {
      return;
    }

    state.dashboard = TeamAnalytics.buildDashboard({
      currentRows: state.currentRows,
      detailRows: state.detailRows,
      options: {
        rampMonths: Number.parseInt(rampMonthsInput.value, 10) || 6,
        defaultRampMonth: Number.parseInt(defaultRampMonthInput.value, 10) || 1,
        referenceDate: new Date(),
      },
    });
    renderDashboard();
  }

  async function handleWorkbook(file) {
    if (!file) {
      return;
    }

    statusMessage.textContent = 'Cargando Excel...';
    setWarnings([]);

    if (!window.XLSX) {
      statusMessage.textContent =
        'No se ha podido cargar la librería de Excel. Revisa la conexión y vuelve a intentarlo.';
      return;
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    const currentSheet = pickSheetName(
      workbook.SheetNames,
      ['mes actual', 'actual'],
      0,
    );
    const detailSheet = pickSheetName(workbook.SheetNames, ['detalle'], 1);

    state.sheetNames = {
      current: currentSheet,
      detail: detailSheet,
    };
    state.currentRows = currentSheet
      ? XLSX.utils.sheet_to_json(workbook.Sheets[currentSheet], {
          defval: '',
          raw: false,
        })
      : [];
    state.detailRows = detailSheet
      ? XLSX.utils.sheet_to_json(workbook.Sheets[detailSheet], {
          defval: '',
          raw: false,
        })
      : [];
    state.selectedRole = null;

    recalculate();
  }

  workbookInput.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    try {
      await handleWorkbook(file);
    } catch (error) {
      statusMessage.textContent = 'No se ha podido procesar el Excel.';
      setWarnings([error.message]);
    }
  });

  [rampMonthsInput, defaultRampMonthInput].forEach((input) => {
    input.addEventListener('change', recalculate);
  });
})();
