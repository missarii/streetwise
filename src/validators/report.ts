// src/validators/report.ts
// Zod schema for citizen report submission (POST /api/reports).
// Server-side validation — same rules regardless of what the browser sends.

import { z } from 'zod';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

export const ReportSubmitSchema = z.object({
  text:  z.string()
           .min(10,  'Description must be at least 10 characters.')
           .max(500, 'Description must be at most 500 characters.'),
  lat:   z.number({ required_error: 'Location is required.' })
           .min(-90).max(90),
  lng:   z.number({ required_error: 'Location is required.' })
           .min(-180).max(180),
  // photo is optional; if provided it is a base64 data URI
  photo: z.string()
           .refine(v => {
             if (!v) return true;
             // Must be a valid data URI for image/jpeg or image/png
             return /^data:image\/(jpeg|png);base64,/.test(v);
           }, 'Photo must be a JPG or PNG.')
           .refine(v => {
             if (!v) return true;
             // Estimate byte size from base64 length
             const base64 = v.split(',')[1] ?? '';
             const bytes  = (base64.length * 3) / 4;
             return bytes <= MAX_PHOTO_BYTES;
           }, 'Photo must be 5 MB or smaller.')
           .optional()
           .nullable(),
});

export type ReportSubmit = z.infer<typeof ReportSubmitSchema>;
