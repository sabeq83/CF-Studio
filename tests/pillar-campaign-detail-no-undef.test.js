import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { transformSync } from 'esbuild';
import * as acorn from 'acorn';

const STANDARD_BROWSER_GLOBALS = new Set([
  'React', 'window', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage',
  'fetch', 'Request', 'Response', 'Headers', 'URL', 'URLSearchParams', 'FormData', 'Blob', 'File', 'FileReader',
  'console', 'JSON', 'Math', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt',
  'Date', 'Promise', 'Error', 'TypeError', 'SyntaxError', 'ReferenceError', 'RegExp', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'Intl', 'AbortController', 'Event', 'CustomEvent', 'ClipboardItem', 'Image', 'Audio',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'alert', 'confirm', 'prompt', 'atob', 'btoa', 'structuredClone', 'globalThis', 'process', 'crypto',
  'undefined', 'NaN', 'Infinity', 'arguments'
]);

function collectPatternBindings(node, targetSet) {
  if (!node || !targetSet) return;
  switch (node.type) {
    case 'Identifier':
      targetSet.add(node.name);
      break;
    case 'ObjectPattern':
      for (const prop of node.properties) {
        if (prop.type === 'RestElement') collectPatternBindings(prop.argument, targetSet);
        else collectPatternBindings(prop.value, targetSet);
      }
      break;
    case 'ArrayPattern':
      for (const el of node.elements) {
        if (el) collectPatternBindings(el, targetSet);
      }
      break;
    case 'RestElement':
      collectPatternBindings(node.argument, targetSet);
      break;
    case 'AssignmentPattern':
      collectPatternBindings(node.left, targetSet);
      break;
  }
}

function collectHoistedVarAndFuncDecls(node, varTarget, lexicalTarget) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) collectHoistedVarAndFuncDecls(child, varTarget, lexicalTarget);
    return;
  }
  switch (node.type) {
    case 'FunctionDeclaration':
      if (node.id?.name && lexicalTarget) lexicalTarget.add(node.id.name);
      return; // do not descend into inner function bodies
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
    case 'ClassDeclaration':
    case 'ClassExpression':
      if (node.type === 'ClassDeclaration' && node.id?.name && lexicalTarget) {
        lexicalTarget.add(node.id.name);
      }
      return;
    case 'VariableDeclaration':
      for (const decl of node.declarations) {
        collectPatternBindings(decl.id, node.kind === 'var' ? varTarget : lexicalTarget);
      }
      return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'type') continue;
    if (value && typeof value === 'object') {
      // Only descend into BlockStatement/ForStatement for `var` hoisting
      collectHoistedVarAndFuncDecls(value, varTarget, null);
    }
  }
}

function findUndeclaredIdentifiers(jsCode) {
  const ast = acorn.parse(jsCode, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const undeclared = [];

  function findBlockDeclarations(stmts, scopeSet) {
    if (!Array.isArray(stmts)) return;
    for (const stmt of stmts) {
      if (!stmt) continue;
      if (stmt.type === 'VariableDeclaration' && stmt.kind !== 'var') {
        for (const decl of stmt.declarations) collectPatternBindings(decl.id, scopeSet);
      } else if (stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') {
        if (stmt.id?.name) scopeSet.add(stmt.id.name);
      } else if (stmt.type === 'ImportDeclaration') {
        for (const spec of stmt.specifiers) {
          if (spec.local?.name) scopeSet.add(spec.local.name);
        }
      }
    }
  }

  function isDeclared(name, scopeStack) {
    if (STANDARD_BROWSER_GLOBALS.has(name)) return true;
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      if (scopeStack[i].has(name)) return true;
    }
    return false;
  }

  function walk(node, scopeStack) {
    if (!node || typeof node !== 'object') return;

    switch (node.type) {
      case 'Program': {
        const rootScope = new Set();
        collectHoistedVarAndFuncDecls(node.body, rootScope, rootScope);
        findBlockDeclarations(node.body, rootScope);
        const nextStack = [...scopeStack, rootScope];
        for (const stmt of node.body) walk(stmt, nextStack);
        return;
      }
      case 'BlockStatement': {
        const blockScope = new Set();
        findBlockDeclarations(node.body, blockScope);
        const nextStack = [...scopeStack, blockScope];
        for (const stmt of node.body) walk(stmt, nextStack);
        return;
      }
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression': {
        const fnScope = new Set();
        if (node.id?.name) fnScope.add(node.id.name);
        for (const param of node.params) collectPatternBindings(param, fnScope);
        if (node.body?.type === 'BlockStatement') {
          collectHoistedVarAndFuncDecls(node.body.body, fnScope, fnScope);
          findBlockDeclarations(node.body.body, fnScope);
          const nextStack = [...scopeStack, fnScope];
          for (const stmt of node.body.body) walk(stmt, nextStack);
        } else {
          walk(node.body, [...scopeStack, fnScope]);
        }
        return;
      }
      case 'CatchClause': {
        const catchScope = new Set();
        if (node.param) collectPatternBindings(node.param, catchScope);
        const nextStack = [...scopeStack, catchScope];
        if (node.body?.type === 'BlockStatement') {
          findBlockDeclarations(node.body.body, catchScope);
          for (const stmt of node.body.body) walk(stmt, nextStack);
        } else {
          walk(node.body, nextStack);
        }
        return;
      }
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement': {
        const forScope = new Set();
        const init = node.type === 'ForStatement' ? node.init : node.left;
        if (init?.type === 'VariableDeclaration' && init.kind !== 'var') {
          for (const decl of init.declarations) collectPatternBindings(decl.id, forScope);
        }
        const nextStack = [...scopeStack, forScope];
        if (node.init) walk(node.init, nextStack);
        if (node.left) walk(node.left, nextStack);
        if (node.right) walk(node.right, nextStack);
        if (node.test) walk(node.test, nextStack);
        if (node.update) walk(node.update, nextStack);
        walk(node.body, nextStack);
        return;
      }
      case 'SwitchStatement': {
        walk(node.discriminant, scopeStack);
        const switchScope = new Set();
        for (const c of node.cases) findBlockDeclarations(c.consequent, switchScope);
        const nextStack = [...scopeStack, switchScope];
        for (const c of node.cases) {
          if (c.test) walk(c.test, nextStack);
          for (const stmt of c.consequent) walk(stmt, nextStack);
        }
        return;
      }
      case 'ImportDeclaration':
      case 'BreakStatement':
      case 'ContinueStatement':
        return;
      case 'ExportNamedDeclaration':
        if (node.declaration) walk(node.declaration, scopeStack);
        if (!node.source && Array.isArray(node.specifiers)) {
          for (const spec of node.specifiers) {
            if (spec.local) walk(spec.local, scopeStack);
          }
        }
        return;
      case 'VariableDeclarator':
        if (node.init) walk(node.init, scopeStack);
        return;
      case 'MemberExpression':
        walk(node.object, scopeStack);
        if (node.computed) walk(node.property, scopeStack);
        return;
      case 'Property':
        if (node.computed) walk(node.key, scopeStack);
        walk(node.value, scopeStack);
        return;
      case 'MethodDefinition':
        if (node.computed) walk(node.key, scopeStack);
        walk(node.value, scopeStack);
        return;
      case 'LabeledStatement':
        walk(node.body, scopeStack);
        return;
      case 'Identifier':
        if (!isDeclared(node.name, scopeStack)) {
          undeclared.push({ name: node.name, line: node.loc?.start?.line || 0 });
        }
        return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'type') continue;
      if (Array.isArray(value)) {
        for (const child of value) walk(child, scopeStack);
      } else if (value && typeof value === 'object') {
        walk(value, scopeStack);
      }
    }
  }

  walk(ast, []);
  return undeclared;
}

test('app/pillar-campaigns/[id]/page.js compiles cleanly with zero undeclared identifiers (H1)', () => {
  const pagePath = path.join(process.cwd(), 'app/pillar-campaigns/[id]/page.js');
  const source = fs.readFileSync(pagePath, 'utf8');

  const transformed = transformSync(source, {
    loader: 'jsx',
    format: 'esm',
    jsx: 'transform'
  });

  const undeclared = findUndeclaredIdentifiers(transformed.code);
  assert.deepEqual(
    undeclared,
    [],
    `Found undeclared identifiers in pillar-campaigns/[id]/page.js: ${JSON.stringify(undeclared)}`
  );
  assert.match(source, /let parsedResult\s*=\s*\{\};/, 'parsedResult must be explicitly declared in Storyboard scope');

  // Regression guard: AST scope walker must catch an undeclared parsedResult reference
  const brokenSample = `export default function Demo() { return parsedResult?.start_frame_qc ? 1 : 0; }`;
  const caught = findUndeclaredIdentifiers(brokenSample);
  assert.ok(caught.some((item) => item.name === 'parsedResult'), 'AST checker should flag undeclared parsedResult');
});
