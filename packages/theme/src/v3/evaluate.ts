import * as acorn from 'acorn'
import type { Node, Program, Expression, Pattern, Property, SpreadElement } from 'acorn'
import type { Unresolved } from '../types'
import { stripTypeScript } from './ts-prepass'

export type EvalSuccess = {
  ok: true
  value: unknown
  unresolved: Unresolved[]
}

export type EvalFailure = {
  ok: false
  value: null
  unresolved: Unresolved[]
}

type Env = Map<string, unknown>

const truncate = (snippet: string): string =>
  snippet.length <= 120 ? snippet : `${snippet.slice(0, 117)}...`

const unresolved = (
  path: string,
  reason: Unresolved['reason'],
  snippet: string,
  source: string,
  message: string,
  line?: number,
): Unresolved => {
  const entry: Unresolved = {
    path,
    reason,
    snippet: truncate(snippet),
    source,
    message,
  }
  if (line !== undefined) {
    entry.line = line
  }
  return entry
}

/** Known modules the browser resolver can substitute without execution. */
export type KnownModules = {
  'tailwindcss/defaultTheme': unknown
  'tailwindcss/colors': unknown
  'tailwindcss/defaultConfig': unknown
}

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && 'type' in value

const get = (obj: unknown, key: string): unknown => {
  if (obj === null || obj === undefined) return undefined
  if (typeof obj !== 'object') return undefined
  return (obj as Record<string, unknown>)[key]
}

/** Statically evaluate a Tailwind v3 config module. */
export const evaluateConfigModule = (
  sourceText: string,
  sourceName: string,
  known: KnownModules,
): EvalSuccess | EvalFailure => {
  const unresolvedList: Unresolved[] = []
  const prepared = stripTypeScript(sourceText)
  let program: Program
  try {
    program = acorn.parse(prepared, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowReturnOutsideFunction: true,
      locations: true,
    }) as Program
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      value: null,
      unresolved: [
        unresolved(
          '(root)',
          'parse-error',
          prepared.slice(0, 120),
          sourceName,
          `Could not parse ${sourceName}: ${message}. Replace dynamic TypeScript/JS constructs with plain values.`,
        ),
      ],
    }
  }

  const env: Env = new Map()

  const evalExpr = (node: Expression | Pattern | Node, path: string): unknown => {
    switch (node.type) {
      case 'Literal':
        return (node as acorn.Literal).value
      case 'TemplateLiteral': {
        const tpl = node as acorn.TemplateLiteral
        if (tpl.expressions.length > 0) {
          unresolvedList.push(
            unresolved(
              path,
              'dynamic-expression',
              prepared.slice(node.start, node.end),
              sourceName,
              `${path} uses a template with substitutions, which fig-tail cannot evaluate.`,
              node.loc?.start.line,
            ),
          )
          return undefined
        }
        return tpl.quasis.map((part) => part.value.cooked ?? '').join('')
      }
      case 'Identifier': {
        const name = (node as acorn.Identifier).name
        if (name === 'undefined') return undefined
        if (env.has(name)) return env.get(name)
        unresolvedList.push(
          unresolved(
            path,
            'dynamic-expression',
            name,
            sourceName,
            `${path} references "${name}", which is not a statically known binding.`,
            node.loc?.start.line,
          ),
        )
        return undefined
      }
      case 'ArrayExpression': {
        const arr: unknown[] = []
        for (const element of (node as acorn.ArrayExpression).elements) {
          if (!element) {
            arr.push(null)
            continue
          }
          if (element.type === 'SpreadElement') {
            const spread = evalExpr(element.argument, path)
            if (Array.isArray(spread)) {
              arr.push(...spread)
            } else {
              unresolvedList.push(
                unresolved(
                  path,
                  'dynamic-expression',
                  prepared.slice(element.start, element.end),
                  sourceName,
                  `${path} spreads a non-array value.`,
                  element.loc?.start.line,
                ),
              )
            }
            continue
          }
          arr.push(evalExpr(element, path))
        }
        return arr
      }
      case 'ObjectExpression': {
        const out: Record<string, unknown> = {}
        for (const prop of (node as acorn.ObjectExpression).properties) {
          if (prop.type === 'SpreadElement') {
            const spread = evalExpr(prop.argument, path)
            if (spread && typeof spread === 'object' && !Array.isArray(spread)) {
              Object.assign(out, spread)
            } else {
              unresolvedList.push(
                unresolved(
                  path,
                  'dynamic-expression',
                  prepared.slice(prop.start, prop.end),
                  sourceName,
                  `${path} spreads a non-object value.`,
                  prop.loc?.start.line,
                ),
              )
            }
            continue
          }
          const property = prop as Property
          if (property.kind !== 'init' || property.method || property.computed) {
            unresolvedList.push(
              unresolved(
                path,
                'unsupported-syntax',
                prepared.slice(property.start, property.end),
                sourceName,
                `${path} uses unsupported object property syntax.`,
                property.loc?.start.line,
              ),
            )
            continue
          }
          let key: string | null = null
          if (property.key.type === 'Identifier' && !property.computed) {
            key = property.key.name
          } else if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
            key = property.key.value
          } else if (property.key.type === 'Literal' && typeof property.key.value === 'number') {
            key = String(property.key.value)
          }
          if (!key) {
            unresolvedList.push(
              unresolved(
                path,
                'dynamic-expression',
                prepared.slice(property.start, property.end),
                sourceName,
                `${path} has a computed key fig-tail cannot evaluate.`,
                property.loc?.start.line,
              ),
            )
            continue
          }
          const childPath = path ? `${path}.${key}` : key
          if (
            property.value.type === 'FunctionExpression' ||
            property.value.type === 'ArrowFunctionExpression'
          ) {
            unresolvedList.push(
              unresolved(
                childPath,
                'function-value',
                prepared.slice(property.value.start, property.value.end),
                sourceName,
                `${childPath} is a function, which fig-tail cannot evaluate. Replace it with plain values.`,
                property.value.loc?.start.line,
              ),
            )
            continue
          }
          out[key] = evalExpr(property.value, childPath)
        }
        return out
      }
      case 'MemberExpression': {
        const member = node as acorn.MemberExpression
        const object = evalExpr(member.object, path)
        let key: string | null = null
        if (!member.computed && member.property.type === 'Identifier') {
          key = member.property.name
        } else if (member.computed) {
          const computed = evalExpr(member.property, path)
          if (typeof computed === 'string' || typeof computed === 'number') {
            key = String(computed)
          }
        }
        if (key === null) {
          unresolvedList.push(
            unresolved(
              path,
              'dynamic-expression',
              prepared.slice(node.start, node.end),
              sourceName,
              `${path} uses computed member access fig-tail cannot evaluate.`,
              node.loc?.start.line,
            ),
          )
          return undefined
        }
        return get(object, key)
      }
      case 'UnaryExpression': {
        const unary = node as acorn.UnaryExpression
        const arg = evalExpr(unary.argument, path)
        if (unary.operator === '-') return typeof arg === 'number' ? -arg : undefined
        if (unary.operator === '+') return typeof arg === 'number' ? +arg : undefined
        if (unary.operator === '!') return !arg
        if (unary.operator === 'typeof') return typeof arg
        unresolvedList.push(
          unresolved(
            path,
            'unsupported-syntax',
            prepared.slice(node.start, node.end),
            sourceName,
            `${path} uses unsupported unary operator ${unary.operator}.`,
            node.loc?.start.line,
          ),
        )
        return undefined
      }
      case 'BinaryExpression': {
        const binary = node as acorn.BinaryExpression
        const left = evalExpr(binary.left, path)
        const right = evalExpr(binary.right, path)
        if (binary.operator === '+' && (typeof left === 'string' || typeof right === 'string')) {
          return `${left ?? ''}${right ?? ''}`
        }
        unresolvedList.push(
          unresolved(
            path,
            'dynamic-expression',
            prepared.slice(node.start, node.end),
            sourceName,
            `${path} uses arithmetic/logic fig-tail cannot safely evaluate.`,
            node.loc?.start.line,
          ),
        )
        return undefined
      }
      case 'CallExpression': {
        const call = node as acorn.CallExpression
        if (
          call.callee.type === 'Identifier' &&
          call.callee.name === 'require' &&
          call.arguments.length === 1 &&
          call.arguments[0]?.type === 'Literal' &&
          typeof (call.arguments[0] as acorn.Literal).value === 'string'
        ) {
          const spec = (call.arguments[0] as acorn.Literal).value as string
          if (spec in known) {
            return known[spec as keyof KnownModules]
          }
          unresolvedList.push(
            unresolved(
              path,
              'unknown-module',
              prepared.slice(call.start, call.end),
              sourceName,
              `${path} requires "${spec}", which is outside fig-tail's known-module table.`,
              call.loc?.start.line,
            ),
          )
          return undefined
        }
        unresolvedList.push(
          unresolved(
            path,
            'dynamic-expression',
            prepared.slice(call.start, call.end),
            sourceName,
            `${path} calls a function fig-tail cannot evaluate.`,
            call.loc?.start.line,
          ),
        )
        return undefined
      }
      case 'ConditionalExpression':
      case 'LogicalExpression':
      case 'NewExpression':
      case 'TaggedTemplateExpression':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        unresolvedList.push(
          unresolved(
            path,
            node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression'
              ? 'function-value'
              : 'dynamic-expression',
            prepared.slice(node.start, node.end),
            sourceName,
            `${path} uses ${node.type}, which fig-tail cannot evaluate.`,
            node.loc?.start.line,
          ),
        )
        return undefined
      default:
        unresolvedList.push(
          unresolved(
            path,
            'unsupported-syntax',
            prepared.slice(node.start, Math.min(node.end, node.start + 120)),
            sourceName,
            `${path} uses unsupported syntax (${node.type}).`,
            node.loc?.start.line,
          ),
        )
        return undefined
    }
  }

  const bindPattern = (pattern: Pattern, value: unknown) => {
    if (pattern.type === 'Identifier') {
      env.set(pattern.name, value)
    }
  }

  let exported: unknown = undefined
  let sawExport = false

  for (const statement of program.body) {
    if (statement.type === 'VariableDeclaration') {
      for (const decl of statement.declarations) {
        if (!decl.init) continue
        const value = evalExpr(decl.init, decl.id.type === 'Identifier' ? decl.id.name : '(binding)')
        bindPattern(decl.id, value)
      }
      continue
    }
    if (statement.type === 'ExpressionStatement') {
      const expr = statement.expression
      if (
        expr.type === 'AssignmentExpression' &&
        expr.left.type === 'MemberExpression' &&
        expr.left.object.type === 'Identifier' &&
        expr.left.object.name === 'module' &&
        !expr.left.computed &&
        expr.left.property.type === 'Identifier' &&
        expr.left.property.name === 'exports'
      ) {
        exported = evalExpr(expr.right, 'module.exports')
        sawExport = true
      }
      continue
    }
    if (statement.type === 'ExportDefaultDeclaration') {
      const decl = statement.declaration
      if (isNode(decl) && (decl.type === 'ObjectExpression' || decl.type === 'Identifier' || decl.type === 'CallExpression' || decl.type === 'MemberExpression' || decl.type === 'ArrayExpression' || decl.type === 'Literal')) {
        exported = evalExpr(decl as Expression, 'export default')
        sawExport = true
      } else if (decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') {
        unresolvedList.push(
          unresolved(
            'export default',
            'unsupported-syntax',
            prepared.slice(decl.start, decl.end),
            sourceName,
            'export default function/class configs are not supported.',
            decl.loc?.start.line,
          ),
        )
      }
      continue
    }
    if (statement.type === 'ImportDeclaration') {
      const spec = statement.source.value
      if (typeof spec === 'string' && spec in known) {
        const mod = known[spec as keyof KnownModules]
        for (const specifier of statement.specifiers) {
          if (specifier.type === 'ImportDefaultSpecifier') {
            env.set(specifier.local.name, mod)
          } else if (specifier.type === 'ImportNamespaceSpecifier') {
            env.set(specifier.local.name, mod)
          } else if (specifier.type === 'ImportSpecifier') {
            const imported =
              specifier.imported.type === 'Identifier'
                ? specifier.imported.name
                : String((specifier.imported as acorn.Literal).value)
            env.set(specifier.local.name, get(mod, imported))
          }
        }
      } else {
        unresolvedList.push(
          unresolved(
            `import ${String(spec)}`,
            'unknown-module',
            prepared.slice(statement.start, statement.end),
            sourceName,
            `Import of "${String(spec)}" is outside fig-tail's known-module table.`,
            statement.loc?.start.line,
          ),
        )
      }
    }
  }

  if (!sawExport) {
    // CommonJS without assignment caught, or `const config = {}; export default config`
    if (env.has('config')) {
      exported = env.get('config')
      sawExport = true
    } else if (env.has('module')) {
      exported = get(env.get('module'), 'exports')
      sawExport = exported !== undefined
    }
  }

  if (!sawExport || exported === undefined || exported === null || typeof exported !== 'object') {
    return {
      ok: false,
      value: null,
      unresolved:
        unresolvedList.length > 0
          ? unresolvedList
          : [
              unresolved(
                '(root)',
                'parse-error',
                prepared.slice(0, 120),
                sourceName,
                `Could not find a static module.exports / export default object in ${sourceName}.`,
              ),
            ],
    }
  }

  return { ok: true, value: exported, unresolved: unresolvedList }
}

// Silence unused SpreadElement import in some TS versions
void (null as unknown as SpreadElement)
