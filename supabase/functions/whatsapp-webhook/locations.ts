// Catalogo camere/zone per hotel, copiato da src/locations.js del repo
// (unica fonte di verita' condivisa con l'app) per riconoscere camere e
// zone nei messaggi WhatsApp in arrivo, per struttura.

const numericRange = (start: number, end: number, excluded: number[] = []): string[] => {
  const blocked = new Set(excluded);
  return Array.from({ length: end - start + 1 }, (_, i) => String(start + i)).filter((v) => !blocked.has(Number(v)));
};

type ZoneDef = { name: string; aliases: string[] };
const zones = (items: [string, string?][]): ZoneDef[] =>
  items.map(([name, aliases = '']) => ({
    name: name.trim(),
    aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
  }));

export const HOTEL_LOCATIONS: Record<string, { rooms: string[]; zones: ZoneDef[] }> = {
  hotelgio: {
    rooms: [
      ...numericRange(1101, 1121, [1113, 1117]),
      ...numericRange(2201, 2221, [2213, 2217]),
      ...numericRange(3301, 3321, [3313, 3317]),
      ...numericRange(4401, 4421, [4413, 4417]),
      ...numericRange(101, 131, [118]),
      ...numericRange(201, 233, [215]),
      ...numericRange(301, 332, [316]),
      ...numericRange(401, 434, [416]),
    ],
    zones: zones([
      ['Giardino Jazz', 'giardino jazz, giardino j, verde jazz'], ['Hall Jazz', 'hall jazz, ingresso jazz, reception jazz, hall j, hall'],
      ['Ufficio Alberto', 'ufficio alberto, stanza alberto, alberto'], ['Ufficio Paolo', 'ufficio paolo, stanza paolo, paolo'],
      ['Reception', 'recepion, accoglienza'], ['Back Office Reception', 'dietro la reception, dietro accoglienza, backoffice, back office'],
      ['Bagni Hall Donne', 'bagno hall donne, bagni donne hall, toilette hall donne'], ['Bagni Hall Uomini', 'bagno hall uomini, bagni uomini hall, toilette hall uomini'],
      ['Piano', 'piano, sala piano, pianoforte'], ['Drums', 'drums, batteria, sala batteria'], ['Guitar', 'guitar, chitarra, sala chitarra'],
      ['Office 1 Jazz', 'primo jazz, 1 jazz, 1jazz, ufficio primo jazz'], ['Corridoio 1 Jazz'], ['Terrazza 1 Jazz', 'terrazza primo, terrazzo 1, dehors'],
      ['Office 2 Jazz', 'secondo jazz, 2 jazz, 2jazz, ufficio secondo jazz'], ['Corridoio 2 Jazz'],
      ['Office 3 Jazz', 'terzo jazz, 3 jazz, 3jazz, ufficio terzo jazz'], ['Corridoio 3 Jazz'],
      ['Office 4 Jazz', 'quarto jazz, 4 jazz, 4jazz, ufficio quarto jazz'], ['Corridoio 4 Jazz', 'corridoio 4 jazz, 4 paino jazz, 4piano jazz, piano4 jazz'],
      ['Terrazza 4 Jazz', 'terrazza quarto, terrazzo quarto, dehors quarto'], ['Piscina', 'pool, 5 piano, quinto piano, 5piano'],
      ['-1 Jazz', 'meno 1 jazz, meno uno jazz, -1 jazz, piano meno 1 jazz'], ['Parcheggio -1 Jazz', 'parcheggio meno 1 jazz, parcheggio -1, garage meno 1 jazz'],
      ['Corridoio -1'], ['Bagni - 1 Jazz Donne', 'bagno meno 1 jazz donne, bagni -1 donne jazz'], ['Bagni - 1 Jazz Uomini', 'bagno meno 1 jazz uomini, bagni -1 uomini jazz'],
      ['Cool', 'cool, sala cool'], ['Bagni Cool Donne', 'bagno cool donne, bagni donne cool'], ['Bagni Cool Uomini', 'bagno cool uomini, bagni uomini cool'],
      ['Preservation', 'preservation, sala preservation'], ['Sala Colazioni', 'colazioni, sala colazione, breakfast, sala breakfast'],
      ['Breakfast 1', 'breakfast 1, colazione 1, sala breakfast 1'], ['Breakfast 2', 'breakfast 2, colazione 2, sala breakfast 2'],
      ['-2 Jazz', 'meno 2 jazz, meno due jazz, -2 jazz, piano meno 2 jazz'], ['Parcheggio -2 Jazz', 'parcheggio meno 2 jazz, parcheggio -2, garage meno 2 jazz'],
      ['Corridoio -2'], ['Bagni -2 Jazz Donne', 'bagno meno 2 jazz donne, bagni -2 donne jazz'], ['Bagni -2 Jazz Uomini', 'bagno meno 2 jazz uomini, bagni -2 uomini jazz'],
      ['Magazzino Elettronico', 'magazzino elettronico, deposito elettronico'], ['Magazzino Idrailico', 'magazzino idraulico, deposito idraulico'],
      ['Magazzino Tavoli', 'magazzino tavoli, deposito tavoli'], ['Sax', 'sax, sassofono, sala sax'], ['Trumpet', 'trumpet, tromba, sala tromba'],
      ['Auditorium', 'auditorium, sala auditorium'], ['Auditorium Bagni Donne', 'bagno auditorium donne, bagni donne auditorium'],
      ['Auditorium Bagni Uomini', 'bagno auditorium uomini, bagni uomini auditorium'], ['Parcheggio -3 Jazz', 'garage, -3'],
      ['Giardino Wine', 'giardino, verde, aiuole, esterno'], ['Hall Wine', 'hall wine, ingresso wine, reception wine, hall w'],
      ['Scale Auditorium', 'scale auditorium, scala auditorium'], ['Office Wine', 'office wine, ufficio wine, back office wine, office hall wine'],
      ['Lavanderia Wine', 'lavanderia, stireria, laundry'], ['Risto Wine', 'risto wine, ristorante wine, sala ristorante wine'],
      ['Sala Cravatte', 'sala cravatte, cravatte'], ['Sala Fontivegge', 'sala fontivegge, fontivegge'], ['Sala Vinarelli', 'sala vinarelli, vinarelli'],
      ['Sala Etichette', 'sala etichette, etichette'], ['Office 1 Wine', 'primo wine, 1 wine, 1wine, ufficio primo wine'], ['Corridoio 1 Wine'],
      ['Office 2 Wine', 'secondo wine, 2 wine, 2wine, ufficio secondo wine'], ['Corridoio 2 Wine'],
      ['Office 3 Wine', 'terzo wine, 3 wine, 3wine, ufficio terzo wine'], ['Corridoio 3 Wine'],
      ['Office 4 Wine', 'quarto wine, 4 wine, 4wine, ufficio quarto wine'], ['Corridoio 4 Wine'],
      ['Ascensore Sinistra Jazz'], ['Ascensore Destra Jazz'], ['Ascensore Staff Jazz'], ['Ascensore Paronamico Wine'],
      ['Ascensore Centrale Wine'], ['Ascensore Staff Wine'], ['Centro Congressi'], ['Palestra'], ['Corridoio Palestra'],
      ['Scale Wine'], ['Scale Jazz Piccole'], ['Scale Jazz Grandi'],
    ]),
  },
  chocohotel: {
    rooms: [...numericRange(201, 232), ...numericRange(301, 332), ...numericRange(401, 430)],
    zones: zones([
      ['Parcheggio Hall'], ['Ingresso Hall'], ['Hall Chocohotel', 'hall'], ['Bagni Uomini Hall'], ['Bagni Donne Hall'],
      ['Choco Store'], ['Sala Fondente 1'], ['Sala Fondente 2'], ['Sala Gianduia'], ['Sala'], ['Sala Latte'],
      ['Locale Caldaie'], ['Giardino 1 piano', 'giardino, pratone'], ['Parcheggio 1 Piano'],
      ['Isola dei golosi', 'colazione, sala colazione'], ['Office 2 Chocohotel'], ['Corridoio 2 Chocohotel'],
      ['Office 3 Chocohotel'], ['Corridoio 3 Chocohotel'], ['Office 4 Chocohotel'], ['Corridoio 4 Chocohotel'],
      ['Piscina'], ['Giardino Piscina'], ['Office Piscina'], ['-1 Chocohotel'], ['Garage -1 Chocohotel'],
    ]),
  },
  brigantino: {
    rooms: [...numericRange(101, 124), ...numericRange(201, 224), 'Casa 1', 'Casa 2', 'Casa 3', 'Casa 4', 'Appartamento 1', 'Appartamento 2'],
    zones: zones([
      ['Hall'], ['Bar Hall'], ['Saletta Hall'], ['Sala Hall'], ['Sala Colazioni'], ['Parcheggio Frontale'],
      ['Parcheggio Spiaggia'], ['Spiaggia'], ['Cucina Colazioni'], ['Corridoio Piano 1'], ['Corridoio Piano 2'],
      ['Scale Esterne'], ['Terrazzo Mare'], ['Piscina'],
    ]),
  },
};

export function normalizeText(s: string): string {
  return s.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function buildZoneLookup(hotelId: string): Map<string, string> {
  const map = new Map<string, string>();
  const cfg = HOTEL_LOCATIONS[hotelId];
  if (!cfg) return map;
  for (const z of cfg.zones) {
    map.set(normalizeText(z.name), z.name);
    for (const alias of z.aliases) map.set(normalizeText(alias), z.name);
  }
  return map;
}

export function zoneReference(hotelId: string): string {
  const cfg = HOTEL_LOCATIONS[hotelId];
  if (!cfg) return '';
  return cfg.zones.map((z) => `${z.name}: ${z.aliases.join(', ')}`).join('\n');
}

export function isKnownRoom(hotelId: string, value: string): boolean {
  return HOTEL_LOCATIONS[hotelId]?.rooms.includes(value) ?? false;
}

export function resolveCamera(hotelId: string, raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (/^\d{1,4}$/.test(trimmed) && isKnownRoom(hotelId, trimmed)) return trimmed;
  const lookup = buildZoneLookup(hotelId);
  return lookup.get(normalizeText(trimmed)) || null;
}
