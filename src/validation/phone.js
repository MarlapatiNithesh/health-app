import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { ApplicationError } from '../errors/application-error.js';

export function normalizeAndValidateGlobalPhone(rawPhone, defaultCountry = 'US') {
  if (typeof rawPhone !== 'string' || rawPhone.trim() === '') {
    throw new ApplicationError('Phone number is required', 422, 'validation_error', [
      { field: 'phone', message: 'Phone number cannot be empty.' },
    ]);
  }

  const trimmed = rawPhone.trim();
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);

  if (!parsed || !parsed.isValid()) {
    throw new ApplicationError(
      'phone must be a valid international phone number',
      422,
      'invalid_phone_number',
      [
        {
          field: 'phone',
          message: 'Please provide a valid phone number including country code (e.g. +14155552671, +919876543210).',
        },
      ],
    );
  }

  const rawType = parsed.getType();
  let mappedType = 'unknown';
  if (rawType === 'MOBILE') mappedType = 'mobile';
  else if (rawType === 'FIXED_LINE') mappedType = 'landline';
  else if (rawType === 'VOIP') mappedType = 'voip';
  else if (rawType === 'TOLL_FREE') mappedType = 'toll_free';

  return {
    e164: parsed.number,
    countryCode: parsed.country || defaultCountry,
    nationalFormat: parsed.formatNational(),
    internationalFormat: parsed.formatInternational(),
    possibleType: mappedType,
  };
}
