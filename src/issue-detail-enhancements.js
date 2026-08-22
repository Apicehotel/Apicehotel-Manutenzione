// Il dettaglio segnalazione usa il selettore foto React originale.
// Un solo tasto Fotocamera/Aggiungi foto apre le scelte native già gestite
// dall'app (fotocamera oppure libreria/galleria) senza forzare pannelli aperti.
// Questo file resta intenzionalmente minimale per non duplicare la logica React.

if (typeof document !== 'undefined') {
  document.documentElement.classList.remove('issue-photo-direct')
}
