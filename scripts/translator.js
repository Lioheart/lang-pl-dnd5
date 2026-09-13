// import { CompendiumMapping } from "../../babele/script/compendium-mapping.js";

// Create Translator instance and register settings
Hooks.once("init", () => {
    game.dnd5e_pl = Translator.get();
});

export class Translator {
    static get() {
        if (!Translator.instance) {
            Translator.instance = new Translator();
        }
        return Translator.instance;
    }

    // Initialize translator
    async initialize() {
        const config = await Promise.all([
            fetch("modules/dnd5e_pl/scripts/translator-config.json")
                .then((r) => r.json())
                .catch((_e) => {
                    console.error("dnd5e_pl: Couldn't find translator config file.");
                }),
        ]);

        this.mappings = config[0]?.mappings ?? {};

        // Signalize translator is ready
        Hooks.callAll("dnd5e_pl.ready");
    }

    constructor() {
        this.initialize();
    }

    // Get mapping
    getMapping(mapping, compendium = false) {
        return this.mappings?.[mapping] ?? {};
    }

    // Merge an object using a provided field mapping
    dynamicMerge(sourceObject, translation, mapping) {
        if (translation) {
            mergeObject(sourceObject, mapping.map(sourceObject, translation ?? {}), { overwrite: true });
        }
        return sourceObject;
    }

    // Merge an array of objects using a provided field mapping
    dynamicArrayMerge(sourceArray, translations, mapping) {
        // Loop through array, merge available objects
        const mappedObjectArray = [];
        for (let i = 0; i < sourceArray.length; i++) {
            if (translations[i]) {
                mappedObjectArray.push(this.dynamicMerge(sourceArray[i], translations[i], mapping));
            } else {
                mappedObjectArray.push(sourceArray[i]);
            }
        }
        return mappedObjectArray;
    }

    // Merge an object list using a provided field mapping


    // Translate text labels provided in rule elements
    translateAdvancement(data, translation) {
        if (!Array.isArray(data)) return data;

        return data.map((entry, index) => {
            const translated =
                translation?.[entry.title]
                ?? translation?.[entry._id]
                ?? translation?.[index];

            if (!translated) return entry;

            const updated = foundry.utils.deepClone(entry);

            if (typeof translated.title === "string") {
                updated.title = translated.title;
            }

            if (typeof translated.hint === "string") {
                updated.hint = translated.hint;
            }

            if (Array.isArray(updated.configuration?.choices)) {
                const translatedChoices = translated.choices ?? translated.configuration?.choices;

                if (Array.isArray(translatedChoices)) {
                    updated.configuration.choices = updated.configuration.choices.map((choice, choiceIndex) => {
                        const translatedChoice =
                            translatedChoices?.[choiceIndex]
                            ?? translatedChoices?.find?.((candidate) => candidate?.value === choice.value);

                        if (translatedChoice?.title) {
                            return { ...choice, title: translatedChoice.title };
                        }

                        return choice;
                    });
                }
            }

            return updated;
        });
    }
}