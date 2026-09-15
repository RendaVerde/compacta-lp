const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const htmlPath = path.join(projectRoot, "index.html");
const cssPath = path.join(projectRoot, "style.css");
const scriptPath = path.join(projectRoot, "script.js");

const html = fs.readFileSync(htmlPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const script = fs.readFileSync(scriptPath, "utf8");

const errors = [];

function unique(values) {
  return [...new Set(values)];
}

function collectMatches(source, pattern, group = 1) {
  return [...source.matchAll(pattern)].map((match) => match[group]);
}

function validateLocalReferences() {
  const references = collectMatches(
    html,
    /\b(?:href|poster|src)=["'](\.\/[^"']+)["']/g,
  ).map((reference) =>
    decodeURIComponent(reference.slice(2).split(/[?#]/, 1)[0]),
  );

  const missingReferences = unique(references).filter(
    (reference) => !fs.existsSync(path.join(projectRoot, reference)),
  );

  if (missingReferences.length) {
    errors.push(`Arquivos locais ausentes: ${missingReferences.join(", ")}`);
  }

  return unique(references).length;
}

function validateIds() {
  const ids = collectMatches(html, /\bid=["']([^"']+)["']/g);
  const duplicateIds = unique(
    ids.filter((id, index) => ids.indexOf(id) !== index),
  );

  if (duplicateIds.length) {
    errors.push(`IDs duplicados: ${duplicateIds.join(", ")}`);
  }

  const labelTargets = collectMatches(
    html,
    /<label\b[^>]*\bfor=["']([^"']+)["']/g,
  );
  const missingLabelTargets = unique(labelTargets).filter(
    (target) => !ids.includes(target),
  );

  if (missingLabelTargets.length) {
    errors.push(
      `Campos referenciados por label não encontrados: ${missingLabelTargets.join(", ")}`,
    );
  }

  const scriptIds = collectMatches(
    script,
    /getElementById\(["']([^"']+)["']\)/g,
  );
  const missingScriptIds = unique(scriptIds).filter((id) => !ids.includes(id));

  if (missingScriptIds.length) {
    errors.push(
      `IDs usados no JavaScript não encontrados: ${missingScriptIds.join(", ")}`,
    );
  }

  return { ids: ids.length, labels: labelTargets.length, scriptIds: scriptIds.length };
}

function validateHtmlStructure() {
  const voidElements = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ]);
  const stack = [];
  const tokens = html.match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>/gi) || [];

  tokens.forEach((token) => {
    if (token.startsWith("<!--") || token.startsWith("<!")) return;

    const match = token.match(/^<\/?\s*([a-z][\w:-]*)/i);
    if (!match) return;

    const tag = match[1].toLowerCase();
    const isClosingTag = /^<\//.test(token);
    const isSelfClosingTag = /\/>$/.test(token) || voidElements.has(tag);

    if (isClosingTag) {
      const expectedTag = stack.pop();
      if (expectedTag !== tag) {
        errors.push(
          `Fechamento HTML inesperado: </${tag}>; esperado: </${expectedTag || "nenhum"}>.`,
        );
      }
    } else if (!isSelfClosingTag) {
      stack.push(tag);
    }
  });

  if (stack.length) {
    errors.push(`Tags HTML sem fechamento: ${stack.join(", ")}`);
  }

  return tokens.length;
}

function validateCssBlocks() {
  let blockDepth = 0;
  let state = "code";
  let quote = "";

  for (let index = 0; index < css.length; index += 1) {
    const character = css[index];
    const nextCharacter = css[index + 1];

    if (state === "comment") {
      if (character === "*" && nextCharacter === "/") {
        state = "code";
        index += 1;
      }
      continue;
    }

    if (state === "string") {
      if (character === "\\") {
        index += 1;
      } else if (character === quote) {
        state = "code";
      }
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      state = "comment";
      index += 1;
    } else if (character === '"' || character === "'") {
      state = "string";
      quote = character;
    } else if (character === "{") {
      blockDepth += 1;
    } else if (character === "}") {
      blockDepth -= 1;
      if (blockDepth < 0) break;
    }
  }

  if (state === "comment") errors.push("Comentário CSS sem fechamento.");
  if (state === "string") errors.push("String CSS sem fechamento.");
  if (blockDepth !== 0) errors.push(`Blocos CSS desequilibrados: ${blockDepth}.`);
}

function validateJavaScriptSyntax() {
  try {
    new vm.Script(script, { filename: "script.js" });
  } catch (error) {
    errors.push(`JavaScript inválido: ${error.message}`);
  }

  const inlineScripts = collectMatches(
    html,
    /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
  ).filter((inlineScript) => inlineScript.trim());

  inlineScripts.forEach((inlineScript, index) => {
    try {
      new vm.Script(inlineScript, { filename: `index.html:inline-${index + 1}` });
    } catch (error) {
      errors.push(`Script inline inválido: ${error.message}`);
    }
  });

  return inlineScripts.length;
}

function validateClarityIntegration() {
  const projectMatch = html.match(
    /\(window,\s*document,\s*["']clarity["'],\s*["']script["'],\s*["']([a-z0-9]+)["']\s*\)/i,
  );
  const loadsOfficialScript = html.includes(
    't.src = "https://www.clarity.ms/tag/" + i;',
  );
  const maskedElements = collectMatches(
    html,
    /<[^>]+\bdata-clarity-mask=["']true["'][^>]*>/gi,
    0,
  );

  if (!projectMatch || !loadsOfficialScript) {
    errors.push("Integração do Microsoft Clarity ausente ou incompleta.");
  }

  if (maskedElements.length < 5) {
    errors.push("Mascaramento explícito do Clarity incompleto.");
  }

  return {
    projectId: projectMatch?.[1] || "não encontrado",
    maskedElements: maskedElements.length,
  };
}

function validatePortfolioSimulator() {
  const requiredIds = [
    "simulador-carteira",
    "portfolioEnergyClients",
    "portfolioInsuranceClients",
    "portfolioTelecomClients",
    "portfolioEstimate",
    "portfolioSimulatorCta",
  ];
  const missingIds = requiredIds.filter(
    (id) => !html.includes(`id="${id}"`),
  );
  const profileButtons = collectMatches(
    html,
    /\bdata-portfolio-profile=["']([^"']+)["']/g,
  );
  const portfolioFields = collectMatches(
    html,
    /\bdata-portfolio-field=["']([^"']+)["']/g,
  );

  if (missingIds.length) {
    errors.push(
      `Elementos do simulador ausentes: ${missingIds.join(", ")}`,
    );
  }

  if (
    !profileButtons.includes("licensee") ||
    !profileButtons.includes("referrer")
  ) {
    errors.push("Perfis do simulador de carteira incompletos.");
  }

  if (
    !["energy", "insurance", "telecom"].every((field) =>
      portfolioFields.includes(field),
    )
  ) {
    errors.push("Campos do simulador de carteira incompletos.");
  }

  if (
    !script.includes(
      'const portfolioSimulator = document.getElementById("simulador-carteira")',
    )
  ) {
    errors.push("Comportamento do simulador de carteira não encontrado.");
  }

  return {
    profiles: unique(profileButtons).length,
    fields: unique(portfolioFields).length,
  };
}

const localReferences = validateLocalReferences();
const idSummary = validateIds();
const htmlTokens = validateHtmlStructure();
validateCssBlocks();
const inlineScripts = validateJavaScriptSyntax();
const claritySummary = validateClarityIntegration();
const portfolioSummary = validatePortfolioSimulator();

if (errors.length) {
  console.error("Validação reprovada:\n");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Validação concluída sem erros.");
console.log(`- ${htmlTokens} elementos HTML analisados`);
console.log(`- ${idSummary.ids} IDs únicos verificados`);
console.log(`- ${idSummary.labels} associações de formulário verificadas`);
console.log(`- ${idSummary.scriptIds} referências do JavaScript verificadas`);
console.log(`- ${localReferences} arquivos locais encontrados`);
console.log(`- ${inlineScripts} scripts inline verificados`);
console.log(
  `- Clarity ${claritySummary.projectId} com ${claritySummary.maskedElements} áreas protegidas`,
);
console.log(
  `- Simulador com ${portfolioSummary.profiles} perfis e ${portfolioSummary.fields} campos verificados`,
);
