import assert from 'node:assert/strict'
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
