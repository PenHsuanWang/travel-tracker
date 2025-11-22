import { fetchGeotaggedImagesForTrip } from './ImageLayer';

describe('fetchGeotaggedImagesForTrip', () => {
  it('requests images scoped to a specific trip without falling back globally', async () => {
    const fetcher = jest.fn().mockResolvedValue([]);
    const tripId = 'trip-123';

    const result = await fetchGeotaggedImagesForTrip(fetcher, tripId);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
      undefined,
      'images',
      tripId
    );
    expect(result).toEqual([]);
  });

  it('normalizes non-array responses to an empty list', async () => {
    const fetcher = jest.fn().mockResolvedValue(null);
    const result = await fetchGeotaggedImagesForTrip(fetcher, 'trip-abc');
    expect(result).toEqual([]);
  });
});
