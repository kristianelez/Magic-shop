import * as cheerio from "cheerio";

async function checkPage() {
  const url = 'https://greentime.ba/collections/profesionalna-sredstva-za-ciscenje';
  console.log('Fetching:', url);
  
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('\nTotal product-card elements:', $('product-card').length);
  
  // Check for main collection vs related products
  const mainCollection = $('.collection__products product-card').length;
  const recommendedProducts = $('.product-recommendations product-card').length;
  
  console.log('Products in main collection:', mainCollection);
  console.log('Products in recommendations:', recommendedProducts);
  
  // List ALL products with their section
  console.log('\n=== ALL PRODUCTS ===\n');
  $('product-card').each((i, el) => {
    const $el = $(el);
    const name = $el.find('.card__title a').text().trim();
    
    // Check which section this product is in
    const isInRecommendations = $el.closest('.product-recommendations').length > 0;
    const isInCollection = $el.closest('.collection__products').length > 0;
    
    const section = isInRecommendations ? 'RECOMMENDATIONS' : (isInCollection ? 'MAIN COLLECTION' : 'OTHER');
    
    console.log(`${i+1}. [${section}] ${name}`);
  });
}

checkPage().then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
