// src/validators/triage.ts
// Zod schema matching the exact triage API contract from contract/triage.request.schema.json

import { z } from 'zod';

export const TriageRequestSchema = z.object({
  id:          z.string().min(1).max(40),
  text:        z.string().min(1).max(2000),
  lat:         z.number().min(-90).max(90),
  lng:         z.number().min(-180).max(180),
  reported_at: z.string().min(1), // ISO 8601 date-time
  photo_url:   z.string().url().nullable().optional(),
});

export type TriageRequest = z.infer<typeof TriageRequestSchema>;
