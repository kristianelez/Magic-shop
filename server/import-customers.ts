import XLSX from "xlsx";
import { db } from "./db";
import { customers } from "@shared/schema";
import { sql } from "drizzle-orm";

// Function to map Excel customer type to our database enum
function mapCustomerType(excelType: string): string {
  const typeMap: Record<string, string> = {
    "KAFIĆ": "kafic",
    "HOTEL": "hotel",
    "RESTORAN": "restoran",
    "PEKARA": "pekara",
    "PROIZVODNJA": "fabrika",
    "FABRIKA": "fabrika",
  };
  
  const normalized = excelType?.toUpperCase().trim();
  return typeMap[normalized] || "ostalo";
}

// Function to normalize phone number
function normalizePhone(phone: any): string | undefined {
  if (!phone) return undefined;
  const phoneStr = String(phone).trim();
  // Remove any non-digit characters except + and spaces
  return phoneStr.replace(/[^\d+\s]/g, '');
}

export async function importCustomersFromExcel() {
  console.log("Starting customer import from Excel...");
  
  try {
    // Read Excel file
    const workbook = XLSX.readFile('attached_assets/Analiza prodaje Predrag Petrušić_1763584360948.xlsx');
    
    // Delete all existing customers first
    console.log("Clearing existing customers...");
    await db.execute(sql`TRUNCATE TABLE ${customers} RESTART IDENTITY CASCADE`);
    
    const customersToInsert: any[] = [];
    
    // Process KUPCI sheet (existing customers - active)
    const kupciSheet = workbook.Sheets['KUPCI'];
    if (kupciSheet) {
      const kupciData = XLSX.utils.sheet_to_json(kupciSheet) as any[];
      console.log(`Processing ${kupciData.length} existing customers from KUPCI sheet...`);
      
      for (const row of kupciData) {
        const customer = {
          company: row['Naziv Kupca']?.trim() || 'N/A',
          name: row['Osoba za kontakt']?.trim() || 'N/A',
          phone: normalizePhone(row['Broj telefona']),
          email: undefined,
          customerType: mapCustomerType(row['Kategorija kupca']),
          status: 'active',
          paymentTerms: row['Dogovoreno plaćanje']?.trim(),
        };
        customersToInsert.push(customer);
      }
    }
    
    // Process POTENCIJALNI KUPCI sheet (potential customers)
    const potencijalniSheet = workbook.Sheets['POTENCIJALNI KUPCI '];
    if (potencijalniSheet) {
      const potencijalniData = XLSX.utils.sheet_to_json(potencijalniSheet) as any[];
      console.log(`Processing ${potencijalniData.length} potential customers from POTENCIJALNI KUPCI sheet...`);
      
      for (const row of potencijalniData) {
        const customer = {
          company: row['Naziv Kupca']?.trim() || 'N/A',
          name: row['Osoba za kontakt']?.trim() || 'N/A',
          phone: normalizePhone(row['Broj telefona']),
          email: undefined,
          customerType: mapCustomerType(row['Kategorija kupca']),
          status: 'potential',
          paymentTerms: row['Dogovoreno plaćanje']?.trim(),
        };
        customersToInsert.push(customer);
      }
    }
    
    // Insert all customers
    if (customersToInsert.length > 0) {
      console.log(`Inserting ${customersToInsert.length} customers into database...`);
      await db.insert(customers).values(customersToInsert);
      console.log(`✓ Successfully imported ${customersToInsert.length} customers!`);
      console.log(`  - Active customers: ${customersToInsert.filter(c => c.status === 'active').length}`);
      console.log(`  - Potential customers: ${customersToInsert.filter(c => c.status === 'potential').length}`);
    } else {
      console.log("No customers to import.");
    }
    
  } catch (error) {
    console.error("Error importing customers:", error);
    throw error;
  }
}

// Run import if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  importCustomersFromExcel()
    .then(() => {
      console.log("Import completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Import failed:", error);
      process.exit(1);
    });
}
