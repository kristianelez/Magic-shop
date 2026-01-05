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

    const existingCustomers = await storage.getCustomers();
    if (existingCustomers.length > 0) {
      console.log("Database already seeded, skipping sample data...");
      return;
    }

    console.log("Seeding database with sample data...");

    // Get user for sales assignment
    const user = await storage.getUserByUsername("PredragPetrusic");

    // Seed sample products
    const products = await Promise.all([
      storage.createProduct({ name: "VORAX GT 5kg", category: "Sredstva za čišćenje", price: "89.90", stock: 45, unit: "kom" }),
      storage.createProduct({ name: "BACTER WC 5L", category: "Sredstva za čišćenje", price: "32.50", stock: 28, unit: "kom" }),
    ]);

    // Seed customers
    const customers = await Promise.all([
      storage.createCustomer({ name: "Amra Softić", company: "Hotel Bristol", email: "amra@bristol.ba", phone: "+387 33 123 456", status: "vip" }),
      storage.createCustomer({ name: "Edin Jusić", company: "Bolnica Koševo", email: "edin@kosevo.ba", phone: "+387 33 234 567", status: "active" }),
      storage.createCustomer({ name: "Selma Imamović", company: "Restoran Kod Muje", email: "selma@kodmuje.ba", phone: "+387 33 345 678", status: "active" }),
      storage.createCustomer({ name: "Nermin Hodžić", company: "Ćevabdžinica Željo", email: "nermin@zeljo.ba", phone: "+387 33 456 789", status: "active" }),
      storage.createCustomer({ name: "Lejla Karić", company: "Škola Štampar Makarije", email: "lejla@skola.ba", phone: "+387 33 567 890", status: "inactive" }),
      storage.createCustomer({ name: "Haris Begić", company: "Tržni centar BBI", email: "haris@bbi.ba", phone: "+387 33 678 901", status: "vip" }),
    ]);

    // Seed sales
    if (user) {
      await Promise.all([
        storage.createSale({ customerId: customers[0].id, productId: products[0].id, quantity: 10, totalAmount: "899.00", status: "completed", salesPersonId: user.id }),
        storage.createSale({ customerId: customers[1].id, productId: products[1].id, quantity: 15, totalAmount: "487.50", status: "completed", salesPersonId: user.id }),
      ]);
    }

    // Seed activities
    await Promise.all([
      storage.createActivity({ customerId: customers[0].id, type: "call", notes: "Planirana isporuka proizvoda", outcome: "positive" }),
      storage.createActivity({ customerId: customers[1].id, type: "call", notes: "Razgovor o novim proizvodima", outcome: "interested" }),
      storage.createActivity({ customerId: customers[2].id, type: "email", notes: "Poslana ponuda", outcome: "pending" }),
      storage.createActivity({ customerId: customers[3].id, type: "call", notes: "Potvrđena narudžba", outcome: "positive" }),
    ]);

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
