import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ENTRY_KEY = 'index.html'
const PROGRAMS_KEY = 'src/features/academics/AcademicCatalogPage.tsx'
const OIDC_KEY = 'src/features/identity/identitySessionManager.ts'
const ADMISSIONS_DEMO_PREFIX = 'src/features/admissions/demo/'

export const DEFAULT_BUNDLE_BUDGETS = Object.freeze({
  entryJavaScript: 280_000,
  entryStyles: 21_000,
  programsJavaScript: 325_000,
  programsStyles: 48_000,
  oidcJavaScript: 75_000,
})

function collectStaticAssets(manifest, roots) {
  const visitedChunks = new Set()
  const javascript = new Set()
  const styles = new Set()
  const pending = [...roots]

  while (pending.length > 0) {
    const key = pending.pop()
    if (visitedChunks.has(key)) continue

    const chunk = manifest[key]
    if (!chunk) throw new Error(`Falta el chunk ${key} en el manifiesto de Vite`)
    visitedChunks.add(key)

    if (chunk.file?.endsWith('.js')) javascript.add(chunk.file)
    for (const style of chunk.css ?? []) styles.add(style)
    for (const dependency of chunk.imports ?? []) pending.push(dependency)
  }

  return { javascript: [...javascript], styles: [...styles] }
}

function sumAssets(assets, sizeOf) {
  return assets.reduce((total, asset) => {
    const size = sizeOf(asset)
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error(`Tamaño inválido para ${asset}: ${size}`)
    }
    return total + size
  }, 0)
}

export function inspectBundleBudget(
  manifest,
  sizeOf,
  budgets = DEFAULT_BUNDLE_BUDGETS,
) {
  const entryAssets = collectStaticAssets(manifest, [ENTRY_KEY])
  const programsAssets = collectStaticAssets(manifest, [PROGRAMS_KEY])
  const oidcChunk = manifest[OIDC_KEY]
  if (!oidcChunk?.file) throw new Error(`Falta el chunk ${OIDC_KEY} en el manifiesto de Vite`)
  const oidcAssets = collectStaticAssets(manifest, [OIDC_KEY])

  const measurements = {
    entryJavaScript: sumAssets(entryAssets.javascript, sizeOf),
    entryStyles: sumAssets(entryAssets.styles, sizeOf),
    programsJavaScript: sumAssets(programsAssets.javascript, sizeOf),
    programsStyles: sumAssets(programsAssets.styles, sizeOf),
    oidcJavaScript: sumAssets(oidcAssets.javascript, sizeOf),
  }

  const violations = []
  const checks = [
    ['entry JavaScript', measurements.entryJavaScript, budgets.entryJavaScript],
    ['entry CSS', measurements.entryStyles, budgets.entryStyles],
    ['ruta #programas JavaScript', measurements.programsJavaScript, budgets.programsJavaScript],
    ['ruta #programas CSS', measurements.programsStyles, budgets.programsStyles],
    ['chunk OIDC JavaScript', measurements.oidcJavaScript, budgets.oidcJavaScript],
  ]
  for (const [label, size, limit] of checks) {
    if (size > limit) violations.push(`${label}: ${size} B excede el límite de ${limit} B`)
  }

  const entry = manifest[ENTRY_KEY]
  if (
    !entry?.dynamicImports?.includes(OIDC_KEY)
    || oidcAssets.javascript.some((asset) => entryAssets.javascript.includes(asset))
  ) {
    violations.push('OIDC debe permanecer en un chunk dinámico separado')
  }

  if (Object.keys(manifest).some((key) => key.startsWith(ADMISSIONS_DEMO_PREFIX))) {
    violations.push('El laboratorio de admisiones de desarrollo no debe entrar al build de producción')
  }

  return { measurements, violations }
}

function verifyBuiltBundle() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
  const distDirectory = path.resolve(scriptDirectory, '..', 'dist')
  const manifestPath = path.join(distDirectory, '.vite', 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const sizeOf = (asset) => statSync(path.resolve(distDirectory, asset)).size
  const { measurements, violations } = inspectBundleBudget(manifest, sizeOf)

  console.log(
    `Bundles: entry ${measurements.entryJavaScript} B JS / ${measurements.entryStyles} B CSS; `
      + `#programas ${measurements.programsJavaScript} B JS / ${measurements.programsStyles} B CSS; `
      + `OIDC diferido ${measurements.oidcJavaScript} B JS.`,
  )

  if (violations.length > 0) {
    for (const violation of violations) console.error(`ERROR: ${violation}`)
    process.exitCode = 1
    return
  }

  console.log('Presupuestos de bundle verificados.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyBuiltBundle()
}
