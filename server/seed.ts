import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { importGreentimeProducts } from "./import-greentime-products";
import { importCustomersFromExcel } from "./import-customers";

export async function seedDatabase() {
  try {
    // CRITICAL SAFETY CHECK: Database is only considered "seeded" if it has
    // the MINIMUM required data, not just "any" data. This prevents partial
    // imports from blocking future seed attempts.
    const MIN_PRODUCT_COUNT = 100;
    const MIN_CUSTOMER_COUNT = 60;
    
    const existingProducts = await storage.getProducts();
    const existingCustomers = await storage.getCustomers();
    
    if (existingProducts.length >= MIN_PRODUCT_COUNT && existingCustomers.length >= MIN_CUSTOMER_COUNT) {
      console.log(`Database already seeded (${existingProducts.length} products, ${existingCustomers.length} customers), skipping...`);
      return;
    }
    
    // If we have partial data, warn about it
    if (existingProducts.length > 0 || existingCustomers.length > 0) {
      console.warn(`⚠ WARNING: Partial data found (${existingProducts.length} products, ${existingCustomers.length} customers)`);
      console.warn(`⚠ Required minimums: ${MIN_PRODUCT_COUNT} products, ${MIN_CUSTOMER_COUNT} customers`);
      console.warn(`⚠ Proceeding with full re-seed...`);
    }

    console.log("═══════════════════════════════════════════════════════");
    console.log("  DATABASE SEEDING STARTED");
    console.log("═══════════════════════════════════════════════════════\n");

    // Seed users with hashed passwords
    console.log("Creating users...");
    const hashedPassword1 = await bcrypt.hash("pedja2024", 10);
    const hashedPassword2 = await bcrypt.hash("kacacaka0607", 10);
    const hashedPassword3 = await bcrypt.hash("kikoris12", 10);

    const users = await Promise.all([
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

    // Import real products from greentime.ba - CRITICAL: Fail if this doesn't work
    console.log("Importing Greentime products...");
    try {
      await importGreentimeProducts();
      console.log("✓ Greentime products imported successfully\n");
    } catch (error) {
      console.error("❌ CRITICAL: Failed to import Greentime products:", error);
      console.error("Database seeding FAILED - cannot continue without products");
      throw new Error("Product import failed - see logs above for details");
    }

    // Import real customers from Excel - CRITICAL: Fail if this doesn't work
    console.log("Importing customers from Excel...");
    try {
      await importCustomersFromExcel();
      console.log("✓ Customers imported successfully\n");
    } catch (error) {
      console.error("❌ CRITICAL: Failed to import customers:", error);
      console.error("Database seeding FAILED - cannot continue without customers");
      throw new Error("Customer import failed - see logs above for details");
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
