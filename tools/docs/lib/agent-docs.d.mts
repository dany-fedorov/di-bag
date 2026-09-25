type Snippet = {
  where: string;
  file: string;
  code: string;
  expectError?: string;
};

export function collectSnippets(root: string): { snippets: Snippet[]; errors: string[] };
export function writeDeclarationPackage(root: string, packageDirectory: string): void;
export function checkSnippets(snippets: readonly Snippet[], workspace: string, typeRoots: readonly string[]): string[];
