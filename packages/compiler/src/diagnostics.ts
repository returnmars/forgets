export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
  docsUrl?: string;
}

export const artifactSchemas = {
  manifest: "docs/schemas/manifest.schema.json",
  diagnostics: "docs/schemas/diagnostics.schema.json",
  aiContext: "docs/schemas/ai-context.schema.json",
} as const;

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const lines = [`${diagnostic.severity} ${diagnostic.code}`];

  if (diagnostic.file) {
    lines.push(
      diagnostic.line === undefined
        ? diagnostic.file
        : `${diagnostic.file}:${diagnostic.line}`,
    );
  }

  lines.push(diagnostic.message);

  if (diagnostic.suggestion) {
    lines.push(`Suggestion: ${diagnostic.suggestion}`);
  }

  if (diagnostic.docsUrl) {
    lines.push(`Docs: ${diagnostic.docsUrl}`);
  }

  return lines.join("\n");
}

export function diagnosticsToJson(diagnostics: Diagnostic[]): string {
  return JSON.stringify({
    schemaVersion: 1,
    diagnostics,
  }, null, 2);
}
