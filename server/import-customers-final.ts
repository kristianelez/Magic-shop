import XLSX from 'xlsx';
import { storage } from './storage';

async function importCustomers() {
  try {
    const filePath = 'attached_assets/analiza_prodaje_(1)_1767134309563.xlsx';
    console.log(`Reading file: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Found ${data.length} rows in Excel.`);
    
    const kristina = await storage.getUserByUsername('KristinaPopović');
    const andrea = await storage.getUserByUsername('Andrea');
    const mladen = await storage.getUserByUsername('Mladen');

    if (!kristina || !andrea || !mladen) {
      console.error('Required users not found.');
      return;
    }

    const userMap: Record<string, string> = {
      'andrea': andrea.id,
      'mladen': mladen.id,
      'ja': kristina.id,
      'kristina': kristina.id,
      'kristina popović': kristina.id
    };

    let count = 0;
    for (const row of data) {
      const companyName = row['Naziv Kupca'] || row['Partner'] || row['Naziv kupca'] || row['Kupac'];
      if (!companyName) continue;

      const phone = String(row['Broj telefona'] || row['Telefon'] || row['MOB'] || row['TEL'] || '').trim();

      // Check for exact key with trailing space or other variations
      let komercijalistaRaw = '';
      for (const key of Object.keys(row)) {
        if (key.trim().toLowerCase() === 'komercijalista') {
          komercijalistaRaw = row[key];
          break;
        }
      }
      
      const komercijalista = String(komercijalistaRaw).toLowerCase().trim();
      const salesPersonId = userMap[komercijalista] || kristina.id;
      
      const customerData = {
        name: String(companyName).trim(),
        company: String(companyName).trim(),
        phone: phone,
        salesPersonId: salesPersonId,
        status: 'active',
        customerType: 'ostalo'
      };

      await storage.createCustomer(customerData);
      count++;
    }

    console.log(`Successfully imported ${count} customers with correct mappings.`);
  } catch (error) {
    console.error('Error during import:', error);
  }
}

importCustomers();
