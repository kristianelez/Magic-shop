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
    if (data.length > 0) {
      console.log('Sample row:', JSON.stringify(data[0], null, 2));
    }

    // Get user IDs
    const kristina = await storage.getUserByUsername('KristinaPopović');
    const andrea = await storage.getUserByUsername('Andrea');
    const mladen = await storage.getUserByUsername('Mladen');

    if (!kristina || !andrea || !mladen) {
      console.error('Required users not found. Please ensure KristinaPopović, Andrea, and Mladen exist.');
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
      // Look for the specific header from the user's Excel if known, otherwise try common ones
      const companyName = row['Partner'] || row['Naziv kupca'] || row['Kupac'] || row['NAZIV'];
      if (!companyName) continue;

      const komercijalista = String(row['Komercijalista'] || row['KOMERCIJALISTA'] || '').toLowerCase().trim();
      const salesPersonId = userMap[komercijalista] || kristina.id;
      
      const customerData = {
        name: String(companyName).trim(),
        company: String(companyName).trim(),
        salesPersonId: salesPersonId,
        status: 'active',
        customerType: 'ostalo'
      };

      await storage.createCustomer(customerData);
      count++;
    }

    console.log(`Successfully imported ${count} customers.`);
  } catch (error) {
    console.error('Error during import:', error);
  }
}

importCustomers();
