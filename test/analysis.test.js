const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDashboard,
  calculateProductivity,
} = require('../src/analysis.js');

test('groups costs by role and calculates role percentages', () => {
  const dashboard = buildDashboard({
    currentRows: [
      {
        Activo: 'Sí',
        Nombre: 'Ana',
        Rol: 'Gestión funcional',
        'Categoría NTT DATA': 'Manager',
        Familia: 'Tributos',
        Group: 'Centros',
        CSR: 1000,
        P1: '50%',
      },
      {
        Activo: 'Sí',
        Nombre: 'Luis',
        Rol: 'Técnico',
        'Categoría NTT DATA': 'Senior Consultant',
        Familia: 'Multas',
        Group: 'Service Rendered',
        CSR: 500,
        P1: '100%',
      },
    ],
    detailRows: [
      {
        Proyecto: 'P1',
        Coste: 1500,
        Ingreso: 3000,
      },
    ],
  });

  assert.equal(dashboard.currentSummary.roleSummary.length, 2);
  assert.equal(dashboard.currentSummary.totalAllocatedCost, 1000);
  assert.equal(dashboard.currentSummary.roleSummary[0].role, 'Gestión funcional');
  assert.equal(dashboard.currentSummary.roleSummary[0].amount, 500);
  assert.equal(dashboard.currentSummary.roleSummary[0].percentage, 50);
  assert.equal(dashboard.currentSummary.roleSummary[1].role, 'Técnico');
  assert.equal(dashboard.currentSummary.roleSummary[1].amount, 500);
  assert.equal(
    dashboard.currentSummary.pyramidByFamily.Sanciones[0].role,
    'Senior Consultant',
  );
  assert.equal(
    dashboard.currentSummary.pyramidByFamily.Sanciones[0].count,
    1,
  );
});

test('applies the escuela productivity ramp to profitability', () => {
  const dashboard = buildDashboard({
    currentRows: [
      {
        Activo: 'Sí',
        Nombre: 'Eva',
        Rol: 'Funcional - Escuela',
        'Categoría NTT DATA': 'Junior Consultant',
        Familia: 'Tributos',
        CSR: 1200,
        P1: '100%',
        'Meses escuela': 3,
      },
    ],
    detailRows: [
      {
        Proyecto: 'P1',
        Coste: 1200,
        Ingreso: 2000,
      },
    ],
    options: {
      rampMonths: 6,
      defaultRampMonth: 1,
      referenceDate: new Date('2026-09-01T00:00:00Z'),
    },
  });

  assert.equal(calculateProductivity(3, 6), 0.5);
  assert.equal(dashboard.profitability.totalRampImpact, 1200);
  assert.equal(dashboard.profitability.adjustedCost, 2400);
  assert.equal(dashboard.profitability.adjustedMargin, -400);
});

test('builds pyramids from Categoría NTT DATA instead of role', () => {
  const dashboard = buildDashboard({
    currentRows: [
      {
        Activo: 'Sí',
        Nombre: 'Ana',
        Rol: 'Gestión funcional',
        'Categoría NTT DATA': 'Manager',
        Familia: 'Tributos',
        CSR: 1000,
        P1: '100%',
      },
      {
        Activo: 'Sí',
        Nombre: 'Eva',
        Rol: 'Funcional - Escuela',
        'Categoría NTT DATA': 'Junior Consultant',
        Familia: 'Tributos',
        CSR: 900,
        P1: '100%',
      },
    ],
    detailRows: [],
  });

  assert.deepEqual(dashboard.currentSummary.pyramidByFamily.Tributos, [
    { role: 'Junior Consultant', count: 1 },
    { role: 'Manager', count: 1 },
  ]);
});
