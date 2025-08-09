import { z } from 'zod';
import { US_STATE_CODES } from './us-states';

export const addressSchema = z.object({
  streetAddress: z
    .string()
    .min(1, 'Street address is required')
    .max(100, 'Street address must be less than 100 characters'),
  city: z
    .string()
    .min(1, 'City is required')
    .max(50, 'City must be less than 50 characters')
    .regex(
      /^[a-zA-Z\s\-'\.]+$/,
      'City must contain only letters, spaces, hyphens, apostrophes, and periods'
    ),
  state: z
    .string()
    .min(1, 'State is required')
    .length(2, 'State must be a 2-letter abbreviation')
    .toUpperCase()
    .refine((val) => US_STATE_CODES.some((code) => code === val), {
      message: 'Please enter a valid US state abbreviation',
    }),
  zipCode: z
    .string()
    .min(1, 'ZIP code is required')
    .regex(
      /^\d{5}(-\d{4})?$/,
      'ZIP code must be in format 12345 or 12345-6789'
    ),
});

export type AddressFormData = z.infer<typeof addressSchema>;

// Optional address schema for cases where address is not required
export const optionalAddressSchema = z.object({
  streetAddress: z
    .string()
    .max(100, 'Street address must be less than 100 characters')
    .optional(),
  city: z
    .string()
    .max(50, 'City must be less than 50 characters')
    .regex(
      /^[a-zA-Z\s\-'\.]*$/,
      'City must contain only letters, spaces, hyphens, apostrophes, and periods'
    )
    .optional(),
  state: z
    .string()
    .length(2, 'State must be a 2-letter abbreviation')
    .toUpperCase()
    .refine((val) => !val || US_STATE_CODES.some((code) => code === val), {
      message: 'Please enter a valid US state abbreviation',
    })
    .optional(),
  zipCode: z
    .string()
    .regex(
      /^(\d{5}(-\d{4})?)?$/,
      'ZIP code must be in format 12345 or 12345-6789'
    )
    .optional(),
});

export type OptionalAddressFormData = z.infer<typeof optionalAddressSchema>;

// EIN validation schema
export const einSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val) return true; // Optional field

      // Check if it matches XX-XXXXXXX format
      const einRegex = /^\d{2}-\d{7}$/;
      return einRegex.test(val);
    },
    {
      message: 'EIN must be in format XX-XXXXXXX (e.g., 12-3456789)',
    }
  );

// Required EIN schema
export const requiredEinSchema = z
  .string()
  .min(1, 'EIN is required')
  .refine(
    (val) => {
      const einRegex = /^\d{2}-\d{7}$/;
      return einRegex.test(val);
    },
    {
      message: 'EIN must be in format XX-XXXXXXX (e.g., 12-3456789)',
    }
  );

export type EINFormData = z.infer<typeof einSchema>;

// Helper function to format address for display
export function formatAddress(address: Partial<AddressFormData>): string {
  const parts = [
    address.streetAddress,
    address.city,
    address.state && address.zipCode
      ? `${address.state} ${address.zipCode}`
      : address.state || address.zipCode,
  ].filter(Boolean);

  return parts.join(', ');
}

// Helper function to parse legacy address string into separate fields
export function parseAddress(addressString: string): Partial<AddressFormData> {
  if (!addressString) return {};

  // Try to parse comma-separated format: "123 Main St, City, State, ZIP" or "123 Main St, City, State ZIP"
  const parts = addressString.split(',').map((part) => part.trim());

  if (parts.length >= 3) {
    const streetAddress = parts[0];
    const city = parts[1];
    const lastPart = parts[parts.length - 1];

    // Try to extract state and zip from the last part
    const stateZipMatch = lastPart.match(/^([A-Z]{2})\s+(\d{5}(-\d{4})?)$/);
    if (stateZipMatch) {
      return {
        streetAddress,
        city,
        state: stateZipMatch[1],
        zipCode: stateZipMatch[2],
      };
    }

    // If no ZIP found, assume it's just state
    if (parts.length === 3 && /^[A-Z]{2}$/.test(lastPart)) {
      return {
        streetAddress,
        city,
        state: lastPart,
      };
    }
  }

  // If parsing fails, put everything in street address
  return {
    streetAddress: addressString,
  };
}
