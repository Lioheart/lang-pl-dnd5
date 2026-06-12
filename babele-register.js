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
        "nameCollection": Dnd5ePlConverters.nameCollection(),

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
        "activities": Dnd5ePlConverters.activities()
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

    static nameCollection() {
        return (data, translations) => {
            if (!data || !translations) return data;

            const cloned = foundry.utils.deepClone(data);

            if (Array.isArray(cloned)) {
                for (const [translationKey, translation] of Object.entries(translations)) {
                    const item = cloned.find(entry =>
                        entry?._id === translationKey
                        || entry?.name === translationKey
                        || entry?.type === translationKey
                    );

                    if (!item) continue;

                    if (typeof translation === "string") {
                        item.name = translation;
                    } else if (translation && typeof translation === "object") {
                        foundry.utils.mergeObject(item, translation, {
                            inplace: true,
                            overwrite: true
                        });
                    }
                }

                return cloned;
            }

            if (typeof cloned === "object") {
                for (const [translationKey, translation] of Object.entries(translations)) {
                    const key = cloned[translationKey]
                        ? translationKey
                        : Object.entries(cloned).find(([, value]) =>
                            value?._id === translationKey
                            || value?.name === translationKey
                            || value?.type === translationKey
                        )?.[0];

                    if (!key || !cloned[key]) continue;

                    if (typeof translation === "string") {
                        cloned[key].name = translation;
                    } else if (translation && typeof translation === "object") {
                        foundry.utils.mergeObject(cloned[key], translation, {
                            inplace: true,
                            overwrite: true
                        });
                    }
                }

                return cloned;
            }

            return data;
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
            if (
                !Array.isArray(data)
                || translations === undefined
                || translations === null
            ) {
                return data;
            }

            const hasOwn = (object, key) => (
                object
                && key !== undefined
                && key !== null
                && Object.prototype.hasOwnProperty.call(object, key)
            );

            const findTranslation = (entry, index) => {
                if (Array.isArray(translations)) {
                    return translations.find((candidate) => (
                        candidate
                        && typeof candidate === "object"
                        && (
                            (
                                entry?._id
                                && (
                                    candidate._id === entry._id
                                    || candidate.id === entry._id
                                )
                            )
                            || (
                                entry?.title
                                && candidate.sourceTitle === entry.title
                            )
                        )
                    )) ?? translations[index];
                }

                if (
                    !translations
                    || typeof translations !== "object"
                ) {
                    return undefined;
                }

                /*
                 * _id jest stabilniejszy od title.
                 *
                 * Obsługa title pozostaje potrzebna dla istniejących plików,
                 * w których advancement jest kluczowane oryginalnym tytułem,
                 * np. "Rages" albo "Background Proficiencies".
                 */
                const candidates = [
                    entry?._id,
                    entry?.title,
                    String(index)
                ];

                for (const key of candidates) {
                    if (key && hasOwn(translations, key)) {
                        return translations[key];
                    }
                }

                return undefined;
            };

            const findChoiceTranslation = (
                choice,
                choiceIndex,
                translatedChoices
            ) => {
                if (!translatedChoices) return undefined;

                if (Array.isArray(translatedChoices)) {
                    return translatedChoices.find((candidate) => (
                        candidate
                        && typeof candidate === "object"
                        && (
                            (
                                choice?._id
                                && (
                                    candidate._id === choice._id
                                    || candidate.id === choice._id
                                )
                            )
                            || (
                                choice?.value !== undefined
                                && candidate.value === choice.value
                            )
                        )
                    )) ?? translatedChoices[choiceIndex];
                }

                if (typeof translatedChoices !== "object") {
                    return undefined;
                }

                const candidates = [
                    choice?._id,
                    choice?.id,
                    choice?.value,
                    choice?.label,
                    choice?.title,
                    String(choiceIndex)
                ];

                for (const key of candidates) {
                    if (
                        key !== undefined
                        && key !== null
                        && hasOwn(translatedChoices, key)
                    ) {
                        return translatedChoices[key];
                    }
                }

                return undefined;
            };

            const applyChoiceTranslation = (
                choice,
                translation
            ) => {
                if (typeof translation === "string") {
                    return {
                        ...choice,
                        label: translation,
                        title: translation
                    };
                }

                if (
                    !translation
                    || typeof translation !== "object"
                ) {
                    return choice;
                }

                const updatedChoice = { ...choice };

                for (
                    const key of [
                        "label",
                        "title",
                        "hint",
                        "description"
                    ]
                ) {
                    if (typeof translation[key] === "string") {
                        updatedChoice[key] = translation[key];
                    }
                }

                return updatedChoice;
            };

            return data.map((entry, index) => {
                const translation = findTranslation(entry, index);
                const updated = foundry.utils.deepClone(entry);

                if (
                    translation
                    && typeof translation === "object"
                ) {
                    if (typeof translation.title === "string") {
                        updated.title = translation.title;
                    }

                    if (typeof translation.hint === "string") {
                        updated.hint = translation.hint;
                    }

                    const translatedChoices = (
                        translation.choices
                        ?? translation.configuration?.choices
                    );

                    if (
                        Array.isArray(
                            updated.configuration?.choices
                        )
                        && translatedChoices
                    ) {
                        updated.configuration.choices =
                            updated.configuration.choices.map(
                                (choice, choiceIndex) =>
                                    applyChoiceTranslation(
                                        choice,
                                        findChoiceTranslation(
                                            choice,
                                            choiceIndex,
                                            translatedChoices
                                        )
                                    )
                            );
                    } else if (
                        updated.configuration?.choices
                        && typeof updated.configuration.choices
                        === "object"
                        && translatedChoices
                    ) {
                        const choiceEntries = Object.entries(
                            updated.configuration.choices
                        );

                        updated.configuration.choices =
                            Object.fromEntries(
                                choiceEntries.map(
                                    (
                                        [choiceKey, choice],
                                        choiceIndex
                                    ) => [
                                            choiceKey,
                                            applyChoiceTranslation(
                                                choice,
                                                (
                                                    typeof translatedChoices
                                                    === "object"
                                                    && !Array.isArray(
                                                        translatedChoices
                                                    )
                                                    && hasOwn(
                                                        translatedChoices,
                                                        choiceKey
                                                    )
                                                )
                                                    ? translatedChoices[
                                                    choiceKey
                                                    ]
                                                    : findChoiceTranslation(
                                                        choice,
                                                        choiceIndex,
                                                        translatedChoices
                                                    )
                                            )
                                        ]
                                )
                            );
                    }
                }

                /*
                 * Zachowanie konwersji ScaleValue, która wcześniej
                 * znajdowała się w mappingu structured.
                 */
                if (
                    updated.type === "ScaleValue"
                    && updated.configuration?.type === "distance"
                ) {
                    const convert =
                        Dnd5ePlConverters.imperialToMetric();

                    if (updated.configuration.distance) {
                        updated.configuration.distance = convert(
                            updated.configuration.distance
                        );
                    }

                    if (
                        updated.configuration.scale
                        && typeof updated.configuration.scale
                        === "object"
                    ) {
                        updated.configuration.scale =
                            Object.fromEntries(
                                Object.entries(
                                    updated.configuration.scale
                                ).map(([level, value]) => [
                                    level,
                                    value
                                        && typeof value === "object"
                                        ? convert(value)
                                        : value
                                ])
                            );
                    }
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