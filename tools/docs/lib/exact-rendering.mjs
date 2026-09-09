import ts from 'typescript';
import { Converter, ReflectionKind } from 'typedoc';
import { MarkdownTheme, MarkdownThemeContext } from 'typedoc-plugin-markdown';

const installedApplications = new WeakSet();

/**
 * Install the DI Bag Markdown theme, which renders public declarations from the
 * compiler syntax tree instead of TypeDoc's normalized type model.
 *
 * The Markdown renderer reconstructs declarations and can omit syntax such as
 * `const` type parameters, constructor-type `new`, and parentheses that affect
 * conditional types. Compiler nodes remain the source of truth for displayed APIs.
 */
export function installExactRendering(app) {
  if (installedApplications.has(app)) return;
  installedApplications.add(app);

  const declarations = new WeakMap();
  const inferredTypes = new WeakMap();
  const signatures = new WeakMap();
  const parameters = new WeakMap();
  const typeParameters = new WeakMap();
  const typeOnlyFunctions = new WeakSet();

  app.converter.on(Converter.EVENT_CREATE_DECLARATION, (context, reflection) => {
    const symbol = context.getSymbolFromReflection(reflection);
    const node = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    if (node) declarations.set(reflection, node);
    if (node && supportsInferredType(node) && !node.type) {
      const type = context.checker.getTypeAtLocation(node);
      const typeNode = context.checker.typeToTypeNode(
        type,
        node,
        ts.NodeBuilderFlags.NoTruncation,
      );
      if (typeNode) inferredTypes.set(reflection, typeNode);
    }
    if (reflection.kind === ReflectionKind.TypeAlias
      && symbol?.declarations?.some(ts.isFunctionDeclaration)) {
      typeOnlyFunctions.add(reflection);
    }
  });

  app.converter.on(Converter.EVENT_CREATE_SIGNATURE, (context, reflection, node, signature) => {
    let declaration = node;
    if ((!declaration || !hasReturnType(declaration)) && signature) {
      const kind = fallbackSignatureKind(reflection);
      const inferred = context.checker.signatureToSignatureDeclaration(
        signature,
        kind,
        declaration,
        ts.NodeBuilderFlags.NoTruncation,
      );
      if (inferred) declaration = inferred;
    }
    if (declaration) signatures.set(reflection, declaration);
  });

  app.converter.on(Converter.EVENT_CREATE_PARAMETER, (_context, reflection, node) => {
    if (node) parameters.set(reflection, node);
  });
  app.converter.on(Converter.EVENT_CREATE_TYPE_PARAMETER, (_context, reflection, node) => {
    if (node) typeParameters.set(reflection, node);
  });

  class ExactMarkdownTheme extends MarkdownTheme {
    getRenderContext(page) {
      return new ExactMarkdownThemeContext(this, page, this.application.options);
    }
  }

  class ExactMarkdownThemeContext extends MarkdownThemeContext {
    constructor(theme, page, options) {
      super(theme, page, options);

      const originalDeclarationTitle = this.partials.declarationTitle;
      const originalSignatureTitle = this.partials.signatureTitle;
      const originalPageTitle = this.partials.pageTitle;

      this.partials.declarationTitle = (model) => {
        const rendered = renderDeclaration(model);
        return rendered ?? originalDeclarationTitle(model);
      };
      this.partials.signatureTitle = (model, signatureOptions) => {
        const node = signatures.get(model);
        return node
          ? declarationBlock(printSignature(node, model), options)
          : originalSignatureTitle(model, signatureOptions);
      };
      this.partials.parametersTable = (model) => descriptionTable(
        'Parameter',
        model,
        parameterName,
        this,
      );
      this.partials.typeParametersTable = (model) => descriptionTable(
        'Type Parameter',
        model,
        typeParameterName,
        this,
      );
      this.partials.signatureReturns = (model, returnOptions) => renderReturnDescription(
        model,
        returnOptions,
        this,
      );
      this.partials.pageTitle = () => typeOnlyFunctions.has(this.page.model)
        ? `Type-Only Function: ${this.page.model.name}`
        : originalPageTitle();
    }
  }

  function renderDeclaration(model) {
    if (typeOnlyFunctions.has(model)) {
      const source = declarations.get(model);
      if (!source || !ts.isFunctionDeclaration(source)) return undefined;
      const exact = printNode(asDeclarationFunction(source), source);
      return `${declarationBlock(exact, app.options)}\n\n${typeOnlyFunctionNote(model.name)}`;
    }

    const source = declarations.get(model);
    if (source && ts.isTypeAliasDeclaration(source)) {
      return declarationBlock(printNode(printableDeclaration(source), source), app.options);
    }

    const callSignatures = model.type?.declaration?.signatures;
    if (callSignatures?.length) {
      const nodes = callSignatures.map(signature => signatures.get(signature));
      if (nodes.some(node => !node)) return undefined;

      // The expanded callable's child nodes come from the helper declaration,
      // which may live in a different source file from the facade property.
      const source = nodes[0];
      const property = callableProperty(model, nodes);
      return declarationBlock(printNode(property, source), app.options);
    }

    const declaration = source && printableDeclaration(
      source,
      inferredTypes.get(model),
    );
    return declaration
      ? declarationBlock(printNode(declaration, source), app.options)
      : undefined;
  }

  app.renderer.defineTheme('di-bag-exact', ExactMarkdownTheme);
  app.options.setValue('theme', 'di-bag-exact');

  function parameterName(reflection) {
    const node = parameters.get(reflection);
    if (!node || !ts.isParameter(node)) {
      return `${reflection.flags?.isRest ? '...' : ''}${reflection.name}${reflection.flags?.isOptional ? '?' : ''}`;
    }
    return `${node.dotDotDotToken ? '...' : ''}${node.name.getText()}${node.questionToken ? '?' : ''}`;
  }

  function typeParameterName(reflection) {
    const node = typeParameters.get(reflection);
    return `${node?.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ConstKeyword) ? 'const ' : ''}${reflection.name}`;
  }
}

function callableProperty(model, nodes) {
  const name = propertyName(model.originalName ?? model.name);
  const modifiers = model.flags?.isReadonly
    ? [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)]
    : undefined;
  const questionToken = model.flags?.isOptional
    ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
    : undefined;
  const type = nodes.length === 1
    ? asFunctionType(nodes[0])
    : ts.factory.createTypeLiteralNode(nodes.map(asCallSignature));
  return ts.factory.createPropertySignature(modifiers, name, questionToken, type);
}

function printableDeclaration(node, inferredType) {
  if (ts.isTypeAliasDeclaration(node)) {
    return ts.factory.updateTypeAliasDeclaration(
      node,
      stripExportModifiers(node.modifiers),
      node.name,
      node.typeParameters,
      node.type,
    );
  }
  if (ts.isPropertySignature(node)) return node;
  if (ts.isParameter(node)) {
    const modifiers = node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)
      ? [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)]
      : undefined;
    return ts.factory.createPropertySignature(
      modifiers,
      node.name,
      node.questionToken,
      node.type ?? inferredType,
    );
  }
  if (ts.isPropertyDeclaration(node)) {
    return ts.factory.updatePropertyDeclaration(
      node,
      node.modifiers,
      node.name,
      node.questionToken,
      node.type ?? inferredType,
      undefined,
    );
  }
  if (ts.isVariableDeclaration(node)) {
    const declaration = ts.factory.updateVariableDeclaration(
      node,
      node.name,
      undefined,
      node.type ?? inferredType,
      undefined,
    );
    const flags = ts.isVariableDeclarationList(node.parent)
      ? node.parent.flags & ts.NodeFlags.BlockScoped
      : ts.NodeFlags.Const;
    return ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList([declaration], flags || ts.NodeFlags.Const),
    );
  }
  return undefined;
}

function asFunctionType(node) {
  return ts.factory.createFunctionTypeNode(
    node.typeParameters,
    stripInitializers(node.parameters ?? []),
    node.type ?? ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
  );
}

function asCallSignature(node) {
  return ts.factory.createCallSignature(
    node.typeParameters,
    stripInitializers(node.parameters ?? []),
    node.type ?? ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
  );
}

function asDeclarationFunction(node) {
  return ts.factory.updateFunctionDeclaration(
    node,
    [ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword)],
    node.asteriskToken,
    node.name,
    node.typeParameters,
    stripInitializers(node.parameters),
    node.type,
    undefined,
  );
}

function stripInitializers(nodes) {
  return nodes.map(node => {
    const questionToken = node.questionToken
      ?? (node.initializer && !node.dotDotDotToken
        ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
        : undefined);
    return ts.factory.updateParameterDeclaration(
      node,
      node.modifiers,
      node.dotDotDotToken,
      node.name,
      questionToken,
      node.type,
      undefined,
    );
  });
}

function printSignature(node, reflection) {
  let printable;
  if (ts.isFunctionDeclaration(node)) {
    printable = reflection.name === '__type' || reflection.name === '__call'
      ? asCallSignature(node)
      : ts.factory.updateFunctionDeclaration(
        node,
        undefined,
        node.asteriskToken,
        node.name,
        node.typeParameters,
        stripInitializers(node.parameters),
        node.type,
        undefined,
      );
  } else if (ts.isMethodDeclaration(node)) {
    printable = ts.factory.updateMethodDeclaration(
      node,
      undefined,
      node.asteriskToken,
      node.name,
      node.questionToken,
      node.typeParameters,
      stripInitializers(node.parameters),
      node.type,
      undefined,
    );
  } else if (ts.isConstructorDeclaration(node)) {
    printable = ts.factory.updateConstructorDeclaration(
      node,
      undefined,
      stripInitializers(node.parameters),
      undefined,
    );
  } else if (isSignatureDeclaration(node)) {
    printable = node;
  } else {
    return node.getText();
  }
  return printNode(printable, node);
}

function printNode(node, source) {
  const sourceFile = source?.getSourceFile?.() ?? ts.createSourceFile(
    'declaration.ts',
    '',
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );
  return ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: true,
  }).printNode(ts.EmitHint.Unspecified, node, sourceFile).trim();
}

function declarationBlock(value, options) {
  return options.getValue('useCodeBlocks') ? `\`\`\`ts\n${value}\n\`\`\`` : `> ${value}`;
}

function descriptionTable(header, reflections, getName, context) {
  const rows = reflections.map(reflection => {
    const rendered = reflection.comment
      ? context.partials.comment(reflection.comment, { isTableColumn: true }) || '-'
      : '-';
    const description = tableCell(rendered);
    return `| \`${escapeCode(getName(reflection))}\` | ${description} |`;
  });
  return [
    `| ${header} | Description |`,
    '| ------ | ------ |',
    ...rows,
  ].join('\n');
}

function renderReturnDescription(model, options, context) {
  const returnsTag = model.comment?.getTag('@returns');
  if (!returnsTag) return '';
  const description = context.helpers.getCommentParts(returnsTag.content);
  return `${'#'.repeat(options.headingLevel)} Returns\n\n${description}`;
}

function typeOnlyFunctionNote(name) {
  return `Type-only package export. Import it with \`import type { ${name} } from 'di-bag'\` and refer to its callable shape as \`typeof ${name}\`. Call the runtime API as \`DiBag.${name}\`.`;
}

function propertyName(name) {
  return ts.isIdentifierText(name, ts.ScriptTarget.Latest)
    ? ts.factory.createIdentifier(name)
    : ts.factory.createStringLiteral(name);
}

function fallbackSignatureKind(reflection) {
  if (reflection.kind === ReflectionKind.ConstructorSignature) return ts.SyntaxKind.ConstructSignature;
  if (reflection.parent?.kind === ReflectionKind.Method) return ts.SyntaxKind.MethodSignature;
  return ts.SyntaxKind.CallSignature;
}

function hasReturnType(node) {
  return isSignatureDeclaration(node) && Boolean(node.type);
}

function isSignatureDeclaration(node) {
  return ts.isFunctionDeclaration(node)
    || ts.isMethodDeclaration(node)
    || ts.isMethodSignature(node)
    || ts.isCallSignatureDeclaration(node)
    || ts.isConstructSignatureDeclaration(node)
    || ts.isConstructorTypeNode(node)
    || ts.isFunctionTypeNode(node)
    || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node);
}

function escapeCode(value) {
  return value.replace(/`/g, '\\`').replace(/\|/g, '\\|');
}

function tableCell(value) {
  return value.trim().replace(/\r?\n+/g, '<br>').replace(/(?<!\\)\|/g, '\\|');
}

function stripExportModifiers(modifiers) {
  return modifiers?.filter(modifier => ![
    ts.SyntaxKind.ExportKeyword,
    ts.SyntaxKind.DefaultKeyword,
  ].includes(modifier.kind));
}

function supportsInferredType(node) {
  return ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node);
}
