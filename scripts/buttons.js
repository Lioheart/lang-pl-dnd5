// Przyciski na
// - Zmianę opisu na en i pl

// Przycisk "Zmień Opis", który pozwala na podejrzenie angielskiego opisu
Hooks.on("ready", injectHeaderTranslationButtonItem)

async function injectHeaderTranslationButtonItem(sheet, buttons) {
  // Sprawdź, czy opcja jest włączona w ustawieniach
  if (!game.settings.get("lang-pl-dnd5", "changeTranslation")) return;

  Hooks.on("renderItemSheet5e", (sheet, html, data) => {
    const header = html.querySelector(".window-header .window-title");
    if (!header) return;

    // Sprawdź, czy przycisk już istnieje
    const existing = html.querySelector(".header-control[data-action='translate']");
    if (existing) return;

    const item = sheet.document;

    // Stwórz nowy przycisk
    const button = document.createElement("button");
    button.className = "header-control";
    button.setAttribute("data-action", "translate");
    button.setAttribute("data-tooltip", "Zmień opis");
    button.innerHTML = `<i class="fa fa-language"></i>`;
    button.addEventListener("click", () => changeTranslation(item, buttons, sheet));

    header.insertAdjacentElement("afterend", button);
  });

  // const document = sheet.item ?? sheet.object;
  // if (!(document instanceof foundry.abstract.Document)) throw new Error('Could not locate sheet\'s document!!!');
  // const button = {
  //   class: 'data-translator',
  //   icon: 'fa fa-language',
  //   label: "Zmień opis",
  //   onclick: _ => changeTranslation(document, buttons, sheet),
  // };
  // buttons.unshift(button);
}

async function changeTranslation(document) {
  try {
    const isFromActor = !!document.actor;
    const item = isFromActor ? document.actor.items.get(document.id) : document;

    const isUnidentified = item.system?.identification?.status === "unidentified";
    if (isUnidentified) {
      ui.notifications.warn("Przedmiot jest niezdentyfikowany");
      return;
    }

    // Używamy ID przedmiotu zamiast oryginalnej nazwy
    const itemId = item.flags?.dnd5e_pl?.id;
    if (!itemId) {
      ui.notifications.warn("Nie można przetłumaczyć opisu (brak ID przedmiotu)!");
      return;
    }

    const originalName = item.flags?.babele?.originalName;
    if (!originalName) {
      ui.notifications.warn("Nie można przetłumaczyć opisu (brak oryginalnej nazwy)!");
      return;
    }

    const sourceId = item.flags?.core?.sourceId || document._stats?.compendiumSource || document._source?._stats?.compendiumSource;
    if (!sourceId) {
      ui.notifications.warn("Nie można ustalić źródła kompendium.");
      return;
    }

    const getTranslationEntry = async (lang) => {
      const parts = sourceId.split(".");
      const lastSegment = sourceId.split(".").pop();
      const paths = [
        `modules/lang-pl-dnd5/lang/${lang}/compendium/${parts[1]}.${parts[2]}.json`,
        `modules/lang-dnd-premium/lang/${lang}/compendium/${parts[1]}.${parts[2]}.json`
      ];

      for (const path of paths) {
        try {
          const response = await fetch(path);
          if (!response.ok) continue;

          const data = await response.json();

          // Szukamy najpierw po originalName
          if (originalName && data.entries?.[originalName]) {
            return data.entries[originalName];
          }

          // Jeśli nie znaleziono, szukamy po lastSegment
          if (lastSegment && data.entries?.[lastSegment]) {
            return data.entries[lastSegment];
          }                         // znaleziono wpis, zwróć
        } catch (e) {
          console.debug(`Nie udało się odczytać ${path}`, e);
        }
      }
      return null;                                         // nic nie znaleziono w obu paczkach
    };

    const currentLang = await item.getFlag("lang-pl-dnd5", "lang") || "pl";
    let targetLang = currentLang === "pl" ? "en" : "pl";

    const entry = await getTranslationEntry(targetLang);
    if (!entry) {
      ui.notifications.warn(`Nie znaleziono tłumaczenia (${targetLang.toUpperCase()}).`);
      return;
    }

    const updateData = {
      "system.description.value": entry.description || ""
    };

    await item.setFlag("lang-pl-dnd5", "lang", targetLang);
    await item.update(updateData);

    const langName = targetLang === "pl" ? "polski" : "angielski";
    ui.notifications.info(`Przełączono na ${langName} opis.`);

  } catch (error) {
    console.error(error);
    ui.notifications.error("Błąd podczas zmiany tłumaczenia!");
  }
}






