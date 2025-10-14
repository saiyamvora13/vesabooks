import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { adminUsers, type AdminUser } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

passport.use('admin-local', new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password',
  },
  async (email: string, password: string, done) => {
    try {
      const normalizedEmail = normalizeEmail(email);
      
      const [admin] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, normalizedEmail))
        .limit(1);

      if (!admin) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      const isValidPassword = await comparePassword(password, admin.password);
      
      if (!isValidPassword) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      return done(null, admin);
    } catch (error) {
      return done(error);
    }
  }
));

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && (req.user as any)?.isAdminUser) {
    return next();
  }
  return res.status(403).json({ message: 'Admin access required' });
}

export async function createAdminUser(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
  isSuperAdmin: boolean = false
): Promise<AdminUser> {
  const normalizedEmail = normalizeEmail(email);
  const hashedPassword = await hashPassword(password);

  const [admin] = await db
    .insert(adminUsers)
    .values({
      email: normalizedEmail,
      password: hashedPassword,
      firstName,
      lastName,
      isSuperAdmin,
    })
    .returning();

  return admin;
}

export async function getAdminByEmail(email: string): Promise<AdminUser | undefined> {
  const normalizedEmail = normalizeEmail(email);
  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, normalizedEmail))
    .limit(1);
  
  return admin || undefined;
}

export async function getAdminById(id: string): Promise<AdminUser | undefined> {
  const [admin] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1);
  
  return admin || undefined;
}
