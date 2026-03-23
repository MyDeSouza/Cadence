import { v4 as uuidv4 } from 'uuid';
import { CadenceEvent, ManualEventInput } from '../types';

// ─── Manual input adapter ────────────────────────────────────────────────────
// Normalizes raw manual input to the CadenceEvent contract.
// Score and cognitive_type are assigned by the engine after normalization.

export function adaptManualInput(input: ManualEventInput): Omit<CadenceEvent, 'score' | 'cognitive_type'> {
  return {
    id: uuidv4(),
    title: input.title.trim(),
    source: 'manual',
    type: input.type,
    timestamp: new Date(input.timestamp).toISOString(),
    deadline: input.deadline ? new Date(input.deadline).toISOString() : undefined,
    raw_content: input.raw_content?.trim(),
    tags: input.tags ?? [],
    user_actioned: null,
    created_at: new Date().toISOString(),
  };
}
