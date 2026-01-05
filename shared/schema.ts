import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const customerTypes = ["hotel", "pekara", "kafic", "restoran", "fabrika", "veseraj", "medicinska_ustanova", "autokozmetika", "ostalo"] as const;

export const userRoles = ["admin", "sales_director", "sales_manager", "komercijalista"] as const;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("komercijalista"),
});

export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3, "Korisničko ime mora imati najmanje 3 karaktera"),
  password: z.string().min(6, "Šifra mora imati najmanje 6 karaktera"),
  fullName: z.string().min(1, "Puno ime je obavezno"),
  role: z.enum(userRoles),
}).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  email: text("email"),
  phone: text("phone"),
  customerType: text("customer_type").default("ostalo"),
  status: text("status").notNull().default("active"),
  paymentTerms: text("payment_terms"),
  salesPersonId: varchar("sales_person_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers, {
  name: z.string().min(1, "Ime je obavezno"),
  company: z.string().min(1, "Kompanija je obavezna"),
  email: z.string().email("Nevažeća email adresa").optional().or(z.literal("")),
  phone: z.string().regex(/^\+?[0-9\s\-()/.]+$/, "Nevažeći broj telefona").optional().or(z.literal("")),
  customerType: z.enum(customerTypes).optional(),
  status: z.string().optional(),
  paymentTerms: z.string().optional(),
  salesPersonId: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  unit: text("unit").notNull().default("kom"),
  description: text("description"),
  vendor: text("vendor"),
  barcode: text("barcode"),
  recommendedFor: text("recommended_for").array(),
});

export const insertProductSchema = createInsertSchema(products, {
  name: z.string().min(1, "Naziv je obavezan"),
  category: z.string().min(1, "Kategorija je obavezna"),
  price: z.string().min(1, "Cijena je obavezna").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Cijena mora biti pozitivan broj"
  ),
  stock: z.number().int().min(0, "Stanje mora biti pozitivno"),
  unit: z.string().min(1, "Jedinica je obavezna"),
  vendor: z.string().optional(),
  recommendedFor: z.array(z.enum(customerTypes)).optional(),
}).omit({
  id: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  productId: integer("product_id").notNull().references(() => products.id),
  salesPersonId: varchar("sales_person_id").references(() => users.id),
  quantity: integer("quantity").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("completed"),
  invoiceVerified: text("invoice_verified").notNull().default("false"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSaleSchema = createInsertSchema(sales, {
  customerId: z.number().int(),
  productId: z.number().int(),
  salesPersonId: z.string().optional(),
  quantity: z.number().int(),
  totalAmount: z.string(),
  status: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  type: text("type").notNull(),
  notes: text("notes"),
  outcome: text("outcome"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activities, {
  customerId: z.number().int(),
  type: z.string().min(1),
  createdAt: z.date().optional(),
}).omit({
  id: true,
});

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

export const aiRecommendationsCache = pgTable("ai_recommendations_cache", {
  id: serial("id").primaryKey(),
  recommendations: text("recommendations").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AIRecommendationsCache = typeof aiRecommendationsCache.$inferSelect;

export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  salesPersonId: varchar("sales_person_id").references(() => users.id),
  status: text("status").notNull().default("draft"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const offerItems = pgTable("offer_items", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id").notNull().references(() => offers.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).default("0"),
  category: text("category").notNull(),
  productName: text("product_name"),
});

export const insertOfferSchema = createInsertSchema(offers, {
  customerId: z.number().int(),
  salesPersonId: z.string().optional(),
  status: z.string().optional(),
  totalAmount: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOfferItemSchema = createInsertSchema(offerItems, {
  offerId: z.number().int(),
  productId: z.number().int(),
  quantity: z.number().int(),
  price: z.string(),
  discount: z.string().optional().default("0"),
  category: z.string(),
  productName: z.string().optional(),
}).omit({
  id: true,
});

export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type Offer = typeof offers.$inferSelect;
export type InsertOfferItem = z.infer<typeof insertOfferItemSchema>;
export type OfferItem = typeof offerItems.$inferSelect;
