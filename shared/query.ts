export type QueryNode =
  | { type: 'tag'; name: string }
  | { type: 'and'; left: QueryNode; right: QueryNode }
  | { type: 'or'; left: QueryNode; right: QueryNode }
  | { type: 'not'; child: QueryNode };

const OPERATORS = new Set(['and', 'or', 'not']);

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n';
}

// Tokenizes a query into tag names (which may contain spaces) and operators.
// Operators (and/or/not) are recognized as standalone, case-insensitive words;
// everything between them is treated as a single tag name.
function tokenize(input: string): string[] {
  const atoms: string[] = [];
  let i = 0;
  const n = input.length;
  while (i < n) {
    while (i < n && isSpace(input[i])) i++;
    if (i >= n) break;
    const ch = input[i];
    if (ch === '(' || ch === ')') {
      atoms.push(ch);
      i++;
      continue;
    }
    const start = i;
    while (i < n && !isSpace(input[i]) && input[i] !== '(' && input[i] !== ')') i++;
    atoms.push(input.slice(start, i));
  }

  const tokens: string[] = [];
  const buffer: string[] = [];
  const flush = () => {
    if (buffer.length > 0) {
      tokens.push(buffer.join(' '));
      buffer.length = 0;
    }
  };
  for (const atom of atoms) {
    if (atom === '(' || atom === ')') {
      flush();
      tokens.push(atom);
    } else if (OPERATORS.has(atom.toLowerCase())) {
      flush();
      tokens.push(atom.toLowerCase());
    } else {
      buffer.push(atom);
    }
  }
  flush();
  return tokens;
}

export function parseQuery(input: string): QueryNode {
  const tokens = tokenize(input);
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr(): QueryNode {
    let left = parseAnd();
    while (peek() !== undefined && peek().toLowerCase() === 'or') {
      next();
      const right = parseAnd();
      left = { type: 'or', left, right };
    }
    return left;
  }

  function parseAnd(): QueryNode {
    let left = parseUnary();
    while (peek() !== undefined && peek().toLowerCase() === 'and') {
      next();
      const right = parseUnary();
      left = { type: 'and', left, right };
    }
    return left;
  }

  function parseUnary(): QueryNode {
    const token = peek();
    if (token === undefined) {
      throw new Error('Unexpected end of query');
    }
    if (token.toLowerCase() === 'not') {
      next();
      return { type: 'not', child: parseUnary() };
    }
    if (token === '(') {
      next();
      const inner = parseOr();
      if (peek() !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      next();
      return inner;
    }
    if (token === ')') {
      throw new Error('Unexpected closing parenthesis');
    }
    if (OPERATORS.has(token.toLowerCase())) {
      throw new Error(`Unexpected operator "${token}"`);
    }
    next();
    return { type: 'tag', name: token };
  }

  const result = parseOr();
  if (peek() !== undefined) {
    throw new Error(`Unexpected token "${peek()}"`);
  }
  return result;
}

export function evaluateQuery(
  node: QueryNode,
  index: Map<string, Set<string>>,
  universe: Set<string>,
): Set<string> {
  switch (node.type) {
    case 'tag':
      return index.get(node.name) ?? new Set<string>();
    case 'and': {
      const left = evaluateQuery(node.left, index, universe);
      const right = evaluateQuery(node.right, index, universe);
      const result = new Set<string>();
      for (const v of left) if (right.has(v)) result.add(v);
      return result;
    }
    case 'or': {
      const left = evaluateQuery(node.left, index, universe);
      const right = evaluateQuery(node.right, index, universe);
      return new Set<string>([...left, ...right]);
    }
    case 'not': {
      const child = evaluateQuery(node.child, index, universe);
      return new Set<string>([...universe].filter((v) => !child.has(v)));
    }
  }
}

export function runQuery(
  input: string,
  index: Record<string, string[]>,
  universe: string[],
): Set<string> {
  const map = new Map<string, Set<string>>();
  for (const [tag, paths] of Object.entries(index)) {
    map.set(tag, new Set(paths));
  }
  const node = parseQuery(input);
  return evaluateQuery(node, map, new Set(universe));
}
