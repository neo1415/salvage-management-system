import { PriceExtractionService } from '../src/features/internet-search/services/price-extraction.service';

async function testRealLamborghiniResults() {
  console.log('🔍 Testing Real Lamborghini Serper Results...');
  
  const priceExtractor = new PriceExtractionService();
  
  // Your actual Serper results
  const realSerperResults = [
    {
      "title": "Is the 2023 Lamborghini Revuelto the Cheapest Hybrid Supercar in ...",
      "link": "https://www.prestigeimports.com/blog/is-the-2023-lamborghini-revuelto-the-cheapest-hybrid-supercar-in-the-market/",
      "snippet": "The base price starts at $608,358. This positions it competitively within the hybrid supercar market. For comparison, other hybrid supercars ...",
      "date": "23 May 2024",
      "position": 1
    },
    {
      "title": "Lamborghini Revuelto (2023) Price & Specs",
      "link": "https://www.cars.co.za/motoring-news/lamborghini-revuelto-2023-price-specs/164436/",
      "snippet": "Opting for the 5-year DrivePlan, meanwhile, will push the starting price to R13 000 000. Regardless, it's the most expensive model in the ...",
      "date": "1 Jun 2023",
      "position": 2
    },
    {
      "title": "2025 Lamborghini Revuelto Review, Pricing, and Specs",
      "link": "https://www.caranddriver.com/lamborghini/revuelto-2025",
      "snippet": "The price of the 2025 Lamborghini Revuelto starts at $608,358. Revuelto ... View 2023 Urus Details. Starting at $233,995 · 8/10. Chevron Down Icon · View ...",
      "currency": "US$",
      "price": 608358,
      "position": 6
    },
    {
      "title": "Lamborghini Revuelto (2023) review: Lambo's last V12",
      "link": "https://www.carmagazine.co.uk/car-reviews/lamborghini/revuelto-coupe/",
      "snippet": "Price when new: £450,000 ; On sale in the UK: Now ; Engine: 6498cc naturally aspirated triple e-motor V12, 1001bhp @ 9,250rpm, 535lb ft @ 6750rpm.",
      "date": "4 Oct 2023",
      "position": 7
    },
    {
      "title": "Lamborghini Revuelto Price - Features, Images, Colours & Reviews",
      "link": "https://www.cardekho.com/lamborghini/revuelto",
      "snippet": "Price: It is priced at Rs 8.89 crore (ex-showroom pan India). Variant: The Revuelto is being offered in a single fully loaded variant. Engine & ...",
      "date": "9 Jul 2023",
      "rating": 4.5,
      "ratingCount": 50,
      "position": 8
    },
    {
      "title": "New and Used Lamborghini Revuelto for Sale",
      "link": "https://www.dupontregistry.com/autos/results/lamborghini/revuelto",
      "snippet": "He sold the car for $65,000 and will be listing a car in the next issue. Lamborghini For Sale. Aventador Murcielago Huracan Countach Diablo Gallardo Miura Jalpa ...",
      "position": 10
    }
  ];
  
  console.log('\n📊 Extracting prices from real Serper results...');
  
  const extractedPrices = priceExtractor.extractPrices(realSerperResults, 'vehicle');
  
  console.log('\n🎯 Extracted Prices:');
  extractedPrices.prices.forEach((price, index) => {
    console.log(`${index + 1}. ₦${price.price.toLocaleString()} (${price.originalText}) - Confidence: ${price.confidence}%`);
    console.log(`   Source: ${price.source}`);
    console.log(`   Title: ${price.title}`);
    console.log('');
  });
  
  console.log('📈 Summary:');
  console.log(`Total prices found: ${extractedPrices.prices.length}`);
  console.log(`Average price: ₦${extractedPrices.averagePrice?.toLocaleString()}`);
  console.log(`Confidence: ${extractedPrices.confidence}%`);
  
  // Let's also test individual snippets
  console.log('\n🔍 Testing individual snippets:');
  
  realSerperResults.forEach((result, index) => {
    console.log(`\n--- Result ${index + 1}: ${result.title.substring(0, 50)}... ---`);
    console.log(`Snippet: "${result.snippet}"`);
    if (result.currency && result.price) {
      console.log(`Structured data: ${result.currency} ${result.price}`);
    }
    
    const singleResult = priceExtractor.extractPrices([result], 'vehicle');
    if (singleResult.prices.length > 0) {
      singleResult.prices.forEach(price => {
        console.log(`  → Extracted: ₦${price.price.toLocaleString()} (${price.originalText})`);
      });
    } else {
      console.log('  → No prices extracted');
    }
  });
}

testRealLamborghiniResults().catch(console.error);