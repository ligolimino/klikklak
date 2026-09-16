# Klik-klakboekjes beheren

## Wat deze versie ondersteunt

- twee tot acht afzonderlijke posities;
- letters en clusters zoals `sch`, `oe`, `ng` en `st`;
- vrije combinaties, inclusief nonsenswoorden;
- alleen bestaande Nederlandse woorden;
- maximaal acht geschreven letters per woordenboekwoord;
- korte links die rechtstreeks uit Excel gemaakt kunnen worden;
- een lijst met woorden die in één boekje uitgesloten moeten worden;
- downloaden van een unieke CSV-inspreeklijst;
- eigen MP3-opnames met automatische browserstem als terugval;
- bestaande oude links met drie groepen.

## Woordenboek

`wordlist-v1.js` bevat versie 1 van de woordenbank. De bron is OpenTaal. De
lijst is vooraf gefilterd op woorden van twee tot en met acht kleine letters.
Ook vervoegde vormen zoals `schorst` kunnen daardoor voorkomen.

Verwijder `wordlist-v1.js` nooit wanneer bestaande links `wb=v1` bevatten. Een
latere verbeterde woordenlijst krijgt een nieuwe bestands- en versienaam. Zo
blijven oude boekjes dezelfde woorden gebruiken.

Een officieel bestaand woord is niet automatisch geschikt voor NT2 Alfa.
Controleer daarom vóór publicatie de gevonden woorden. Ongewenste woorden kunnen
in het veld **Woorden uitsluiten** worden gezet en worden mee in de link bewaard.

## Inspreeklijst maken

1. Open `beheer/`.
2. Vul de posities van het boekje in.
3. Kies **Alleen bestaande Nederlandse woorden**.
4. Kies **Woorden controleren**.
5. Voeg ongewenste woorden toe bij **Woorden uitsluiten**.
6. Kies **Inspreeklijst downloaden**.

De CSV bevat elk woord één keer, de opbouw, de gewenste MP3-bestandsnaam en de
map waarin de opname op GitHub hoort.

## Audio

Letterlab gebruikt deze volgorde:

1. een opname die lokaal in het lesgeversgedeelte werd toegevoegd;
2. een vaste opname van een losse klank;
3. `assets/audio/woorden/eerste-letter/woord.mp3` voor een volledig woord;
4. de Belgisch-Nederlandse browserstem.

Voorbeeld: de eigen uitspraak van `schorst` staat als
`assets/audio/woorden/s/schorst.mp3`.

Met `plaats-woordaudio.ps1` kunnen losse MP3-bestanden automatisch over de
juiste lettermappen worden verdeeld.

## Belangrijke uitspraakgrens

Letters zoals `c`, `q`, `x` en `y` hebben niet in ieder woord één vaste
fonetische uitspraak. Een enkele losse opname van bijvoorbeeld `c` kan daarom
niet voor ieder woord correct zijn. Gebruik voor zulke gevallen bij voorkeur
een volledige woordopname.

## Korte Excel-links

Een link ziet er bijvoorbeeld zo uit:

`klikklak/?wb=v1&woorden=ja&p1=sch&p2=o&p3=r&p4=s&p5=t`

- `wb=v1`: woordenboekversie;
- `woorden=ja`: alleen bestaande woorden;
- `p1` tot en met `p8`: toegestane letters of klanken per positie;
- `uit=woord1,woord2`: woorden die niet mogen verschijnen.

De volledige configuratie staat in de link. Er is geen databank nodig.

## Controle vóór publicatie

- Open de link uit Excel eerst zelf.
- Draai iedere positie enkele keren omhoog en omlaag.
- Controleer de volledige woordenlijst via de CSV.
- Test minstens één woord met eigen MP3 en één woord zonder MP3.
- Test de Genially-insluiting op Android en iPhone, staand en liggend.
- Bewaar de volledige ZIP en het Excelbestand als back-up.

