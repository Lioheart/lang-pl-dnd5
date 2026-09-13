// Przycisk przełączający przedmiot między wersją PL i EN.
//
// Cel:
//   - stosować cały flags.babele.originalPayload,
//   - pomijać wyłącznie główne pole flags.babele.originalPayload.name,
//   - nie pomijać zagnieżdżonych pól name, np. nazw aktywności i efektów,
//   - używać mapowania Babele, a gdy nie jest dostępne — lokalnego fallbacku
//     zgodnego z mapowaniem generowanym przez lang-pl-dnd5.
//
// Sugerowana nazwa pliku:
//   scripts/item-payload-language-toggle.js

Hooks.once("ready", injectItemPayloadLanguageToggle);

const TRANSLATION_FILE_CACHE = new Map();

const TRANSLATION_MODULES_BY_PACKAGE = {
  dnd5e: ["dnd5e_pl"],
  "dnd-players-handbook": ["lang-dnd-premium"],
  "dnd-monster-manual": ["lang-dnd-premium"],
  "dnd-dungeon-masters-guide": ["lang-dnd-premium"]
};

const FALLBACK_ITEM_MAPPING = {
  description: "system.description.value",
  requirements: "system.requirements",
  materials: "system.materials.value",
  chat: "system.description.chat",
  activation: "system.activation.condition",
  activationValue: "system.activation.value",
  unidentified: "system.unidentified.description",

  activities: {
    path: "system.activities",
    converter: "structured",
    cardinality: "many",
    container: "keyed",
    keys: ["_id", "name", "type"],
    mapping: {
      name: "name",
      condition: "activation.condition",
      activationCondition: "activation.condition",
      activationValue: "activation.value",
      chatFlavor: "description.chatFlavor",
      duration: "duration.special",
      roll: "roll.name",
      damageOnSave: "damage.onSave",
      range: {
        path: "range",
        converter: "imperialToMetric"
      },
      target: {
        path: "target",
        converter: "imperialToMetric"
      },
      uses: "uses.max",
      profiles: {
        path: "profiles",
        converter: "nameCollection"
      }
    }
  },

  effects: {
    path: "effects",
    converter: "document",
    documentType: "ActiveEffect",
    cardinality: "many",
    keys: ["_id", "name", "label"],
    mapping: {
      name: "name",
      label: "label",
      description: "description",
      changes: {
        path: "changes",
        converter: "structured",
        cardinality: "many",
        container: "array",
        key: "key",
        valuePath: "value"
      }
    }
  },

  advancement: {
    path: "system.advancement",
    converter: "structured",
    cardinality: "many",
    container: "keyed",
    keys: ["_id", "title"],
    mapping: {
      title: "title",
      hint: "hint",
      _variants: [
        {
          _when: {
            path: "type",
            equals: "ScaleValue"
          },
          distance: {
            path: "configuration.distance",
            converter: "imperialToMetric"
          },
          scale: {
            path: "configuration.scale",
            converter: "imperialToMetric"
          }
        }
      ]
    }
  },

  movement: {
    path: "system.movement",
    converter: "imperialToMetric"
  },
  weight: {
    path: "system.weight",
    converter: "imperialToMetric"
  },
  range: {
    path: "system.range",
    converter: "imperialToMetric"
  },
  capacityWeight: {
    path: "system.capacity.weight",
    converter: "imperialToMetric"
  },
  senses: {
    path: "system.senses",
    converter: "imperialToMetric"
  },
  target: {
    path: "system.target",
    converter: "imperialToMetric"
  },
  volume: {
    path: "system.capacity.volume",
    converter: "imperialToMetric"
  }
};

function injectItemPayloadLanguageToggle() {
  if (!game.settings.get("dnd5e_pl", "changeTranslation")) return;

  Hooks.on("renderItemSheet5e", (sheet, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;

    const header = root.querySelector(".window-header .window-title");
    if (!header) return;

    const existing = root.querySelector("[data-dnd5e-pl-payload-toggle]");
    if (existing) return;

    const item = sheet.document;
    if (!item) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "header-control";
    button.dataset.dnd5ePlPayloadToggle = "true";
    button.setAttribute("data-action", "translate");
    button.setAttribute("data-tooltip", "Zmień język przedmiotu");
    button.innerHTML = `<i class="fa fa-language"></i>`;

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      changeTranslation(item);
    });

    header.insertAdjacentElement("afterend", button);
  });
}

function getDocumentData(document) {
  if (document?.toObject instanceof Function) return document.toObject();
  if (document?.toJSON instanceof Function) return document.toJSON();
  return document ?? {};
}

function joinPath(...parts) {
  return parts
  .filter(part => typeof part === "string" && part.length)
  .join(".");
}

function getProperty(source, path) {
  if (!path) return source;
  return foundry.utils.getProperty(source, path);
}

function setUpdate(updateData, path, value) {
  if (!path) return;
  updateData[path] = clonePlain(value);
}

function clonePlain(value) {
  if (value === undefined) return undefined;
  return foundry.utils.deepClone(value);
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function getItemSourceId(item, document) {
  return item.flags?.core?.sourceId
  || item.flags?.dnd5e?.sourceId
  || item._stats?.compendiumSource
  || item._source?._stats?.compendiumSource
  || document?._stats?.compendiumSource
  || document?._source?._stats?.compendiumSource
  || null;
}

function getOriginalPayload(item) {
  return item.flags?.babele?.originalPayload ?? null;
}

function getOriginalName(item) {
  return item.flags?.babele?.originalName
  || getOriginalPayload(item)?.name
  || null;
}

function translationLookupKeys(item, sourceId) {
  const originalPayload = getOriginalPayload(item);
  const originalName = getOriginalName(item);
  const sourceItemId = sourceId?.split(".").pop();

  return [
    item._id,
    originalName,
    originalPayload?.name,
    sourceItemId,
    item.name
  ].filter((value, index, array) => (
    typeof value === "string"
    && value.trim()
    && array.indexOf(value) === index
  ));
}

function compendiumTranslationPaths(sourceId, lang) {
  if (typeof sourceId !== "string") return [];

  const parts = sourceId.split(".");
  if (parts[0] !== "Compendium" || parts.length < 3) return [];

  const packageId = parts[1];
  const packName = parts[2];
  const fileName = `${packageId}.${packName}.json`;

  const moduleIds = TRANSLATION_MODULES_BY_PACKAGE[packageId] ?? [
    "dnd5e_pl",
    "lang-dnd-premium"
  ];

  return moduleIds
  .filter(moduleId => game.modules.get(moduleId)?.active)
  .map(moduleId => `modules/${moduleId}/lang/${lang}/compendium/${fileName}`);
}

async function getTranslationFileData(sourceId, lang) {
  const paths = compendiumTranslationPaths(sourceId, lang);

  for (const path of paths) {
    if (TRANSLATION_FILE_CACHE.has(path)) {
      const cached = TRANSLATION_FILE_CACHE.get(path);
      if (cached) return cached;
      continue;
    }

    try {
      const response = await fetch(path);

      if (!response.ok) {
        TRANSLATION_FILE_CACHE.set(path, null);
        continue;
      }

      const data = await response.json();
      TRANSLATION_FILE_CACHE.set(path, data);
      return data;
    } catch (error) {
      TRANSLATION_FILE_CACHE.set(path, null);
      console.debug(`Nie udało się odczytać ${path}`, error);
    }
  }

  return null;
}

async function getTranslationEntryAndMapping(item, sourceId, lang) {
  const data = await getTranslationFileData(sourceId, lang);
  if (!data) return { entry: null, mapping: null };

  const lookupKeys = translationLookupKeys(item, sourceId);

  for (const key of lookupKeys) {
    const entry = data.entries?.[key];
    if (entry) return { entry, mapping: data.mapping ?? null };
  }

  return { entry: null, mapping: data.mapping ?? null };
}

function getMappingFromBabele(item) {
  try {
    if (!game.babele?.inspectMapping) return null;

    const report = game.babele.inspectMapping("Item", {
      data: getDocumentData(item)
    });

    return report?.effective?.mapping ?? null;
  } catch (error) {
    console.debug("Nie udało się pobrać mapowania przez game.babele.inspectMapping().", error);
    return null;
  }
}

function normalizeMappingEntry(mappingEntry) {
  if (typeof mappingEntry === "string") {
    return { path: mappingEntry };
  }

  if (mappingEntry && typeof mappingEntry === "object") {
    return mappingEntry;
  }

  return null;
}

function mergeMappings(...mappings) {
  const result = {};

  for (const mapping of mappings) {
    if (!mapping || typeof mapping !== "object") continue;

    for (const [key, value] of Object.entries(mapping)) {
      if (isPlainObject(result[key]) && isPlainObject(value)) {
        result[key] = mergeMappings(result[key], value);
      } else {
        result[key] = clonePlain(value);
      }
    }
  }

  return result;
}

function conditionMatches(condition, sourceObject) {
  if (!condition || typeof condition !== "object") return false;

  if (Array.isArray(condition.all)) {
    return condition.all.every(part => conditionMatches(part, sourceObject));
  }

  if (Array.isArray(condition.any)) {
    return condition.any.some(part => conditionMatches(part, sourceObject));
  }

  const value = getProperty(sourceObject, condition.path);

  if ("equals" in condition) {
    return value === condition.equals;
  }

  if (Array.isArray(condition.in)) {
    return condition.in.includes(value);
  }

  if ("exists" in condition) {
    const exists = value !== undefined && value !== null;
    return condition.exists ? exists : !exists;
  }

  return false;
}

function effectiveMapping(mapping, sourceObject) {
  if (!mapping || typeof mapping !== "object") return {};

  const result = {};

  for (const [key, value] of Object.entries(mapping)) {
    if (key === "_variants") continue;
    result[key] = value;
  }

  const variants = Array.isArray(mapping._variants) ? mapping._variants : [];
  for (const variant of variants) {
    if (!conditionMatches(variant._when, sourceObject)) continue;

    for (const [key, value] of Object.entries(variant)) {
      if (key === "_when") continue;
      result[key] = value;
    }
  }

  return result;
}

function isRootOriginalPayloadName(basePath, payloadKey) {
  return !basePath && payloadKey === "name";
}

function recordMatchesKey(record, payloadKey, payloadValue, keys) {
  if (!record || typeof record !== "object") return false;

  const candidateKeys = Array.isArray(keys) && keys.length
  ? keys
  : ["_id", "id", "name", "label", "title", "type"];

  if (candidateKeys.some(key => getProperty(record, key) === payloadKey)) {
    return true;
  }

  if (payloadValue && typeof payloadValue === "object") {
    for (const key of candidateKeys) {
      const payloadCandidate = payloadValue[key];
      if (typeof payloadCandidate !== "string") continue;

      for (const recordKey of candidateKeys) {
        if (getProperty(record, recordKey) === payloadCandidate) {
          return true;
        }
      }
    }
  }

  return false;
}

function findCollectionEntryPath(documentData, collectionPath, payloadKey, payloadValue, keys, fallbackIndex) {
  const collection = getProperty(documentData, collectionPath);

  if (Array.isArray(collection)) {
    let index = collection.findIndex(record => recordMatchesKey(record, payloadKey, payloadValue, keys));

    if (index < 0 && Number.isInteger(fallbackIndex) && fallbackIndex >= 0 && fallbackIndex < collection.length) {
      index = fallbackIndex;
    }

    if (index < 0) return null;

    return {
      path: `${collectionPath}.${index}`,
      value: collection[index]
    };
  }

  if (collection && typeof collection === "object") {
    if (Object.prototype.hasOwnProperty.call(collection, payloadKey)) {
      return {
        path: `${collectionPath}.${payloadKey}`,
        value: collection[payloadKey]
      };
    }

    const entries = Object.entries(collection);
    let match = entries.find(([, record]) => recordMatchesKey(record, payloadKey, payloadValue, keys));

    if (!match && Number.isInteger(fallbackIndex) && fallbackIndex >= 0 && fallbackIndex < entries.length) {
      match = entries[fallbackIndex];
    }

    if (!match) return null;

    return {
      path: `${collectionPath}.${match[0]}`,
      value: match[1]
    };
  }

  return null;
}

function applyScalarEntryPayload(updateData, matchPath, payloadValue, mappingEntry) {
  const valuePath = mappingEntry.valuePath ?? "value";
  setUpdate(updateData, joinPath(matchPath, valuePath), payloadValue);
}

function applyCollectionPayload(updateData, documentData, basePath, payload, mappingEntry, fallbackIndexBase = 0) {
  if (!payload || typeof payload !== "object") return;

  const collectionPath = joinPath(basePath, mappingEntry.path);
  const nestedMapping = mappingEntry.mapping;
  const keys = mappingEntry.keys ?? (mappingEntry.key ? [mappingEntry.key] : undefined);
  const isArrayPayload = Array.isArray(payload);
  const entries = isArrayPayload ? payload.entries() : Object.entries(payload);

  let index = 0;

  for (const [payloadKeyRaw, payloadValue] of entries) {
    if (payloadKeyRaw === "$sort") continue;

    const payloadKey = String(payloadKeyRaw);
    const match = findCollectionEntryPath(
      documentData,
      collectionPath,
      payloadKey,
      payloadValue,
      keys,
      fallbackIndexBase + index
    );

    index += 1;

    if (!match) continue;

    if (mappingEntry.valuePath && !isPlainObject(payloadValue)) {
      applyScalarEntryPayload(updateData, match.path, payloadValue, mappingEntry);
      continue;
    }

    if (nestedMapping && payloadValue && typeof payloadValue === "object") {
      applyPayloadToUpdateData(
        updateData,
        documentData,
        payloadValue,
        nestedMapping,
        match.path,
        match.value
      );
    } else {
      setUpdate(updateData, match.path, payloadValue);
    }
  }
}

function applyNameCollectionPayload(updateData, documentData, basePath, payload, mappingEntry) {
  const mappingWithDefault = {
    ...mappingEntry,
    mapping: mappingEntry.mapping ?? {
      name: "name",
      label: "label",
      title: "title",
      text: "text"
    }
  };

  applyCollectionPayload(updateData, documentData, basePath, payload, mappingWithDefault);
}

function applyTextCollectionPayload(updateData, documentData, basePath, payload, mappingEntry) {
  const mappingWithDefault = {
    ...mappingEntry,
    mapping: mappingEntry.mapping ?? {
      text: "text"
    }
  };

  applyCollectionPayload(updateData, documentData, basePath, payload, mappingWithDefault);
}

function applyPayloadToUpdateData(updateData, documentData, payload, mapping, basePath = "", sourceObject = documentData) {
  if (!payload || typeof payload !== "object") return;

  const activeMapping = effectiveMapping(mapping, sourceObject);

  for (const [payloadKey, payloadValue] of Object.entries(payload)) {
    if (isRootOriginalPayloadName(basePath, payloadKey)) {
      console.debug("Pominięto flags.babele.originalPayload.name; nazwa przedmiotu nie jest przełączana.");
      continue;
    }

    const mappingEntry = normalizeMappingEntry(activeMapping[payloadKey]);

    if (!mappingEntry) {
      console.debug(`Brak mapowania Babele dla pola originalPayload${basePath ? "." + basePath : ""}.${payloadKey}.`);
      continue;
    }

    const targetPath = joinPath(basePath, mappingEntry.path);

    if (mappingEntry.converter === "structured" || mappingEntry.converter === "document") {
      applyCollectionPayload(updateData, documentData, basePath, payloadValue, mappingEntry);
      continue;
    }

    if (mappingEntry.converter === "nameCollection") {
      applyNameCollectionPayload(updateData, documentData, basePath, payloadValue, mappingEntry);
      continue;
    }

    if (mappingEntry.converter === "textCollection") {
      applyTextCollectionPayload(updateData, documentData, basePath, payloadValue, mappingEntry);
      continue;
    }

    if (mappingEntry.mapping && payloadValue && typeof payloadValue === "object") {
      const childSource = getProperty(documentData, targetPath);
      applyPayloadToUpdateData(
        updateData,
        documentData,
        payloadValue,
        mappingEntry.mapping,
        targetPath,
        childSource
      );
      continue;
    }

    setUpdate(updateData, targetPath, payloadValue);
  }
}

function collectCurrentCollectionPayload(documentData, basePath, templatePayload, mappingEntry, fallbackIndexBase = 0) {
  const result = Array.isArray(templatePayload) ? [] : {};
  if (!templatePayload || typeof templatePayload !== "object") return result;

  const collectionPath = joinPath(basePath, mappingEntry.path);
  const nestedMapping = mappingEntry.mapping;
  const keys = mappingEntry.keys ?? (mappingEntry.key ? [mappingEntry.key] : undefined);
  const isArrayPayload = Array.isArray(templatePayload);
  const entries = isArrayPayload ? templatePayload.entries() : Object.entries(templatePayload);

  let index = 0;

  for (const [payloadKeyRaw, templateValue] of entries) {
    if (payloadKeyRaw === "$sort") continue;

    const payloadKey = String(payloadKeyRaw);
    const match = findCollectionEntryPath(
      documentData,
      collectionPath,
      payloadKey,
      templateValue,
      keys,
      fallbackIndexBase + index
    );

    index += 1;

    if (!match) continue;

    if (mappingEntry.valuePath && !isPlainObject(templateValue)) {
      result[payloadKeyRaw] = clonePlain(getProperty(match.value, mappingEntry.valuePath));
      continue;
    }

    if (nestedMapping && templateValue && typeof templateValue === "object") {
      result[payloadKeyRaw] = collectCurrentPayloadFromMapping(
        documentData,
        templateValue,
        nestedMapping,
        match.path,
        match.value
      );
    } else {
      result[payloadKeyRaw] = clonePlain(match.value);
    }
  }

  return result;
}

function collectCurrentPayloadFromMapping(documentData, templatePayload, mapping, basePath = "", sourceObject = documentData) {
  const result = {};
  if (!templatePayload || typeof templatePayload !== "object") return result;

  const activeMapping = effectiveMapping(mapping, sourceObject);

  for (const [payloadKey, templateValue] of Object.entries(templatePayload)) {
    if (isRootOriginalPayloadName(basePath, payloadKey)) {
      console.debug("Pominięto flags.babele.originalPayload.name; nazwa przedmiotu nie jest zapisywana do plPayload.");
      continue;
    }

    const mappingEntry = normalizeMappingEntry(activeMapping[payloadKey]);

    if (!mappingEntry) {
      console.debug(`Brak mapowania Babele dla pola originalPayload${basePath ? "." + basePath : ""}.${payloadKey}; nie zapisano lokalnego odpowiednika.`);
      continue;
    }

    if (mappingEntry.converter === "structured" || mappingEntry.converter === "document") {
      result[payloadKey] = collectCurrentCollectionPayload(
        documentData,
        basePath,
        templateValue,
        mappingEntry
      );
      continue;
    }

    if (mappingEntry.converter === "nameCollection") {
      result[payloadKey] = collectCurrentCollectionPayload(
        documentData,
        basePath,
        templateValue,
        {
          ...mappingEntry,
          mapping: mappingEntry.mapping ?? {
            name: "name",
            label: "label",
            title: "title",
            text: "text"
          }
        }
      );
      continue;
    }

    if (mappingEntry.converter === "textCollection") {
      result[payloadKey] = collectCurrentCollectionPayload(
        documentData,
        basePath,
        templateValue,
        {
          ...mappingEntry,
          mapping: mappingEntry.mapping ?? {
            text: "text"
          }
        }
      );
      continue;
    }

    const targetPath = joinPath(basePath, mappingEntry.path);

    if (mappingEntry.mapping && templateValue && typeof templateValue === "object") {
      const childSource = getProperty(documentData, targetPath);
      result[payloadKey] = collectCurrentPayloadFromMapping(
        documentData,
        templateValue,
        mappingEntry.mapping,
        targetPath,
        childSource
      );
      continue;
    }

    const currentValue = getProperty(documentData, targetPath);
    if (currentValue !== undefined) {
      result[payloadKey] = clonePlain(currentValue);
    }
  }

  return result;
}

async function resolveMapping(item, sourceId, fileMapping = null) {
  const babeleMapping = getMappingFromBabele(item);

  // Kolejność jest celowa:
  // 1. fallback D&D5e daje pola specyficzne dla lang-pl-dnd5;
  // 2. Babele daje mapowanie publicznie dostępne przez inspectMapping();
  // 3. mapping z pliku kompendium jest najbardziej konkretny.
  return mergeMappings(
    FALLBACK_ITEM_MAPPING,
    babeleMapping,
    fileMapping
  );
}

async function changeTranslation(document) {
  try {
    const item = document.actor ? document.actor.items.get(document.id) : document;

    if (!item) {
      ui.notifications.warn("Nie można ustalić przedmiotu.");
      return;
    }

    const isUnidentified = item.system?.identification?.status === "unidentified";
    if (isUnidentified) {
      ui.notifications.warn("Przedmiot jest niezidentyfikowany.");
      return;
    }

    const originalPayload = getOriginalPayload(item);
    const sourceId = getItemSourceId(item, document);

    if (!originalPayload && !sourceId) {
      ui.notifications.warn("Nie można przetłumaczyć przedmiotu (brak originalPayload i źródła kompendium).");
      return;
    }

    const currentLang = await item.getFlag("dnd5e_pl", "lang")
    || item.flags?.babele?.lang
    || "pl";

    const targetLang = currentLang === "pl" ? "en" : "pl";

    let translationEntry = null;
    let fileMapping = null;
    let storedPayload = null;

    if (targetLang === "pl") {
      storedPayload = await item.getFlag("dnd5e_pl", "plPayload");

      if (!storedPayload && sourceId) {
        const result = await getTranslationEntryAndMapping(item, sourceId, "pl");
        translationEntry = result.entry;
        fileMapping = result.mapping;
      }
    } else if (sourceId) {
      // Dla EN najczęściej wystarcza originalPayload + fallback mapping.
      // Jeżeli plik PL istnieje, jego mapping rozszerzy obsługę pól specyficznych
      // dla danego kompendium. Brak pliku nie blokuje przełączenia.
      const data = await getTranslationFileData(sourceId, "pl");
      fileMapping = data?.mapping ?? null;
    }

    const mapping = await resolveMapping(item, sourceId, fileMapping);

    let targetPayload = null;

    if (targetLang === "en") {
      if (originalPayload && typeof originalPayload === "object") {
        const documentData = getDocumentData(item);
        const currentPayload = collectCurrentPayloadFromMapping(
          documentData,
          originalPayload,
          mapping
        );

        await item.setFlag("dnd5e_pl", "plPayload", currentPayload);
        targetPayload = originalPayload;
      }

      if (!targetPayload && sourceId) {
        const result = await getTranslationEntryAndMapping(item, sourceId, "en");
        targetPayload = result.entry;
        fileMapping = fileMapping ?? result.mapping;
      }
    } else {
      targetPayload = storedPayload || translationEntry;
    }

    if (!targetPayload || typeof targetPayload !== "object") {
      ui.notifications.warn(`Nie znaleziono danych przedmiotu (${targetLang.toUpperCase()}).`);
      return;
    }

    const documentData = getDocumentData(item);
    const updateData = {};
    applyPayloadToUpdateData(updateData, documentData, targetPayload, mapping);

    if (!Object.keys(updateData).length) {
      ui.notifications.warn(`Nie znaleziono pól do podmiany (${targetLang.toUpperCase()}).`);
      return;
    }

    await item.update(updateData);
    await item.setFlag("dnd5e_pl", "lang", targetLang);

    const langName = targetLang === "pl" ? "polski" : "angielski";
    ui.notifications.info(`Przełączono przedmiot na język ${langName}.`);
  } catch (error) {
    console.error(error);
    ui.notifications.error("Błąd podczas zmiany tłumaczenia!");
  }
}
