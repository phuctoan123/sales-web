const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function loadDictionary(file, name) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), context, {
    filename: file,
  });
  return context.window[name];
}

function flattenKeys(value, prefix = "", keys = []) {
  Object.keys(value).forEach((key) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value[key] && typeof value[key] === "object" && !Array.isArray(value[key])) {
      flattenKeys(value[key], fullKey, keys);
    } else {
      keys.push(fullKey);
    }
  });
  return keys;
}

function htmlKeys(file) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  const keys = new Set();
  const attributePattern = /\bdata-i18n(?:-html|-placeholder|-alt|-title|-aria|-meta)?="([^"]+)"/g;
  let match;

  while ((match = attributePattern.exec(html))) {
    keys.add(match[1]);
  }

  return keys;
}

const english = loadDictionary("js/lang/en.js", "I18N_EN");
const vietnamese = loadDictionary("js/lang/vi.js", "I18N_VI");
const englishKeys = new Set(flattenKeys(english));
const vietnameseKeys = new Set(flattenKeys(vietnamese));
const errors = [];

for (const key of englishKeys) {
  if (!vietnameseKeys.has(key)) {
    errors.push(`Missing from Vietnamese dictionary: ${key}`);
  }
}

for (const key of vietnameseKeys) {
  if (!englishKeys.has(key)) {
    errors.push(`Missing from English dictionary: ${key}`);
  }
}

for (const file of ["index.html", "blog-single.html"]) {
  for (const key of htmlKeys(file)) {
    if (!englishKeys.has(key)) {
      errors.push(`${file} uses unknown key: ${key}`);
    }
    if (!vietnameseKeys.has(key)) {
      errors.push(`${file} uses key missing from Vietnamese dictionary: ${key}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`i18n check passed: ${englishKeys.size} shared keys, HTML keys are valid.`);
