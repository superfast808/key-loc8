import { companies, users, locations, keyBunches, type Company, type InsertCompany } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export class CompanyService {
  // Create a new company with initial setup
  async createCompany(companyData: InsertCompany, userId: string): Promise<Company> {
    // Create the company
    const [company] = await db
      .insert(companies)
      .values(companyData)
      .returning();

    // Update the user to be associated with this company as admin
    await db
      .update(users)
      .set({ 
        companyId: company.id,
        role: "super_admin", // Company creator is always super admin
        updatedAt: new Date()
      })
      .where(eq(users.email, userId));

    // Don't create default locations - let companies start completely blank
    // await this.createDefaultLocations(company.id);

    return company;
  }

  // Create a new company with admin user in one transaction
  async createCompanyWithAdmin(
    companyData: InsertCompany,
    adminData: {
      email: string;
      firstName: string;
      lastName?: string;
      password: string;
    }
  ): Promise<{ company: Company; user: any }> {
    // Check if user with this email already exists
    const existingUser = await db.select().from(users).where(eq(users.email, adminData.email)).limit(1);
    if (existingUser.length > 0) {
      throw new Error("An account with this email address already exists. Please use a different email or log in to your existing account.");
    }

    // First create the company
    const [company] = await db
      .insert(companies)
      .values({
        ...companyData,
        adminEmail: adminData.email
      })
      .returning();

    // Create the admin user - let database auto-generate ID
    const [user] = await db
      .insert(users)
      .values({
        email: adminData.email,
        firstName: adminData.firstName,
        lastName: adminData.lastName || '',
        password: adminData.password, // Store the password directly for now
        companyId: company.id,
        role: 'super_admin', // First user is always super admin
        isActive: true,
        profileImageUrl: null,
        permissions: [],
        customPermissions: [],
        allowedLocationIds: []
      })
      .returning();

    // Don't create default locations - let companies start completely blank
    // await this.createDefaultLocations(company.id);

    return { company, user };
  }

  // Create default locations and demo data for new company
  private async createDefaultLocations(companyId: number) {
    const defaultLocations = [
      { name: "Main Office", type: "office", description: "Primary office location" },
      { name: "Van 1", type: "van", description: "Mobile unit 1" },
      { name: "Van 2", type: "van", description: "Mobile unit 2" },
    ];

    for (const locationData of defaultLocations) {
      await db.insert(locations).values({
        companyId,
        ...locationData,
        status: "active"
      });
    }
  }

  // Get company by ID
  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, id));
    
    return company;
  }

  // Get company by slug
  async getCompanyBySlug(slug: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.slug, slug));
    
    return company;
  }

  // Check if a company slug is available
  async isSlugAvailable(slug: string): Promise<boolean> {
    const existing = await this.getCompanyBySlug(slug);
    return !existing;
  }

  // Get user's company
  async getUserCompany(userId: number): Promise<Company | undefined> {
    const [user] = await db
      .select({ companyId: users.companyId })
      .from(users)
      .where(eq(users.id, userId));

    if (!user?.companyId) {
      return undefined;
    }

    return this.getCompany(user.companyId);
  }

  // Update company settings
  async updateCompany(id: number, updates: Partial<Company>): Promise<Company | undefined> {
    const [company] = await db
      .update(companies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();

    return company;
  }

  // Get all companies (admin only)
  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }

  // Check if user belongs to company
  async userBelongsToCompany(userId: string, companyId: number): Promise<boolean> {
    const [user] = await db
      .select({ companyId: users.companyId })
      .from(users)
      .where(eq(users.id, userId));

    return user?.companyId === companyId;
  }
}

export const companyService = new CompanyService();