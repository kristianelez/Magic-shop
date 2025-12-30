import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import {
  type User,
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Product,
  type InsertProduct,
  type Sale,
  type InsertSale,
  type Activity,
  type InsertActivity,
  type Offer,
  type InsertOffer,
  type OfferItem,
  type InsertOfferItem,
  users,
  customers,
  products,
  sales,
  activities,
  offers,
  offerItems,
} from "@shared/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface CustomerWithStats extends Customer {
  totalPurchases: number;
  lastContact?: string;
  favoriteProducts: string[];
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Customers
  getCustomers(userId?: string, role?: string): Promise<Customer[]>;
  getCustomersWithStats(userId?: string, role?: string): Promise<CustomerWithStats[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;

  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // Sales
  getSales(): Promise<Sale[]>;
  getSalesByCustomer(customerId: number): Promise<Sale[]>;
  getSalesBySalesPerson(salesPersonId: string): Promise<Sale[]>;
  createSale(sale: InsertSale): Promise<Sale>;
  updateSale(id: number, sale: Partial<InsertSale>): Promise<Sale | undefined>;
  deleteSale(id: number): Promise<boolean>;

  // Activities
  getActivities(): Promise<Activity[]>;
  getActivitiesByCustomer(customerId: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: number, activity: Partial<InsertActivity>): Promise<Activity | undefined>;

  // Offers
  getOffers(): Promise<any[]>;
  getOffer(id: number): Promise<any>;
  createOffer(offer: any): Promise<any>;
  updateOffer(id: number, offer: Partial<InsertOffer>): Promise<Offer | undefined>;
  addOfferItem(item: any): Promise<any>;
  deleteOfferItems(offerId: number): Promise<boolean>;
  deleteOffer(id: number): Promise<boolean>;

  // Analytics
  getCustomerStats(customerId: number): Promise<{
    totalPurchases: number;
    lastPurchaseDate: Date | null;
    favoriteProducts: string[];
  }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Customers
  async getCustomers(userId?: string, role?: string): Promise<Customer[]> {
    if (role === 'admin' || !userId) {
      return await db.select().from(customers).orderBy(desc(customers.createdAt));
    }
    return await db.select().from(customers).where(eq(customers.salesPersonId, userId)).orderBy(desc(customers.createdAt));
  }

  async getCustomersWithStats(userId?: string, role?: string): Promise<CustomerWithStats[]> {
    // Batch load all data in just 3 queries instead of N+1
    const [allCustomers, allActivities, allSales, allProducts] = await Promise.all([
      role === 'admin' || !userId 
        ? db.select().from(customers).orderBy(desc(customers.createdAt))
        : db.select().from(customers).where(eq(customers.salesPersonId, userId)).orderBy(desc(customers.createdAt)),
      db.select().from(activities).orderBy(desc(activities.createdAt)),
      db.select().from(sales),
      db.select().from(products),
    ]);

    // Create lookup maps for O(1) access
    const productMap = new Map(allProducts.map(p => [p.id, p.name]));
    
    // Group activities by customer
    const activitiesByCustomer = new Map<number, Activity[]>();
    for (const activity of allActivities) {
      const existing = activitiesByCustomer.get(activity.customerId) || [];
      existing.push(activity);
      activitiesByCustomer.set(activity.customerId, existing);
    }

    // Group sales by customer and calculate stats
    const salesByCustomer = new Map<number, { total: number; productCounts: Map<number, number> }>();
    for (const sale of allSales) {
      const existing = salesByCustomer.get(sale.customerId) || { total: 0, productCounts: new Map() };
      existing.total += parseFloat(sale.totalAmount);
      existing.productCounts.set(sale.productId, (existing.productCounts.get(sale.productId) || 0) + 1);
      salesByCustomer.set(sale.customerId, existing);
    }

    // Build result with all stats
    return allCustomers.map(customer => {
      const customerActivities = activitiesByCustomer.get(customer.id) || [];
      const lastActivity = customerActivities[0];
      
      const customerSalesData = salesByCustomer.get(customer.id);
      const totalPurchases = customerSalesData?.total || 0;
      
      // Get top 3 favorite products
      const favoriteProducts: string[] = [];
      if (customerSalesData) {
        const topProductIds = Array.from(customerSalesData.productCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id]) => id);
        
        for (const productId of topProductIds) {
          const productName = productMap.get(productId);
          if (productName) favoriteProducts.push(productName);
        }
      }

      return {
        ...customer,
        totalPurchases,
        lastContact: lastActivity 
          ? new Date(lastActivity.createdAt).toLocaleDateString('bs-BA')
          : undefined,
        favoriteProducts,
      };
    });
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    return result[0];
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(customers).values(customer).returning();
    return result[0];
  }

  async updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const result = await db.update(customers).set(customer).where(eq(customers.id, id)).returning();
    return result[0];
  }

  async deleteCustomer(id: number): Promise<boolean> {
    // Use transaction to ensure all deletes succeed or all fail
    return await db.transaction(async (tx) => {
      // First delete all related activities
      await tx.delete(activities).where(eq(activities.customerId, id));
      
      // Then delete all related sales
      await tx.delete(sales).where(eq(sales.customerId, id));
      
      // Finally delete the customer
      const result = await tx.delete(customers).where(eq(customers.id, id)).returning();
      return result.length > 0;
    });
  }

  // Products
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(products.name);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return result[0];
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(product).returning();
    return result[0];
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await db.update(products).set(product).where(eq(products.id, id)).returning();
    return result[0];
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }

  // Sales
  async getSales(): Promise<Sale[]> {
    return await db.select().from(sales).orderBy(desc(sales.createdAt));
  }

  async getSalesByCustomer(customerId: number): Promise<Sale[]> {
    return await db
      .select()
      .from(sales)
      .where(eq(sales.customerId, customerId))
      .orderBy(desc(sales.createdAt));
  }

  async getSalesBySalesPerson(salesPersonId: string): Promise<Sale[]> {
    return await db
      .select()
      .from(sales)
      .where(eq(sales.salesPersonId, salesPersonId))
      .orderBy(desc(sales.createdAt));
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    const result = await db.insert(sales).values(sale).returning();
    return result[0];
  }

  async updateSale(id: number, sale: Partial<InsertSale>): Promise<Sale | undefined> {
    const result = await db.update(sales).set(sale).where(eq(sales.id, id)).returning();
    return result[0];
  }

  async deleteSale(id: number): Promise<boolean> {
    const result = await db.delete(sales).where(eq(sales.id, id)).returning();
    return result.length > 0;
  }

  // Activities
  async getActivities(): Promise<Activity[]> {
    return await db.select().from(activities).orderBy(desc(activities.createdAt));
  }

  async getActivitiesByCustomer(customerId: number): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.customerId, customerId))
      .orderBy(desc(activities.createdAt));
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const result = await db.insert(activities).values(activity).returning();
    return result[0];
  }

  async updateActivity(id: number, activity: Partial<InsertActivity>): Promise<Activity | undefined> {
    const result = await db.update(activities).set(activity).where(eq(activities.id, id)).returning();
    return result[0];
  }

  // Offers
  async getOffers(): Promise<any[]> {
    const allOffers = await db.select().from(offers).orderBy(desc(offers.createdAt));
    const items = await db.select().from(offerItems);
    const allProducts = await db.select().from(products);
    const productMap = new Map(allProducts.map(p => [p.id, p]));
    
    return allOffers.map(offer => ({
      ...offer,
      items: items
        .filter(item => item.offerId === offer.id)
        .map(item => ({
          ...item,
          productName: item.productName || productMap.get(item.productId)?.name || "N/A",
          discount: item.discount || "0",
        })),
    }));
  }

  async getOffer(id: number): Promise<any> {
    const offer = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
    if (!offer[0]) return undefined;
    const items = await db.select().from(offerItems).where(eq(offerItems.offerId, id));
    const allProducts = await db.select().from(products);
    const productMap = new Map(allProducts.map(p => [p.id, p]));
    
    return { 
      ...offer[0], 
      items: items.map(item => ({
        ...item,
        productName: item.productName || productMap.get(item.productId)?.name || "N/A",
        discount: item.discount || "0",
      })),
    };
  }

  async createOffer(offer: InsertOffer): Promise<Offer> {
    const result = await db.insert(offers).values(offer).returning();
    return result[0];
  }

  async addOfferItem(item: InsertOfferItem): Promise<OfferItem> {
    const result = await db.insert(offerItems).values(item).returning();
    return result[0];
  }

  async updateOffer(id: number, offer: Partial<InsertOffer>): Promise<Offer | undefined> {
    const result = await db.update(offers).set(offer).where(eq(offers.id, id)).returning();
    return result[0];
  }

  async deleteOfferItems(offerId: number): Promise<boolean> {
    await db.delete(offerItems).where(eq(offerItems.offerId, offerId));
    return true;
  }

  async deleteOffer(id: number): Promise<boolean> {
    await db.delete(offerItems).where(eq(offerItems.offerId, id));
    const result = await db.delete(offers).where(eq(offers.id, id)).returning();
    return result.length > 0;
  }

  // Analytics
  async getCustomerStats(customerId: number): Promise<{
    totalPurchases: number;
    lastPurchaseDate: Date | null;
    favoriteProducts: string[];
  }> {
    const customerSales = await db
      .select({
        totalAmount: sales.totalAmount,
        createdAt: sales.createdAt,
        productId: sales.productId,
      })
      .from(sales)
      .where(eq(sales.customerId, customerId));

    const totalPurchases = customerSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
    
    const lastPurchaseDate = customerSales.length > 0 
      ? customerSales.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
      : null;

    const productCounts = customerSales.reduce((acc, sale) => {
      acc[sale.productId] = (acc[sale.productId] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const topProductIds = Object.entries(productCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => parseInt(id));

    const topProducts = topProductIds.length > 0
      ? await db.select().from(products).where(inArray(products.id, topProductIds))
      : [];

    return {
      totalPurchases,
      lastPurchaseDate,
      favoriteProducts: topProducts.map(p => p.name),
    };
  }
}

export const storage = new DatabaseStorage();
