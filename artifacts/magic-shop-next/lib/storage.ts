import { db } from "@/lib/db";
import {
  type User,
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Product,
  type InsertProduct,
  type ProductSize,
  type InsertProductSize,
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
  productSizes,
  sales,
  activities,
  offers,
  offerItems,
} from "@workspace/db/schema";
import { eq, desc, and, inArray, asc } from "drizzle-orm";

export interface CustomerWithStats extends Customer {
  totalPurchases: number;
  lastContact?: string;
  favoriteProducts: string[];
}

export interface ProductWithSizes extends Product {
  sizes: ProductSize[];
}

class DatabaseStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getCustomers(userId?: string, role?: string): Promise<Customer[]> {
    if (role === "admin" || role === "sales_director" || !userId) {
      return await db.select().from(customers).orderBy(desc(customers.createdAt));
    }
    return await db
      .select()
      .from(customers)
      .where(eq(customers.salesPersonId, userId))
      .orderBy(desc(customers.createdAt));
  }

  async getCustomersWithStats(userId?: string, role?: string): Promise<CustomerWithStats[]> {
    const canSeeAll = role === "admin" || role === "sales_director" || !userId;
    const [allCustomers, allActivities, allSales, allProducts] = await Promise.all([
      canSeeAll
        ? db.select().from(customers).orderBy(desc(customers.createdAt))
        : db
            .select()
            .from(customers)
            .where(eq(customers.salesPersonId, userId))
            .orderBy(desc(customers.createdAt)),
      db.select().from(activities).orderBy(desc(activities.createdAt)),
      canSeeAll
        ? db.select().from(sales)
        : db.select().from(sales).where(eq(sales.salesPersonId, userId)),
      db.select().from(products),
    ]);

    const productMap = new Map(allProducts.map((p) => [p.id, p.name]));

    const activitiesByCustomer = new Map<number, Activity[]>();
    for (const activity of allActivities) {
      const existing = activitiesByCustomer.get(activity.customerId) || [];
      existing.push(activity);
      activitiesByCustomer.set(activity.customerId, existing);
    }

    const salesByCustomer = new Map<number, { total: number; productCounts: Map<number, number> }>();
    for (const sale of allSales) {
      const existing = salesByCustomer.get(sale.customerId) || {
        total: 0,
        productCounts: new Map(),
      };
      existing.total += parseFloat(sale.totalAmount);
      existing.productCounts.set(
        sale.productId,
        (existing.productCounts.get(sale.productId) || 0) + 1,
      );
      salesByCustomer.set(sale.customerId, existing);
    }

    return allCustomers.map((customer) => {
      const customerActivities = activitiesByCustomer.get(customer.id) || [];
      const lastActivity = customerActivities[0];

      const customerSalesData = salesByCustomer.get(customer.id);
      const totalPurchases = customerSalesData?.total || 0;

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
          ? new Date(lastActivity.createdAt).toLocaleDateString("bs-BA")
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
    const result = await db
      .update(customers)
      .set(customer)
      .where(eq(customers.id, id))
      .returning();
    return result[0];
  }

  async deleteCustomer(id: number): Promise<boolean> {
    return await db.transaction(async (tx) => {
      await tx.delete(activities).where(eq(activities.customerId, id));
      await tx.delete(sales).where(eq(sales.customerId, id));
      const result = await tx.delete(customers).where(eq(customers.id, id)).returning();
      return result.length > 0;
    });
  }

  async getProducts(): Promise<ProductWithSizes[]> {
    const allProducts = await db.select().from(products).orderBy(products.name);
    const allSizes = await db
      .select()
      .from(productSizes)
      .orderBy(asc(productSizes.sortOrder), asc(productSizes.id));
    const sizesByProduct = new Map<number, ProductSize[]>();
    for (const s of allSizes) {
      const existing = sizesByProduct.get(s.productId) || [];
      existing.push(s);
      sizesByProduct.set(s.productId, existing);
    }
    return allProducts.map((p) => ({ ...p, sizes: sizesByProduct.get(p.id) || [] }));
  }

  async getProduct(id: number): Promise<ProductWithSizes | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!result[0]) return undefined;
    const sizes = await this.getProductSizes(id);
    return { ...result[0], sizes };
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

  async setProductPromotion(
    id: number,
    promotion: {
      promoPrice: string;
      promoStartDate: Date;
      promoEndDate: Date;
      promoNote?: string | null;
    },
  ): Promise<Product | undefined> {
    const result = await db
      .update(products)
      .set({
        promoPrice: promotion.promoPrice,
        promoStartDate: promotion.promoStartDate,
        promoEndDate: promotion.promoEndDate,
        promoNote: promotion.promoNote ?? null,
      })
      .where(eq(products.id, id))
      .returning();
    return result[0];
  }

  async clearProductPromotion(id: number): Promise<Product | undefined> {
    const result = await db
      .update(products)
      .set({
        promoPrice: null,
        promoStartDate: null,
        promoEndDate: null,
        promoNote: null,
      })
      .where(eq(products.id, id))
      .returning();
    return result[0];
  }

  async getProductSizes(productId: number): Promise<ProductSize[]> {
    return await db
      .select()
      .from(productSizes)
      .where(eq(productSizes.productId, productId))
      .orderBy(asc(productSizes.sortOrder), asc(productSizes.id));
  }

  async getProductSize(sizeId: number): Promise<ProductSize | undefined> {
    const result = await db
      .select()
      .from(productSizes)
      .where(eq(productSizes.id, sizeId))
      .limit(1);
    return result[0];
  }

  async createProductSize(
    productId: number,
    data: { name: string; stock: number; sortOrder?: number },
  ): Promise<ProductSize> {
    const result = await db
      .insert(productSizes)
      .values({ productId, name: data.name, stock: data.stock, sortOrder: data.sortOrder ?? 0 })
      .returning();
    return result[0];
  }

  async updateProductSize(
    sizeId: number,
    data: Partial<{ name: string; stock: number; sortOrder: number }>,
  ): Promise<ProductSize | undefined> {
    const result = await db
      .update(productSizes)
      .set(data)
      .where(eq(productSizes.id, sizeId))
      .returning();
    return result[0];
  }

  async deleteProductSize(sizeId: number): Promise<{ deleted: boolean; cleared: boolean }> {
    const usedInSales = await db
      .select({ id: sales.id })
      .from(sales)
      .where(eq(sales.sizeId, sizeId))
      .limit(1);
    const usedInOffers = await db
      .select({ id: offerItems.id })
      .from(offerItems)
      .where(eq(offerItems.sizeId, sizeId))
      .limit(1);
    if (usedInSales.length > 0 || usedInOffers.length > 0) {
      await db.update(productSizes).set({ stock: 0 }).where(eq(productSizes.id, sizeId));
      return { deleted: false, cleared: true };
    }
    const res = await db
      .delete(productSizes)
      .where(eq(productSizes.id, sizeId))
      .returning({ id: productSizes.id });
    return { deleted: res.length > 0, cleared: false };
  }

  async replaceProductSizes(
    productId: number,
    desired: Array<{ id?: number; name: string; stock: number; sortOrder?: number }>,
  ): Promise<ProductSize[]> {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(productSizes)
        .where(eq(productSizes.productId, productId));
      const existingById = new Map(existing.map((s) => [s.id, s]));
      const desiredIds = new Set(
        desired.filter((d) => typeof d.id === "number").map((d) => d.id as number),
      );

      for (const s of existing) {
        if (!desiredIds.has(s.id)) {
          const usedInSales = await tx
            .select({ id: sales.id })
            .from(sales)
            .where(eq(sales.sizeId, s.id))
            .limit(1);
          const usedInOffers = await tx
            .select({ id: offerItems.id })
            .from(offerItems)
            .where(eq(offerItems.sizeId, s.id))
            .limit(1);
          if (usedInSales.length > 0 || usedInOffers.length > 0) {
            await tx.update(productSizes).set({ stock: 0 }).where(eq(productSizes.id, s.id));
          } else {
            await tx.delete(productSizes).where(eq(productSizes.id, s.id));
          }
        }
      }

      let order = 0;
      for (const d of desired) {
        const sortOrder = typeof d.sortOrder === "number" ? d.sortOrder : order;
        if (typeof d.id === "number" && existingById.has(d.id)) {
          await tx
            .update(productSizes)
            .set({ name: d.name, stock: d.stock, sortOrder })
            .where(eq(productSizes.id, d.id));
        } else {
          await tx.insert(productSizes).values({ productId, name: d.name, stock: d.stock, sortOrder });
        }
        order++;
      }

      return await tx
        .select()
        .from(productSizes)
        .where(eq(productSizes.productId, productId))
        .orderBy(asc(productSizes.sortOrder), asc(productSizes.id));
    });
  }

  async getSale(id: number): Promise<Sale | undefined> {
    const result = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
    return result[0];
  }

  async getSales(userId?: string, role?: string): Promise<Sale[]> {
    if (role === "admin" || role === "sales_director" || !userId) {
      return await db.select().from(sales).orderBy(desc(sales.createdAt));
    }
    return await db
      .select()
      .from(sales)
      .where(eq(sales.salesPersonId, userId))
      .orderBy(desc(sales.createdAt));
  }

  async getSalesByCustomer(customerId: number, userId?: string, role?: string): Promise<Sale[]> {
    if (role === "admin" || role === "sales_director" || !userId) {
      return await db
        .select()
        .from(sales)
        .where(eq(sales.customerId, customerId))
        .orderBy(desc(sales.createdAt));
    }
    return await db
      .select()
      .from(sales)
      .where(and(eq(sales.customerId, customerId), eq(sales.salesPersonId, userId)))
      .orderBy(desc(sales.createdAt));
  }

  async getLastDiscountsByCustomer(
    customerId: number,
    userId?: string,
    role?: string,
  ): Promise<Record<number, string>> {
    const canSeeAll = role === "admin" || role === "sales_director" || !userId;
    const customerSales = canSeeAll
      ? await db
          .select({ productId: sales.productId, discount: sales.discount, createdAt: sales.createdAt })
          .from(sales)
          .where(eq(sales.customerId, customerId))
          .orderBy(desc(sales.createdAt))
      : await db
          .select({ productId: sales.productId, discount: sales.discount, createdAt: sales.createdAt })
          .from(sales)
          .where(and(eq(sales.customerId, customerId), eq(sales.salesPersonId, userId)))
          .orderBy(desc(sales.createdAt));

    const result: Record<number, string> = {};
    for (const sale of customerSales) {
      if (!(sale.productId in result)) {
        result[sale.productId] = sale.discount ?? "0";
      }
    }
    return result;
  }

  async createSale(sale: InsertSale & { createdAt?: Date }): Promise<Sale> {
    const result = await db.insert(sales).values(sale).returning();
    return result[0];
  }

  async updateSale(id: number, sale: Partial<InsertSale> & { createdAt?: Date }): Promise<Sale | undefined> {
    const result = await db.update(sales).set(sale).where(eq(sales.id, id)).returning();
    return result[0];
  }

  async deleteSale(id: number): Promise<boolean> {
    const result = await db.delete(sales).where(eq(sales.id, id)).returning();
    return result.length > 0;
  }

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

  async getOffers(userId?: string, role?: string): Promise<any[]> {
    const canSeeAll = role === "admin" || role === "sales_director" || !userId;
    const allOffers = canSeeAll
      ? await db.select().from(offers).orderBy(desc(offers.createdAt))
      : await db
          .select()
          .from(offers)
          .where(eq(offers.salesPersonId, userId))
          .orderBy(desc(offers.createdAt));
    const allOfferItems = await db.select().from(offerItems);
    const allProducts = await db.select().from(products);
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    return allOffers.map((offer) => ({
      ...offer,
      items: allOfferItems
        .filter((item) => item.offerId === offer.id)
        .map((item) => ({
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
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    return {
      ...offer[0],
      items: items.map((item) => ({
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

  async getCustomerStats(
    customerId: number,
    userId?: string,
    role?: string,
  ): Promise<{
    totalPurchases: number;
    lastPurchaseDate: Date | null;
    favoriteProducts: string[];
  }> {
    let customerSales;
    if (role === "admin" || role === "sales_director" || !userId) {
      customerSales = await db
        .select({ totalAmount: sales.totalAmount, createdAt: sales.createdAt, productId: sales.productId })
        .from(sales)
        .where(eq(sales.customerId, customerId));
    } else {
      customerSales = await db
        .select({ totalAmount: sales.totalAmount, createdAt: sales.createdAt, productId: sales.productId })
        .from(sales)
        .where(and(eq(sales.customerId, customerId), eq(sales.salesPersonId, userId)));
    }

    const totalPurchases = customerSales.reduce(
      (sum, sale) => sum + parseFloat(sale.totalAmount),
      0,
    );

    const lastPurchaseDate =
      customerSales.length > 0
        ? customerSales.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
        : null;

    const productCounts = customerSales.reduce(
      (acc, sale) => {
        acc[sale.productId] = (acc[sale.productId] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

    const topProductIds = Object.entries(productCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => parseInt(id));

    const topProducts =
      topProductIds.length > 0
        ? await db.select().from(products).where(inArray(products.id, topProductIds))
        : [];

    return {
      totalPurchases,
      lastPurchaseDate,
      favoriteProducts: topProducts.map((p) => p.name),
    };
  }
}

export const storage = new DatabaseStorage();
