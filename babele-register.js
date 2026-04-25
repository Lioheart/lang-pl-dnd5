import { Translator } from "./scripts/translator.js";
import { Converters as babeleConverters } from "../babele/script/converter/converters.js";

Hooks.once("init", () => {
    game.settings.register("dnd5e_pl", "dual-language-names", {
        name: "Wyświetl nazwy po polsku i angielsku",
        hint: "Oprócz nazwy polskiej wyświetlaj nazwę oryginalną (o ile się różni).",
        scope: "world",
        type: Boolean,
        default: true,
        config: true
    });

    game.settings.register("dnd5e_pl", "changeTranslation", {
        name: "Zmień opis",
        hint: "Wyświetla na kartach przedmiotów przycisk, który pozwala podejrzeć oryginalną treść opisu.",
        scope: "world",
        type: Boolean,
        default: true,
        config: true,
        restricted: true,
        requiresReload: true
    });

    game.dnd5e_pl = Translator.get();
});

Hooks.once("babele.init", (babele) => {
    babele.register({
        module: "dnd5e_pl",
        lang: "pl",
        dir: "lang/pl/compendium"
    });

    babele.registerConverters({
        "items": babeleConverters.fromDefaultMapping("Item", "items"),

        "alignment": Dnd5ePlConverters.mergeOrReplace(),
        "travel": Dnd5ePlConverters.mergeOrReplace(),
        "tokenLight": Dnd5ePlConverters.mergeOrReplace(),

        // Nie dodawaj tego, jeśli zgodnie z poprzednią decyzją usuwasz planarSubtype z JSON-ów.
        // Jeśli jednak zostaje w aktualnych plikach repo, musi istnieć konwerter:
        // "planarSubtype": Dnd5ePlConverters.mergeOrReplace(),

        "range": Dnd5ePlConverters.imperialToMetric("range"),
        "weight": Dnd5ePlConverters.imperialToMetric("weight"),
        "target": Dnd5ePlConverters.imperialToMetric("target"),
        "senses": Dnd5ePlConverters.imperialToMetric("senses"),
        "volume": Dnd5ePlConverters.imperialToMetric("volume"),
        "movement": Dnd5ePlConverters.imperialToMetric("movement"),
        "sightRange": Dnd5ePlConverters.imperialToMetric("sightRange"),
        "communication": Dnd5ePlConverters.imperialToMetric("communication"),
        "rangeActivities": Dnd5ePlConverters.imperialToMetric("rangeActivities"),
        "distanceAdvancement": Dnd5ePlConverters.imperialToMetric("distanceAdvancement"),

        "pages": Dnd5ePlConverters.pages(),
        "effects": Dnd5ePlConverters.effects(),
        "activities": Dnd5ePlConverters.activities(),
        "advancement": Dnd5ePlConverters.advancement(),
        "translateAdvancement": (data, translation) => {
            return game.dnd5e_pl.translateAdvancement(data, translation);
        }
    });
});

class Dnd5ePlConverters {
    static mergeOrReplace() {
        return (data, translation) => {
            if (translation === undefined || translation === null) return data;

            const cloned = foundry.utils.deepClone(data);

            if (
                cloned
                && typeof cloned === "object"
                && !Array.isArray(cloned)
                && typeof translation === "object"
                && !Array.isArray(translation)
            ) {
                return foundry.utils.mergeObject(cloned, translation, {
                    inplace: false,
                    overwrite: true
                });
            }

            return translation;
        };
    }

    static imperialToMetric(field) {
        return (data, translation) => {
            if (!translation) return data;

            const original = foundry.utils.deepClone(data);
            const value = translation?.[field] ?? translation;

            if (value === undefined || value === null) return original;

            foundry.utils.setProperty(original, field, value);
            return original;
        };
    }

    static pages() {
        return (pages, translations) => {
            if (!Array.isArray(pages) || !translations) return pages;

            return pages.map((page, index) => {
                const translation =
                    translations?.[page.name]
                    ?? translations?.[page._id]
                    ?? translations?.[index];

                if (!translation) return page;

                return foundry.utils.mergeObject(
                    foundry.utils.deepClone(page),
                    translation,
                    { inplace: false, overwrite: true }
                );
            });
        };
    }

    static effects() {
        return (effects, translations) => {
            if (!Array.isArray(effects) || !translations) return effects;

            return effects.map((effect, index) => {
                const translation =
                    translations?.[effect.name]
                    ?? translations?.[effect._id]
                    ?? translations?.[index];

                if (!translation) return effect;

                return foundry.utils.mergeObject(
                    foundry.utils.deepClone(effect),
                    translation,
                    { inplace: false, overwrite: true }
                );
            });
        };
    }

    static activities() {
        return (activities, translations) => {
            if (!activities || !translations) return activities;

            const cloned = foundry.utils.deepClone(activities);

            for (const [translationKey, translation] of Object.entries(translations)) {
                let activityKey = translationKey;

                if (!cloned[activityKey]) {
                    activityKey = Object.entries(cloned).find(
                        ([, activity]) => activity?.name === translationKey
                    )?.[0];
                }

                if (!activityKey || !cloned[activityKey]) continue;

                foundry.utils.mergeObject(cloned[activityKey], translation, {
                    inplace: true,
                    overwrite: true
                });
            }

            return cloned;
        };
    }

    static advancement() {
        return (data, translation) => {
            return game.dnd5e_pl?.translateAdvancement(data, translation) ?? data;
        };
    }
}