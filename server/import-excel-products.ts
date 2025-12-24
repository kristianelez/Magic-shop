import XLSX from "xlsx";
import { db } from "./db";
import { products } from "@shared/schema";
import { sql } from "drizzle-orm";

function mapKategorijaKupca(kategorijaKupca: string): string[] {
  if (!kategorijaKupca) return ["ostalo"];
  
  const kupci = kategorijaKupca.toLowerCase();
  const result: string[] = [];
  
  if (kupci.includes("hotel")) result.push("hotel");
  if (kupci.includes("restoran")) result.push("restoran");
  if (kupci.includes("kafić") || kupci.includes("kafic")) result.push("kafic");
  if (kupci.includes("pekara")) result.push("pekara");
  if (kupci.includes("firma") || kupci.includes("industrija")) result.push("fabrika");
  if (kupci.includes("vešeraj") || kupci.includes("veseraj")) result.push("veseraj");
  if (kupci.includes("medicinska") || kupci.includes("ustanova")) result.push("medicinska_ustanova");
  if (kupci.includes("autokozmetika")) result.push("autokozmetika");
  
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
  
  console.log("Deleting all existing products...");
  await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
  
  console.log("Inserting all products...");
  let inserted = 0;
  
  for (const row of data) {
    const name = row["Naziv"];
    const category = row["Kategorija robe"];
    const priceWithVAT = parseFloat(row["Cijena sa PDV"]) || 0;
    const kategorijaKupca = row["Kategorija kupca "] || "";
    const recommendedFor = mapKategorijaKupca(kategorijaKupca);
    
    if (!name || !category) {
      console.log(`Skipping row with missing name or category`);
      continue;
    }
    
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
  data.forEach(row => {
    const cat = row["Kategorija robe"];
    if (cat) {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  });
  
  console.log("\nProducts by category:");
  Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
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
