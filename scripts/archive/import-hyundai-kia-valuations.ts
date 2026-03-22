import 'dotenv/config';
import { db } from '../../src/lib/db/drizzle';
import { vehicleValuations } from '../../src/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

// Hyundai & Kia vehicle valuation data from official guide (Feb 2026)
// Transform the data into separate records for each condition category
const hyundaiKiaRawData = [
  // HYUNDAI MODELS
  // Elantra
  { make: 'Hyundai', model: 'Elantra', year: 2008, nigUsedLow: 600000, nigUsedHigh: 1200000, tokunboLow: 900000, tokunboHigh: 1800000, avgUsed: 900000, avgTokunbo: 1400000 },
  { make: 'Hyundai', model: 'Elantra', year: 2010, nigUsedLow: 800000, nigUsedHigh: 1500000, tokunboLow: 1200000, tokunboHigh: 2300000, avgUsed: 1100000, avgTokunbo: 1800000 },
  { make: 'Hyundai', model: 'Elantra', year: 2012, nigUsedLow: 1000000, nigUsedHigh: 2000000, tokunboLow: 1800000, tokunboHigh: 3500000, avgUsed: 1500000, avgTokunbo: 2600000 },
  { make: 'Hyundai', model: 'Elantra', year: 2014, nigUsedLow: 1500000, nigUsedHigh: 2800000, tokunboLow: 2500000, tokunboHigh: 4500000, avgUsed: 2100000, avgTokunbo: 3500000 },
  { make: 'Hyundai', model: 'Elantra', year: 2016, nigUsedLow: 2000000, nigUsedHigh: 3800000, tokunboLow: 3500000, tokunboHigh: 6500000, avgUsed: 2900000, avgTokunbo: 5000000 },
  { make: 'Hyundai', model: 'Elantra', year: 2018, nigUsedLow: 3000000, nigUsedHigh: 5500000, tokunboLow: 5500000, tokunboHigh: 9500000, avgUsed: 4300000, avgTokunbo: 7500000 },
  { make: 'Hyundai', model: 'Elantra', year: 2020, nigUsedLow: 4500000, nigUsedHigh: 8000000, tokunboLow: 8500000, tokunboHigh: 14000000, avgUsed: 6300000, avgTokunbo: 11300000 },
  { make: 'Hyundai', model: 'Elantra', year: 2022, tokunboLow: 13000000, tokunboHigh: 20000000, avgTokunbo: 16500000 },
  { make: 'Hyundai', model: 'Elantra', year: 2024, tokunboLow: 18000000, tokunboHigh: 28000000, avgTokunbo: 23000000 },

  // Sonata
  { make: 'Hyundai', model: 'Sonata', year: 2006, nigUsedLow: 500000, nigUsedHigh: 1000000, tokunboLow: 800000, tokunboHigh: 1500000, avgUsed: 750000, avgTokunbo: 1100000 },
  { make: 'Hyundai', model: 'Sonata', year: 2008, nigUsedLow: 700000, nigUsedHigh: 1400000, tokunboLow: 1100000, tokunboHigh: 2200000, avgUsed: 1000000, avgTokunbo: 1600000 },
  { make: 'Hyundai', model: 'Sonata', year: 2010, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1500000, tokunboHigh: 3000000, avgUsed: 1400000, avgTokunbo: 2300000 },
  { make: 'Hyundai', model: 'Sonata', year: 2012, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Hyundai', model: 'Sonata', year: 2014, nigUsedLow: 1800000, nigUsedHigh: 3500000, tokunboLow: 3200000, tokunboHigh: 6000000, avgUsed: 2600000, avgTokunbo: 4600000 },
  { make: 'Hyundai', model: 'Sonata', year: 2016, nigUsedLow: 2500000, nigUsedHigh: 4800000, tokunboLow: 4500000, tokunboHigh: 8500000, avgUsed: 3600000, avgTokunbo: 6500000 },
  { make: 'Hyundai', model: 'Sonata', year: 2018, nigUsedLow: 3500000, nigUsedHigh: 6500000, tokunboLow: 6500000, tokunboHigh: 11500000, avgUsed: 5000000, avgTokunbo: 9000000 },
  { make: 'Hyundai', model: 'Sonata', year: 2020, nigUsedLow: 5500000, nigUsedHigh: 10000000, tokunboLow: 10000000, tokunboHigh: 17000000, avgUsed: 7800000, avgTokunbo: 13500000 },
  { make: 'Hyundai', model: 'Sonata', year: 2022, tokunboLow: 15000000, tokunboHigh: 24000000, avgTokunbo: 19500000 },
  { make: 'Hyundai', model: 'Sonata', year: 2024, tokunboLow: 22000000, tokunboHigh: 35000000, avgTokunbo: 28500000 },

  // Tucson
  { make: 'Hyundai', model: 'Tucson', year: 2006, nigUsedLow: 700000, nigUsedHigh: 1400000, tokunboLow: 1100000, tokunboHigh: 2200000, avgUsed: 1000000, avgTokunbo: 1600000 },
  { make: 'Hyundai', model: 'Tucson', year: 2008, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1500000, tokunboHigh: 3000000, avgUsed: 1400000, avgTokunbo: 2300000 },
  { make: 'Hyundai', model: 'Tucson', year: 2010, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Hyundai', model: 'Tucson', year: 2012, nigUsedLow: 1800000, nigUsedHigh: 3500000, tokunboLow: 3200000, tokunboHigh: 6000000, avgUsed: 2600000, avgTokunbo: 4600000 },
  { make: 'Hyundai', model: 'Tucson', year: 2014, nigUsedLow: 2500000, nigUsedHigh: 4800000, tokunboLow: 4500000, tokunboHigh: 8500000, avgUsed: 3600000, avgTokunbo: 6500000 },
  { make: 'Hyundai', model: 'Tucson', year: 2016, nigUsedLow: 3500000, nigUsedHigh: 6500000, tokunboLow: 6500000, tokunboHigh: 11500000, avgUsed: 5000000, avgTokunbo: 9000000 },
  { make: 'Hyundai', model: 'Tucson', year: 2018, nigUsedLow: 5000000, nigUsedHigh: 9000000, tokunboLow: 9500000, tokunboHigh: 16000000, avgUsed: 7000000, avgTokunbo: 12800000 },
  { make: 'Hyundai', model: 'Tucson', year: 2020, nigUsedLow: 7500000, nigUsedHigh: 13000000, tokunboLow: 14000000, tokunboHigh: 23000000, avgUsed: 10300000, avgTokunbo: 18500000 },
  { make: 'Hyundai', model: 'Tucson', year: 2022, tokunboLow: 20000000, tokunboHigh: 32000000, avgTokunbo: 26000000 },
  { make: 'Hyundai', model: 'Tucson', year: 2024, tokunboLow: 28000000, tokunboHigh: 45000000, avgTokunbo: 36500000 },

  // ix35
  { make: 'Hyundai', model: 'ix35', year: 2010, nigUsedLow: 1100000, nigUsedHigh: 2200000, tokunboLow: 2000000, tokunboHigh: 4000000, avgUsed: 1600000, avgTokunbo: 3000000 },
  { make: 'Hyundai', model: 'ix35', year: 2012, nigUsedLow: 1600000, nigUsedHigh: 3200000, tokunboLow: 3000000, tokunboHigh: 5500000, avgUsed: 2400000, avgTokunbo: 4300000 },
  { make: 'Hyundai', model: 'ix35', year: 2014, nigUsedLow: 2200000, nigUsedHigh: 4200000, tokunboLow: 4000000, tokunboHigh: 7500000, avgUsed: 3200000, avgTokunbo: 5800000 },
  { make: 'Hyundai', model: 'ix35', year: 2016, nigUsedLow: 3000000, nigUsedHigh: 5500000, tokunboLow: 5500000, tokunboHigh: 10000000, avgUsed: 4300000, avgTokunbo: 7800000 },

  // Santa Fe
  { make: 'Hyundai', model: 'Santa Fe', year: 2008, nigUsedLow: 1000000, nigUsedHigh: 2000000, tokunboLow: 1800000, tokunboHigh: 3500000, avgUsed: 1500000, avgTokunbo: 2600000 },
  { make: 'Hyundai', model: 'Santa Fe', year: 2010, nigUsedLow: 1500000, nigUsedHigh: 3000000, tokunboLow: 2800000, tokunboHigh: 5500000, avgUsed: 2300000, avgTokunbo: 4100000 },
  { make: 'Hyundai', model: 'Santa Fe', year: 2012, nigUsedLow: 2200000, nigUsedHigh: 4200000, tokunboLow: 4000000, tokunboHigh: 7500000, avgUsed: 3200000, avgTokunbo: 5800000 },
  { make: 'Hyundai', model: 'Santa Fe', year: 2014, nigUsedLow: 3000000, nigUsedHigh: 5500000, tokunboLow: 5500000, tokunboHigh: 10000000, avgUsed: 4300000, avgTokunbo: 7800000 },
  { make: 'Hyundai', model: 'Santa Fe', year: 2016, nigUsedLow: 4500000, nigUsedHigh: 8000000, tokunboLow: 8500000, tokunboHigh: 14000000, avgUsed: 6300000, avgTokunbo: 11300000 },
  { make: 'Hyundai', model: 'Santa Fe', year: 2018, nigUsedLow: 6500000, nigUsedHigh: 11500000, tokunboLow: 12500000, tokunboHigh: 20000000, avgUsed: 9000000, avgTokunbo: 16300000 },
  { make: 'Hyundai', model: 'Santa Fe', year: 2020, nigUsedLow: 9500000, nigUsedHigh: 16000000, tokunboLow: 18000000, tokunboHigh: 28000000, avgUsed: 12800000, avgTokunbo: 23000000 },
  { make: 'Hyundai', model: 'Santa Fe', year: 2022, tokunboLow: 28000000, tokunboHigh: 42000000, avgTokunbo: 35000000 },
  { make: 'Hyundai', model: 'Santa Fe', year: 2024, tokunboLow: 38000000, tokunboHigh: 58000000, avgTokunbo: 48000000 },

  // Creta
  { make: 'Hyundai', model: 'Creta', year: 2016, nigUsedLow: 2500000, nigUsedHigh: 4500000, tokunboLow: 4500000, tokunboHigh: 8000000, avgUsed: 3500000, avgTokunbo: 6300000 },
  { make: 'Hyundai', model: 'Creta', year: 2018, nigUsedLow: 3500000, nigUsedHigh: 6500000, tokunboLow: 6500000, tokunboHigh: 11000000, avgUsed: 5000000, avgTokunbo: 8800000 },
  { make: 'Hyundai', model: 'Creta', year: 2020, nigUsedLow: 5500000, nigUsedHigh: 9500000, tokunboLow: 10000000, tokunboHigh: 16000000, avgUsed: 7500000, avgTokunbo: 13000000 },
  { make: 'Hyundai', model: 'Creta', year: 2022, tokunboLow: 15000000, tokunboHigh: 23000000, avgTokunbo: 19000000 },
  { make: 'Hyundai', model: 'Creta', year: 2024, tokunboLow: 20000000, tokunboHigh: 32000000, avgTokunbo: 26000000 },

  // Palisade
  { make: 'Hyundai', model: 'Palisade', year: 2020, tokunboLow: 25000000, tokunboHigh: 38000000, avgTokunbo: 31500000 },
  { make: 'Hyundai', model: 'Palisade', year: 2022, tokunboLow: 35000000, tokunboHigh: 52000000, avgTokunbo: 43500000 },
  { make: 'Hyundai', model: 'Palisade', year: 2024, tokunboLow: 48000000, tokunboHigh: 70000000, avgTokunbo: 59000000 },

  // Veloster
  { make: 'Hyundai', model: 'Veloster', year: 2012, nigUsedLow: 1500000, nigUsedHigh: 2800000, tokunboLow: 2800000, tokunboHigh: 5000000, avgUsed: 2100000, avgTokunbo: 3900000 },
  { make: 'Hyundai', model: 'Veloster', year: 2014, nigUsedLow: 2200000, nigUsedHigh: 4000000, tokunboLow: 4000000, tokunboHigh: 7000000, avgUsed: 3100000, avgTokunbo: 5500000 },
  { make: 'Hyundai', model: 'Veloster', year: 2016, nigUsedLow: 3000000, nigUsedHigh: 5500000, tokunboLow: 5500000, tokunboHigh: 9500000, avgUsed: 4300000, avgTokunbo: 7500000 },
  { make: 'Hyundai', model: 'Veloster', year: 2019, tokunboLow: 12000000, tokunboHigh: 18000000, avgTokunbo: 15000000 },

  // Accent
  { make: 'Hyundai', model: 'Accent', year: 2008, nigUsedLow: 500000, nigUsedHigh: 1000000, tokunboLow: 800000, tokunboHigh: 1500000, avgUsed: 750000, avgTokunbo: 1100000 },
  { make: 'Hyundai', model: 'Accent', year: 2010, nigUsedLow: 700000, nigUsedHigh: 1400000, tokunboLow: 1100000, tokunboHigh: 2200000, avgUsed: 1000000, avgTokunbo: 1600000 },
  { make: 'Hyundai', model: 'Accent', year: 2012, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1600000, tokunboHigh: 3200000, avgUsed: 1400000, avgTokunbo: 2400000 },
  { make: 'Hyundai', model: 'Accent', year: 2014, nigUsedLow: 1300000, nigUsedHigh: 2500000, tokunboLow: 2300000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Hyundai', model: 'Accent', year: 2016, nigUsedLow: 1800000, nigUsedHigh: 3500000, tokunboLow: 3200000, tokunboHigh: 6000000, avgUsed: 2600000, avgTokunbo: 4600000 },
  { make: 'Hyundai', model: 'Accent', year: 2018, nigUsedLow: 2500000, nigUsedHigh: 4800000, tokunboLow: 4500000, tokunboHigh: 8500000, avgUsed: 3600000, avgTokunbo: 6500000 },

  // KIA MODELS
  // Sportage
  { make: 'Kia', model: 'Sportage', year: 2006, nigUsedLow: 700000, nigUsedHigh: 1400000, tokunboLow: 1100000, tokunboHigh: 2200000, avgUsed: 1000000, avgTokunbo: 1600000 },
  { make: 'Kia', model: 'Sportage', year: 2008, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1500000, tokunboHigh: 3000000, avgUsed: 1400000, avgTokunbo: 2300000 },
  { make: 'Kia', model: 'Sportage', year: 2010, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Kia', model: 'Sportage', year: 2012, nigUsedLow: 1800000, nigUsedHigh: 3500000, tokunboLow: 3200000, tokunboHigh: 6000000, avgUsed: 2600000, avgTokunbo: 4600000 },
  { make: 'Kia', model: 'Sportage', year: 2014, nigUsedLow: 2500000, nigUsedHigh: 4800000, tokunboLow: 4500000, tokunboHigh: 8500000, avgUsed: 3600000, avgTokunbo: 6500000 },
  { make: 'Kia', model: 'Sportage', year: 2016, nigUsedLow: 3500000, nigUsedHigh: 6500000, tokunboLow: 6500000, tokunboHigh: 11500000, avgUsed: 5000000, avgTokunbo: 9000000 },
  { make: 'Kia', model: 'Sportage', year: 2018, nigUsedLow: 5000000, nigUsedHigh: 9000000, tokunboLow: 9500000, tokunboHigh: 16000000, avgUsed: 7000000, avgTokunbo: 12800000 },
  { make: 'Kia', model: 'Sportage', year: 2020, nigUsedLow: 7500000, nigUsedHigh: 13000000, tokunboLow: 14000000, tokunboHigh: 23000000, avgUsed: 10300000, avgTokunbo: 18500000 },
  { make: 'Kia', model: 'Sportage', year: 2022, tokunboLow: 20000000, tokunboHigh: 32000000, avgTokunbo: 26000000 },
  { make: 'Kia', model: 'Sportage', year: 2024, tokunboLow: 28000000, tokunboHigh: 45000000, avgTokunbo: 36500000 },

  // Sorento
  { make: 'Kia', model: 'Sorento', year: 2008, nigUsedLow: 1000000, nigUsedHigh: 2000000, tokunboLow: 1800000, tokunboHigh: 3500000, avgUsed: 1500000, avgTokunbo: 2600000 },
  { make: 'Kia', model: 'Sorento', year: 2010, nigUsedLow: 1500000, nigUsedHigh: 3000000, tokunboLow: 2800000, tokunboHigh: 5500000, avgUsed: 2300000, avgTokunbo: 4100000 },
  { make: 'Kia', model: 'Sorento', year: 2012, nigUsedLow: 2200000, nigUsedHigh: 4200000, tokunboLow: 4000000, tokunboHigh: 7500000, avgUsed: 3200000, avgTokunbo: 5800000 },
  { make: 'Kia', model: 'Sorento', year: 2014, nigUsedLow: 3000000, nigUsedHigh: 5500000, tokunboLow: 5500000, tokunboHigh: 10000000, avgUsed: 4300000, avgTokunbo: 7800000 },
  { make: 'Kia', model: 'Sorento', year: 2016, nigUsedLow: 4500000, nigUsedHigh: 8000000, tokunboLow: 8500000, tokunboHigh: 14000000, avgUsed: 6300000, avgTokunbo: 11300000 },
  { make: 'Kia', model: 'Sorento', year: 2018, nigUsedLow: 6500000, nigUsedHigh: 11500000, tokunboLow: 12500000, tokunboHigh: 20000000, avgUsed: 9000000, avgTokunbo: 16300000 },
  { make: 'Kia', model: 'Sorento', year: 2020, nigUsedLow: 9500000, nigUsedHigh: 16000000, tokunboLow: 18000000, tokunboHigh: 28000000, avgUsed: 12800000, avgTokunbo: 23000000 },
  { make: 'Kia', model: 'Sorento', year: 2022, tokunboLow: 28000000, tokunboHigh: 42000000, avgTokunbo: 35000000 },
  { make: 'Kia', model: 'Sorento', year: 2024, tokunboLow: 38000000, tokunboHigh: 58000000, avgTokunbo: 48000000 },

  // Rio/Picanto
  { make: 'Kia', model: 'Rio', year: 2008, nigUsedLow: 500000, nigUsedHigh: 1000000, tokunboLow: 800000, tokunboHigh: 1500000, avgUsed: 750000, avgTokunbo: 1100000 },
  { make: 'Kia', model: 'Rio', year: 2010, nigUsedLow: 700000, nigUsedHigh: 1400000, tokunboLow: 1100000, tokunboHigh: 2200000, avgUsed: 1000000, avgTokunbo: 1600000 },
  { make: 'Kia', model: 'Rio', year: 2012, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1600000, tokunboHigh: 3200000, avgUsed: 1400000, avgTokunbo: 2400000 },
  { make: 'Kia', model: 'Rio', year: 2014, nigUsedLow: 1300000, nigUsedHigh: 2500000, tokunboLow: 2300000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Kia', model: 'Rio', year: 2016, nigUsedLow: 1800000, nigUsedHigh: 3500000, tokunboLow: 3200000, tokunboHigh: 6000000, avgUsed: 2600000, avgTokunbo: 4600000 },
  { make: 'Kia', model: 'Rio', year: 2018, nigUsedLow: 2500000, nigUsedHigh: 4800000, tokunboLow: 4500000, tokunboHigh: 8500000, avgUsed: 3600000, avgTokunbo: 6500000 },
  { make: 'Kia', model: 'Picanto', year: 2012, nigUsedLow: 700000, nigUsedHigh: 1400000, tokunboLow: 1200000, tokunboHigh: 2400000, avgUsed: 1000000, avgTokunbo: 1800000 },
  { make: 'Kia', model: 'Picanto', year: 2014, nigUsedLow: 1000000, nigUsedHigh: 2000000, tokunboLow: 1800000, tokunboHigh: 3500000, avgUsed: 1500000, avgTokunbo: 2600000 },
  { make: 'Kia', model: 'Picanto', year: 2016, nigUsedLow: 1400000, nigUsedHigh: 2800000, tokunboLow: 2500000, tokunboHigh: 5000000, avgUsed: 2100000, avgTokunbo: 3800000 },

  // Cerato/Forte
  { make: 'Kia', model: 'Cerato', year: 2008, nigUsedLow: 600000, nigUsedHigh: 1200000, tokunboLow: 900000, tokunboHigh: 1800000, avgUsed: 900000, avgTokunbo: 1400000 },
  { make: 'Kia', model: 'Cerato', year: 2010, nigUsedLow: 800000, nigUsedHigh: 1500000, tokunboLow: 1200000, tokunboHigh: 2300000, avgUsed: 1100000, avgTokunbo: 1800000 },
  { make: 'Kia', model: 'Cerato', year: 2012, nigUsedLow: 1000000, nigUsedHigh: 2000000, tokunboLow: 1800000, tokunboHigh: 3500000, avgUsed: 1500000, avgTokunbo: 2600000 },
  { make: 'Kia', model: 'Cerato', year: 2014, nigUsedLow: 1500000, nigUsedHigh: 2800000, tokunboLow: 2500000, tokunboHigh: 4500000, avgUsed: 2100000, avgTokunbo: 3500000 },
  { make: 'Kia', model: 'Cerato', year: 2016, nigUsedLow: 2000000, nigUsedHigh: 3800000, tokunboLow: 3500000, tokunboHigh: 6500000, avgUsed: 2900000, avgTokunbo: 5000000 },
  { make: 'Kia', model: 'Cerato', year: 2018, nigUsedLow: 3000000, nigUsedHigh: 5500000, tokunboLow: 5500000, tokunboHigh: 9500000, avgUsed: 4300000, avgTokunbo: 7500000 },
  { make: 'Kia', model: 'Forte', year: 2020, nigUsedLow: 4500000, nigUsedHigh: 8000000, tokunboLow: 8500000, tokunboHigh: 14000000, avgUsed: 6300000, avgTokunbo: 11300000 },
  { make: 'Kia', model: 'Forte', year: 2022, tokunboLow: 13000000, tokunboHigh: 20000000, avgTokunbo: 16500000 },

  // Optima/K5
  { make: 'Kia', model: 'Optima', year: 2006, nigUsedLow: 500000, nigUsedHigh: 1000000, tokunboLow: 800000, tokunboHigh: 1500000, avgUsed: 750000, avgTokunbo: 1100000 },
  { make: 'Kia', model: 'Optima', year: 2008, nigUsedLow: 700000, nigUsedHigh: 1400000, tokunboLow: 1100000, tokunboHigh: 2200000, avgUsed: 1000000, avgTokunbo: 1600000 },
  { make: 'Kia', model: 'Optima', year: 2010, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1500000, tokunboHigh: 3000000, avgUsed: 1400000, avgTokunbo: 2300000 },
  { make: 'Kia', model: 'Optima', year: 2012, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Kia', model: 'Optima', year: 2014, nigUsedLow: 1800000, nigUsedHigh: 3500000, tokunboLow: 3200000, tokunboHigh: 6000000, avgUsed: 2600000, avgTokunbo: 4600000 },
  { make: 'Kia', model: 'Optima', year: 2016, nigUsedLow: 2500000, nigUsedHigh: 4800000, tokunboLow: 4500000, tokunboHigh: 8500000, avgUsed: 3600000, avgTokunbo: 6500000 },
  { make: 'Kia', model: 'Optima', year: 2018, nigUsedLow: 3500000, nigUsedHigh: 6500000, tokunboLow: 6500000, tokunboHigh: 11500000, avgUsed: 5000000, avgTokunbo: 9000000 },
  { make: 'Kia', model: 'K5', year: 2020, nigUsedLow: 5500000, nigUsedHigh: 10000000, tokunboLow: 10000000, tokunboHigh: 17000000, avgUsed: 7800000, avgTokunbo: 13500000 },
  { make: 'Kia', model: 'K5', year: 2022, tokunboLow: 15000000, tokunboHigh: 24000000, avgTokunbo: 19500000 },
  { make: 'Kia', model: 'K5', year: 2024, tokunboLow: 22000000, tokunboHigh: 35000000, avgTokunbo: 28500000 },

  // Soul
  { make: 'Kia', model: 'Soul', year: 2010, nigUsedLow: 900000, nigUsedHigh: 1800000, tokunboLow: 1500000, tokunboHigh: 3000000, avgUsed: 1400000, avgTokunbo: 2300000 },
  { make: 'Kia', model: 'Soul', year: 2012, nigUsedLow: 1200000, nigUsedHigh: 2500000, tokunboLow: 2200000, tokunboHigh: 4500000, avgUsed: 1900000, avgTokunbo: 3400000 },
  { make: 'Kia', model: 'Soul', year: 2014, nigUsedLow: 1800000, nigUsedHigh: 3500000, tokunboLow: 3200000, tokunboHigh: 6000000, avgUsed: 2600000, avgTokunbo: 4600000 },
  { make: 'Kia', model: 'Soul', year: 2016, nigUsedLow: 2500000, nigUsedHigh: 4800000, tokunboLow: 4500000, tokunboHigh: 8500000, avgUsed: 3600000, avgTokunbo: 6500000 },
  { make: 'Kia', model: 'Soul', year: 2018, nigUsedLow: 3500000, nigUsedHigh: 6500000, tokunboLow: 6500000, tokunboHigh: 11500000, avgUsed: 5000000, avgTokunbo: 9000000 },
  { make: 'Kia', model: 'Soul', year: 2020, tokunboLow: 12000000, tokunboHigh: 18000000, avgTokunbo: 15000000 },

  // Stinger
  { make: 'Kia', model: 'Stinger', year: 2018, nigUsedLow: 8000000, nigUsedHigh: 14000000, tokunboLow: 15000000, tokunboHigh: 24000000, avgUsed: 11000000, avgTokunbo: 19500000 },
  { make: 'Kia', model: 'Stinger', year: 2020, nigUsedLow: 12000000, nigUsedHigh: 20000000, tokunboLow: 22000000, tokunboHigh: 35000000, avgUsed: 16000000, avgTokunbo: 28500000 },
  { make: 'Kia', model: 'Stinger', year: 2022, tokunboLow: 32000000, tokunboHigh: 48000000, avgTokunbo: 40000000 },

  // Telluride
  { make: 'Kia', model: 'Telluride', year: 2020, tokunboLow: 25000000, tokunboHigh: 38000000, avgTokunbo: 31500000 },
  { make: 'Kia', model: 'Telluride', year: 2022, tokunboLow: 35000000, tokunboHigh: 52000000, avgTokunbo: 43500000 },
  { make: 'Kia', model: 'Telluride', year: 2024, tokunboLow: 48000000, tokunboHigh: 70000000, avgTokunbo: 59000000 },
];

// Transform raw data into database records with condition categories
function transformToDbRecords() {
  const records: any[] = [];
  
  for (const item of hyundaiKiaRawData) {
    // Add nig_used_low record if data exists
    if (item.nigUsedLow && item.nigUsedHigh && item.avgUsed) {
      records.push({
        make: item.make,
        model: item.model,
        year: item.year,
        conditionCategory: 'nig_used_low',
        lowPrice: item.nigUsedLow,
        highPrice: item.nigUsedHigh,
        averagePrice: item.avgUsed,
        dataSource: 'Hyundai & Kia in Nigeria Comprehensive Price & Valuation Guide (Feb 2026)',
      });
    }
    
    // Add tokunbo_low record if data exists
    if (item.tokunboLow && item.tokunboHigh && item.avgTokunbo) {
      records.push({
        make: item.make,
        model: item.model,
        year: item.year,
        conditionCategory: 'tokunbo_low',
        lowPrice: item.tokunboLow,
        highPrice: item.tokunboHigh,
        averagePrice: item.avgTokunbo,
        dataSource: 'Hyundai & Kia in Nigeria Comprehensive Price & Valuation Guide (Feb 2026)',
      });
    }
  }
  
  return records;
}

const hyundaiKiaValuations = transformToDbRecords();

async function importHyundaiKiaValuations() {
  console.log('Starting Hyundai & Kia vehicle valuation import...');
  console.log(`Total records to import: ${hyundaiKiaValuations.length}`);

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const valuation of hyundaiKiaValuations) {
    try {
      // Check if record already exists
      const existing = await db
        .select()
        .from(vehicleValuations)
        .where(
          and(
            eq(vehicleValuations.make, valuation.make),
            eq(vehicleValuations.model, valuation.model),
            eq(vehicleValuations.year, valuation.year),
            eq(vehicleValuations.conditionCategory, valuation.conditionCategory)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing record
        await db
          .update(vehicleValuations)
          .set({
            lowPrice: valuation.lowPrice.toString(),
            highPrice: valuation.highPrice.toString(),
            averagePrice: valuation.averagePrice.toString(),
            dataSource: valuation.dataSource,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(vehicleValuations.make, valuation.make),
              eq(vehicleValuations.model, valuation.model),
              eq(vehicleValuations.year, valuation.year),
              eq(vehicleValuations.conditionCategory, valuation.conditionCategory)
            )
          );
        updated++;
        console.log(`✓ Updated: ${valuation.year} ${valuation.make} ${valuation.model} (${valuation.conditionCategory})`);
      } else {
        // Insert new record
        await db.insert(vehicleValuations).values({
          make: valuation.make,
          model: valuation.model,
          year: valuation.year,
          conditionCategory: valuation.conditionCategory,
          lowPrice: valuation.lowPrice.toString(),
          highPrice: valuation.highPrice.toString(),
          averagePrice: valuation.averagePrice.toString(),
          dataSource: valuation.dataSource,
          createdBy: SYSTEM_USER_ID,
        });
        imported++;
        console.log(`✓ Imported: ${valuation.year} ${valuation.make} ${valuation.model} (${valuation.conditionCategory})`);
      }
    } catch (error) {
      console.error(`✗ Error processing ${valuation.year} ${valuation.make} ${valuation.model} (${valuation.conditionCategory}):`, error);
      skipped++;
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`Total records processed: ${hyundaiKiaValuations.length}`);
  console.log(`New records imported: ${imported}`);
  console.log(`Existing records updated: ${updated}`);
  console.log(`Records skipped (errors): ${skipped}`);
  console.log('======================\n');
}

importHyundaiKiaValuations()
  .then(() => {
    console.log('Hyundai & Kia valuation import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error during import:', error);
    process.exit(1);
  });
