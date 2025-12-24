import XLSX from "xlsx";
import { db } from "./db";
import { products } from "@shared/schema";
import { sql } from "drizzle-orm";

const ALLOWED_CATEGORIES = [
  "Osvježivači",
  "Automobilska kozmetika",
  "Oprema za čišćenje",
  "Salvete",
  "Toaletni papir",
  "Ubrusi za ruke",
];

function mapKategorijaKupca(kategorijaKupca: string): string[] {
  if (!kategorijaKupca) return ["ostalo"];
  
  const kupci = kategorijaKupca.toLowerCase();
  const result: string[] = [];
  
  if (kupci.includes("hotel")) result.push("hotel");
  if (kupci.includes("restoran")) result.push("restoran");
  if (kupci.includes("kafić") || kupci.includes("kafic")) result.push("kafic");
  if (kupci.includes("pekara")) result.push("pekara");
  if (kupci.includes("firma") || kupci.includes("industrija")) result.push("fabrika");
  
  if (kupci.includes("autokozmetika") && result.length === 0) {
    return [];
  }
  
  if (result.length === 0) {
    result.push("ostalo");
  }
  
  return result;
}

async function importProducts() {
  console.log("Starting product import from Excel...");
  
  const workbook = XLSX.readFile("attached_assets/finalni_cjenovnik_1766590832986.xlsx");
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet) as any[];
  
  console.log(`Total rows in Excel: ${data.length}`);
  
  const filteredData = data.filter(row => {
    const category = row["Kategorija robe"];
    return ALLOWED_CATEGORIES.includes(category);
  });
  
  console.log(`Filtered to ${filteredData.length} products in allowed categories`);
  
  console.log("Deleting all existing products...");
  await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
  
  console.log("Inserting new products...");
  let inserted = 0;
  
  for (const row of filteredData) {
    const name = row["Naziv"];
    const category = row["Kategorija robe"];
    const priceWithVAT = parseFloat(row["Cijena sa PDV"]) || 0;
    const kategorijaKupca = row["Kategorija kupca "] || "";
    const recommendedFor = mapKategorijaKupca(kategorijaKupca);
    
    try {
      await db.insert(products).values({
        name: name,
        category: category,
        price: priceWithVAT.toFixed(2),
        stock: 100,
        unit: "kom",
        description: `Šifra: ${row["Šifra"]}`,
        vendor: "Greentime",
        recommendedFor: recommendedFor.length > 0 ? recommendedFor : null,
      });
      inserted++;
    } catch (error) {
      console.error(`Failed to insert product: ${name}`, error);
    }
  }
  
  console.log(`Successfully inserted ${inserted} products`);
  
  const categoryCounts: Record<string, number> = {};
  filteredData.forEach(row => {
    const cat = row["Kategorija robe"];
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  
  console.log("\nProducts by category:");
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
  
  console.log("\nImport completed!");
}

importProducts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
