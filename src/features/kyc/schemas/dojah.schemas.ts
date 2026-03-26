import { z } from 'zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise any date string to YYYY-MM-DD (ISO 8601) */
function toISODate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw; // pass through if unparseable
  return d.toISOString().slice(0, 10);
}

/** Normalise a Nigerian phone number to E.164 (+234XXXXXXXXXX) */
function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('234')) return `+${digits}`;
  if (digits.startsWith('0')) return `+234${digits.slice(1)}`;
  return `+234${digits}`;
}

// ---------------------------------------------------------------------------
// NIN entity (inside government_data.data.nin.entity)
// ---------------------------------------------------------------------------

export const DojahNINEntitySchema = z.object({
  nin: z.string().optional().nullable(),
  firstname: z.string().optional().nullable(),
  middlename: z.string().optional().nullable(),
  surname: z.string().optional().nullable(),
  maidenname: z.string().optional().nullable(),
  telephoneno: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? toE164(v) : v)),
  birthdate: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? toISODate(v) : v)),
  gender: z.string().optional().nullable(),
  height: z.string().optional().nullable(),
  educationallevel: z.string().optional().nullable(),
  employmentstatus: z.string().optional().nullable(),
  maritalstatus: z.string().optional().nullable(),
  residence_AddressLine1: z.string().optional().nullable(),
  residence_AddressLine2: z.string().optional().nullable(),
  residence_lga: z.string().optional().nullable(),
  residence_state: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  trackingId: z.string().optional().nullable(),
});

export type DojahNINEntity = z.infer<typeof DojahNINEntitySchema>;

// ---------------------------------------------------------------------------
// BVN entity
// ---------------------------------------------------------------------------

export const DojahBVNEntitySchema = z.object({
  bvn: z.string().optional().nullable(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  middle_name: z.string().optional().nullable(),
  date_of_birth: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? toISODate(v) : v)),
  phone_number1: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? toE164(v) : v)),
  gender: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  residential_address: z.string().optional().nullable(),
});

export type DojahBVNEntity = z.infer<typeof DojahBVNEntitySchema>;

// ---------------------------------------------------------------------------
// ID document data
// ---------------------------------------------------------------------------

export const DojahIDDataSchema = z.object({
  last_name: z.string().optional().nullable(),
  first_name: z.string().optional().nullable(),
  middle_name: z.string().optional().nullable(),
  date_of_birth: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? toISODate(v) : v)),
  date_issued: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? toISODate(v) : v)),
  expiry_date: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? toISODate(v) : v)),
  document_type: z.string().optional().nullable(),
  document_number: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  mrz_status: z.string().optional().nullable(),
  extras: z.string().optional().nullable(),
});

export type DojahIDData = z.infer<typeof DojahIDDataSchema>;

// ---------------------------------------------------------------------------
// Full verification result (widget onSuccess / GET /api/v1/kyc/verification)
// ---------------------------------------------------------------------------

export const DojahVerificationResultSchema = z.object({
  status: z.boolean(),
  message: z.string().optional().nullable(),
  reference_id: z.string().optional().nullable(),
  verification_status: z.string().optional().nullable(),
  verification_mode: z.string().optional().nullable(),
  verification_type: z.string().optional().nullable(),
  verification_value: z.string().optional().nullable(),
  verification_url: z.string().optional().nullable(),
  selfie_url: z.string().optional().nullable(),
  id_url: z.string().optional().nullable(),
  back_url: z.string().optional().nullable(),
  aml: z
    .object({
      status: z.boolean().optional().nullable(),
    })
    .optional()
    .nullable(),
  data: z
    .object({
      id: z
        .object({
          status: z.boolean().optional().nullable(),
          message: z.string().optional().nullable(),
          data: z
            .object({
              id_url: z.string().optional().nullable(),
              back_url: z.string().optional().nullable(),
              id_data: DojahIDDataSchema.optional().nullable(),
            })
            .optional()
            .nullable(),
        })
        .optional()
        .nullable(),
      selfie: z
        .object({
          status: z.boolean().optional().nullable(),
          message: z.string().optional().nullable(),
          data: z
            .object({
              selfie_url: z.string().optional().nullable(),
              liveness_score: z.number().min(0).max(100).optional().nullable(),
              match_score: z.number().min(0).max(100).optional().nullable(),
            })
            .optional()
            .nullable(),
        })
        .optional()
        .nullable(),
      government_data: z
        .object({
          status: z.boolean().optional().nullable(),
          data: z
            .object({
              nin: z
                .object({
                  entity: DojahNINEntitySchema.optional().nullable(),
                })
                .optional()
                .nullable(),
              bvn: z
                .object({
                  entity: DojahBVNEntitySchema.optional().nullable(),
                })
                .optional()
                .nullable(),
            })
            .optional()
            .nullable(),
        })
        .optional()
        .nullable(),
      user_data: z
        .object({
          status: z.boolean().optional().nullable(),
          data: z
            .object({
              first_name: z.string().optional().nullable(),
              last_name: z.string().optional().nullable(),
              dob: z
                .string()
                .optional()
                .nullable()
                .transform((v) => (v ? toISODate(v) : v)),
            })
            .optional()
            .nullable(),
        })
        .optional()
        .nullable(),
      phone_number: z
        .object({
          status: z.boolean().optional().nullable(),
          data: z
            .object({
              phone: z
                .string()
                .optional()
                .nullable()
                .transform((v) => (v ? toE164(v) : v)),
            })
            .optional()
            .nullable(),
        })
        .optional()
        .nullable(),
      additional_document: z
        .array(
          z.object({
            document_url: z.string().optional().nullable(),
            document_type: z.string().optional().nullable(),
          })
        )
        .optional()
        .nullable(),
    })
    .optional()
    .nullable(),
  metadata: z
    .object({
      ipinfo: z.record(z.unknown()).optional().nullable(),
      device_info: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export type DojahVerificationResult = z.infer<typeof DojahVerificationResultSchema>;

// ---------------------------------------------------------------------------
// AML Screening v2 result
// ---------------------------------------------------------------------------

export const DojahAMLMatchSchema = z.object({
  name: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  score: z.number().optional().nullable(),
  categories: z.array(z.string()).optional().nullable(),
  source: z.string().optional().nullable(),
});

export const DojahAMLResultSchema = z.object({
  status: z.boolean().optional().nullable(),
  message: z.string().optional().nullable(),
  entity: z
    .object({
      pep: z.array(DojahAMLMatchSchema).optional().default([]),
      sanctions: z.array(DojahAMLMatchSchema).optional().default([]),
      adverse_media: z.array(DojahAMLMatchSchema).optional().default([]),
    })
    .optional()
    .nullable(),
});

export type DojahAMLResult = z.infer<typeof DojahAMLResultSchema>;
export type DojahAMLMatch = z.infer<typeof DojahAMLMatchSchema>;

// ---------------------------------------------------------------------------
// CAC Lookup result
// ---------------------------------------------------------------------------

export const DojahCACResultSchema = z.object({
  status: z.boolean().optional().nullable(),
  message: z.string().optional().nullable(),
  entity: z
    .object({
      company_name: z.string().optional().nullable(),
      rc_number: z.string().optional().nullable(),
      registration_date: z
        .string()
        .optional()
        .nullable()
        .transform((v) => (v ? toISODate(v) : v)),
      company_status: z.string().optional().nullable(),
      company_type: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      directors: z.array(z.record(z.unknown())).optional().nullable(),
    })
    .optional()
    .nullable(),
});

export type DojahCACResult = z.infer<typeof DojahCACResultSchema>;

// ---------------------------------------------------------------------------
// Advanced NIN result
// ---------------------------------------------------------------------------

export const DojahNINAdvancedResultSchema = z.object({
  status: z.boolean().optional().nullable(),
  message: z.string().optional().nullable(),
  entity: DojahNINEntitySchema.optional().nullable(),
});

export type DojahNINAdvancedResult = z.infer<typeof DojahNINAdvancedResultSchema>;
