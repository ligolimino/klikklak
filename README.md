# Letterlab — klik-klak

Zelfstandige klik-klaktool met twee tot acht posities, OpenTaalwoordenboek,
uitsluitwoorden, inspreeklijsten en eigen woordaudio.

## Publiceren

Maak op GitHub een openbare repository `klikklak` en upload de **inhoud** van
deze map. Schakel GitHub Pages in via `main` en `/ (root)`.

- Cursisten: `https://gebruikersnaam.github.io/klikklak/`
- Beheer: `https://gebruikersnaam.github.io/klikklak/beheer/`

Gebruik in Excel bij **Basislink Klik-klak** de cursistenlink hierboven.

Een link uit Excel opnieuw beheren: open `beheer/`, plak de volledige link bij
**Boekje uit Excel openen** en kies **Boekje laden in beheer**. Daarna zijn ook
woordencontrole, aanpassingen en de CSV-inspreeklijst beschikbaar.

Gebruik `-` als een positie ook leeg mag zijn, bijvoorbeeld `-, m, k` in
positie 1 of `-, n, t` in positie 3. Daardoor kan een driedelig boekje ook
woorden van twee letters vormen.

Lees `BEHEER-KLIKKLAK.md` voor woordenlijsten en eigen MP3-opnames.

## Overstappen

Publiceer en test deze repository eerst. Vervang daarna eventuele bestaande
links in Genially. Verwijder de oude gecombineerde repository pas wanneer alle
vervangen links op pc, Android en iPhone werken.

## Twee weergaven: onderkant en volledig

| Weergave | Wat staat erop | Link |
|---|---|---|
| Onderkant (standaard) | het boekje met klank- en woordknoppen | zoals altijd |
| Volledig | instructie-audio bovenaan + het boekje | met `&weergave=volledig&instructie=naam` erachter |

Alle bestaande links blijven de onderkant tonen, precies zoals vroeger. De
Excel-lijst maakt per boekje beide links (tabblad **Klik-klaklinken**).

Zet instructie-opnames in de repository **audio**, map `instructies/`
(of voeg ze toe met de knop op de createpagina). De oude map
`assets/audio/instructies/` werkt nog als tweede kans. In Excel typ je alleen
de bestandsnaam; `.mp3` mag je weglaten. Een volledige link (`https://...`)
werkt ook. Wordt de instructie niet gevonden, dan verschijnt de balk gewoon
niet.

## Wat staat er onder het boekje?

Met `onder=` in de link kies je wat er onder de flapjes staat. Werkt in beide
weergaven.

| In de link | Onder het boekje |
|---|---|
| (niets) | woord en luisterknop, zoals altijd |
| `onder=luisteren` | luisterknop; het woord verschijnt pas na het luisteren |
| `onder=audio` | alleen de luisterknop |
| `onder=woord` | alleen het woord |
| `onder=geen` | niets: alleen het boekje |

## Opnames staan centraal

Sinds oktober 2026 staan alle opnames in één repository: **ligolimino/audio**
(`klanken/`, `woorden/<eerste letter>/`, `woorden/nonsens/`, `instructies/`,
`zinnen/`). Deze tool zoekt daar eerst. De oude mappen in deze repository
blijven als tweede kans bestaan, zodat oudere links altijd blijven werken.
Nieuwe opnames voeg je toe met de createpagina of rechtstreeks in de
audio-repository.
