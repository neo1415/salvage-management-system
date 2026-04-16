# AuctionScheduleSelector - Quick Reference

## 🚀 Quick Start

```tsx
import { AuctionScheduleSelector, AuctionScheduleValue } from '@/components/ui/auction-schedule-selector';

const [value, setValue] = useState<AuctionScheduleValue>({ mode: 'now' });

<AuctionScheduleSelector value={value} onChange={setValue} minDate={new Date()} />
```

## 📦 Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | `AuctionScheduleValue` | ✅ | - | Current value |
| `onChange` | `(value) => void` | ✅ | - | Change handler |
| `minDate` | `Date` | ❌ | `new Date()` | Minimum date |
| `className` | `string` | ❌ | - | CSS classes |

## 🔧 Types

```typescript
interface AuctionScheduleValue {
  mode: 'now' | 'scheduled';
  scheduledTime?: Date;
}
```

## 📍 Files

- **Component**: `src/components/ui/auction-schedule-selector.tsx`
- **Demo**: `src/app/demo/auction-schedule/page.tsx`
- **Tests**: `src/components/ui/__tests__/auction-schedule-selector.test.tsx`
- **Docs**: `src/components/ui/auction-schedule-selector.md`

## 🎨 Theme

- **Primary**: `#800020` (Burgundy)
- **Hover**: `#600018`
- **Focus**: 2px burgundy ring

## ✅ Validation

- ✅ Future dates only
- ✅ After minDate
- ✅ Date required in scheduled mode
- ✅ Inline error messages

## 📱 Mobile

- Touch-friendly (44x44px min)
- Responsive grid
- Optimized popover
- Clear feedback

## ♿ Accessibility

- Keyboard navigation
- Focus indicators
- ARIA labels
- Semantic HTML

## 🔗 Demo

Visit: `http://localhost:3000/demo/auction-schedule`

## 📝 Integration Example

```typescript
// 1. Import
import { AuctionScheduleSelector, AuctionScheduleValue } from '@/components/ui/auction-schedule-selector';

// 2. State
const [scheduleValue, setScheduleValue] = useState<AuctionScheduleValue>({
  mode: 'now',
});

// 3. Render
<AuctionScheduleSelector
  value={scheduleValue}
  onChange={setScheduleValue}
  minDate={new Date()}
/>

// 4. Use in API
const response = await fetch('/api/cases/approve', {
  method: 'POST',
  body: JSON.stringify({
    auctionStartMode: scheduleValue.mode,
    auctionStartTime: scheduleValue.scheduledTime?.toISOString(),
  }),
});
```

## 🧪 Testing

```bash
npm test src/components/ui/__tests__/auction-schedule-selector.test.tsx
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Calendar not showing | Check Popover import |
| Validation not working | Set minDate prop |
| Past dates allowed | Verify minDate is set |
| Styling issues | Check Tailwind config |

## 📚 Related Components

- `Calendar` - Date picker
- `Button` - Action buttons
- `Popover` - Dropdown
- `Label` - Form labels

## 🎯 Use Cases

1. **Manager Approval**: Schedule auction start
2. **Admin Panel**: Schedule system events
3. **Vendor Portal**: Schedule asset listings
4. **Reports**: Schedule report generation

## 💡 Tips

- Always validate on backend
- Reset state on case change
- Show timezone for clarity
- Handle scheduled auctions with cron

## 📖 Full Documentation

- **API Docs**: `src/components/ui/auction-schedule-selector.md`
- **Integration**: `docs/AUCTION_SCHEDULE_SELECTOR_INTEGRATION.md`
- **Visual Guide**: `docs/AUCTION_SCHEDULE_SELECTOR_VISUAL_GUIDE.md`
- **Complete**: `docs/AUCTION_SCHEDULE_SELECTOR_COMPLETE.md`

---

**Version**: 1.0.0 | **Status**: ✅ Ready
