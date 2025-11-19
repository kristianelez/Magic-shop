import { db } from "./db";
import { products, sales, activities } from "../shared/schema";
import * as cheerio from "cheerio";

interface GreentimeProduct {
  name: string;
  price: number;
  category: string;
  brand?: string;
}

const CATEGORIES = [
  { name: "Ubrusi za ruke", url: "https://greentime.ba/collections/ubrusi-za-ruke" },
  { name: "Toaletni papir", url: "https://greentime.ba/collections/toaletni-papir" },
  { name: "Salvete", url: "https://greentime.ba/collections/salvete-za-restorane" },
  { name: "Dispenzeri", url: "https://greentime.ba/collections/dispenzeri-za-ubruse-toaletni-papir-sapune" },
  { name: "Sapuni za ruke", url: "https://greentime.ba/collections/sapuni-za-ruke" },
  { name: "Profesionalna sredstva za čišćenje", url: "https://greentime.ba/collections/profesionalna-sredstva-za-ciscenje" },
  { name: "Oprema za čišćenje objekata", url: "https://greentime.ba/collections/oprema-za-ciscenje-objekata" },
  { name: "Oprema za čišćenje staklenih površina", url: "https://greentime.ba/collections/oprema-za-ciscenje-staklenih-povrsina" },
  { name: "Kolica za čišćenje", url: "https://greentime.ba/collections/kolica-za-ciscenje" },
  { name: "Vrećice za smeće", url: "https://greentime.ba/collections/vrecice-za-smece" },
  { name: "Hotelska kolica", url: "https://greentime.ba/collections/hotelska-kolica" },
  { name: "Hotelska kozmetika", url: "https://greentime.ba/collections/hotelska-kozmetika" },
  { name: "Osvježivači prostora", url: "https://greentime.ba/collections/osvjezivaci-prostora" },
  { name: "Mašine za dubinsko pranje", url: "https://greentime.ba/collections/masine-za-dubinsko-pranje-ciscenje" },
  { name: "Mašine za pranje podova", url: "https://greentime.ba/collections/masine-za-pranje-i-ciscenje-podova-eureka" },
  { name: "Industrijski usisivači", url: "https://greentime.ba/collections/industrijski-usisivaci" },
  { name: "Automobilska oprema", url: "https://greentime.ba/collections/automobilska-oprema-i-kozmetika" },
  { name: "Ugostiteljska oprema", url: "https://greentime.ba/collections/ugostiteljska-oprema" },
];

async function fetchCategoryProducts(categoryUrl: string, categoryName: string): Promise<GreentimeProduct[]> {
  try {
    console.log(`\nFetching products from: ${categoryName}`);
    console.log(`  URL: ${categoryUrl}`);
    
    const response = await fetch(categoryUrl);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const productsData: GreentimeProduct[] = [];
    
    // Find all product cards
    $('product-card').each((_index, element) => {
      const $el = $(element);
      
      // Extract product name
      const name = $el.find('.card__title a.card-link').text().trim();
      
      // Extract brand
      const brand = $el.find('.card__vendor').text().trim() || undefined;
      
      // Extract price
      const priceText = $el.find('.price__current .money').first().text().trim();
      const priceMatch = priceText.match(/(\d+,\d+)/);
      
      if (name && priceMatch) {
        const priceStr = priceMatch[1].replace(',', '.');
        const price = parseFloat(priceStr);
        
        if (!isNaN(price)) {
          productsData.push({
            name,
            price,
            category: categoryName,
            brand,
          });
          
          console.log(`  ✓ ${name} - ${price} KM ${brand ? `(${brand})` : ''}`);
        }
      }
    });
    
    console.log(`  Total found: ${productsData.length} products`);
    return productsData;
  } catch (error) {
    console.error(`Error fetching ${categoryName}:`, error);
    return [];
  }
}

async function importAllProducts() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  GREENTIME PRODUCT IMPORT SCRIPT");
  console.log("═══════════════════════════════════════════════════════\n");
  
  // Step 1: Fetch products from all categories (WITHOUT touching database yet)
  console.log("Step 1: Fetching products from greentime.ba...");
  console.log(`Total categories to process: ${CATEGORIES.length}\n`);
  
  const allProducts: GreentimeProduct[] = [];
  
  for (let i = 0; i < CATEGORIES.length; i++) {
    const category = CATEGORIES[i];
    console.log(`[${i + 1}/${CATEGORIES.length}] Processing: ${category.name}`);
    
    const categoryProducts = await fetchCategoryProducts(category.url, category.name);
    allProducts.push(...categoryProducts);
    
    // Delay to avoid overwhelming the server
    if (i < CATEGORIES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log("\n\n═══════════════════════════════════════════════════════");
  console.log(`  SCRAPING COMPLETE: ${allProducts.length} products collected`);
  console.log("═══════════════════════════════════════════════════════\n");
  
  // Step 2: Validate scraping results BEFORE touching database
  const MIN_PRODUCT_COUNT = 200; // Safety threshold
  
  if (allProducts.length < MIN_PRODUCT_COUNT) {
    console.error(`\n❌ SAFETY CHECK FAILED!`);
    console.error(`   Expected at least ${MIN_PRODUCT_COUNT} products, but only got ${allProducts.length}.`);
    console.error(`   This might indicate a scraping error or website changes.`);
    console.error(`   Aborting import to prevent data loss.\n`);
    process.exit(1);
  }
  
  console.log(`✓ Global safety check passed (${allProducts.length} >= ${MIN_PRODUCT_COUNT} products)\n`);
  
  // Validate per-category counts
  console.log("Step 2b: Validating per-category results...\n");
  const categoryCounts = new Map<string, number>();
  allProducts.forEach(p => {
    categoryCounts.set(p.category, (categoryCounts.get(p.category) || 0) + 1);
  });
  
  let hasEmptyCategories = false;
  CATEGORIES.forEach(cat => {
    const count = categoryCounts.get(cat.name) || 0;
    console.log(`  ${cat.name}: ${count} products`);
    if (count === 0) {
      console.warn(`  ⚠ WARNING: Category "${cat.name}" has 0 products!`);
      hasEmptyCategories = true;
    }
  });
  
  if (hasEmptyCategories) {
    console.error(`\n❌ Some categories returned 0 products.`);
    console.error(`   This might indicate scraping issues.`);
    console.error(`   Please review the warnings above before proceeding.\n`);
    process.exit(1);
  }
  
  console.log(`\n✓ All categories have products\n`);
  
  // Step 3: Delete and insert in single operation (error handling wrapper)
  console.log("Step 3: Replacing products in database...\n");
  
  try {
    // Delete existing data
    console.log("  - Deleting sales...");
    await db.delete(sales);
    console.log("  - Deleting activities...");
    await db.delete(activities);
    console.log("  - Deleting products...");
    await db.delete(products);
    console.log(`  ✓ Old data deleted.\n`);
    
    console.log("  - Inserting new products...\n");
    
    let insertedCount = 0;
    const errors: string[] = [];
    
    for (const product of allProducts) {
      try {
        // Determine recommended customer types based on category
        let recommendedFor: string[] = [];
        
        if (product.category.includes('Hotelska')) {
          recommendedFor = ['hotel'];
        } else if (product.category.includes('Ugostiteljska')) {
          recommendedFor = ['restoran', 'kafic'];
        } else if (product.category.includes('Pekara') || product.category.includes('Salvete')) {
          recommendedFor = ['pekara', 'restoran', 'kafic'];
        } else {
          // General cleaning products suitable for all
          recommendedFor = ['hotel', 'restoran', 'kafic', 'pekara', 'fabrika'];
        }
        
        await db.insert(products).values({
          name: product.name,
          price: product.price.toFixed(2), // Convert number to decimal string
          stock: 100,
          category: product.category,
          description: product.brand ? `Brend: ${product.brand}` : '',
          recommendedFor: recommendedFor,
        });
        
        insertedCount++;
        
        if (insertedCount % 20 === 0) {
          console.log(`    ✓ Inserted ${insertedCount}/${allProducts.length} products...`);
        }
      } catch (error: any) {
        errors.push(`${product.name}: ${error.message}`);
      }
    }
    
    if (errors.length > 0) {
      console.error(`\n  ⚠ ${errors.length} products failed to insert:`);
      errors.slice(0, 5).forEach(err => console.error(`    - ${err}`));
      if (errors.length > 5) {
        console.error(`    ... and ${errors.length - 5} more errors`);
      }
    }
    
    const skippedCount = allProducts.length - insertedCount;
    
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  IMPORT COMPLETE!");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  ✓ Successfully imported: ${insertedCount} products`);
    if (skippedCount > 0) {
      console.log(`  ✗ Skipped (errors): ${skippedCount} products`);
    }
    console.log("═══════════════════════════════════════════════════════\n");
    
  } catch (error: any) {
    console.error("\n\n❌ DATABASE ERROR during import:");
    console.error(error);
    console.error("\nImport failed. Database may be in inconsistent state.");
    console.error("Please review errors above and re-run import script.\n");
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the import
importAllProducts().catch((error) => {
  console.error("\n\n❌ FATAL ERROR:", error);
  process.exit(1);
});
