import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertCustomerSchema, insertProductSchema, insertSaleSchema, insertActivitySchema, type InsertCustomer } from "@shared/schema";
import { generateLocalRecommendations } from "./local-ai";
import { requireAuth } from "./auth";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication API
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Korisničko ime i šifra su obavezni" });
      }

      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(401).json({ message: "Neispravno korisničko ime ili šifra" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ message: "Neispravno korisničko ime ili šifra" });
      }

      req.session.userId = user.id;

      // Wait for the session to be persisted to Postgres BEFORE responding.
      // Otherwise the browser gets the Set-Cookie back and immediately fires
      // follow-up requests (auth/me, sales, customers, ...) that race the
      // session write — the session row isn't there yet, so those requests
      // come back as 401 and the user gets bounced back to /login.
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Greška pri prijavljivanju" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Greška pri odjavljivanju" });
      }
      res.json({ message: "Uspješno ste se odjavili" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Niste prijavljeni" });
      }

      const user = await storage.getUser(req.session.userId);

      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "Korisnik nije pronađen" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ message: "Greška pri dohvatanju korisnika" });
    }
  });

  // Middleware to attach user to request for protected routes
  app.use("/api/*", async (req, res, next) => {
    if (req.path.startsWith("/api/auth/")) {
      return next();
    }

    if (req.session.userId) {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        req.user = user;
      }
    }
    next();
  });

  // Users API
  app.get("/api/users", async (req, res) => {
    try {
      const allUsers = await storage.getUsers();
      // Remove passwords from response
      const usersWithoutPasswords = allUsers.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Customers API
  app.get("/api/customers", requireAuth, async (req, res) => {
    try {
      // Use optimized batch loading instead of N+1 queries
      const customersWithStats = await storage.getCustomersWithStats(req.user!.id, req.user!.role);
      res.json(customersWithStats);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomer(id);
      
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      // Pass user info for proper sales filtering
      const stats = await storage.getCustomerStats(id, req.user!.id, req.user!.role);
      const activities = await storage.getActivitiesByCustomer(id);
      const sales = await storage.getSalesByCustomer(id, req.user!.id, req.user!.role);
      const lastContact = activities.length > 0 
        ? new Date(activities[0].createdAt).toLocaleDateString('bs-BA')
        : undefined;
      
      res.json({
        ...customer,
        totalPurchases: stats.totalPurchases,
        lastContact,
        favoriteProducts: stats.favoriteProducts,
        activities,
        sales,
      });
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", requireAuth, async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customerWithSalesPerson = {
        ...customerData,
        salesPersonId: customerData.salesPersonId || req.user!.id
      };
      const customer = await storage.createCustomer(customerWithSalesPerson);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating customer:", error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const existing = await storage.getCustomer(id);
      if (!existing) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      const updates = insertCustomerSchema.partial().parse(req.body);
      
      const mergedData: any = { ...existing };
      for (const key in updates) {
        mergedData[key] = updates[key as keyof typeof updates];
      }
      
      delete mergedData.id;
      delete mergedData.createdAt;
      
      const customer = await storage.updateCustomer(id, mergedData);
      
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating customer:", error);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteCustomer(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  // Products API
  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/stats", requireAuth, async (req, res) => {
    try {
      // Logic for product stats could be here
      res.json([]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product stats" });
    }
  });

  app.get("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", requireAuth, async (req, res) => {
    if (req.user!.role === "sales_manager") {
      return res.status(403).json({ error: "Nemate ovlaštenje za dodavanje proizvoda" });
    }
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", requireAuth, async (req, res) => {
    if (req.user!.role === "sales_manager") {
      return res.status(403).json({ error: "Nemate ovlaštenje za izmjenu proizvoda" });
    }
    try {
      const id = parseInt(req.params.id);
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, productData);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", requireAuth, async (req, res) => {
    if (req.user!.role === "sales_manager") {
      return res.status(403).json({ error: "Nemate ovlaštenje za brisanje proizvoda" });
    }
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProduct(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Sales API
  app.get("/api/sales", requireAuth, async (req, res) => {
    try {
      const sales = await storage.getSales(req.user!.id, req.user!.role);
      res.json(sales);
    } catch (error) {
      console.error("Error fetching sales:", error);
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  });

  app.post("/api/sales", requireAuth, async (req, res) => {
    try {
      // createdAt smije slati samo admin/sales_director — ostali ga ignorišu
      const { createdAt: createdAtRaw, ...rest } = req.body ?? {};
      const saleData = insertSaleSchema.parse(rest);

      const saleWithSalesPerson: InsertSale & { createdAt?: Date } = {
        ...saleData,
        salesPersonId: req.user!.id,
      };

      if (createdAtRaw !== undefined && createdAtRaw !== null && createdAtRaw !== "") {
        const role = req.user!.role;
        if (role !== "admin" && role !== "sales_director") {
          return res.status(403).json({ error: "Nemate dozvolu za izmjenu datuma narudžbe" });
        }
        const parsed = new Date(createdAtRaw);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ error: "Nevažeći datum narudžbe" });
        }
        saleWithSalesPerson.createdAt = parsed;
      }

      const sale = await storage.createSale(saleWithSalesPerson);
      res.status(201).json(sale);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating sale:", error);
      res.status(500).json({ error: "Failed to create sale" });
    }
  });

  app.patch("/api/sales/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { createdAt: createdAtRaw, ...rest } = req.body ?? {};
      const saleData: Partial<InsertSale> & { createdAt?: Date } =
        insertSaleSchema.partial().parse(rest);

      if (createdAtRaw !== undefined && createdAtRaw !== null && createdAtRaw !== "") {
        const role = req.user!.role;
        if (role !== "admin" && role !== "sales_director") {
          return res.status(403).json({ error: "Nemate dozvolu za izmjenu datuma narudžbe" });
        }
        const parsed = new Date(createdAtRaw);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ error: "Nevažeći datum narudžbe" });
        }
        saleData.createdAt = parsed;
      }

      const sale = await storage.updateSale(id, saleData);

      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }

      res.json(sale);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating sale:", error);
      res.status(500).json({ error: "Failed to update sale" });
    }
  });

  app.delete("/api/sales/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSale(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Sale not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting sale:", error);
      res.status(500).json({ error: "Failed to delete sale" });
    }
  });

  // Toggle invoice verified status for multiple sales (grouped order)
  app.post("/api/sales/verify-invoice", requireAuth, async (req, res) => {
    try {
      const { saleIds, verified } = req.body;
      
      if (!Array.isArray(saleIds) || saleIds.length === 0) {
        return res.status(400).json({ error: "saleIds must be a non-empty array" });
      }
      
      const verifiedValue = verified === true || verified === "true" ? "true" : "false";
      
      for (const saleId of saleIds) {
        await storage.updateSale(parseInt(saleId), { invoiceVerified: verifiedValue } as any);
      }
      
      res.json({ success: true, verified: verifiedValue });
    } catch (error) {
      console.error("Error updating invoice verification:", error);
      res.status(500).json({ error: "Failed to update invoice verification" });
    }
  });

  // Activities API
  app.get("/api/activities", requireAuth, async (req, res) => {
    try {
      let activities;
      if (req.user!.role === "admin") {
        activities = await storage.getActivities();
      } else {
        // Filter activities for sales person's customers and their own activities
        const allActivities = await storage.getActivities();
        const myCustomers = await storage.getCustomers(req.user!.id, req.user!.role);
        const myCustomerIds = new Set(myCustomers.map(c => c.id));
        activities = allActivities.filter(a => myCustomerIds.has(a.customerId));
      }
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  app.post("/api/activities", requireAuth, async (req, res) => {
    try {
      const activityData = insertActivitySchema.parse(req.body);
      const activity = await storage.createActivity(activityData);
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating activity:", error);
      res.status(500).json({ error: "Failed to create activity" });
    }
  });

  app.patch("/api/activities/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const activityData = insertActivitySchema.partial().parse(req.body);
      const activity = await storage.updateActivity(id, activityData);
      
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }
      
      res.json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating activity:", error);
      res.status(500).json({ error: "Failed to update activity" });
    }
  });

  app.post("/api/activities/call/:customerId", requireAuth, async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      
      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const activity = await storage.createActivity({
        customerId,
        type: "call",
        notes: "Poziv komercijaliste",
      });

      res.status(201).json(activity);
    } catch (error) {
      console.error("Error recording call activity:", error);
      res.status(500).json({ error: "Failed to record call" });
    }
  });

  // Offers API
  app.get("/api/offers", requireAuth, async (req, res) => {
    try {
      const offers = await storage.getOffers(req.user!.id, req.user!.role);
      res.json(offers);
    } catch (error) {
      console.error("Error fetching offers:", error);
      res.status(500).json({ error: "Failed to fetch offers" });
    }
  });

  app.post("/api/offers", requireAuth, async (req, res) => {
    try {
      const { customerId, totalAmount, status } = req.body;
      const offer = await storage.createOffer({
        customerId,
        totalAmount,
        status: status || "draft",
        salesPersonId: req.user?.id,
      });
      res.status(201).json(offer);
    } catch (error) {
      console.error("Error creating offer:", error);
      res.status(500).json({ error: "Failed to create offer" });
    }
  });

  app.post("/api/offers/items", requireAuth, async (req, res) => {
    try {
      const { offerId, productId, quantity, price, category } = req.body;
      const item = await storage.addOfferItem({
        offerId,
        productId,
        quantity,
        price,
        category,
        discount: "0",
      });
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding offer item:", error);
      res.status(500).json({ error: "Failed to add offer item" });
    }
  });

  app.get("/api/offers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const offer = await storage.getOffer(id);
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }
      res.json(offer);
    } catch (error) {
      console.error("Error fetching offer:", error);
      res.status(500).json({ error: "Failed to fetch offer" });
    }
  });

  app.patch("/api/offers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { customerId, totalAmount, status, items } = req.body;
      
      const offer = await storage.updateOffer(id, {
        customerId,
        totalAmount,
        status,
      });
      
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }

      if (items && items.length > 0) {
        await storage.deleteOfferItems(id);
        for (const item of items) {
          await storage.addOfferItem({
            offerId: id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount || "0",
            category: item.category,
            productName: item.productName,
          });
        }
      }

      const updatedOffer = await storage.getOffer(id);
      res.json(updatedOffer);
    } catch (error) {
      console.error("Error updating offer:", error);
      res.status(500).json({ error: "Failed to update offer" });
    }
  });

  app.delete("/api/offers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteOffer(id);
      if (!deleted) {
        return res.status(404).json({ error: "Offer not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting offer:", error);
      res.status(500).json({ error: "Failed to delete offer" });
    }
  });

  // AI Recommendations API (Pure Local)
  app.get("/api/recommendations", requireAuth, async (req, res) => {
    try {
      const recommendations = await generateLocalRecommendations();
      res.json(recommendations);
    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });



  const httpServer = createServer(app);

  return httpServer;
}
