import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { db } from './db';
import { products } from '../shared/schema';

interface CSVRow {
  Handle: string;
  Title: string;
  'Body (HTML)': string;
  Vendor: string;
  'Product Category': string;
  Type: string;
  Tags: string;
  Published: string;
  'Option1 Name': string;
  'Option1 Value': string;
  'Variant SKU': string;
  'Variant Price': string;
  'Variant Compare At Price': string;
}

function determineRecommendedFor(title: string, category: string, tags: string, vendor: string): string[] {
  const text = `${title} ${category} ${tags} ${vendor}`.toLowerCase();
  const recommended: Set<string> = new Set();

  if (text.includes('hotel') || text.includes('kupatilo') || text.includes('tepih') || text.includes('toalet')) {
    recommended.add('hotel');
  }

  if (text.includes('pekara') || text.includes('pećnica') || text.includes('brašno') || text.includes('peciva')) {
    recommended.add('pekara');
  }

  if (text.includes('kafić') || text.includes('kafic') || text.includes('kafe') || text.includes('espreso') || text.includes('espresso')) {
    recommended.add('kafic');
  }

  if (text.includes('restoran') || text.includes('kuhinja') || text.includes('roštilj') || text.includes('rostilj') || 
      text.includes('mašina za pranje') || text.includes('masina za pranje')) {
    recommended.add('restoran');
  }

  if (text.includes('fabrika') || text.includes('industrij') || text.includes('pogon') || text.includes('hala')) {
    recommended.add('fabrika');
  }

  if (text.includes('čišćenje') || text.includes('ciscenje') || text.includes('čisti') || text.includes('cisti') ||
      text.includes('pranje') || text.includes('deterdžent') || text.includes('deterdzent') || 
      text.includes('sapun') || text.includes('sredstvo')) {
    recommended.add('hotel');
    recommended.add('restoran');
    recommended.add('kafic');
  }

  if (text.includes('dezinfek') || text.includes('higijena') || text.includes('sanitarn')) {
    recommended.add('hotel');
    recommended.add('restoran');
    recommended.add('fabrika');
  }

  if (text.includes('staklo') || text.includes('prozor')) {
    recommended.add('hotel');
    recommended.add('kafic');
  }

  if (text.includes('pod') || text.includes('površin')) {
    recommended.add('hotel');
    recommended.add('restoran');
    recommended.add('kafic');
    recommended.add('fabrika');
  }

  if (recommended.size === 0) {
    return ['hotel', 'restoran', 'kafic', 'pekara', 'fabrika'];
  }

  return Array.from(recommended);
}

function determineCategory(productCategory: string, tags: string, title: string): string {
  const text = `${productCategory} ${tags} ${title}`.toLowerCase();
  
  if (text.includes('oprema') || text.includes('mašina') || text.includes('masina') || text.includes('aparat')) {
    return 'Oprema';
  }
  
  if (text.includes('čišćenje') || text.includes('ciscenje') || text.includes('deterd') || text.includes('sapun')) {
    return 'Sredstva za čišćenje';
  }
  
  if (text.includes('osvježivač') || text.includes('osveživač') || text.includes('miris')) {
    return 'Osvježivači';
  }
  
  if (text.includes('dezinfek')) {
    return 'Dezinfekciona sredstva';
  }
  
  if (text.includes('wc') || text.includes('toalet')) {
    return 'WC sredstva';
  }
  
  return 'Razno';
}

export async function importProductsFromCSV(filePath: string) {
  console.log('🚀 Pokrećem import proizvoda iz CSV fajla...');
  
  const existingProducts = await db.select({ name: products.name }).from(products);
  const existingNames = new Set(existingProducts.map(p => p.name));
  console.log(`📊 Pronađeno ${existingNames.size} postojećih proizvoda u bazi`);
  
  const fileContent = readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CSVRow[];

  console.log(`📦 Pronađeno ${records.length} redova u CSV fajlu`);

  const productsToInsert = new Map<string, any>();
  let skipped = 0;

  for (const record of records) {
    if (!record.Title || !record['Variant Price'] || record['Variant Price'] === '') {
      skipped++;
      continue;
    }

    const title = record.Title;
    const price = parseFloat(record['Variant Price']);
    
    if (isNaN(price) || price <= 0) {
      skipped++;
      continue;
    }

    if (productsToInsert.has(title) || existingNames.has(title)) {
      skipped++;
      continue;
    }

    const category = determineCategory(record['Product Category'] || '', record.Tags || '', title);
    const recommendedFor = determineRecommendedFor(
      title,
      record['Product Category'] || '',
      record.Tags || '',
      record.Vendor || ''
    );

    productsToInsert.set(title, {
      name: title,
      category: category,
      price: price.toFixed(2),
      stock: Math.floor(Math.random() * 100) + 10,
      unit: 'kom',
      description: record['Body (HTML)']?.substring(0, 500) || null,
      vendor: record.Vendor || null,
      recommendedFor: recommendedFor,
    });
  }

  console.log(`✅ Pripremljeno ${productsToInsert.size} jedinstvenih proizvoda za import`);
  console.log(`⏭️  Preskočeno ${skipped} redova (bez naziva ili cijene)`);

  const batchSize = 50;
  const productsArray = Array.from(productsToInsert.values());
  let imported = 0;

  for (let i = 0; i < productsArray.length; i += batchSize) {
    const batch = productsArray.slice(i, i + batchSize);
    
    try {
      await db.insert(products).values(batch).execute();
      imported += batch.length;
      console.log(`✅ Importovano ${imported}/${productsArray.length} proizvoda...`);
    } catch (error: any) {
      console.error(`❌ Greška pri importovanju batch-a ${i / batchSize + 1}:`, error?.message || error);
      for (const product of batch) {
        try {
          await db.insert(products).values(product).execute();
          imported++;
        } catch (singleError: any) {
          console.error(`❌ Ne mogu importovati proizvod "${product.name}":`, singleError?.message);
        }
      }
    }
  }

  console.log(`🎉 Import završen! Ukupno importovano: ${imported} proizvoda`);
  return imported;
}

importProductsFromCSV('attached_assets/products_export_1_1763506189182.csv')
  .then((count) => {
    console.log(`✅ Uspješno importovano ${count} proizvoda!`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Greška pri importu:', error);
    process.exit(1);
  });
