# Bugfix Requirements Document

## Introduction

The AI assessment system is producing incorrect valuations for vehicles, specifically returning ₦18M for a 2021 Toyota Camry in excellent condition when the expected valuation should be ₦32M-₦48M (Tokunbo average ₦40M). The root causes include:

1. Vision API only detects damage but doesn't assess overall vehicle condition (excellent/good/fair/poor)
2. Case creation form doesn't capture critical valuation inputs: vehicle condition and mileage
3. Condition adjustments exist in code but are never applied because condition is never captured from user
4. Vision API is biased toward detecting damage rather than recognizing pristine condition

This results in significant undervaluation of vehicles in excellent condition, causing user confusion and loss of trust in the AI assessment system.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user uploads photos of a 2021 Toyota Camry in excellent condition THEN the system returns a valuation of ₦18M instead of the expected ₦32M-₦48M range

1.2 WHEN a user uploads photos showing a pristine vehicle with no visible damage THEN the Vision API fails to recognize the excellent condition and does not apply positive condition adjustments

1.3 WHEN a user creates a case for vehicle assessment THEN the system does not provide input fields for vehicle condition (excellent/good/fair/poor) or mileage

1.4 WHEN the AI assessment service calculates valuation THEN it cannot apply condition adjustments because the condition parameter is never captured from the user

1.5 WHEN the Vision API analyzes photos THEN it only searches for damage-related keywords and does not assess overall vehicle condition quality

1.6 WHEN a vehicle has no detected damage THEN the system assumes "fair" condition by default instead of allowing user to specify actual condition

### Expected Behavior (Correct)

2.1 WHEN a user uploads photos of a 2021 Toyota Camry in excellent condition THEN the system SHALL return a valuation in the ₦32M-₦48M range (average ₦40M) based on market data

2.2 WHEN a user creates a case for vehicle assessment THEN the system SHALL provide input fields to capture vehicle condition (excellent/good/fair/poor) and mileage

2.3 WHEN the user specifies "excellent" condition THEN the system SHALL apply a +15% adjustment to the base market value

2.4 WHEN the user specifies "good" condition THEN the system SHALL apply no adjustment (0%) to the base market value

2.5 WHEN the user specifies "fair" condition THEN the system SHALL apply a -15% adjustment to the base market value

2.6 WHEN the user specifies "poor" condition THEN the system SHALL apply a -30% adjustment to the base market value

2.7 WHEN the user provides mileage information THEN the system SHALL apply appropriate mileage adjustments based on expected mileage for vehicle age (±15,000 km/year baseline)

2.8 WHEN mileage is below 50% of expected for age THEN the system SHALL apply a +10% premium adjustment

2.9 WHEN mileage is 50-80% of expected for age THEN the system SHALL apply a +5% adjustment

2.10 WHEN mileage is 80-120% of expected for age THEN the system SHALL apply no adjustment (0%)

2.11 WHEN mileage is 120-150% of expected for age THEN the system SHALL apply a -5% adjustment

2.12 WHEN mileage is above 150% of expected for age THEN the system SHALL apply a -15% adjustment

2.13 WHEN both condition and mileage adjustments apply THEN the system SHALL apply them multiplicatively to the base market value (e.g., base × condition_factor × mileage_factor)

2.14 WHEN the final valuation is calculated THEN the system SHALL display the breakdown showing: base market value, condition adjustment, mileage adjustment, damage deductions, and final salvage value

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the Vision API detects actual damage in photos THEN the system SHALL CONTINUE TO identify and classify damage types (structural, mechanical, cosmetic, electrical, interior)

3.2 WHEN damage is detected THEN the system SHALL CONTINUE TO apply appropriate damage deductions using the damage calculation service

3.3 WHEN market value is queried THEN the system SHALL CONTINUE TO use the database-first approach (database → scraping → estimation fallback)

3.4 WHEN a user provides explicit market value THEN the system SHALL CONTINUE TO use that value with 90% confidence

3.5 WHEN vehicle information (make/model/year) is provided THEN the system SHALL CONTINUE TO query the valuation database and market data scraping service

3.6 WHEN total loss conditions are met (repair cost > 70% of value OR structural damage > 70%) THEN the system SHALL CONTINUE TO flag the vehicle as total loss

3.7 WHEN confidence scores are calculated THEN the system SHALL CONTINUE TO consider photo quality, vehicle detection, damage detection, and valuation accuracy

3.8 WHEN assessment warnings are generated THEN the system SHALL CONTINUE TO validate salvage value, reserve price, and severity classifications

3.9 WHEN the assessment is complete THEN the system SHALL CONTINUE TO return detailed breakdown including damage scores, confidence metrics, and recommendations
