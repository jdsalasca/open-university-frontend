import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_BUNDLE_BUDGETS,
  inspectBundleBudget,
} from './check-bundle-budget.mjs'

const ENTRY = 'index.html'
const CATALOG = 'src/features/academics/AcademicCatalogPage.tsx'
const OIDC = 'src/features/identity/identitySessionManager.ts'
const ADMISSIONS_DEMO = 'src/features/admissions/demo/AdmissionsWorkflowLab.tsx'
const LOCAL_PREVIEW_CLIENT = 'src/features/identity/localPreviewSessionClient.ts'
const LOCAL_PREVIEW_IDENTITY = 'src/features/identity/localPreviewIdentity.ts'

function createManifest() {
  return {
    [ENTRY]: {
      file: 'assets/entry.js',
      imports: ['src/shared.js'],
      dynamicImports: [CATALOG, OIDC],
      css: ['assets/entry.css'],
    },
    'src/shared.js': {
      file: 'assets/shared.js',
    },
    [CATALOG]: {
      file: 'assets/catalog.js',
      imports: [ENTRY],
      css: ['assets/catalog.css'],
    },
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
    'assets/catalog.js': 20,
    'assets/oidc.js': 30,
    'assets/entry.css': 12,
    'assets/catalog.css': 5,
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
    programsJavaScript: 70,
    programsStyles: 17,
    oidcJavaScript: 30,
  })
  assert.deepEqual(result.violations, [])
})

test('reporta cuando la ruta de programas supera el límite de JavaScript', () => {
  // Arrange
  const budgets = { ...DEFAULT_BUNDLE_BUDGETS, programsJavaScript: 69 }

  // Act
  const result = inspectBundleBudget(createManifest(), sizeOfSyntheticAsset, budgets)

  // Assert
  assert.deepEqual(result.violations, ['ruta #programas JavaScript: 70 B excede el límite de 69 B'])
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
