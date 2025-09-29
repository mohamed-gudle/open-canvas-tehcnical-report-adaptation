import { readFile } from "fs/promises";
import path from "path";
import Handlebars from "handlebars";
import { Citation, DocumentDefinition } from "./types.js";

const templatesDir = path.resolve(__dirname, "../../templates");

const templateCache = new Map<string, Handlebars.TemplateDelegate>();

export async function loadTemplate(templateName: string) {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName)!;
  }
  const templatePath = path.join(templatesDir, templateName);
  const templateContent = await readFile(templatePath, "utf-8");
  const compiled = Handlebars.compile(templateContent);
  templateCache.set(templateName, compiled);
  return compiled;
}

export interface RenderTemplateInput {
  definition: DocumentDefinition;
  dossier: Record<string, string>;
  citations: Citation[];
  title: string;
}

export async function renderDocumentTemplate(
  templateName: string,
  input: RenderTemplateInput
): Promise<string> {
  const compiled = await loadTemplate(templateName);
  const context = {
    title: input.title,
    ...input.dossier,
    citations: input.citations,
  };
  return compiled(context);
}
