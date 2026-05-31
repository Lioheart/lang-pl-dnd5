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
        // Konwertery zgodne z płaskimi plikami kompendium w stylu repozytorium francuskiego.
        "tokens": Dnd5ePlConverters.tokens(),
        "alignment": Dnd5ePlConverters.mergeOrReplace(),
        "travel": Dnd5ePlConverters.mergeOrReplace(),
        "tokenLight": Dnd5ePlConverters.imperialToMetric(),
        "effectsChanges": Dnd5ePlConverters.effectsChanges(),
        "tableResultRange": Dnd5ePlConverters.tableResultRange(),
        "imperialToMetric": Dnd5ePlConverters.imperialToMetric(),

        // Konwertery zachowane dla starszych lub mieszanych plików z sekcją mapping.
        "items": babeleConverters.fromDefaultMapping("Item", "items"),
        "text": Dnd5ePlConverters.text(),
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
        "translateAdvancement": Dnd5ePlConverters.advancement()
    });
});

class Dnd5ePlConverters {
    static text() {
        return (data, translation) => translation ?? data;
    }

    static mergeOrReplace() {
        return (data, translation) => {
            if (translation === undefined || translation === null) return data;

            if (
                data
                && typeof data === "object"
                && !Array.isArray(data)
                && translation
                && typeof translation === "object"
                && !Array.isArray(translation)
            ) {
                return foundry.utils.mergeObject(foundry.utils.deepClone(data), translation, {
                    inplace: false,
                    overwrite: true
                });
            }

            return translation;
        };
    }

    static byNameIdOrIndex(collection, translations, index, document = null) {
        if (!translations) return undefined;
        if (document?._id && translations?.[document._id]) return translations[document._id];
        if (document?.name && translations?.[document.name]) return translations[document.name];
        if (translations?.[index]) return translations[index];
        return undefined;
    }

    static convertMetricLength() {
        return game.settings.get("dnd5e", "metricLengthUnits");
    }

    static convertMetricWeight() {
        return game.settings.get("dnd5e", "metricWeightUnits");
    }

    static convertMetricVolume() {
        return game.settings.get("dnd5e", "metricVolumeUnits");
    }

    static round(num) {
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }

    static feetToMeters(value) {
        if (!Dnd5ePlConverters.convertMetricLength() || value === null || value === undefined || isNaN(parseFloat(value))) return value;
        return Dnd5ePlConverters.round(parseFloat(value) * 0.3);
    }

    static milesToKilometers(value) {
        if (!Dnd5ePlConverters.convertMetricLength() || value === null || value === undefined || isNaN(parseFloat(value))) return value;
        return Dnd5ePlConverters.round(parseFloat(value) * 1.5);
    }

    static poundsToKilograms(value) {
        if (!Dnd5ePlConverters.convertMetricWeight() || value === null || value === undefined || isNaN(parseFloat(value))) return value;
        return Dnd5ePlConverters.round(parseFloat(value) / 2);
    }

    static cubicFeetToLiters(value) {
        if (!Dnd5ePlConverters.convertMetricVolume() || value === null || value === undefined || isNaN(parseFloat(value))) return value;
        return Dnd5ePlConverters.round(parseFloat(value) * 28.317);
    }

    static conversionInfo(units) {
        const info = {
            "ft": {
                converter: Dnd5ePlConverters.feetToMeters,
                units: Dnd5ePlConverters.convertMetricLength() ? "m" : "ft"
            },
            "mi": {
                converter: Dnd5ePlConverters.milesToKilometers,
                units: Dnd5ePlConverters.convertMetricLength() ? "km" : "mi"
            },
            "mph": {
                converter: Dnd5ePlConverters.milesToKilometers,
                units: Dnd5ePlConverters.convertMetricLength() ? "kph" : "mph"
            },
            "lb": {
                converter: Dnd5ePlConverters.poundsToKilograms,
                units: Dnd5ePlConverters.convertMetricWeight() ? "kg" : "lb"
            },
            "cubicFoot": {
                converter: Dnd5ePlConverters.cubicFeetToLiters,
                units: Dnd5ePlConverters.convertMetricVolume() ? "liter" : "cubicFoot"
            }
        };
        return info[units];
    }

    static imperialToMetric(field = null) {
        return (data, translation) => {
            if (field) {
                const original = foundry.utils.deepClone(data);
                const value = translation?.[field] ?? translation;
                if (value === undefined || value === null) return original;
                foundry.utils.setProperty(original, field, value);
                return original;
            }

            const value = foundry.utils.deepClone(data);
            if (!value || typeof value !== "object") return translation ?? value;

            const units = value.units ?? value.template?.units ?? "ft";
            const conversion = Dnd5ePlConverters.conversionInfo(units);
            const converted = {};

            if (conversion) {
                for (const key of ["value", "long", "reach", "distance", "burrow", "climb", "swim", "walk", "fly", "bright", "dim", "range"])
                    if (value[key] !== undefined && value[key] !== null) converted[key] = conversion.converter(value[key]);

                if (value.units) converted.units = conversion.units;

                if (value.template) {
                    converted.template = foundry.utils.deepClone(value.template);
                    for (const key of ["size", "height", "width"])
                        if (converted.template[key] !== undefined && converted.template[key] !== null) converted.template[key] = conversion.converter(converted.template[key]);
                    converted.template.units = conversion.units;
                }

                if (value.ranges) {
                    converted.ranges = foundry.utils.deepClone(value.ranges);
                    for (const key of ["darkvision", "blindsight", "tremorsense", "truesight"])
                        if (converted.ranges[key] !== undefined && converted.ranges[key] !== null) converted.ranges[key] = conversion.converter(converted.ranges[key]);
                }

                if (value.paces) {
                    converted.paces = foundry.utils.deepClone(value.paces);
                    for (const key of ["air", "land", "water"])
                        if (converted.paces[key] !== undefined && converted.paces[key] !== null) converted.paces[key] = conversion.converter(converted.paces[key]);
                }

                if (value.speeds) {
                    converted.speeds = foundry.utils.deepClone(value.speeds);
                    for (const key of ["air", "land", "water"])
                        if (converted.speeds[key] !== undefined && converted.speeds[key] !== null) converted.speeds[key] = conversion.converter(converted.speeds[key]);
                }
            }

            if (translation && value?.affects?.special) converted.affects = { ...value.affects, special: translation };
            if (translation && value?.special) converted.special = translation;

            return Object.keys(converted).length
                ? foundry.utils.mergeObject(value, converted, { inplace: false, overwrite: true })
                : value;
        };
    }

    static pages() {
        return (pages, translations) => {
            if (!Array.isArray(pages) || !translations) return pages;

            return pages.map((page, index) => {
                const translation = Dnd5ePlConverters.byNameIdOrIndex(pages, translations, index, page);
                if (!translation) return page;

                const updated = foundry.utils.deepClone(page);
                if (typeof translation.name === "string") updated.name = translation.name;
                if (typeof translation.text === "string") foundry.utils.setProperty(updated, "text.content", translation.text);
                if (translation.text && typeof translation.text === "object") {
                    updated.text = foundry.utils.mergeObject(updated.text ?? {}, translation.text, { inplace: false, overwrite: true });
                }
                return updated;
            });
        };
    }

    static effects() {
        return (effects, translations) => {
            if (!Array.isArray(effects) || !translations) return effects;

            return effects.map((effect, index) => {
                const translation = Dnd5ePlConverters.byNameIdOrIndex(effects, translations, index, effect);
                if (!translation) return effect;

                const updated = foundry.utils.deepClone(effect);
                if (typeof translation.name === "string") updated.name = translation.name;
                if (typeof translation.description === "string") updated.description = translation.description;

                if (translation.changes && Array.isArray(updated.changes)) {
                    updated.changes = Dnd5ePlConverters.effectsChanges()(updated.changes, translation.changes);
                }

                return foundry.utils.mergeObject(updated, translation, {
                    inplace: false,
                    overwrite: true
                });
            });
        };
    }

    static effectsChanges() {
        return (changes, translations) => {
            if (!Array.isArray(changes)) return changes;

            const converted = changes.map((change, index) => {
                const updated = foundry.utils.deepClone(change);
                const value = String(updated.value ?? "");

                const movementAndSenseKeys = [
                    "system.attributes.movement.burrow",
                    "system.attributes.movement.climb",
                    "system.attributes.movement.fly",
                    "system.attributes.movement.swim",
                    "system.attributes.movement.walk",
                    "system.attributes.senses.ranges.blindsight",
                    "system.attributes.senses.ranges.darkvision",
                    "system.attributes.senses.ranges.tremorsense",
                    "system.attributes.senses.ranges.truesight",
                    "system.attributes.senses.blindsight",
                    "system.attributes.senses.darkvision",
                    "system.attributes.senses.tremorsense",
                    "system.attributes.senses.truesight"
                ];

                if (updated.mode !== 1 && movementAndSenseKeys.includes(updated.key)) {
                    if (value.startsWith("+") || value.startsWith("-")) updated.value = `${value[0]}${Dnd5ePlConverters.feetToMeters(value.substring(1))}`;
                    else updated.value = Dnd5ePlConverters.feetToMeters(value);
                }

                if (updated.mode !== 1 && ["system.range.value", "system.range.long"].includes(updated.key)) {
                    if (parseInt(value)) updated.value = Dnd5ePlConverters.feetToMeters(value);
                }

                const translation = Array.isArray(translations) ? translations[index] : translations?.[index] ?? translations?.[updated.key];
                if (translation !== undefined && translation !== null) updated.value = translation?.value ?? translation;
                return updated;
            });

            return converted;
        };
    }

    static activities() {
        return (activities, translations) => {
            if (!activities || !translations || typeof activities !== "object") return activities;

            const updated = foundry.utils.deepClone(activities);

            for (const [translationKey, translation] of Object.entries(translations)) {
                let activityKey = updated[translationKey] ? translationKey : undefined;

                if (!activityKey) {
                    activityKey = Object.entries(updated).find(([, activity]) => activity?.name === translationKey)?.[0];
                }

                if (!activityKey || !updated[activityKey]) continue;
                const activity = updated[activityKey];

                if (typeof translation.name === "string") activity.name = translation.name;
                if (typeof translation.condition === "string") foundry.utils.setProperty(activity, "activation.condition", translation.condition);
                if (typeof translation.chatFlavor === "string") foundry.utils.setProperty(activity, "description.chatFlavor", translation.chatFlavor);
                if (typeof translation.target === "string") foundry.utils.setProperty(activity, "target.affects.special", translation.target);
                if (typeof translation.range === "string") foundry.utils.setProperty(activity, "range.special", translation.range);
                if (typeof translation.roll === "string") foundry.utils.setProperty(activity, "roll.name", translation.roll);

                if (translation.profiles && activity.profiles) {
                    for (const [profileKey, profileTranslation] of Object.entries(translation.profiles)) {
                        let profile = activity.profiles[profileKey];
                        if (!profile && Array.isArray(activity.profiles)) profile = activity.profiles.find(p => p?.name === profileKey);
                        if (!profile) continue;

                        if (typeof profileTranslation === "string") profile.name = profileTranslation;
                        else if (typeof profileTranslation?.name === "string") profile.name = profileTranslation.name;
                    }
                }
            }

            return updated;
        };
    }

    static advancement() {
        return (data, translations) => {
            if (!Array.isArray(data) || !translations) return data;

            return data.map((entry, index) => {
                const translation = translations?.[entry.title] ?? translations?.[entry._id] ?? translations?.[index];
                if (!translation) return entry;

                const updated = foundry.utils.deepClone(entry);
                if (typeof translation.title === "string") updated.title = translation.title;
                if (typeof translation.hint === "string") updated.hint = translation.hint;

                const translatedChoices = translation.choices ?? translation.configuration?.choices;
                if (Array.isArray(updated.configuration?.choices) && translatedChoices) {
                    updated.configuration.choices = updated.configuration.choices.map((choice, choiceIndex) => {
                        const translatedChoice = Array.isArray(translatedChoices)
                            ? translatedChoices[choiceIndex] ?? translatedChoices.find(candidate => candidate?.value === choice.value)
                            : translatedChoices?.[choice.value] ?? translatedChoices?.[choice.label] ?? translatedChoices?.[choiceIndex];

                        if (typeof translatedChoice === "string") return { ...choice, label: translatedChoice, title: translatedChoice };
                        if (translatedChoice?.label || translatedChoice?.title) return {
                            ...choice,
                            label: translatedChoice.label ?? choice.label,
                            title: translatedChoice.title ?? choice.title
                        };
                        return choice;
                    });
                }

                return updated;
            });
        };
    }

    static tableResultRange() {
        return (range, translation) => translation ?? range;
    }

    static tokens() {
        return (tokens, translations) => {
            if (!Array.isArray(tokens) || !translations) return tokens;

            return tokens.map((token, index) => {
                const translation = translations?.[token._id] ?? translations?.[token.name] ?? translations?.[index];
                if (!translation) return token;

                const updated = foundry.utils.deepClone(token);
                if (typeof translation.name === "string") updated.name = translation.name;

                if (translation.delta && updated.delta) {
                    updated.delta = foundry.utils.mergeObject(updated.delta, translation.delta, {
                        inplace: false,
                        overwrite: true
                    });
                }

                if (updated.light) updated.light = Dnd5ePlConverters.imperialToMetric()(updated.light);
                if (updated.sight) updated.sight = Dnd5ePlConverters.imperialToMetric()(updated.sight);

                return updated;
            });
        };
    }
}