import bcrypt from 'bcryptjs';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { storage } from './storage';
import type { User, UpsertUser } from '@shared/schema';

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function validateEmail(email: string): boolean {
  const normalizedEmail = normalizeEmail(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(normalizedEmail);
}

export async function createUserWithPassword(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
): Promise<User> {
  const normalizedEmail = normalizeEmail(email);

  if (!validateEmail(normalizedEmail)) {
    throw new Error('Invalid email format');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  const existingUser = await storage.getUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new Error('Email already exists');
  }

  const hashedPassword = await hashPassword(password);

  const userData: UpsertUser = {
    email: normalizedEmail,
    password: hashedPassword,
    authProvider: 'email',
    firstName,
    lastName,
    emailVerified: false,
  };

  return storage.createUser(userData);
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const normalizedEmail = normalizeEmail(email);
  const user = await storage.getUserByEmail(normalizedEmail);

  if (!user) {
    return null;
  }

  if (!user.password) {
    return null;
  }

  const isPasswordValid = await comparePassword(password, user.password);

  if (!isPasswordValid) {
    return null;
  }

  return user;
}

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const user = await authenticateUser(email, password);
        
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user: Express.User, done) => {
  done(null, (user as User).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    
    if (!user) {
      return done(null, false);
    }

    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
