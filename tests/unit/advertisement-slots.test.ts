import { describe, expect, it } from 'vitest';
import { getAdvertisementSlotReservation } from '../../src/data/advertisement-slots';

describe('getAdvertisementSlotReservation', () => {
  it('uses a stable banner and inline reservation', () => {
    expect(getAdvertisementSlotReservation('banner')).toEqual({
      minimumHeight: '5.625rem',
      mobileMinimumHeight: '5.625rem',
    });
    expect(getAdvertisementSlotReservation('inline')).toEqual({
      minimumHeight: '5.625rem',
      mobileMinimumHeight: '5.625rem',
    });
  });

  it('keeps right-rail sizes stable and collapses them into document flow on mobile', () => {
    expect(getAdvertisementSlotReservation('rail')).toEqual({
      minimumHeight: '15.625rem',
      mobileMinimumHeight: '5.625rem',
    });
    expect(getAdvertisementSlotReservation('rail', 'tall')).toEqual({
      minimumHeight: '37.5rem',
      mobileMinimumHeight: '5.625rem',
    });
  });
});
