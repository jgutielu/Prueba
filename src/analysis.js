(function createAnalysisModule(globalScope) {
  const CURRENT_ALIASES = {
    active: ['activo', 'active'],
    role: ['rol', 'role'],
    family: ['familia', 'family'],
    strategyLine: ['linea estrategica', 'línea estratégica', 'linea', 'linea de ejecucion'],
    group: ['group', 'grupo'],
    csr: ['csr', 'coste', 'costo', 'coste persona', 'coste mensual'],
    name: ['nombre', 'persona', 'recurso', 'empleado', 'consultor', 'name'],
    months: [
      'meses desde incorporacion',
      'meses desde incorporación',
      'meses en proyecto',
      'meses escuela',
      'meses adaptacion',
      'meses adaptación',
      'meses desde alta',
      'meses desde inicio',
      'seniority meses',
    ],
    startDate: [
      'fecha incorporacion',
      'fecha incorporación',
      'fecha alta',
      'fecha inicio',
      'inicio',
      'start date',
    ],
  };

  const DETAIL_ALIASES = {
    project: ['proyecto', 'project', 'codigo proyecto', 'código proyecto'],
    cost: ['coste', 'costo', 'cost', 'importe coste', 'importe costo'],
    revenue: ['ingreso', 'revenue', 'facturacion', 'facturación', 'venta', 'importe ingreso'],
  };

  const ROLE_PRIORITY = [
    'gestion funcional',
    'gestión funcional',
    'funcional',
    'funcional escuela',
    'tecnico',
    'técnico',
  ];

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function titleCase(value) {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return '';
    }

    return normalized
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  function parseNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (value === null || value === undefined || value === '') {
      return null;
    }

    const raw = String(value).trim();
    if (!raw) {
      return null;
    }

    let sanitized = raw.replace(/[€$\s]/g, '');
    const commaIndex = sanitized.lastIndexOf(',');
    const dotIndex = sanitized.lastIndexOf('.');

    if (commaIndex > -1 && dotIndex > -1) {
      if (commaIndex > dotIndex) {
        sanitized = sanitized.replace(/\./g, '').replace(',', '.');
      } else {
        sanitized = sanitized.replace(/,/g, '');
      }
    } else if (commaIndex > -1) {
      sanitized = sanitized.replace(/\./g, '').replace(',', '.');
    } else {
      sanitized = sanitized.replace(/,/g, '');
    }

    const parsed = Number.parseFloat(sanitized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parsePercent(value) {
    const parsed = parseNumber(value);
    if (parsed === null) {
      return 0;
    }

    const raw = String(value ?? '');
    if (raw.includes('%')) {
      return parsed;
    }

    return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  }

  function parseBoolean(value) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    const normalized = normalizeText(value);
    if (!normalized) {
      return true;
    }

    if (
      ['si', 'sí', 'yes', 'true', 'activo', 'active', 'x', '1'].includes(
        normalized,
      )
    ) {
      return true;
    }

    if (
      ['no', 'false', 'inactivo', 'inactive', '0'].includes(normalized)
    ) {
      return false;
    }

    return true;
  }

  function parseDate(value) {
    if (value instanceof Date && !Number.isNaN(value.valueOf())) {
      return value;
    }

    if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 70000) {
      return new Date(Math.round((value - 25569) * 86400 * 1000));
    }

    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const fromNative = new Date(trimmed);
    if (!Number.isNaN(fromNative.valueOf())) {
      return fromNative;
    }

    const parts = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!parts) {
      return null;
    }

    const day = Number.parseInt(parts[1], 10);
    const month = Number.parseInt(parts[2], 10) - 1;
    const year = Number.parseInt(parts[3], 10);
    const resolvedYear = year < 100 ? 2000 + year : year;
    const parsed = new Date(resolvedYear, month, day);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  }

  function monthsBetweenInclusive(startDate, endDate) {
    return (
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth()) +
      1
    );
  }

  function getAllKeys(rows) {
    const set = new Set();
    rows.forEach((row) => {
      Object.keys(row || {}).forEach((key) => set.add(key));
    });
    return Array.from(set);
  }

  function findAliasKey(keys, aliases) {
    const normalizedKeys = keys.map((key) => ({
      original: key,
      normalized: normalizeText(key),
    }));
    const normalizedAliases = aliases.map(normalizeText);

    for (const alias of normalizedAliases) {
      const exact = normalizedKeys.find((key) => key.normalized === alias);
      if (exact) {
        return exact.original;
      }
    }

    for (const alias of normalizedAliases) {
      const contains = normalizedKeys.find((key) => key.normalized.includes(alias));
      if (contains) {
        return contains.original;
      }
    }

    return null;
  }

  function detectProjectKeys(keys) {
    return keys
      .map((key) => {
        const normalized = normalizeText(key);
        if (/^p\d+$/.test(normalized)) {
          return { key, project: normalized.toUpperCase() };
        }

        const match = normalized.match(/(?:dedicacion|proyecto|project)\s*(p\d+)/);
        if (match) {
          return { key, project: match[1].toUpperCase() };
        }

        return null;
      })
      .filter(Boolean)
      .sort((left, right) => left.project.localeCompare(right.project));
  }

  function normalizeFamily(value) {
    const normalized = normalizeText(value);
    if (normalized.includes('tribut')) {
      return 'Tributos';
    }

    if (normalized.includes('multa') || normalized.includes('sancion')) {
      return 'Sanciones';
    }

    return titleCase(value || 'Sin familia') || 'Sin familia';
  }

  function isEscuelaRole(role) {
    const normalized = normalizeText(role);
    return normalized.includes('funcional') && normalized.includes('escuela');
  }

  function sortRoles(roleA, roleB) {
    const normalizedA = normalizeText(roleA);
    const normalizedB = normalizeText(roleB);
    const indexA = ROLE_PRIORITY.findIndex((role) => normalizedA.includes(normalizeText(role)));
    const indexB = ROLE_PRIORITY.findIndex((role) => normalizedB.includes(normalizeText(role)));
    const resolvedIndexA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
    const resolvedIndexB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
    if (resolvedIndexA !== resolvedIndexB) {
      return resolvedIndexA - resolvedIndexB;
    }

    return roleA.localeCompare(roleB, 'es');
  }

  function getMonthsUntilFullProductivity(row, fieldMap, options) {
    const monthsValue = fieldMap.months ? parseNumber(row[fieldMap.months]) : null;
    if (monthsValue !== null) {
      return Math.max(1, Math.round(monthsValue));
    }

    const startDateValue = fieldMap.startDate ? parseDate(row[fieldMap.startDate]) : null;
    if (startDateValue) {
      return Math.max(1, monthsBetweenInclusive(startDateValue, options.referenceDate));
    }

    return options.defaultRampMonth;
  }

  function calculateProductivity(monthsElapsed, rampMonths) {
    const safeRamp = Math.max(1, rampMonths);
    return Math.min(1, Math.max(1, monthsElapsed) / safeRamp);
  }

  function summarizeCurrentSheet(rows, rawOptions) {
    const options = {
      rampMonths: 6,
      defaultRampMonth: 1,
      referenceDate: new Date(),
      ...rawOptions,
    };

    const keys = getAllKeys(rows);
    const fieldMap = Object.fromEntries(
      Object.entries(CURRENT_ALIASES).map(([name, aliases]) => [
        name,
        findAliasKey(keys, aliases),
      ]),
    );
    const projectKeys = detectProjectKeys(keys);
    const warnings = [];

    if (!fieldMap.role) {
      warnings.push('No se ha detectado la columna de Rol.');
    }
    if (!fieldMap.csr) {
      warnings.push('No se ha detectado la columna CSR.');
    }
    if (!fieldMap.family) {
      warnings.push('No se ha detectado la columna Familia.');
    }
    if (!projectKeys.length) {
      warnings.push(
        'No se han detectado columnas P1/P2/P3/P4; se asumirá 100% de dedicación para los recursos activos.',
      );
    }

    const members = rows.map((row, index) => {
      const active = fieldMap.active ? parseBoolean(row[fieldMap.active]) : true;
      const role = String(row[fieldMap.role] || 'Sin rol').trim() || 'Sin rol';
      const family = normalizeFamily(fieldMap.family ? row[fieldMap.family] : 'Sin familia');
      const group = String(row[fieldMap.group] || '').trim();
      const strategyLine = String(row[fieldMap.strategyLine] || '').trim();
      const csr = parseNumber(fieldMap.csr ? row[fieldMap.csr] : null) || 0;
      const name =
        String(row[fieldMap.name] || '').trim() || `Recurso ${index + 1}`;
      const projectAssignments = projectKeys
        .map(({ key, project }) => ({
          project,
          dedicationPct: parsePercent(row[key]),
        }))
        .filter((assignment) => assignment.dedicationPct > 0);
      const totalDedicationPct = projectKeys.length
        ? projectAssignments.reduce(
            (sum, assignment) => sum + assignment.dedicationPct,
            0,
          )
        : active
          ? 100
          : 0;
      const allocatedCost = csr * (totalDedicationPct / 100);
      const monthsElapsed = isEscuelaRole(role)
        ? getMonthsUntilFullProductivity(row, fieldMap, options)
        : null;
      const productivity = isEscuelaRole(role)
        ? calculateProductivity(monthsElapsed, options.rampMonths)
        : 1;
      const productivityAdjustedCost =
        productivity > 0 ? allocatedCost / productivity : allocatedCost;
      const productivityImpact = productivityAdjustedCost - allocatedCost;

      return {
        active,
        role,
        family,
        group,
        strategyLine,
        csr,
        name,
        projectAssignments,
        totalDedicationPct,
        allocatedCost,
        monthsElapsed,
        productivity,
        productivityAdjustedCost,
        productivityImpact,
        productivitySource:
          fieldMap.months && row[fieldMap.months] !== ''
            ? 'months'
            : fieldMap.startDate && row[fieldMap.startDate]
              ? 'startDate'
              : 'default',
      };
    });

    const activeMembers = members.filter((member) => member.active);
    if (
      activeMembers.some(
        (member) =>
          isEscuelaRole(member.role) && member.productivitySource === 'default',
      )
    ) {
      warnings.push(
        'Hay perfiles "Funcional - Escuela" sin antigüedad detectable; se usa el mes por defecto configurado.',
      );
    }

    const totalAllocatedCost = activeMembers.reduce(
      (sum, member) => sum + member.allocatedCost,
      0,
    );

    const roleSummary = Array.from(
      activeMembers.reduce((map, member) => {
        const current = map.get(member.role) || {
          role: member.role,
          headcount: 0,
          amount: 0,
          members: [],
        };
        current.headcount += 1;
        current.amount += member.allocatedCost;
        current.members.push(member);
        map.set(member.role, current);
        return map;
      }, new Map()).values(),
    )
      .map((role) => ({
        ...role,
        percentage: totalAllocatedCost
          ? (role.amount / totalAllocatedCost) * 100
          : 0,
        members: role.members.sort((left, right) =>
          left.name.localeCompare(right.name, 'es'),
        ),
      }))
      .sort((left, right) => sortRoles(left.role, right.role));

    const pyramidByFamily = activeMembers.reduce((map, member) => {
      const familyKey = member.family;
      const roleKey = member.role;
      const familyEntry = map.get(familyKey) || new Map();
      familyEntry.set(roleKey, (familyEntry.get(roleKey) || 0) + 1);
      map.set(familyKey, familyEntry);
      return map;
    }, new Map());

    return {
      warnings,
      fieldMap,
      projectKeys: projectKeys.map((project) => project.project),
      members,
      activeMembers,
      totalAllocatedCost,
      roleSummary,
      pyramidByFamily: Object.fromEntries(
        Array.from(pyramidByFamily.entries()).map(([family, roles]) => [
          family,
          Array.from(roles.entries())
            .map(([role, count]) => ({ role, count }))
            .sort((left, right) => sortRoles(left.role, right.role)),
        ]),
      ),
    };
  }

  function summarizeDetailSheet(rows) {
    const keys = getAllKeys(rows);
    const fieldMap = Object.fromEntries(
      Object.entries(DETAIL_ALIASES).map(([name, aliases]) => [
        name,
        findAliasKey(keys, aliases),
      ]),
    );

    const projects = rows
      .map((row, index) => {
        const project =
          String(row[fieldMap.project] || '').trim() || `Proyecto ${index + 1}`;
        const cost = parseNumber(fieldMap.cost ? row[fieldMap.cost] : null) || 0;
        const revenue =
          parseNumber(fieldMap.revenue ? row[fieldMap.revenue] : null) || 0;
        const margin = revenue - cost;
        return {
          project,
          cost,
          revenue,
          margin,
          marginPct: revenue ? (margin / revenue) * 100 : null,
        };
      })
      .filter(
        (project) =>
          project.project || project.cost !== 0 || project.revenue !== 0,
      );

    const totalCost = projects.reduce((sum, project) => sum + project.cost, 0);
    const totalRevenue = projects.reduce(
      (sum, project) => sum + project.revenue,
      0,
    );

    return {
      fieldMap,
      projects,
      totalCost,
      totalRevenue,
      totalMargin: totalRevenue - totalCost,
    };
  }

  function summarizeProfitability(currentSummary, detailSummary) {
    const escuelaMembers = currentSummary.activeMembers.filter((member) =>
      isEscuelaRole(member.role),
    );
    const totalRampImpact = escuelaMembers.reduce(
      (sum, member) => sum + member.productivityImpact,
      0,
    );
    const baselineCost =
      detailSummary.totalCost || currentSummary.totalAllocatedCost;
    const totalRevenue = detailSummary.totalRevenue;
    const baselineMargin = totalRevenue - baselineCost;
    const adjustedCost = baselineCost + totalRampImpact;
    const adjustedMargin = totalRevenue - adjustedCost;

    return {
      escuelaHeadcount: escuelaMembers.length,
      estimatedMembers: escuelaMembers.filter(
        (member) => member.productivitySource === 'default',
      ).length,
      averageProductivity: escuelaMembers.length
        ? (escuelaMembers.reduce(
            (sum, member) => sum + member.productivity,
            0,
          ) /
            escuelaMembers.length) *
          100
        : 100,
      totalRampImpact,
      baselineCost,
      totalRevenue,
      baselineMargin,
      baselineMarginPct: totalRevenue ? (baselineMargin / totalRevenue) * 100 : null,
      adjustedCost,
      adjustedMargin,
      adjustedMarginPct: totalRevenue ? (adjustedMargin / totalRevenue) * 100 : null,
    };
  }

  function buildDashboard(input) {
    const currentSummary = summarizeCurrentSheet(
      input.currentRows || [],
      input.options,
    );
    const detailSummary = summarizeDetailSheet(input.detailRows || []);
    const profitability = summarizeProfitability(currentSummary, detailSummary);

    return {
      currentSummary,
      detailSummary,
      profitability,
      warnings: [
        ...currentSummary.warnings,
        !detailSummary.fieldMap.project
          ? 'No se ha detectado la columna de Proyecto en la pestaña Detalle.'
          : null,
        !detailSummary.fieldMap.cost
          ? 'No se ha detectado la columna de Coste en la pestaña Detalle.'
          : null,
        !detailSummary.fieldMap.revenue
          ? 'No se ha detectado la columna de Ingreso en la pestaña Detalle.'
          : null,
      ].filter(Boolean),
    };
  }

  const api = {
    buildDashboard,
    calculateProductivity,
    isEscuelaRole,
    normalizeFamily,
    normalizeText,
    parseNumber,
    parsePercent,
    summarizeCurrentSheet,
    summarizeDetailSheet,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  globalScope.TeamAnalytics = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
