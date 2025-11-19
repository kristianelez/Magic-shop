import { Request, Response, NextFunction } from "express";
import { User } from "@shared/schema";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Autentifikacija je obavezna" });
  }
  next();
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
