import { storage } from "./storage";
import bcrypt from "bcryptjs";

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

    // Seed products
    const products = await Promise.all([
      storage.createProduct({ name: "VORAX GT 5kg", category: "Sredstva za čišćenje", price: "89.90", stock: 45, unit: "kom" }),
      storage.createProduct({ name: "BACTER WC 5L", category: "Sredstva za čišćenje", price: "32.50", stock: 28, unit: "kom" }),
      storage.createProduct({ name: "Higi Glass Cleaner 4L", category: "Sredstva za čišćenje", price: "24.90", stock: 52, unit: "kom" }),
      storage.createProduct({ name: "IPC 24V CT15 B35 16L", category: "Oprema", price: "5690.00", stock: 3, unit: "kom" }),
      storage.createProduct({ name: "Suma Grill D9 2L", category: "Sredstva za čišćenje", price: "45.00", stock: 18, unit: "kom" }),
      storage.createProduct({ name: "TASKI Jontec 300 5L", category: "Sredstva za čišćenje", price: "67.50", stock: 31, unit: "kom" }),
      storage.createProduct({ name: "Higi Dish Soap 4L", category: "Sredstva za čišćenje", price: "28.90", stock: 42, unit: "kom" }),
      storage.createProduct({ name: "Air Wick Essential Oils", category: "Osvježivači", price: "7.40", stock: 65, unit: "kom" }),
      storage.createProduct({ name: "Aquarius Dispenser", category: "Dispenseri", price: "125.00", stock: 8, unit: "kom" }),
      storage.createProduct({ name: "Domestos gel 750ml", category: "Sredstva za čišćenje", price: "8.50", stock: 55, unit: "kom" }),
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

    // Seed sales (assign to Predrag Petrusic - sales manager)
    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    await Promise.all([
      // Hotel Bristol purchases
      storage.createSale({ customerId: customers[0].id, productId: products[0].id, quantity: 10, totalAmount: "899.00", status: "completed", salesPersonId: users[0].id }),
      storage.createSale({ customerId: customers[0].id, productId: products[4].id, quantity: 6, totalAmount: "270.00", status: "completed", salesPersonId: users[0].id }),
      
      // Bolnica Koševo purchases  
      storage.createSale({ customerId: customers[1].id, productId: products[1].id, quantity: 15, totalAmount: "487.50", status: "completed", salesPersonId: users[0].id }),
      storage.createSale({ customerId: customers[1].id, productId: products[2].id, quantity: 8, totalAmount: "199.20", status: "completed", salesPersonId: users[0].id }),
      
      // Restoran Kod Muje purchases
      storage.createSale({ customerId: customers[2].id, productId: products[6].id, quantity: 8, totalAmount: "231.20", status: "pending", salesPersonId: users[0].id }),
      
      // Tržni centar BBI purchases
      storage.createSale({ customerId: customers[5].id, productId: products[2].id, quantity: 20, totalAmount: "498.00", status: "completed", salesPersonId: users[0].id }),
      storage.createSale({ customerId: customers[5].id, productId: products[5].id, quantity: 12, totalAmount: "810.00", status: "completed", salesPersonId: users[0].id }),
    ]);

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
