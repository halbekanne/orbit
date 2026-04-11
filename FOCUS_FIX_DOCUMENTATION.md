
# Focus Service Local Storage Fix

## Problem
When a focused task or work item was selected and the page was refreshed, the focus was lost. This happened because the focus service was clearing the focus target when the focused item couldn't be resolved, even if the data wasn't loaded yet.

## Root Cause
The original implementation had an effect that would clear the focus whenever the focused item couldn't be resolved:

```typescript
effect(() => {
  const item = this.focusedItem();
  const target = this.focusTarget();
  if (target && !item) {
    this.focusTarget.set(null); // This would clear focus immediately
  }
});
```

During page refresh:
1. FocusService loads focus target from local storage
2. Effect runs and tries to resolve the item
3. Data services (Jira, Bitbucket) haven't loaded data yet, so arrays are empty
4. Focused item can't be found, so focus is cleared
5. User loses their focus state

## Solution
Modified the effect to check if data has been loaded before clearing the focus:

```typescript
effect(() => {
  const item = this.focusedItem();
  const target = this.focusTarget();
  if (target && !item) {
    // Only clear focus if data has been loaded and item still doesn't exist
    const dataLoaded = this.isDataLoadedForTarget(target);
    if (dataLoaded) {
      this.focusTarget.set(null);
    }
  }
});
```

Added a new method `isDataLoadedForTarget(target)` that checks the loading state for each data type:
- **Tickets**: Check `!this.data.ticketsLoading()`
- **Pull Requests**: Check `!this.data.pullRequestsLoading()`
- **Todos/Ideas**: Always return `true` (data is available immediately from local storage)

## Behavior After Fix

### Tickets and Pull Requests
1. User sets focus on a ticket/PR
2. Page refreshes
3. Focus is loaded from local storage
4. Data is still loading → focus is preserved
5. Data finishes loading:
   - If item exists → focus remains
   - If item doesn't exist → focus is cleared

### Todos and Ideas
1. User sets focus on a todo/idea
2. Page refreshes
3. Focus is loaded from local storage
4. Data is immediately available:
   - If item exists → focus remains
   - If item doesn't exist → focus is cleared immediately

## Files Modified
- `/workspace/src/app/shared/focus.service.ts`: Added data loading check to focus validation effect
- `/workspace/src/app/shared/focus.service.spec.ts`: Added tests for the new behavior

## Testing
The fix ensures that:
- Focus is preserved during data loading for tickets and PRs
- Focus is cleared appropriately when items no longer exist after data is loaded
- Todos and ideas continue to work as before
- Local storage persistence continues to work correctly
