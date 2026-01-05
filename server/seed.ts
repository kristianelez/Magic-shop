import { storage } from "./storage";
import bcrypt from "bcryptjs";

export async function seedDatabase() {
  try {
    // Always check and create users first if they don't exist
    const existingAdmin = await storage.getUserByUsername("Greentimeadmin");
    if (!existingAdmin) {
      console.log("Creating default users...");
      const hashedPassword1 = await bcrypt.hash("pedja2024", 10);
      const hashedPassword2 = await bcrypt.hash("kacacaka0607", 10);
      const hashedPassword3 = await bcrypt.hash("kikoris12", 10);

      await Promise.all([
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
      console.log("Default users created!");
    }

    console.log("Automation disabled. Waiting for new data from user.");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
