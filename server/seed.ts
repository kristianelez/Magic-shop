import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { importGreentimeProducts } from "./import-greentime-products";
import { importCustomersFromExcel } from "./import-customers";

export async function seedDatabase() {
  try {
    const existingCustomers = await storage.getCustomers();
    if (existingCustomers.length > 0) {
      console.log("Database already seeded, skipping...");
      return;
    }

    console.log("Seeding database with initial data...");

    // Seed users with hashed passwords
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

    console.log(`Created ${users.length} users`);

    // Import real products from greentime.ba
    console.log("Importing Greentime products...");
    try {
      await importGreentimeProducts();
      console.log("✓ Greentime products imported successfully");
    } catch (error) {
      console.error("Failed to import Greentime products:", error);
      console.log("Continuing with seed process...");
    }

    // Import real customers from Excel
    console.log("Importing customers from Excel...");
    try {
      await importCustomersFromExcel();
      console.log("✓ Customers imported successfully");
    } catch (error) {
      console.error("Failed to import customers:", error);
      console.log("Continuing with seed process...");
    }

    console.log("✓ Database seeding completed successfully!");
    console.log("Summary:");
    const allProducts = await storage.getProducts();
    const allCustomers = await storage.getCustomers();
    console.log(`- Users: ${users.length}`);
    console.log(`- Products: ${allProducts.length}`);
    console.log(`- Customers: ${allCustomers.length}`);

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
