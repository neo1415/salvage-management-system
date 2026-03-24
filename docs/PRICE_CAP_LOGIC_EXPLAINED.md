# Price Cap Logic Explanation

## Overview
Price caps (validation ranges) are applied during price extraction from internet search results to filter out:
1. **Outliers** - Unrealistic prices that would skew the average
2. **Errors** - Misextracted prices (e.g., part prices, rental fees, deposits)
3. **Irrelevant listings** - Items that don't match the search intent

## Price Ranges by Item Type

### 1. Vehicles
- **Minimum**: ₦500,000 (500k)
- **Maximum**: ₦1,000,000,000 (1B)
- **Rationale**: 
  - Min: Filters out motorcycles, bicycles, and part prices
  - Max: Accommodates luxury vehicles (Lamborghini, Ferrari, etc.)

### 2. Electronics
- **Minimum**: ₦10,000 (10k)
- **Maximum**: ₦5,000,000 (5M)
- **Rationale**:
  - Min: Filters out accessories (cases, chargers)
  - Max: Accommodates high-end laptops, phones, and professional equipment

### 3. Appliances
- **Minimum**: ₦20,000 (20k)
- **Maximum**: ₦2,000,000 (2M)
- **Rationale**:
  - Min: Filters out small accessories
  - Max: Accommodates industrial-grade appliances

### 4. Property
- **Minimum**: ₦1,000,000 (1M)
- **Maximum**: ₦1,000,000,000 (1B)
- **Rationale**:
  - Min: Filters out land plots and incomplete structures
  - Max: Accommodates luxury properties

### 5. Jewelry
- **Minimum**: ₦5,000 (5k)
- **Maximum**: ₦10,000,000 (10M)
- **Rationale**:
  - Min: Filters out costume jewelry
  - Max: Accommodates luxury jewelry

### 6. Furniture
- **Minimum**: ₦10,000 (10k)
- **Maximum**: ₦5,000,000 (5M)
- **Rationale**:
  - Min: Filters out small items
  - Max: Accommodates luxury furniture sets

### 7. Machinery (Heavy Equipment)
- **Minimum**: ₦100,000 (100k)
- **Maximum**: ₦1,000,000,000 (1B)
- **Rationale**:
  - Min: Filters out tools and small equipment
  - Max: Accommodates large construction equipment (excavators, bulldozers)

## Special Validation Rules

### Luxury Vehicles
- **Brands**: Lamborghini, Ferrari, McLaren, Bugatti, Koenigsegg, Pagani, Rolls-Royce, Bentley
- **Minimum**: ₦100,000,000 (100M)
- **Exceptions**: Down payments, deposits, monthly installments
- **Rationale**: Prevents undervaluation of exotic vehicles

### Heavy Equipment
- **Brands**: Caterpillar (CAT), Komatsu, Volvo, Hitachi, JCB, Liebherr, Doosan, Hyundai
- **Minimum**: ₦32,000,000 (32M) - **UPDATED from ₦30M**
- **Exceptions**: Down payments, deposits, rentals, hire fees
- **Rationale**: 
  - CAT 320 excavators range from ₦32M to ₦640M in Nigeria
  - Prevents undervaluation of heavy construction equipment
  - Increased from ₦30M after market research showed ₦28M was too low

## Statistical Outlier Detection

In addition to hard caps, the system uses **IQR (Interquartile Range) method** to remove statistical outliers:

1. Calculate Q1 (25th percentile) and Q3 (75th percentile)
2. Calculate IQR = Q3 - Q1
3. Remove prices outside: [Q1 - 1.5×IQR, Q3 + 1.5×IQR]

This removes extreme values that would skew the average, even if they're within the hard caps.

## Why Caps Are Necessary

### Without Caps:
- A search for "Toyota Camry 2020" might return:
  - ₦8,500,000 (actual vehicle)
  - ₦50,000 (bumper part)
  - ₦200,000 (monthly rental)
  - ₦1,000,000 (down payment)
  - ₦15,000,000,000 (typo or currency error)

### With Caps:
- Only realistic vehicle prices (₦500k - ₦1B) are included
- Average is accurate and reliable
- Outliers are logged for debugging

## Logging and Transparency

All price rejections are logged with reasons:
- `🚫 Price range validation failed for {type}: ₦{price} is outside range ₦{min} - ₦{max}`
- `🚫 Heavy equipment price validation failed: ₦{price} is below minimum ₦32M for {brand}`
- `🚫 Luxury vehicle price validation failed: ₦{price} is below minimum ₦100M for {brand}`
- `🚫 Statistical outlier removed: ₦{price} (bounds: ₦{lower} - ₦{upper})`

## Recommendations

### Keep Caps:
✅ Essential for data quality
✅ Prevents undervaluation
✅ Filters out irrelevant results

### Make Flexible:
✅ Already flexible - different ranges per item type
✅ Special rules for luxury/heavy equipment
✅ Statistical outlier detection adapts to data

### Improve:
✅ Add more logging (DONE in this fix)
✅ Update caps based on market research (DONE - heavy equipment ₦30M → ₦32M)
✅ Consider dynamic caps based on historical data (future enhancement)

## Location: Code Implementation

- **File**: `src/features/internet-search/services/price-extraction.service.ts`
- **Constant**: `PRICE_RANGES` (lines ~90-100)
- **Function**: `validatePrice()` (lines ~420-500)
- **Outlier Detection**: `removeStatisticalOutliers()` (lines ~380-420)
