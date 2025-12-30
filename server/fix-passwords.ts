import bcrypt from "bcryptjs";
import { storage } from "./storage";

async function fixPasswords() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("1234", salt);
    
    console.log("Hashed password for 1234:", hashedPassword);
    
    // We will update KristinaPopović, Andrea, and Mladen
    const usersToUpdate = ["KristinaPopović", "Andrea", "Mladen"];
    
    for (const username of usersToUpdate) {
      const user = await storage.getUserByUsername(username);
      if (user) {
        // We use a direct SQL update to ensure it's set correctly in the DB
        // But since we have the storage, let's see if we can use it.
        // Actually, let's just use execute_sql_tool for the update to be sure about the hash.
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

fixPasswords();
