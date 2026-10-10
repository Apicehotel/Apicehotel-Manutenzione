# Flutter × RandApp — laboratorio isolato

Esperimento NON collegato alle API e NON destinato alla produzione. Non sostituisce React/Vite.
Percorso: `experiments/flutter_randapp`.

## Avvio
Installare Flutter stable e il relativo SDK di piattaforma. Dalla cartella dell'esperimento:
```bash
flutter pub get
flutter analyze
flutter test
flutter run -d chrome
```
Per Android/iOS/Windows eseguire `flutter create --platforms=android,ios,windows,web .` dentro questa cartella prima del primo avvio; poi scegliere un device con `flutter devices`.

## Cosa contiene
- Shell Material 3 navigabile, cinque destinazioni, menu mobile e rail tablet/desktop.
- Layout Piccolo/Normale/Grande: selezione manuale o automatica.
- Home con controllo presenza simulato.
- Operatività, Planning e Task con TOP 3 per tipologia.
- Chat RandAI locale, esplicitamente non connessa al backend.
- Due widget test di smoke.

## Stato di verifica
Codice e test scritti nel branch sperimentale. In questo ambiente Flutter/Dart SDK non sono installati, pertanto `flutter analyze`, `flutter test` e compilazione NON sono stati eseguiti. Nessun deploy, merge o modifica a main.

## Regole
- Non usare credenziali o dati reali.
- Nessuna operazione di scrittura su Supabase.
- Validare Android/iOS/Windows e accessibilità prima di considerare una migrazione.
