# LocationMap Component

A reusable React component for displaying embedded Google Maps with location markers throughout the application.

## Features

- **GPS Coordinates Support**: Displays maps using latitude/longitude (preferred method)
- **Address Geocoding**: Falls back to address-based geocoding when coordinates unavailable
- **Responsive Design**: Adapts to container width with configurable height
- **Graceful Fallbacks**: Shows appropriate UI when API key not configured or location data missing
- **External Links**: Provides "View on Google Maps" link when embedded map unavailable

## Usage

```tsx
import { LocationMap } from '@/components/ui/location-map';

// With GPS coordinates (preferred)
<LocationMap
  latitude={6.5244}
  longitude={3.3792}
  address="Lagos, Nigeria"
  height="300px"
/>

// With address only (geocoding fallback)
<LocationMap
  address="1 Adeola Odeku Street, Victoria Island, Lagos"
  height="300px"
/>

// Custom styling
<LocationMap
  latitude={6.5244}
  longitude={3.3792}
  className="rounded-lg shadow-md"
  height="400px"
/>
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `latitude` | `number` | No | - | GPS latitude coordinate (preferred) |
| `longitude` | `number` | No | - | GPS longitude coordinate (preferred) |
| `address` | `string` | No | - | Address string for geocoding (fallback) |
| `className` | `string` | No | `''` | Additional CSS classes |
| `height` | `string` | No | `'300px'` | Map container height |

## Requirements

### Environment Variables

The component requires the Google Maps API key to be configured:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Google Cloud APIs

Enable the following APIs in Google Cloud Console:
- Maps Embed API
- Geocoding API (for address-based maps)

See `GOOGLE_MAPS_API_403_ERROR_FIX.md` for setup instructions.

## Behavior

### Priority Order

1. **GPS Coordinates**: If both `latitude` and `longitude` are provided, uses coordinates
2. **Address Geocoding**: If only `address` is provided, uses Google's geocoding
3. **No Data**: Shows "Location data unavailable" message

### Fallback Scenarios

| Scenario | Behavior |
|----------|----------|
| API key not configured | Shows fallback UI with external Google Maps link |
| No location data | Shows "Location data unavailable" message |
| Invalid coordinates | Falls back to address geocoding |
| No API key + no data | Shows basic "unavailable" message |

## Integration Points

The LocationMap component is currently integrated in:

1. **Adjuster Case Details** (`src/app/(dashboard)/adjuster/cases/[id]/page.tsx`)
   - Shows case location with embedded map
   
2. **Manager Approval Page** (`src/app/(dashboard)/manager/approvals/page.tsx`)
   - Shows case location during approval review
   
3. **Vendor Auction Details** (`src/app/(dashboard)/vendor/auctions/[id]/page.tsx`)
   - Shows auction item location (already implemented inline)
   
4. **Bid History Details** (`src/app/(dashboard)/bid-history/[auctionId]/page.tsx`)
   - Shows auction item location (already implemented inline)

## Map Specifications

- **Width**: 100% (responsive to container)
- **Height**: Configurable (default 300px)
- **Zoom Level**: 15 (street level)
- **Map Type**: Roadmap
- **Marker**: Automatically placed at location

## Examples

### Basic Usage
```tsx
<LocationMap
  latitude={6.5244}
  longitude={3.3792}
  address="Lagos, Nigeria"
/>
```

### In a Card Layout
```tsx
<div className="bg-white rounded-lg shadow-md p-4">
  <h3 className="font-bold text-gray-900 mb-3">Location</h3>
  <p className="text-sm text-gray-700 mb-3">Lagos, Nigeria</p>
  <LocationMap
    latitude={6.5244}
    longitude={3.3792}
    address="Lagos, Nigeria"
    height="300px"
  />
</div>
```

### With Coordinates Display
```tsx
<div className="space-y-3">
  <div className="flex items-center gap-2">
    <MapPin className="h-4 w-4 text-muted-foreground" />
    <span className="text-sm font-medium">Location</span>
  </div>
  <p className="text-sm text-muted-foreground">{locationName}</p>
  {latitude && longitude && (
    <p className="text-xs text-gray-500">
      Coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
    </p>
  )}
  <LocationMap 
    latitude={latitude}
    longitude={longitude}
    address={locationName}
  />
</div>
```

## Testing

### Test Cases

1. **With GPS Coordinates**: Verify map displays at correct location
2. **With Address Only**: Verify geocoding works correctly
3. **No API Key**: Verify fallback UI with external link
4. **No Location Data**: Verify "unavailable" message displays
5. **Mobile Responsive**: Verify map scales correctly on mobile devices

### Manual Testing

```bash
# Test with valid API key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-key npm run dev

# Test without API key (fallback mode)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key npm run dev
```

## Troubleshooting

### Map Not Displaying

1. **Check API Key**: Ensure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set
2. **Verify APIs Enabled**: Maps Embed API must be enabled in Google Cloud
3. **Check Billing**: Google Maps requires billing to be enabled
4. **Inspect Console**: Look for 403 errors or API key issues

### Incorrect Location

1. **Verify Coordinates**: Ensure latitude/longitude are correct (lat: -90 to 90, lng: -180 to 180)
2. **Check Address Format**: Ensure address is detailed enough for geocoding
3. **Test External Link**: Click "View on Google Maps" to verify location

### Performance Issues

1. **Use Lazy Loading**: The iframe uses `loading="lazy"` by default
2. **Limit Map Count**: Avoid rendering too many maps on a single page
3. **Consider Thumbnails**: For lists, show maps only in detail views

## Related Documentation

- `GOOGLE_MAPS_API_403_ERROR_FIX.md` - API setup guide
- `GOOGLE_APIS_SETUP_VERIFICATION_COMPLETE.md` - Verification checklist
- `GOOGLE_MAPS_GPS_API_SETUP_GUIDE.md` - Complete setup instructions

## Future Enhancements

- [ ] Add custom marker icons
- [ ] Support multiple markers
- [ ] Add map controls (zoom, pan)
- [ ] Add street view integration
- [ ] Add distance/directions calculation
- [ ] Add map style customization
- [ ] Add clustering for multiple locations
