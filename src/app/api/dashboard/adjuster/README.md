# Adjuster Dashboard API

## Overview
This API endpoint provides dashboard statistics for claims adjusters, showing counts of cases they've created broken down by status.

## Endpoint

### GET `/api/dashboard/adjuster`

Get dashboard statistics for the authenticated claims adjuster.

## Authentication
- **Required**: Yes
- **Role**: `claims_adjuster`

## Request

No request body or query parameters required. The endpoint automatically filters data based on the authenticated user's ID.

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "totalCases": 5,
    "pendingApproval": 2,
    "approved": 2,
    "rejected": 1
  }
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "error": "Forbidden: Only claims adjusters can access this endpoint"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to fetch dashboard statistics"
}
```

## Data Fields

| Field | Type | Description |
|-------|------|-------------|
| `totalCases` | number | Total number of cases created by the adjuster |
| `pendingApproval` | number | Cases with status `pending_approval` |
| `approved` | number | Cases with status `approved` |
| `rejected` | number | Cases with status `cancelled` |

## Case Status Values

The endpoint counts cases based on these status values:

- `draft` - Case saved but not submitted (not counted separately)
- `pending_approval` - Case submitted, awaiting manager approval
- `approved` - Case approved by manager
- `active_auction` - Case is in auction (counted in total only)
- `sold` - Case sold to a vendor (counted in total only)
- `cancelled` - Case rejected/cancelled (counted as "rejected")

## Usage Example

### JavaScript/TypeScript
```typescript
const response = await fetch('/api/dashboard/adjuster');
const result = await response.json();

if (result.success) {
  console.log('Total Cases:', result.data.totalCases);
  console.log('Pending Approval:', result.data.pendingApproval);
  console.log('Approved:', result.data.approved);
  console.log('Rejected:', result.data.rejected);
}
```

### React Component
```tsx
const [stats, setStats] = useState(null);

useEffect(() => {
  const fetchStats = async () => {
    const response = await fetch('/api/dashboard/adjuster');
    const result = await response.json();
    if (result.success) {
      setStats(result.data);
    }
  };
  
  fetchStats();
}, []);
```

## Performance

- Uses efficient SQL COUNT queries
- Indexed columns: `created_by`, `status`
- Fast response time even with large datasets
- No N+1 query problems

## Security

- ✅ Authentication required
- ✅ Role-based authorization
- ✅ Data isolation (users only see their own cases)
- ✅ SQL injection protection (Drizzle ORM)
- ✅ Error messages don't expose sensitive data

## Related Endpoints

- `GET /api/cases` - Get list of cases
- `POST /api/cases` - Create a new case
- `GET /api/cases/[id]` - Get case details

## Database Schema

The endpoint queries the `salvage_cases` table:

```sql
SELECT COUNT(*) FROM salvage_cases 
WHERE created_by = :userId 
AND status = :status;
```

## Testing

### Manual Testing
1. Log in as a claims adjuster
2. Navigate to `/adjuster/dashboard`
3. Verify statistics are displayed
4. Create a new case
5. Refresh dashboard and verify counts updated

### Automated Testing
See `tests/integration/dashboard/adjuster-dashboard.test.ts` (to be created)

## Changelog

### 2024-02-04
- Initial implementation
- Added authentication and authorization
- Added case status counting
- Added error handling
