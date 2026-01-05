import { storage } from "./storage";
import bcrypt from "bcryptjs";

export async function seedDatabase() {
  try {
    // Always check and create users first if they don't exist
    const existingKristina = await storage.getUserByUsername("Kristina");
    if (!existingKristina) {
      console.log("Creating default users...");
      const hashedPassword = await bcrypt.hash("magic2024", 10);

      await Promise.all([
        storage.createUser({ 
          username: "Kristina", 
          password: hashedPassword, 
          fullName: "Kristina",
          role: "admin" 
        }),
        storage.createUser({ 
          username: "Mladen", 
          password: hashedPassword, 
          fullName: "Mladen",
          role: "sales_director" 
        }),
        storage.createUser({ 
          username: "Andrea", 
          password: hashedPassword, 
          fullName: "Andrea",
          role: "sales_manager" 
        }),
      ]);
      console.log("Default users created!");
    }

    console.log("Automation disabled. Waiting for new data from user.");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
