import { storage } from "./storage";
import { db } from "./db";
import { activities, sales, aiRecommendationsCache, offers, offerItems } from "@shared/schema";

async function cleanupProductionData() {
  if (process.env.REPLIT_DEPLOYMENT === "1") {
    console.log("Starting production data cleanup...");
    try {
      await db.delete(activities);
      await db.delete(sales);
      await db.delete(aiRecommendationsCache);
      await db.delete(offerItems);
      await db.delete(offers);
      console.log("Production data cleanup successful.");
    } catch (error) {
      console.error("Production data cleanup failed:", error);
    }
  } else {
    console.log("Cleanup skipped: Not a production deployment.");
  }
}

cleanupProductionData().catch(console.error);
