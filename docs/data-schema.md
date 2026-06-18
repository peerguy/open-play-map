# Court Data Schema

`data/courts.json` is an array of court/location records.

```json
{
  "id": "unique-slug",
  "name": "Park or facility name",
  "address": "Street/city/state address",
  "city": "City",
  "state": "ST",
  "country": "USA",
  "latitude": 0,
  "longitude": 0,
  "icon": "OP",
  "access": "public | private | paid | club | unknown",
  "isFree": true,
  "openPlay": [
    {
      "days": "Mon/Wed/Fri",
      "hours": "8:00 AM–11:00 AM",
      "notes": "Beginner-friendly mornings"
    }
  ],
  "estimatedSkillLevel": "beginner | intermediate | advanced | mixed | unknown",
  "courts": {
    "count": 6,
    "surface": "dedicated pickleball | tennis overlay | unknown",
    "indoorOutdoor": "outdoor | indoor | both | unknown"
  },
  "photos": [
    "assets/photos/location-photo.jpg"
  ],
  "notes": "Anything players should know before going.",
  "sourceUrl": "https://example.com/source",
  "websiteUrl": "https://example.com/open-play",
  "phoneNumber": "301-555-1234",
  "lastVerified": "YYYY-MM-DD"
}
```

## Data Quality Rules

- Use `unknown` instead of guessing.
- Keep `lastVerified` current when open-play hours are checked.
- Open-play hours change often; treat official parks pages, local pickleball groups, and recent player reports as stronger sources than stale directory listings.
- Photos should be original, permission-cleared, or from sources that allow reuse.
