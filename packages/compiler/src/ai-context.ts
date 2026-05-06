import type { Diagnostic } from "./diagnostics";

export interface AiRouteFact {
  method: string;
  path: string;
  tags: string[];
  source: string;
  factory?: string;
  index?: number;
}

export interface AiContextInput {
  projectName: string;
  forgetsVersion: string;
  perryVersion: string;
  packages: string[];
  generatedEntry: string;
  routes: AiRouteFact[];
  schemaNames: string[];
  configKeys: string[];
  diagnostics: Diagnostic[];
  nativeCompatibility: NativeCompatibility;
}

export interface NativeCompatibility {
  status: "unknown" | "passed" | "failed";
  perryCheck: "not-run" | "passed" | "failed";
  perryCompile: "not-run" | "passed" | "failed";
  nativeSmoke: "not-run" | "passed" | "failed";
}

export interface AiContext {
  schemaVersion: 1;
  framework: "forgets";
  projectName: string;
  forgetsVersion: string;
  perryVersion: string;
  packages: string[];
  generatedEntry: string;
  routes: AiRouteFact[];
  schemaNames: string[];
  configKeys: string[];
  diagnostics: Diagnostic[];
  nativeCompatibility: NativeCompatibility;
}

export function createAiContext(input: AiContextInput): AiContext {
  return {
    schemaVersion: 1,
    framework: "forgets",
    projectName: input.projectName,
    forgetsVersion: input.forgetsVersion,
    perryVersion: input.perryVersion,
    packages: input.packages,
    generatedEntry: input.generatedEntry,
    routes: input.routes,
    schemaNames: input.schemaNames,
    configKeys: input.configKeys,
    diagnostics: input.diagnostics,
    nativeCompatibility: input.nativeCompatibility,
  };
}

export function aiContextToJson(input: AiContextInput): string {
  return JSON.stringify(createAiContext(input), null, 2);
}
