import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { importGreentimeProducts } from "./import-greentime-products";
import { importCustomersFromExcel } from "./import-customers";

export async function seedDatabase() {
  try {
    // GRANULAR SEEDING: Check each dataset independently and seed only what's missing
    const MIN_PRODUCT_COUNT = 100;
    const MIN_CUSTOMER_COUNT = 60;
    
    const existingProducts = await storage.getProducts();
    const existingCustomers = await storage.getCustomers();
    const existingUsers = await storage.getUsers();
    
    // Determine what needs to be seeded
    const needUsers = existingUsers.length === 0;
    const needProducts = existingProducts.length < MIN_PRODUCT_COUNT;
    const needCustomers = existingCustomers.length < MIN_CUSTOMER_COUNT;
    
    // If everything is already seeded, skip
    if (!needUsers && !needProducts && !needCustomers) {
      console.log(`✓ Database already fully seeded:`);
      console.log(`  - Users: ${existingUsers.length}`);
      console.log(`  - Products: ${existingProducts.length}`);
      console.log(`  - Customers: ${existingCustomers.length}`);
      return;
    }
    
    // Log what will be seeded
    console.log("═══════════════════════════════════════════════════════");
    console.log("  DATABASE SEEDING STARTED");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`Current state:`);
    console.log(`  - Users: ${existingUsers.length} ${needUsers ? '❌ (will seed)' : '✓'}`);
    console.log(`  - Products: ${existingProducts.length}/${MIN_PRODUCT_COUNT} ${needProducts ? '❌ (will seed)' : '✓'}`);
    console.log(`  - Customers: ${existingCustomers.length}/${MIN_CUSTOMER_COUNT} ${needCustomers ? '❌ (will seed)' : '✓'}`);
    console.log("═══════════════════════════════════════════════════════\n");

    let users = existingUsers;
    
    // Seed users if needed
    if (needUsers) {
      console.log("Creating users...");
      const hashedPassword1 = await bcrypt.hash("pedja2024", 10);
      const hashedPassword2 = await bcrypt.hash("kacacaka0607", 10);
      const hashedPassword3 = await bcrypt.hash("kikoris12", 10);

      users = await Promise.all([
        storage.createUser({ 
          username: "PredragPetrusic", 
          password: hashedPassword1, 
          fullName: "Predrag Petrusić",
          role: "sales_manager" 
        }),
        storage.createUser({ 
          username: "DraganElez", 
          password: hashedPassword2, 
          fullName: "Dragan Elez",
          role: "sales_director" 
        }),
        storage.createUser({ 
          username: "Greentimeadmin", 
          password: hashedPassword3, 
          fullName: "Admin",
          role: "admin" 
        }),
      ]);

      console.log(`✓ Created ${users.length} users\n`);
    } else {
      console.log(`⏭  Skipping users (already have ${existingUsers.length})\n`);
    }

    // Import products if needed
    if (needProducts) {
      console.log("Importing Greentime products...");
      try {
        await importGreentimeProducts();
        console.log("✓ Greentime products imported successfully\n");
      } catch (error) {
        console.error("❌ CRITICAL: Failed to import Greentime products:", error);
        console.error("Database seeding FAILED - cannot continue without products");
        throw new Error("Product import failed - see logs above for details");
      }
    } else {
      console.log(`⏭  Skipping products (already have ${existingProducts.length})\n`);
    }

    // Import customers if needed
    if (needCustomers) {
      console.log("Importing customers from Excel...");
      try {
        await importCustomersFromExcel();
        console.log("✓ Customers imported successfully\n");
      } catch (error) {
        console.error("❌ CRITICAL: Failed to import customers:", error);
        console.error("Database seeding FAILED - cannot continue without customers");
        throw new Error("Customer import failed - see logs above for details");
      }
    } else {
      console.log(`⏭  Skipping customers (already have ${existingCustomers.length})\n`);
    }

    // FINAL VERIFICATION: Ensure database has minimum required data
    const allProducts = await storage.getProducts();
    const allCustomers = await storage.getCustomers();
    
    if (allProducts.length < MIN_PRODUCT_COUNT) {
      throw new Error(`❌ Seed verification FAILED: Only ${allProducts.length} products in database (expected at least ${MIN_PRODUCT_COUNT})`);
    }
    if (allCustomers.length < MIN_CUSTOMER_COUNT) {
      throw new Error(`❌ Seed verification FAILED: Only ${allCustomers.length} customers in database (expected at least ${MIN_CUSTOMER_COUNT})`);
    }

    // Only declare success AFTER verification passes
    console.log("═══════════════════════════════════════════════════════");
    console.log("  DATABASE SEEDING COMPLETED SUCCESSFULLY");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  ✓ Users: ${users.length}`);
    console.log(`  ✓ Products: ${allProducts.length}`);
    console.log(`  ✓ Customers: ${allCustomers.length}`);
    console.log("═══════════════════════════════════════════════════════\n");

  } catch (error) {
    console.error("\n❌ DATABASE SEEDING FAILED:", error);
    throw error;
  }
}
