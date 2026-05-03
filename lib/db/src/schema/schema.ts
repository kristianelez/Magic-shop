import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, decimal, timestamp, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// "session" tablica koju koristi connect-pg-simple za čuvanje express
// sesija. Strukturu (sid PK, sess JSON, expire timestamp(6) + indeks na
// expire) diktira sam connect-pg-simple paket. Tablica se OBAVEZNO mora
// nalaziti u Drizzle schemi — inače `npm run db:push` u post-merge skripti
// vidi tablicu u bazi koja "ne pripada" shemi i traži destruktivni DROP,
// što obara sesije svih prijavljenih korisnika i izaziva grešku
// "relation \"session\" does not exist" pri prvom sljedećem zahtjevu.
export const session = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_session_expire").on(table.expire),
  }),
);

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
  promoPrice: decimal("promo_price", { precision: 10, scale: 2 }),
  promoStartDate: timestamp("promo_start_date"),
  promoEndDate: timestamp("promo_end_date"),
  promoNote: text("promo_note"),
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
  promoPrice: z.string().optional().nullable(),
  promoStartDate: z.date().optional().nullable(),
  promoEndDate: z.date().optional().nullable(),
  promoNote: z.string().optional().nullable(),
}).omit({
  id: true,
  promoPrice: true,
  promoStartDate: true,
  promoEndDate: true,
  promoNote: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Veličine artikala (npr. S/M/L/XL) i stanje po veličini.
// Opcionalno — artikli bez veličina rade kao i danas.
export const productSizes = pgTable("product_sizes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  stock: integer("stock").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertProductSizeSchema = createInsertSchema(productSizes, {
  productId: z.number().int(),
  name: z.string().min(1, "Naziv veličine je obavezan"),
  stock: z.number().int().min(0, "Stanje mora biti pozitivno"),
  sortOrder: z.number().int().optional(),
}).omit({ id: true });

export type InsertProductSize = z.infer<typeof insertProductSizeSchema>;
export type ProductSize = typeof productSizes.$inferSelect;

// Šema za bulk-update veličina nekog artikla.
// Frontend šalje cijelu listu željenih veličina, backend pravi diff.
export const updateProductSizesSchema = z.object({
  sizes: z.array(
    z.object({
      id: z.number().int().optional(),
      name: z.string().min(1, "Naziv veličine je obavezan"),
      stock: z.number().int().min(0, "Stanje mora biti pozitivno"),
      sortOrder: z.number().int().optional(),
    }),
  ),
});

export type UpdateProductSizesInput = z.infer<typeof updateProductSizesSchema>;

export const setPromotionSchema = z.object({
  promoPrice: z
    .string()
    .min(1, "Akcijska cijena je obavezna")
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
      "Akcijska cijena mora biti pozitivan broj",
    ),
  promoStartDate: z.string().min(1, "Datum početka je obavezan"),
  promoEndDate: z.string().min(1, "Datum kraja je obavezan"),
  promoNote: z.string().optional().nullable(),
});

export type SetPromotionInput = z.infer<typeof setPromotionSchema>;

// Pomoćna provjera: da li je artikal trenutno na akciji
export function isPromotionActive(product: Pick<Product, "promoPrice" | "promoStartDate" | "promoEndDate">, now: Date = new Date()): boolean {
  if (!product.promoPrice) return false;
  const start = product.promoStartDate ? new Date(product.promoStartDate) : null;
  const end = product.promoEndDate ? new Date(product.promoEndDate) : null;
  if (!start || !end) return false;
  return now >= start && now <= end;
}

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  productId: integer("product_id").notNull().references(() => products.id),
  // Veličina artikla (npr. M, L) — opcionalno; popunjeno samo ako artikal ima veličine.
  sizeId: integer("size_id").references(() => productSizes.id),
  salesPersonId: varchar("sales_person_id").references(() => users.id),
  quantity: integer("quantity").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("completed"),
  invoiceVerified: text("invoice_verified").notNull().default("false"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSaleSchema = createInsertSchema(sales, {
  customerId: z.number().int(),
  productId: z.number().int(),
  sizeId: z.number().int().nullable().optional(),
  salesPersonId: z.string().optional(),
  quantity: z.number().int(),
  totalAmount: z.string(),
  discount: z.string().optional(),
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

// Expo push tokeni — registrovani sa mobilnih klijenata nakon prijave.
// Jedan korisnik može imati više uređaja, ali isti token (uređaj) ne smije
// postojati duplo, tako da je `token` unique. Pri brisanju usera/loginu
// drugog korisnika s istim tokenom radimo upsert preko `token`.
export const pushTokens = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  platform: text("platform"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPushTokenSchema = createInsertSchema(pushTokens, {
  userId: z.string(),
  token: z.string().min(1, "Push token je obavezan"),
  platform: z.string().optional().nullable(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type PushToken = typeof pushTokens.$inferSelect;

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
  // Veličina artikla — opcionalno, samo ako artikal ima veličine.
  sizeId: integer("size_id").references(() => productSizes.id),
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
