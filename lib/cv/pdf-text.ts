import { extractText, getDocumentProxy } from "unpdf";

export { isImageOnly } from "./image-only";

export async function extractPdf(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pageTexts = Array.isArray(text) ? text : [text];
  return { text: pageTexts.join("\n"), pageTexts, pageCount: totalPages };
}
