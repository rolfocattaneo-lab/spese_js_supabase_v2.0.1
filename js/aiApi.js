import { supabase } from './supabaseClient.js';

export async function generateAiAnalysis(payload) {
  const { data, error } = await supabase.functions.invoke('generate-ai-report', {
    body: payload
  });

  if (error) {
    console.error('AI function error:', error);
    const details = error.context instanceof Response
      ? await error.context.text().catch(() => '')
      : '';
    throw new Error(details || error.message || 'Errore generazione analisi AI.');
  }

  return data;
}
