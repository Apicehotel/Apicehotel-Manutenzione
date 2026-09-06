import { SkillInvocation, SkillRisk, SkillStatus } from './contracts.js'
import { SkillRegistry } from './registry.js'

const DEFINITIONS = Object.freeze([
  {
    id: 'maintenance', name: 'Maintenance', description: 'Diagnosi, segnalazioni e interventi tecnici hotel.', tags: ['maintenance','operations'], risk: SkillRisk.HIGH,
    permissions: ['READ','WRITE_PROTECTED'], requiredTools: ['maintenance.*','interventions.*','procedures.read','warehouse.read'],
    instructions: ['Identifica hotel, area, asset e sintomo.', 'Consulta storico/procedure prima di mutare stato.', 'Non inventare disponibilità o chiusure.'],
    successCriteria: ['hotel-scoped', 'auditabile', 'stato operativo coerente'],
    routing: { keywords: ['manutenzione','guasto','guasta','rotto','rotta','fulminata','lampadina','perdita','serratura','climatizzatore','condizionatore','riparazione','intervento','tecnico'], priority: 30 },
  },
  {
    id: 'housekeeping', name: 'Housekeeping', description: 'Piani, camere, attività e segnalazioni housekeeping.', tags: ['housekeeping','operations'], risk: SkillRisk.MEDIUM,
    permissions: ['READ','WRITE'], requiredTools: ['housekeeping.*','rooms.read','issues.write'],
    instructions: ['Identifica hotel, piano e camera/area.', 'Separa attività housekeeping da guasti tecnici.', 'Promuovi a manutenzione quando il problema è tecnico.'],
    successCriteria: ['hotel-scoped', 'camera/piano identificati', 'stato housekeeping coerente'],
    routing: { keywords: ['housekeeping','governante','camera','camere','pulizia','biancheria','lenzuola','asciugamani','federe','office','piano','piani','rifare camera'], priority: 25 },
  },
  {
    id: 'planning', name: 'Planning', description: 'Planning sale, lavori, calendario, conflitti e dipendenze.', tags: ['planning','operations'], risk: SkillRisk.MEDIUM,
    permissions: ['READ','WRITE'], requiredTools: ['planning.*','calendar.*'],
    instructions: ['Verifica hotel, sala/data e conflitti.', 'Non sovrascrivere prenotazioni senza gateway autorizzato.', 'Evidenzia dipendenze e collisioni.'],
    successCriteria: ['nessun conflitto ignorato', 'hotel-scoped', 'date e sala verificati'],
    routing: { keywords: ['planning','sala','sale','evento','allestimento','calendario','prenotazione','conflitto','turno'], priority: 20 },
  },
  {
    id: 'warehouse', name: 'Warehouse', description: 'Materiali, categorie, disponibilità e movimenti magazzino.', tags: ['warehouse','inventory'], risk: SkillRisk.HIGH,
    permissions: ['READ','WRITE_PROTECTED'], requiredTools: ['warehouse.*','inventory.*'],
    instructions: ['Verifica categoria, articolo e hotel.', 'Distingui disponibilità da movimento reale.', 'Nessuno scarico senza evento operativo verificato.'],
    successCriteria: ['quantità verificata', 'movimenti auditabili', 'nessun cross-hotel'],
    routing: { keywords: ['magazzino','scorta','scorte','materiale','materiali','pezzo','pezzi','ricambio','ricambi','inventario','disponibilità','quantità'], priority: 22 },
  },
  {
    id: 'whatsapp', name: 'WhatsApp', description: 'Routing e risposte sui canali WhatsApp autorizzati.', tags: ['whatsapp','messaging'], risk: SkillRisk.HIGH,
    permissions: ['READ','WRITE_PROTECTED'], requiredTools: ['whatsapp.*','messaging.*'],
    instructions: ['Identifica hotel/canale autorizzato.', 'Non confondere i numeri delle strutture.', 'Invia solo tramite gateway e policy approvate.'],
    successCriteria: ['canale corretto', 'destinatario autorizzato', 'invio auditabile'],
    routing: { keywords: ['whatsapp','wp','messaggio','messaggi','chat','webhook','numero whatsapp','meta whatsapp'], priority: 28 },
  },
  {
    id: 'procedures', name: 'Procedures', description: 'Consultazione, bozza, revisione e workflow RandGuide.', tags: ['procedures','randguide'], risk: SkillRisk.HIGH,
    permissions: ['READ','WRITE_PROTECTED'], requiredTools: ['procedures.*','randguide.*'],
    instructions: ['Distingui consultazione, bozza, revisione e pubblicazione.', 'I contenuti operativi entrano come bozza.', 'Pubblicazione solo dopo workflow autorizzato.'],
    successCriteria: ['stato procedura esplicito', 'review rispettata', 'versione auditabile'],
    routing: { keywords: ['procedura','procedure','guida','guide','istruzioni','bozza','revisione','pubblica procedura','randguide'], priority: 24 },
  },
  {
    id: 'repo-radar', name: 'Repo Radar', description: 'Valutazione repository e fonti esterne contro l ecosistema Rand.', tags: ['repo-radar','randcore'], risk: SkillRisk.MEDIUM,
    permissions: ['READ'], requiredTools: ['repo-radar.*','github.read','security-intelligence.read'],
    instructions: ['Valuta prima di importare.', 'Classifica Aggiungi/Sostituisci/Ignora/Fonte.', 'Non auto-installare codice esterno.'],
    successCriteria: ['benefici/rischi motivati', 'compatibilità valutata', 'nessuna installazione implicita'],
    routing: { keywords: ['repository','repo','github','open source','libreria','dipendenza','framework','valuta repo','analizza repo'], priority: 35 },
  },
])

export const RAND_SKILL_CATALOG_VERSION = '1.1.0'

export function canonicalRandSkillDefinitions() {
  return DEFINITIONS.map((skill) => ({
    ...skill,
    version: RAND_SKILL_CATALOG_VERSION,
    status: SkillStatus.APPROVED,
    invocation: SkillInvocation.BOTH,
    metadata: { source: `rand-skills/${skill.id}/SKILL.md`, governedBy: 'RandCore', routing: skill.routing },
  }))
}

export function registerCanonicalRandSkills(registry = new SkillRegistry()) {
  for (const definition of canonicalRandSkillDefinitions()) {
    if (!registry.get(definition.id, definition.version)) registry.register(definition)
  }
  return registry
}
