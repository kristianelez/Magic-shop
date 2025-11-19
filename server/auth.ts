import { Request, Response, NextFunction } from "express";
import { User } from "@shared/schema";
import { storage } from "./storage";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Autentifikacija je obavezna" });
  }

  try {
    const user = await storage.getUser(req.session.userId);
    
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Korisnik nije pronađen" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Error in requireAuth middleware:", error);
    res.status(500).json({ message: "Greška pri autentifikaciji" });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Autentifikacija je obavezna" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Nemate dozvolu za pristup ovom resursu" });
    }

    next();
  };
}
