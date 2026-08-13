// Catalogo importato in sola lettura dai Google Sheet condivisi da Apicehotel.
const numericRange = (start, end, excluded = []) => {
  const blocked = new Set(excluded)
  return Array.from({ length: end - start + 1 }, (_, index) => String(start + index)).filter((value) => !blocked.has(Number(value)))
}

const zones = (items) => items.map(([name, aliases = '']) => ({
  name: name.trim(),
  aliases: aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
}))

export const HOTEL_LOCATIONS = {
  hotelgio: {
    roomGroups: [
      { name: 'Jazz P1', rooms: numericRange(1101, 1121, [1113, 1117]) },
      { name: 'Jazz P2', rooms: numericRange(2201, 2221, [2213, 2217]) },
      { name: 'Jazz P3', rooms: numericRange(3301, 3321, [3313, 3317]) },
      { name: 'Jazz P4', rooms: numericRange(4401, 4421, [4413, 4417]) },
      { name: 'Wine P1', rooms: numericRange(101, 131, [118]) },
      { name: 'Wine P2', rooms: numericRange(201, 233, [215]) },
      { name: 'Wine P3', rooms: numericRange(301, 332, [316]) },
      { name: 'Wine P4', rooms: numericRange(401, 434, [416]) },
    ],
    zones: zones([
      ['Giardino Jazz','giardino jazz, giardino j, verde jazz'],['Hall Jazz','hall jazz, ingresso jazz, reception jazz, hall j, hall'],['Ufficio Alberto','ufficio alberto, stanza alberto, alberto'],['Ufficio Paolo','ufficio paolo, stanza paolo, paolo'],['Reception','Recepion, accoglienza'],['Back Office Reception','Dietro la reception, dietro accoglienza, backoffice, back Office'],['Bagni Hall Donne','bagno hall donne, bagni donne hall, toilette hall donne'],['Bagni Hall Uomini','bagno hall uomini, bagni uomini hall, toilette hall uomini'],['Piano','piano, sala piano, pianoforte'],['Drums','drums, batteria, sala batteria'],['Guitar','guitar, chitarra, sala chitarra'],['Office 1 Jazz','Primo jazz, 1 jazz, 1jazz, ufficio primo jazz'],['Corridoio 1 Jazz'],['Terrazza 1 Jazz','terrazza primo, terrazzo 1, dehors'],['Office 2 Jazz','Secondo jazz, 2 jazz, 2jazz, ufficio secondo jazz'],['Corridoio 2 Jazz'],['Office 3 Jazz','Terzo jazz, 3 jazz, 3jazz, ufficio terzo jazz'],['Corridoio 3 Jazz'],['Office 4 Jazz','Quarto jazz, 4 jazz, 4jazz, ufficio quarto jazz'],['Corridoio 4 Jazz','corridoio 4 jazz, 4 paino jazz, 4piano jazz, piano4 jazz'],['Terrazza 4 Jazz','terrazza quarto, terrazzo quarto, dehors quarto'],['Piscina','pool, 5 piano, quinto piano, 5piano'],['-1 Jazz','meno 1 jazz, meno uno jazz, -1 jazz, piano meno 1 jazz'],['Parcheggio -1 Jazz','parcheggio meno 1 jazz, parcheggio -1, garage meno 1 jazz'],['Corridoio -1'],['Bagni - 1 Jazz Donne','bagno meno 1 jazz donne, bagni -1 donne jazz'],['Bagni - 1 Jazz Uomini','bagno meno 1 jazz uomini, bagni -1 uomini jazz'],['Cool','cool, sala cool'],['Bagni Cool Donne','bagno cool donne, bagni donne cool'],['Bagni Cool Uomini','bagno cool uomini, bagni uomini cool'],['Preservation','preservation, sala preservation'],['Sala Colazioni','colazioni, sala colazione, breakfast, sala breakfast'],['Breakfast 1','breakfast 1, colazione 1, sala breakfast 1'],['Breakfast 2','breakfast 2, colazione 2, sala breakfast 2'],['-2 Jazz','meno 2 jazz, meno due jazz, -2 jazz, piano meno 2 jazz'],['Parcheggio -2 Jazz','parcheggio meno 2 jazz, parcheggio -2, garage meno 2 jazz'],['Corridoio -2'],['Bagni -2 Jazz Donne','bagno meno 2 jazz donne, bagni -2 donne jazz'],['Bagni -2 Jazz Uomini','bagno meno 2 jazz uomini, bagni -2 uomini jazz'],['Magazzino Elettronico','magazzino elettronico, deposito elettronico'],['Magazzino Idrailico','magazzino idraulico, deposito idraulico'],['Magazzino Tavoli','magazzino tavoli, deposito tavoli'],['Sax','sax, sassofono, sala sax'],['Trumpet','trumpet, tromba, sala tromba'],['Auditorium','auditorium, sala auditorium'],['Auditorium Bagni Donne','bagno auditorium donne, bagni donne auditorium'],['Auditorium Bagni Uomini','bagno auditorium uomini, bagni uomini auditorium'],['Parcheggio -3 Jazz','garage , -3'],['Giardino Wine','giardino, verde, aiuole, esterno'],['Hall Wine','hall wine, ingresso wine, reception wine, hall w'],['Scale Auditorium','scale auditorium, scala auditorium'],['Office Wine','office wine, ufficio wine, back office wine, office hall wine'],['Lavanderia Wine','lavanderia, stireria, laundry'],['Risto Wine','risto wine, ristorante wine, sala ristorante wine'],['Sala Cravatte','sala cravatte, cravatte'],['Sala Fontivegge','sala fontivegge, fontivegge'],['Sala Vinarelli','sala vinarelli, vinarelli'],['Sala Etichette','sala etichette, etichette'],['Office 1 Wine','Primo wine, 1 wine, 1wine, ufficio primo wine'],['Corridoio 1 Wine'],['Office 2 Wine','Secondo wine, 2 wine, 2wine, ufficio secondo wine'],['Corridoio 2 Wine'],['Office 3 Wine','Terzo wine, 3 wine, 3wine, ufficio terzo wine'],['Corridoio 3 Wine'],['Office 4 Wine','Quarto wine, 4 wine, 4wine, ufficio quarto wine'],['Corridoio 4 Wine'],['Ascensore Sinistra Jazz'],['Ascensore Destra Jazz'],['Ascensore Staff Jazz'],['Ascensore Paronamico Wine'],['Ascensore Centrale Wine'],['Ascensore Staff Wine'],['Centro Congressi'],['Palestra'],['Corridoio Palestra'],['Scale Wine'],['Scale Jazz Piccole'],['Scale Jazz Grandi'],
    ]),
  },
  chocohotel: {
    roomGroups: [
      { name: 'P2 Chocohotel', rooms: numericRange(201, 232) },
      { name: 'P3 Chocohotel', rooms: numericRange(301, 332) },
      { name: 'P4 Chocohotel', rooms: numericRange(401, 430) },
    ],
    zones: zones([['Parcheggio Hall'],['Ingresso Hall'],['Hall Chocohotel','Hall'],['Bagni Uomini Hall'],['Bagni Donne Hall'],['Choco Store'],['Sala Fondente 1'],['Sala Fondente 2'],['Sala Gianduia'],['Sala'],['Sala Latte'],['Locale Caldaie'],['Giardino 1 piano','Giardino, Pratone'],['Parcheggio 1 Piano'],['Isola dei golosi','Colazione, Sala Colazione'],['Office 2 Chocohotel'],['Corridoio 2 Chocohotel'],['Office 3 Chocohotel'],['Corridoio 3 Chocohotel'],['Office 4 Chocohotel'],['Corridoio 4 Chocohotel'],['Piscina'],['Giardino Piscina'],['Office Piscina'],['-1 Chocohotel'],['Garage -1 Chocohotel']]),
  },
  brigantino: {
    roomGroups: [
      { name: 'P1 Brigantino', rooms: numericRange(101, 124) },
      { name: 'P2 Brigantino', rooms: numericRange(201, 224) },
      { name: 'Case', rooms: ['Casa 1','Casa 2','Casa 3','Casa 4'] },
      { name: 'Appartamento', rooms: ['Appartamento 1','Appartamento 2'] },
    ],
    zones: zones([['Hall'],['Bar Hall'],['Saletta Hall'],['Sala Hall'],['Sala Colazioni'],['Parcheggio Frontale'],['Parcheggio Spiaggia'],['Spiaggia'],['Cucina Colazioni'],['Corridoio Piano 1'],['Corridoio Piano 2'],['Scale Esterne'],['Terrazzo Mare'],['Piscina']]),
  },
}

export const getHotelRooms = (hotelId) => HOTEL_LOCATIONS[hotelId]?.roomGroups.flatMap((group) => group.rooms) || []
export const getHotelZones = (hotelId) => HOTEL_LOCATIONS[hotelId]?.zones || []
