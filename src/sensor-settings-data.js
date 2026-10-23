export async function saveSensorSeason(client, season) {
  if (!['inverno', 'estate'].includes(season)) throw new Error('Stagione non valida.')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Collegati a Internet per cambiare stagione.')
  // RLS can turn an unauthorized UPDATE into zero affected rows. Returning
  // the saved row is required before telling the operator it succeeded.
  const { data, error } = await client.from('sensori_impostazioni')
    .update({ stagione: season, aggiornato_il: new Date().toISOString() })
    .eq('id', 1)
    .select('id,stagione,soglia_inverno_min,soglia_estate_max,soglia_frigo_max')
    .single()
  if (error || data?.stagione !== season) throw new Error('Stagione non salvata. Verifica i permessi e riprova.')
  return data
}
