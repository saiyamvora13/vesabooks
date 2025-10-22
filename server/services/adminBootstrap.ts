import { storage } from '../storage';
import { hashPassword, normalizeEmail } from '../auth';

/**
 * Admin Bootstrap Service
 * Automatically creates the first admin user from environment variables on server startup.
 * This solves the chicken-and-egg problem of creating the first admin when deploying to new environments.
 * 
 * Required Environment Variables:
 * - ADMIN_BOOTSTRAP_EMAIL: Email for the first admin user
 * - ADMIN_BOOTSTRAP_PASSWORD: Password for the first admin user
 * 
 * Optional Environment Variables:
 * - ADMIN_BOOTSTRAP_FIRST_NAME: First name (defaults to "Admin")
 * - ADMIN_BOOTSTRAP_LAST_NAME: Last name (defaults to "User")
 * 
 * Security:
 * - Only runs if NO admin users exist in the database
 * - Only activates when bootstrap environment variables are explicitly set
 * - Logs are minimal to avoid exposing sensitive information
 */
export async function bootstrapAdminUser(): Promise<void> {
  try {
    const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
    const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;

    // Skip bootstrap if environment variables are not set
    if (!bootstrapEmail || !bootstrapPassword) {
      console.log('[Admin Bootstrap] No bootstrap credentials configured - skipping');
      return;
    }

    // Check if any admin users already exist
    const existingAdmins = await storage.getAllAdminUsers();
    if (existingAdmins.length > 0) {
      console.log('[Admin Bootstrap] Admin users already exist - skipping bootstrap');
      return;
    }

    // Create the first admin user
    console.log('[Admin Bootstrap] No admin users found - creating first admin from environment variables...');
    
    const hashedPassword = await hashPassword(bootstrapPassword);
    const adminUser = await storage.createAdminUser({
      email: normalizeEmail(bootstrapEmail),
      password: hashedPassword,
      firstName: process.env.ADMIN_BOOTSTRAP_FIRST_NAME || 'Admin',
      lastName: process.env.ADMIN_BOOTSTRAP_LAST_NAME || 'User',
      isSuperAdmin: true,
    });

    console.log(`[Admin Bootstrap] ✅ Successfully created first admin user: ${adminUser.email}`);
  } catch (error) {
    console.error('[Admin Bootstrap] ❌ Failed to bootstrap admin user:', error);
    // Don't throw - we don't want to crash the server on bootstrap failure
  }
}
