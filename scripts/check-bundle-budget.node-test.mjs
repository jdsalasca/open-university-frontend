import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_BUNDLE_BUDGETS,
  inspectBundleBudget,
} from './check-bundle-budget.mjs'

const ENTRY = 'index.html'
const WORKSPACE_HOME = 'src/features/workspace/WorkspaceHomePage.tsx'
const CATALOG = 'src/features/academics/AcademicCatalogPage.tsx'
const CURRICULUM_COMPARISON_PANEL = 'src/features/academics/CurriculumVersionComparisonPanel.tsx'
const PUBLIC_DIRECTORY = 'src/features/academics/publicCatalog/PublicUndergraduateDirectory.tsx'
const PUBLIC_CATALOG = 'src/features/academics/publicCatalog/uptcUndergraduateCatalog.snapshot.json'
const OIDC = 'src/features/identity/identitySessionManager.ts'
const ADMISSIONS_DEMO = 'src/features/admissions/demo/AdmissionsWorkflowLab.tsx'
const STUDENT_DEMO = 'src/features/students/demo/MyAcademicWeekDemo.tsx'
const GRADEBOOK_DEMO = 'src/features/gradebook/demo/GradeEntryDemo.tsx'
const ROOM_PLANNING_DEMO = 'src/features/room-planning/demo/RoomAllocationDemo.tsx'
const WORKSPACE_HOME_DEMO = 'src/features/workspace/demo/WorkspaceDevelopmentLabs.tsx'
const LOCAL_PREVIEW_CLIENT = 'src/features/identity/localPreviewSessionClient.ts'
const LOCAL_PREVIEW_IDENTITY = 'src/features/identity/localPreviewIdentity.ts'

function createManifest() {
  return {
    [ENTRY]: {
      file: 'assets/entry.js',
      imports: ['src/shared.js'],
      dynamicImports: [WORKSPACE_HOME, CATALOG, OIDC],
      css: ['assets/entry.css'],
    },
    [WORKSPACE_HOME]: {
      file: 'assets/workspace-home.js',
      imports: [ENTRY],
      css: ['assets/workspace-home.css'],
    },
    'src/shared.js': {
      file: 'assets/shared.js',
    },
    [CATALOG]: {
      file: 'assets/catalog.js',
      imports: [ENTRY],
      dynamicImports: [CURRICULUM_COMPARISON_PANEL, PUBLIC_DIRECTORY],
      css: ['assets/catalog.css'],
    },
    [CURRICULUM_COMPARISON_PANEL]: {
      file: 'assets/curriculum-comparison.js',
      isDynamicEntry: true,
    },
    [PUBLIC_DIRECTORY]: {
      file: 'assets/public-directory.js',
      imports: [ENTRY],
      assets: ['assets/catalog-data.json'],
      css: ['assets/public-directory.css'],
    },
    [PUBLIC_CATALOG]: { file: 'assets/catalog-data.json', isAsset: true },
    [OIDC]: {
      file: 'assets/oidc.js',
      isDynamicEntry: true,
    },
  }
}

function sizeOfSyntheticAsset(asset) {
  return {
    'assets/entry.js': 40,
    'assets/shared.js': 10,
    'assets/workspace-home.js': 25,
    'assets/catalog.js': 20,
    'assets/public-directory.js': 35,
    'assets/curriculum-comparison.js': 20,
    'assets/oidc.js': 30,
    'assets/entry.css': 12,
    'assets/workspace-home.css': 7,
    'assets/catalog.css': 5,
    'assets/public-directory.css': 9,
    'assets/catalog-data.json': 30,
  }[asset]
}

test('mide los assets estáticos de la ruta y deja OIDC en un chunk dinámico', () => {
  // Arrange
  const manifest = createManifest()

  // Act
  const result = inspectBundleBudget(manifest, sizeOfSyntheticAsset)

  // Assert
  assert.deepEqual(result.measurements, {
    entryJavaScript: 50,
    entryStyles: 12,
    workspaceHomeJavaScript: 75,
    workspaceHomeStyles: 19,
    programsJavaScript: 105,
    programsStyles: 26,
    programsDataBytes: 30,
    oidcJavaScript: 30,
  })
  assert.deepEqual(result.violations, [])
})

test('aplica los límites de la portada y la ruta completa de programas', () => {
  // Arrange
  const budgets = {
    ...DEFAULT_BUNDLE_BUDGETS,
    workspaceHomeJavaScript: 74,
  }
  const programBudget = { ...budgets, programsJavaScript: 104 }

  // Act
  const result = inspectBundleBudget(createManifest(), sizeOfSyntheticAsset, programBudget)

  // Assert
  assert.deepEqual(result.violations, [
    'ruta #resumen JavaScript: 75 B excede el límite de 74 B',
    'ruta #programas JavaScript: 105 B excede el límite de 104 B',
  ])
})

test('exige portada y directorio público como chunks dinámicos independientes', () => {
  // Arrange
  const manifest = createManifest()
  manifest[ENTRY].dynamicImports = [CATALOG, OIDC]
  manifest[ENTRY].imports.push(WORKSPACE_HOME)
  manifest[CATALOG].dynamicImports = [CURRICULUM_COMPARISON_PANEL]
  manifest[CATALOG].imports.push(PUBLIC_DIRECTORY)

  // Act
  const result = inspectBundleBudget(manifest, sizeOfSyntheticAsset)

  // Assert
  assert.ok(result.violations.includes('La portada #resumen debe permanecer en un chunk dinámico separado'))
  assert.ok(result.violations.includes('El directorio público de #programas debe permanecer en un chunk dinámico medido'))
})

test('limita el JSON público y exige que el directorio lo declare como asset asociado', () => {
  // Arrange
  const tooSmallBudget = { ...DEFAULT_BUNDLE_BUDGETS, programsDataBytes: 29 }
  const manifest = createManifest()

  // Act
  const result = inspectBundleBudget(manifest, sizeOfSyntheticAsset, tooSmallBudget)

  // Assert
  assert.ok(result.violations.includes('datos estáticos de #programas: 30 B excede el límite de 29 B'))
})

test('rechaza la instantánea pública cuando el manifest no la asocia al directorio', () => {
  // Arrange
  const manifest = createManifest()
  delete manifest[PUBLIC_DIRECTORY].assets

  // Act
  const result = inspectBundleBudget(manifest, sizeOfSyntheticAsset)

  // Assert
  assert.ok(result.violations.includes('La instantánea pública UPTC debe quedar como asset estático asociado al directorio de #programas'))
})

test('mantiene la comparación curricular en un chunk dinámico de la ruta de programas', () => {
  // Arrange
  const manifest = createManifest()
  manifest[CATALOG].dynamicImports = [CURRICULUM_COMPARISON_PANEL, PUBLIC_DIRECTORY]
  manifest[CURRICULUM_COMPARISON_PANEL] = { file: 'assets/curriculum-comparison.js' }

  // Act
  const result = inspectBundleBudget(manifest, sizeOfSyntheticAsset)

  // Assert
  assert.deepEqual(result.violations, [])
  assert.equal(result.measurements.programsJavaScript, 105)
})

test('rechaza cargar la comparación curricular de forma estática con la ruta de programas', () => {
  // Arrange
  const manifest = createManifest()
  manifest[CATALOG].dynamicImports = [CURRICULUM_COMPARISON_PANEL]
  manifest[CATALOG].imports.push(CURRICULUM_COMPARISON_PANEL)
  manifest[CURRICULUM_COMPARISON_PANEL] = { file: 'assets/curriculum-comparison.js' }

  // Act
  const result = inspectBundleBudget(manifest, sizeOfSyntheticAsset)

  // Assert
  assert.ok(result.violations.includes('La comparación curricular debe permanecer en un chunk dinámico separado'))
})

test('reporta cuando la ruta de programas supera el límite de JavaScript', () => {
  // Arrange
  const budgets = { ...DEFAULT_BUNDLE_BUDGETS, programsJavaScript: 69 }

  // Act
  const result = inspectBundleBudget(createManifest(), sizeOfSyntheticAsset, budgets)

  // Assert
  assert.deepEqual(result.violations, ['ruta #programas JavaScript: 105 B excede el límite de 69 B'])
})

test('incluye las dependencias estáticas del chunk OIDC en su presupuesto', () => {
  // Arrange
  const manifest = createManifest()
  manifest[OIDC].imports = ['src/features/identity/oidc-vendor.js']
  manifest['src/features/identity/oidc-vendor.js'] = { file: 'assets/oidc-vendor.js' }
  const sizeOf = (asset) => asset === 'assets/oidc-vendor.js'
    ? 7
    : sizeOfSyntheticAsset(asset)

  // Act
  const result = inspectBundleBudget(manifest, sizeOf)

  // Assert
  assert.equal(result.measurements.oidcJavaScript, 37)
  assert.deepEqual(result.violations, [])
})

test('falla si la implementación OIDC deja de ser una importación dinámica del entry', () => {
  // Arrange
  const manifest = createManifest()
  manifest[ENTRY].dynamicImports = [CATALOG]
  manifest[ENTRY].imports.push(OIDC)

  // Act
  const result = inspectBundleBudget(manifest, sizeOfSyntheticAsset)

  // Assert
  assert.ok(result.violations.includes('OIDC debe permanecer en un chunk dinámico separado'))
})

test('rechaza que el laboratorio local de admisiones aparezca en el manifest de producción', () => {
  // Arrange
  const manifest = createManifest()
  manifest[ADMISSIONS_DEMO] = { file: 'assets/admissions-demo.js' }

  // Act
  const result = inspectBundleBudget(manifest, sizeOfSyntheticAsset)

  // Assert
  assert.deepEqual(result.violations, ['El laboratorio de admisiones de desarrollo no debe entrar al build de producción'])
})

test('rechaza que la experiencia estudiantil de ejemplo aparezca en el manifest de producción', () => {
  // Arrange
  const manifest = createManifest()
  manifest[STUDENT_DEMO] = { file: 'assets/student-week-demo.js' }

  // Act
  const result = inspectBundleBudget(manifest, sizeOfSyntheticAsset)

  // Assert
  assert.deepEqual(result.violations, ['La experiencia estudiantil de desarrollo no debe entrar al build de producción'])
})

test('rechaza que el laboratorio local de calificaciones aparezca en el manifest de producción', () => {
  // Arrange
  const manifest = createManifest()
  manifest[GRADEBOOK_DEMO] = { file: 'assets/grade-entry-demo.js' }

  // Act
  const result = inspectBundleBudget(manifest, sizeOfSyntheticAsset)

  // Assert
  assert.deepEqual(result.violations, ['El laboratorio de calificaciones de desarrollo no debe entrar al build de producción'])
})

test('rechaza que el laboratorio de asignación de aulas aparezca en el manifest de producción', () => {
  // Arrange
  const manifest = createManifest()
  manifest[ROOM_PLANNING_DEMO] = { file: 'assets/room-allocation-demo.js' }

  // Act
  const result = inspectBundleBudget(manifest, sizeOfSyntheticAsset)

  // Assert
  assert.ok(result.violations.some((violation) => /asignación de aulas/i.test(violation)))
})

test('rechaza que los recorridos locales de la portada aparezcan en el manifest de producción', () => {
  // Arrange
  const manifest = createManifest()
  manifest[WORKSPACE_HOME_DEMO] = { file: 'assets/workspace-home-demo.js' }

  // Act
  const result = inspectBundleBudget(manifest, sizeOfSyntheticAsset)

  // Assert
  assert.ok(result.violations.includes('Los recorridos locales de la portada no deben entrar al build de producción'))
})

test('rechaza que el cliente de sesión de desarrollador aparezca en el manifest de producción', () => {
  // Arrange
  const manifest = createManifest()
  manifest[LOCAL_PREVIEW_CLIENT] = { file: 'assets/local-preview-session.js' }

  // Act
  const result = inspectBundleBudget(manifest, sizeOfSyntheticAsset)

  // Assert
  assert.deepEqual(result.violations, [
    'El cliente de sesión de desarrollador local no debe entrar al build de producción',
  ])
})

test('rechaza que la lógica de sesión de desarrollador aparezca en el manifest de producción', () => {
  // Arrange
  const manifest = createManifest()
  manifest[LOCAL_PREVIEW_IDENTITY] = { file: 'assets/local-preview-identity.js' }

  // Act
  const result = inspectBundleBudget(manifest, sizeOfSyntheticAsset)

  // Assert
  assert.deepEqual(result.violations, [
    'La lógica de sesión de desarrollador local no debe entrar al build de producción',
  ])
})
