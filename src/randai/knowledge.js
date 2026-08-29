export const RANDAI_KNOWLEDGE_VERSION = 1

export const INTERNAL_PROCEDURES = [
  {
    id: 'hotelgio-jazz-clima-not-cooling',
    hotelId: 'hotelgio',
    title: 'Jazz - aria condizionata non raffredda',
    category: 'climatizzazione',
    area: 'Jazz',
    sourceType: 'procedura_interna',
    sourceLabel: 'Procedura interna Hotel Giò',
    keywords: ['condizionatore', 'condizionatori', 'clima', 'aria condizionata', 'fredda', 'freddano', 'raffredda', 'raffreddano', 'jazz', 'temperatura'],
    summary: 'Prima verificare la temperatura della zona. Se è anomala, controllare il motore esterno al 1° Jazz che gestisce l’aria condizionata dei quattro piani Jazz.',
    steps: [
      'Controlla la temperatura rilevata nella zona interessata del Jazz.',
      'Se la temperatura è anomala, verifica se il problema riguarda anche altri piani Jazz.',
      'Controlla il motore esterno situato al 1° Jazz.',
      'Ricorda che questo motore gestisce l’aria condizionata dei quattro piani Jazz: un’anomalia qui può coinvolgere più piani.',
      'Annota temperatura, piani coinvolti e stato del motore prima di proseguire con ulteriori verifiche.',
    ],
    caution: 'RandAI guida secondo la procedura interna. Prima di interventi elettrici o su parti in pressione, applicare le procedure di sicurezza e le competenze autorizzate.',
  },
]

const normalize = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

export function findInternalProcedure({ hotelId, query }) {
  const text = normalize(query)
  if (!hotelId || !text.trim()) return null

  const candidates = INTERNAL_PROCEDURES
    .filter((item) => item.hotelId === hotelId)
    .map((item) => ({
      item,
      score: item.keywords.reduce((score, keyword) => score + (text.includes(normalize(keyword)) ? 1 : 0), 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  return candidates[0]?.item || null
}
