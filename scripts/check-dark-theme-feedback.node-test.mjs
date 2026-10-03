import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { compile } from 'sass'

const stylesheetPath = fileURLToPath(new URL('../src/styles/_theme.scss', import.meta.url))
const compiledTheme = compile(stylesheetPath).css

function darkRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return compiledTheme.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1]
}

function contrastRatio(textColor, backgroundColor) {
  const luminance = (hexColor) => {
    const channels = hexColor.slice(1).match(/.{2}/g).map((channel) => Number.parseInt(channel, 16) / 255)
    const [red, green, blue] = channels.map((channel) => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
  }

  const values = [luminance(textColor), luminance(backgroundColor)].sort((left, right) => right - left)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

function assertReadableContrast(declarations) {
  const themeDeclarations = darkRule(':root[data-theme=dark]')
  const resolveColor = (property) => {
    const color = declarations.match(new RegExp(`(?:^|\\s)${property}:\\s*(#[0-9a-f]{6}|var\\(--([\\w-]+)\\));`, 'i'))
    if (!color) return undefined
    if (color[1].startsWith('#')) return color[1]
    return themeDeclarations?.match(new RegExp(`--${color[2]}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1]
  }
  const textColor = resolveColor('color')
  const backgroundColor = resolveColor('background')
  assert.ok(textColor && backgroundColor, 'text and background colors must be explicit')
  assert.ok(contrastRatio(textColor, backgroundColor) >= 4.5, 'feedback text must meet WCAG AA contrast')
}

test('dark theme gives identity status messages a readable dark surface', () => {
  // Arrange
  const selector = ':root[data-theme=dark] .workspace main .visual-identity-center .identity-status'

  // Act
  const declarations = darkRule(selector)

  // Assert
  assert.ok(declarations, 'dark identity status rule must be present')
  assert.match(declarations, /background: #332e1d;/)
  assert.match(declarations, /color: #f0dfa0;/)
  assertReadableContrast(declarations)
})

test('dark theme gives identity errors a readable dark error surface', () => {
  // Arrange
  const selector = ':root[data-theme=dark] .workspace main .visual-identity-center .identity-alert'

  // Act
  const declarations = darkRule(selector)

  // Assert
  assert.ok(declarations, 'dark identity error rule must be present')
  assert.match(declarations, /background: #352320;/)
  assert.match(declarations, /color: #ffc0b7;/)
  assertReadableContrast(declarations)
})

test('dark theme gives structure audit events a readable raised surface', () => {
  // Arrange
  const selector = ':root[data-theme=dark] .workspace main .academic-structure-audit-events > li'

  // Act
  const declarations = darkRule(selector)

  // Assert
  assert.ok(declarations, 'dark academic audit event rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface-raised\);/)
  assert.match(declarations, /color:\s*var\(--ui-text-primary\);/)
  assertReadableContrast(declarations)
})

test('dark theme gives identity center chrome a readable surface', () => {
  // Arrange: these elements keep light backgrounds but inherit the light dark-mode text color,
  // so without a dark rule they render light-on-light (Lighthouse contrast 1.03–2.11).
  const selector = ':root[data-theme=dark] .workspace main .visual-identity-center :is('
    + '.identity-revision-chip, .contrast-hint, .preview-local-badge, .summary-icon)'

  // Act
  const declarations = darkRule(selector)

  // Assert
  assert.ok(declarations, 'dark identity center chrome rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface-raised\);/)
  assert.match(declarations, /color:\s*var\(--ui-text-primary\);/)
  assertReadableContrast(declarations)
})

test('library page styles reference only tokens the theme defines, so dark mode can override them', () => {
  // Arrange: a component that invents token names silently keeps light colors in dark mode.
  const libraryStylesheet = readFileSync(
    fileURLToPath(new URL('../src/features/library/LibraryAdminPage.scss', import.meta.url)), 'utf8')

  // Act
  const definedTokens = new Set([...compiledTheme.matchAll(/(--[a-z0-9-]+):/g)].map((match) => match[1]))
  const referenced = [...new Set([...libraryStylesheet.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]))]

  // Assert
  assert.ok(referenced.length > 0, 'the library page must style itself through theme tokens')
  assert.deepEqual(referenced.filter((token) => !definedTokens.has(token)), [])
})

test('library page surfaces keep WCAG AA contrast in dark mode', () => {
  // Arrange
  const dark = darkRule(':root[data-theme=dark]')
  const token = (name) => dark?.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1]

  // Act + Assert
  const surface = token('ui-surface')
  const raised = token('ui-surface-raised')
  const text = token('ui-text-primary')
  assert.ok(surface && raised && text, 'dark tokens must be defined')
  assert.ok(contrastRatio(text, surface) >= 4.5, 'library text on surface must meet WCAG AA')
  assert.ok(contrastRatio(text, raised) >= 4.5, 'library text on raised surface must meet WCAG AA')
})

test('public undergraduate directory keeps its dark surfaces readable', () => {
  // Arrange
  const selectors = [
    ':root[data-theme=dark] .workspace main .public-undergraduate-directory .public-undergraduate-hero',
    ':root[data-theme=dark] .workspace main .public-undergraduate-directory .public-undergraduate-source-note',
    ':root[data-theme=dark] .workspace main .public-undergraduate-directory .public-undergraduate-filters',
    ':root[data-theme=dark] .workspace main .public-undergraduate-directory .public-undergraduate-results-count',
    ':root[data-theme=dark] .workspace main .public-undergraduate-directory .public-undergraduate-offer-tag',
    ':root[data-theme=dark] .workspace main .public-undergraduate-directory .public-undergraduate-offer-tag.is-marked',
  ]

  // Act + Assert
  for (const selector of selectors) {
    const declarations = darkRule(selector)
    assert.ok(declarations, `dark theme rule must exist for ${selector}`)
    assertReadableContrast(declarations)
  }
})

test('dark theme keeps academic, spaces, and catalog chrome readable', () => {
  // Arrange: these elements keep hardcoded light backgrounds but inherit the light dark-mode text.
  const selectors = [
    ':root[data-theme=dark] .workspace main .academic-unit-copy strong',
    ':root[data-theme=dark] .workspace main .academic-unit-copy small',
    ':root[data-theme=dark] .workspace main .academic-sort-order',
    ':root[data-theme=dark] .workspace main .spaces-type-badge',
    ':root[data-theme=dark] .workspace main .spaces-pathway-kind',
    ':root[data-theme=dark] .workspace main .spaces-pathway-note',
    ':root[data-theme=dark] .workspace main .spaces-directory-footer',
    ':root[data-theme=dark] .workspace main .catalog-operation-note',
    ':root[data-theme=dark] .workspace main .catalog-locked-tag',
    ':root[data-theme=dark] .workspace main .catalog-button',
  ]

  // Act + Assert
  for (const selector of selectors) {
    const declarations = darkRule(selector)
    assert.ok(declarations, `dark theme rule must exist for ${selector}`)
    assertReadableContrast(declarations)
  }
})
