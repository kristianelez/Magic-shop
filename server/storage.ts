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
  users,
  customers,
  products,
  sales,
  activities,
} from "@shared/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Customers
  getCustomers(): Promise<Customer[]>;
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
  createSale(sale: InsertSale): Promise<Sale>;

  // Activities
  getActivities(): Promise<Activity[]>;
  getActivitiesByCustomer(customerId: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

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
  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
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
    const result = await db.delete(customers).where(eq(customers.id, id)).returning();
    return result.length > 0;
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

  async createSale(sale: InsertSale): Promise<Sale> {
    const result = await db.insert(sales).values(sale).returning();
    return result[0];
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
