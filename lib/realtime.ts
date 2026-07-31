import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

let realtimeSequence = 0;

/**
 * Supabase reuses a channel when the same topic already exists. React can mount
 * an effect again before the previous asynchronous cleanup has finished, so a
 * fixed topic may receive a second subscribe() call and crash the screen.
 * Every subscription gets its own topic to prevent that race condition.
 */
export function createRealtimeTopic(baseTopic: string): string {
  realtimeSequence += 1;
  return `${baseTopic}:${Date.now()}:${realtimeSequence}`;
}

/** Remove the channel from the client instead of only leaving it on the server. */
export function removeRealtimeChannel(channel?: RealtimeChannel | null): void {
  if (!channel) return;
  void supabase.removeChannel(channel).catch((error) => {
    console.warn('Falha ao remover canal Realtime:', error);
  });
}
