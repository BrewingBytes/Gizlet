export type AdvertisementSlotVariant = 'banner' | 'inline' | 'rail';
export type AdvertisementRailSize = 'standard' | 'tall';

export interface AdvertisementSlotReservation {
  readonly minimumHeight: `${number}rem`;
  readonly mobileMinimumHeight: `${number}rem`;
}

const inlineReservation = {
  minimumHeight: '5.625rem',
  mobileMinimumHeight: '5.625rem',
} as const satisfies AdvertisementSlotReservation;

const railReservations = {
  standard: {
    minimumHeight: '15.625rem',
    mobileMinimumHeight: '5.625rem',
  },
  tall: {
    minimumHeight: '37.5rem',
    mobileMinimumHeight: '5.625rem',
  },
} as const satisfies Record<AdvertisementRailSize, AdvertisementSlotReservation>;

/**
 * Reserves stable layout space for an ad provider while keeping mobile rails inline.
 */
export function getAdvertisementSlotReservation(
  variant: AdvertisementSlotVariant,
  railSize: AdvertisementRailSize = 'standard',
): AdvertisementSlotReservation {
  return variant === 'rail' ? railReservations[railSize] : inlineReservation;
}
