import * as XLSX from 'xlsx';
import { storage } from './storage';
import { insertCustomerSchema } from '../shared/schema';

async function importCustomers() {
  try {
    const workbook = XLSX.readFile('attached_assets/analiza_prodaje_(1)_1767134309563.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    // Get user IDs
    const kristina = await storage.getUserByUsername('Kristina');
    const andrea = await storage.getUserByUsername('Andrea');
    const mladen = await storage.getUserByUsername('Mladen');

    if (!kristina || !andrea || !mladen) {
      console.error('Users not found');
      return;
    }

    const userMap: Record<string, string> = {
      'andrea': andrea.id,
      'mladen': mladen.id,
      'ja': kristina.id
    };

    console.log(`Starting import of ${data.length} customers...`);

    for (const row of data) {
      const komercijalista = String(row['Komercijalista'] || '').toLowerCase();
      const salesPersonId = userMap[komercijalista] || kristina.id;
      
      const customerData = {
        name: String(row['Naziv kupca'] || row['Partner'] || 'Nepoznato'),
        company: String(row['Naziv kupca'] || row['Partner'] || 'Nepoznato'),
        salesPersonId: salesPersonId,
        status: 'active',
        customerType: 'ostalo'
      };

      try {
        await storage.createCustomer(customerData);
      } catch (err) {
        console.error(`Failed to import customer: ${customerData.name}`, err);
      }
    }

    console.log('Import finished successfully');
  } catch (error) {
    console.error('Error during import:', error);
  }
}

importCustomers();
