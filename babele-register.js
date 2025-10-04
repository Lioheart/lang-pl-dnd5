import { Translator } from "./scripts/translator.js";

Hooks.once('init', () => {
    if (typeof Babele !== 'undefined') {
        game.settings.register("lang-pl-dnd5", "dual-language-names", {
            name: "Wyświetl nazwy po polsku i angielsku",
            hint: 'Oprócz nazwy polskiej wyświetlaj nazwę oryginalną (o ile się różni).',
            scope: "world",
            type: Boolean,
            default: true,
            config: true,
        });
        game.settings.register("lang-pl-dnd5", "changeTranslation", {
            name: "Zmień opis",
            hint: 'Wyświetla na kartach przedmiotów przycisk, który pozwala podejrzeć oryginalną treść opisu.',
            scope: "world",
            type: Boolean,
            default: true,
            config: true,
            restricted: true,            
            requiresReload: true,
        });
        game.babele.register({
            module: 'lang-pl-dnd5',
            lang: 'pl',
            dir: 'lang/pl/compendium'
        });
    }

    game.dnd5e_pl = Translator.get();
    game.babele.registerConverters({
        translateAdvancement: (data, translation) => {
            return game.dnd5e_pl.translateAdvancement(data, translation);
        },
    });
});

Hooks.on("preCreateItem", (item, context) => {
    const sourceId =
        context?.fromCompendium?.uuid ||
        item.flags?.core?.sourceId ||
        item._stats?.compendiumSource ||
        item._source?._stats?.compendiumSource;

    if (!sourceId) return;

    item.updateSource({
        "flags.lang-pl-dnd5.id": sourceId
    });
});


Hooks.on("renderCompendiumDirectory", (app, html) => {
    const root = html[0] ?? html; // wsparcie dla v12 i v13

    const searchInput = root.querySelector('input[name="search"]');
    const originalList = root.querySelector("ol.directory-list");
    if (!searchInput || !originalList) return;

    const resultsContainer = document.createElement("ol");
    resultsContainer.id = "search-results";
    resultsContainer.className = "directory-list plain";
    resultsContainer.style.display = "none";

    originalList.insertAdjacentElement("afterend", resultsContainer);

    searchInput.addEventListener("input", async function () {
        const query = this.value.trim().toLowerCase();
        resultsContainer.innerHTML = "";

        if (!query) {
            resultsContainer.style.display = "none";
            originalList.style.display = "";
            return;
        }

        const results = [];

        for (const pack of game.packs) {
            if (pack.metadata?.system !== "dnd5e") continue;

            const index = await pack.getIndex();
            const filtered = index.filter(entry => {
                const originalName = entry.flags?.babele?.originalName || "";
                return entry.name.toLowerCase().includes(query) || originalName.toLowerCase().includes(query);
            });

            results.push(...filtered.map(entry => ({
                name: entry.name,
                originalName: entry.flags?.babele?.originalName || null,
                pack: pack.collection,
                uuid: `Compendium.${pack.collection}.${entry._id}`,
                packTitle: pack.metadata.label,
                img: entry.img || "icons/svg/book.svg"
            })));
        }

        originalList.style.display = "none";
        resultsContainer.style.display = "";

        if (results.length > 0) {
            results.forEach(item => {
                const listItem = document.createElement("li");
                listItem.className = "match";
                listItem.dataset.pack = item.pack;
                listItem.draggable = true;

                listItem.innerHTML = `
                    <div class="thumbnail">
                        <img src="${item.img}" class="item-icon">
                    </div>
                    <a class="match-name">${item.name}</a>
                    <span class="compendium-source">${item.packTitle}</span>
                `;

                listItem.addEventListener("click", () => {
                    fromUuid(item.uuid).then(entity => entity?.sheet?.render(true));
                });

                resultsContainer.appendChild(listItem);
            });
        } else {
            resultsContainer.innerHTML = `
                <li class="directory-item" style="padding: 5px 10px;">
                    <h3>Brak wyników</h3>
                </li>
            `;
        }
    });
});

