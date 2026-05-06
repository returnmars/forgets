export interface PerryEntryOptions {
  serverImport: string;
  serverExport: string;
}

export function generatePerryEntry(options: PerryEntryOptions): string {
  return [
    `import { ${options.serverExport} } from "${options.serverImport}";`,
    "",
    `const { app, config } = await ${options.serverExport}();`,
    "await app.listen(config.PORT);",
    "",
  ].join("\n");
}
