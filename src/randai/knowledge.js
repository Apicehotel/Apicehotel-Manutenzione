import { KnowledgeTrust, MaintenanceKnowledgeEngine } from './maintenance/index.js'

export const RANDAI_KNOWLEDGE_VERSION = 2

export const INTERNAL_PROCEDURES = [
  {
    id: 'hotelgio-jazz-clima-not-cooling',
    hotelId: 'hotelgio',
    title: 'Jazz - aria condizionata non raffredda',
    category: 'climatizzazione',
    area: 'Jazz',
    symptom: 'non raffredda',
    sourceType: 'procedura_interna',
    sourceLabel: 'Procedura interna Hotel Giò',
    trust: KnowledgeTrust.APPROVED,
    version: 1,
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

const localEngine = new MaintenanceKnowledgeEngine({ procedures: INTERNAL_PROCEDURES })

export function findInternalProcedure({ hotelId, query }) {
  const result = localEngine.search({ hotelId, query, allowedTrust: [KnowledgeTrust.APPROVED] })
  if (!result.found) return null
  return {
    ...result.procedure,
    sourceType: result.procedure.sourceType || 'procedura_interna',
  }
}

export function findInternalKnowledge({ hotelId, query }) {
  return localEngine.search({ hotelId, query, allowedTrust: [KnowledgeTrust.APPROVED] })
}
