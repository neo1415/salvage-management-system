# Search Progress Indicator Component

The `SearchProgressIndicator` component provides visual feedback during internet search operations in the case creation workflow. It shows progress for market price searches, AI assessment processing, and part price searches for salvage calculations.

## Features

- **Multi-stage Progress**: Shows different stages of the search process (market search, AI processing, part search)
- **Real-time Updates**: Displays progress percentage, elapsed time, and estimated time remaining
- **Data Source Indicators**: Shows whether data comes from internet search, database, or cache
- **Confidence Scoring**: Displays search result confidence with color-coded indicators
- **Error Handling**: Shows error states with retry functionality
- **Timeout Warnings**: Alerts users when searches take longer than expected
- **Accessibility**: Screen reader friendly with proper ARIA labels

## Usage

### Basic Usage

```tsx
import { SearchProgressIndicator, useSearchProgress } from '@/components/ui/search-progress-indicator';

function MyComponent() {
  const {
    progress,
    startMarketSearch,
    startAIProcessing,
    setComplete,
    setError,
    reset
  } = useSearchProgress();

  const handleSearch = async () => {
    try {
      startMarketSearch('Toyota Camry 2021 used price Nigeria');
      
      // Perform search...
      const result = await searchAPI();
      
      setComplete(85, 'internet');
    } catch (error) {
      setError('Search failed');
    }
  };

  return (
    <div>
      <button onClick={handleSearch}>Start Search</button>
      
      <SearchProgressIndicator
        progress={progress}
        onCancel={() => reset()}
        onRetry={handleSearch}
      />
    </div>
  );
}
```

### Progress States

The component supports the following progress states:

- `idle`: No search in progress
- `market_search`: Searching for market prices via internet
- `ai_processing`: AI analyzing photos with market data
- `part_search`: Searching for damaged part prices
- `complete`: Search completed successfully
- `error`: Search failed with error message

### Progress Object

```typescript
interface SearchProgress {
  stage: 'idle' | 'market_search' | 'ai_processing' | 'part_search' | 'complete' | 'error';
  message: string;
  progress?: number; // 0-100
  confidence?: number; // 0-100
  dataSource?: 'internet' | 'database' | 'cache';
  searchQuery?: string;
  timeElapsed?: number;
  estimatedTimeRemaining?: number;
  error?: string;
}
```

### Hook Methods

The `useSearchProgress` hook provides these methods:

- `startMarketSearch(query)`: Start market price search
- `startAIProcessing()`: Start AI photo analysis
- `startPartSearch(partCount)`: Start part price search
- `setComplete(confidence?, dataSource?)`: Mark search as complete
- `setError(error)`: Set error state
- `updateProgress(update)`: Update progress with partial data
- `reset()`: Reset to idle state

## Visual Indicators

### Progress Stages

Each stage has a unique color scheme and icon:

- **Market Search**: Blue with search icon
- **AI Processing**: Purple with brain/lightbulb icon
- **Part Search**: Orange with gear icon
- **Complete**: Green with checkmark icon
- **Error**: Red with warning icon

### Confidence Levels

Confidence scores are color-coded:

- **High (80-100%)**: Green background
- **Medium (60-79%)**: Yellow background
- **Low (0-59%)**: Red background

### Data Sources

Data sources are indicated with icons and colors:

- **Internet**: 🌐 Blue (real-time search)
- **Database**: 💾 Green (cached database data)
- **Cache**: ⚡ Yellow (recently cached results)

## Integration with Case Creation

The search progress indicator is integrated into the case creation workflow:

1. **Photo Upload**: Triggers automatic AI assessment with progress tracking
2. **Market Search**: Shows progress while searching for item market prices
3. **Part Search**: Displays progress during salvage value calculations
4. **Form Interaction**: Disables relevant form elements during active searches
5. **Error Handling**: Provides fallback options when searches fail

## Accessibility Features

- **Screen Reader Support**: Progress updates are announced
- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **ARIA Labels**: Proper labeling for assistive technologies
- **Reduced Motion**: Respects user's motion preferences
- **High Contrast**: Color schemes work with high contrast modes

## Performance Considerations

- **Debounced Updates**: Progress updates are throttled to prevent excessive re-renders
- **Memory Management**: Timers and intervals are properly cleaned up
- **Efficient Rendering**: Only re-renders when progress actually changes
- **Timeout Handling**: Prevents indefinite loading states

## Error Handling

The component handles various error scenarios:

- **Network Timeouts**: Shows timeout warnings after 10 seconds
- **API Failures**: Displays error messages with retry options
- **Rate Limiting**: Indicates when API limits are reached
- **Fallback Data**: Shows when fallback data sources are used

## Customization

The component accepts these props for customization:

- `className`: Additional CSS classes
- `onCancel`: Callback for cancel button
- `onRetry`: Callback for retry button

## Testing

The component includes comprehensive tests:

- Unit tests for all progress states
- Integration tests with case creation workflow
- Accessibility tests for screen reader compatibility
- Performance tests for memory usage and re-renders

## Browser Support

The component works in all modern browsers and gracefully degrades in older browsers:

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Related Components

- `SyncProgressIndicator`: For offline sync progress
- `VehicleAutocomplete`: For vehicle selection with loading states
- `Toast`: For success/error notifications