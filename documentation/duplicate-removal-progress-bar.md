# Duplicate Removal Progress Bar

## Overview
Enhanced the duplicate removal feature with an animated progress bar that provides visual feedback during the removal process.

## Features

### 1. Animated Progress Bar
- **Smooth Animation**: Progress bar fills gradually during the removal process
- **Real-time Updates**: Shows current progress (e.g., "45 / 100")
- **Percentage Display**: Shows completion percentage below the bar
- **Visual Feedback**: Gradient colors and pulsing animation

### 2. Progress Simulation
Since the backend operation is synchronous, the frontend simulates progress:
- Starts at 0% when removal begins
- Gradually increases to 90% while waiting for backend
- Updates every 300ms for smooth animation
- Jumps to 100% when backend completes
- Shows final count for 1.5 seconds before closing

### 3. Enhanced UI
- **Gradient Background**: Blue to indigo gradient for modern look
- **Spinning Loader Icon**: Indicates active processing
- **Badge Display**: Current/total count in a rounded badge
- **Pulsing Effect**: Subtle animation on the progress bar fill
- **Shadow Effects**: Depth and dimension for better visibility

### 4. User Experience
- **Button Disabled**: "Remove Duplicates" button is disabled during processing
- **Status Text**: Shows "Removing..." with spinning icon
- **Auto-close**: Modal closes automatically after completion
- **Toast Notification**: Success message shows final count

## Technical Implementation

### Frontend (AdminOffers.tsx)

#### Progress State
```typescript
const [duplicateRemovalProgress, setDuplicateRemovalProgress] = useState<{
  current: number, 
  total: number
} | null>(null);
```

#### Progress Animation Logic
```typescript
const handleConfirmRemoveDuplicates = async () => {
  // Initialize progress
  const totalToRemove = duplicateData?.total_documents_to_remove || 0;
  setDuplicateRemovalProgress({ current: 0, total: totalToRemove });

  // Simulate progress while waiting for backend
  const progressInterval = setInterval(() => {
    setDuplicateRemovalProgress(prev => {
      if (!prev) return null;
      // Gradually increase up to 90%
      const newCurrent = Math.min(
        prev.current + Math.ceil(prev.total * 0.05), 
        Math.floor(prev.total * 0.9)
      );
      return { current: newCurrent, total: prev.total };
    });
  }, 300);

  // Call backend
  const removeResult = await adminOfferApi.removeDuplicates(keepStrategy);
  
  // Clear interval and show completion
  clearInterval(progressInterval);
  setDuplicateRemovalProgress({ 
    current: removeResult.removed, 
    total: totalToRemove 
  });
};
```

#### Progress Bar UI
```tsx
{duplicateRemovalProgress && (
  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-300 shadow-md">
    {/* Header with spinner and count */}
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <span className="text-sm font-semibold text-blue-900">
          Removing duplicates...
        </span>
      </div>
      <span className="text-sm font-bold text-blue-700 bg-white px-3 py-1 rounded-full">
        {duplicateRemovalProgress.current} / {duplicateRemovalProgress.total}
      </span>
    </div>
    
    {/* Progress bar */}
    <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden shadow-inner">
      <div 
        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out relative"
        style={{ 
          width: `${(duplicateRemovalProgress.current / duplicateRemovalProgress.total) * 100}%` 
        }}
      >
        <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
      </div>
    </div>
    
    {/* Percentage */}
    <div className="mt-2 text-xs text-blue-700 text-center">
      {Math.round((duplicateRemovalProgress.current / duplicateRemovalProgress.total) * 100)}% Complete
    </div>
  </div>
)}
```

## User Flow

### Step 1: Click "Remove Duplicates"
- Admin clicks the "Remove Duplicates" button
- System checks for duplicates
- Shows duplicate preview modal

### Step 2: Review Duplicates
- Modal displays:
  - Total duplicate groups
  - Total duplicate documents
  - Number to be removed
  - Preview of duplicate groups

### Step 3: Confirm Removal
- Admin selects keep strategy (newest/oldest)
- Clicks "Remove X Duplicates" button
- Button becomes disabled with "Removing..." text

### Step 4: Progress Display
```
┌─────────────────────────────────────────────────────┐
│ 🔄 Removing duplicates...              45 / 100    │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                    45% Complete                      │
└─────────────────────────────────────────────────────┘
```

### Step 5: Completion
- Progress bar fills to 100%
- Shows final count (e.g., "100 / 100")
- Success toast appears
- Modal closes after 1.5 seconds
- Offers list refreshes

## Visual States

### Initial State (0%)
```
🔄 Removing duplicates...                0 / 100
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
0% Complete
```

### In Progress (45%)
```
🔄 Removing duplicates...               45 / 100
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░
45% Complete
```

### Complete (100%)
```
🔄 Removing duplicates...              100 / 100
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
100% Complete
```

## Styling Details

### Colors
- **Background**: Gradient from blue-50 to indigo-50
- **Border**: 2px blue-300
- **Progress Bar Background**: blue-200
- **Progress Bar Fill**: Gradient from blue-500 to indigo-600
- **Text**: blue-900 (dark), blue-700 (medium), blue-600 (light)

### Animations
- **Spinner**: Continuous rotation (Loader2 icon)
- **Progress Bar**: 500ms ease-out transition
- **Pulse Effect**: White overlay with opacity-20 and pulse animation
- **Progress Updates**: Smooth 300ms intervals

### Dimensions
- **Progress Bar Height**: 12px (h-3)
- **Border Radius**: Full rounded (rounded-full)
- **Padding**: 16px (p-4)
- **Shadow**: Medium shadow (shadow-md)

## Error Handling

### If Removal Fails
1. Progress bar disappears immediately
2. Error toast shows with message
3. Modal remains open
4. Button re-enables
5. User can retry

### If Partial Success
1. Progress shows actual removed count
2. Success toast shows count
3. Error details available in response
4. Modal closes normally

## Performance Considerations

1. **Interval Cleanup**: Progress interval is cleared when operation completes
2. **State Updates**: Minimal re-renders with optimized state updates
3. **Smooth Animation**: CSS transitions for performance
4. **Auto-close Delay**: 1.5 seconds to show completion before closing

## Future Enhancements

1. **Real-time Progress**: Backend could provide actual progress via WebSocket
2. **Cancellation**: Allow user to cancel long-running operations
3. **Detailed Log**: Show which offers are being removed in real-time
4. **Batch Processing**: Process in smaller batches with progress updates
5. **Estimated Time**: Show estimated time remaining
