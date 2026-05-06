import * as ts from "typescript";

export interface StaticRoute {
  method: string;
  path: string;
  tags: string[];
  source: string;
  factory: string;
  index: number;
}

export function inspectStaticRoutes(
  sourceText: string,
  fileName = "routes.ts",
): StaticRoute[] {
  const file = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const routes: StaticRoute[] = [];

  for (const statement of file.statements) {
    if (!ts.isFunctionDeclaration(statement)) continue;
    if (!statement.name || !hasExportModifier(statement)) continue;
    if (!statement.body) continue;

    const factoryName = statement.name.text;
    const returnedGroup = findReturnedGroup(statement.body);
    if (!returnedGroup) continue;

    const [prefixArg, routesArg] = returnedGroup.arguments;
    if (!prefixArg || !routesArg) continue;
    if (!ts.isStringLiteral(prefixArg) || !ts.isArrayLiteralExpression(routesArg)) {
      continue;
    }

    let index = 0;
    for (const element of routesArg.elements) {
      const route = readRouteCall(
        element,
        prefixArg.text,
        fileName,
        factoryName,
        index,
      );
      if (route) {
        routes.push(route);
        index += 1;
      }
    }
  }

  return routes;
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    )
  );
}

function findReturnedGroup(body: ts.Block): ts.CallExpression | undefined {
  for (const statement of body.statements) {
    if (!ts.isReturnStatement(statement) || !statement.expression) continue;
    if (!ts.isCallExpression(statement.expression)) continue;

    const call = statement.expression;
    if (ts.isIdentifier(call.expression) && call.expression.text === "group") {
      return call;
    }
  }

  return undefined;
}

function readRouteCall(
  node: ts.Node,
  prefix: string,
  fileName: string,
  factoryName: string,
  index: number,
): StaticRoute | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  if (!ts.isPropertyAccessExpression(node.expression)) return undefined;
  if (!ts.isIdentifier(node.expression.expression)) return undefined;
  if (node.expression.expression.text !== "route") return undefined;

  const method = node.expression.name.text.toUpperCase();
  const [pathArg, _handlerArg, optionsArg] = node.arguments;

  if (!pathArg || !ts.isStringLiteral(pathArg)) return undefined;

  return {
    method,
    path: joinPaths(prefix, pathArg.text),
    tags: readTags(optionsArg),
    source: fileName,
    factory: factoryName,
    index,
  };
}

function readTags(node: ts.Node | undefined): string[] {
  if (!node || !ts.isObjectLiteralExpression(node)) return [];

  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (!ts.isIdentifier(property.name) || property.name.text !== "tags") {
      continue;
    }
    if (!ts.isArrayLiteralExpression(property.initializer)) return [];

    return property.initializer.elements
      .filter(ts.isStringLiteral)
      .map((item) => item.text);
  }

  return [];
}

function joinPaths(prefix: string, path: string): string {
  const left = prefix.replace(/\/+$/, "");
  const right = path.replace(/^\/+/, "");
  return `${left}/${right}`.replace(/\/+/g, "/");
}
