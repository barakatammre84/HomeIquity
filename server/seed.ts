import { db } from "./db";
import { properties, users } from "@shared/schema";
import { sql } from "drizzle-orm";

const sampleProperties = [
  {
    address: "123 Maple Street",
    city: "San Francisco",
    state: "California",
    zipCode: "94102",
    price: "875000",
    propertyType: "single_family",
    bedrooms: 3,
    bathrooms: "2.5",
    squareFeet: 1850,
    yearBuilt: 2018,
    description: "Beautiful modern home in prime SF location with updated kitchen and hardwood floors throughout.",
    features: ["Updated Kitchen", "Hardwood Floors", "Smart Home", "Central AC"],
    images: ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"],
    status: "active",
  },
  {
    address: "456 Oak Avenue",
    city: "Austin",
    state: "Texas",
    zipCode: "78701",
    price: "525000",
    propertyType: "single_family",
    bedrooms: 4,
    bathrooms: "3",
    squareFeet: 2400,
    yearBuilt: 2020,
    description: "Spacious family home with open floor plan, large backyard, and modern finishes.",
    features: ["Open Floor Plan", "Large Backyard", "2-Car Garage", "Energy Efficient"],
    images: ["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800"],
    status: "active",
  },
  {
    address: "789 Pine Road",
    city: "Seattle",
    state: "Washington",
    zipCode: "98101",
    price: "699000",
    propertyType: "condo",
    bedrooms: 2,
    bathrooms: "2",
    squareFeet: 1200,
    yearBuilt: 2021,
    description: "Luxury downtown condo with stunning city views, concierge service, and rooftop deck.",
    features: ["City Views", "Concierge", "Rooftop Deck", "Gym Access"],
    images: ["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800"],
    status: "active",
  },
  {
    address: "321 Birch Lane",
    city: "Denver",
    state: "Colorado",
    zipCode: "80202",
    price: "450000",
    propertyType: "townhouse",
    bedrooms: 3,
    bathrooms: "2.5",
    squareFeet: 1650,
    yearBuilt: 2019,
    description: "Modern townhouse near downtown with mountain views and attached garage.",
    features: ["Mountain Views", "Attached Garage", "Modern Kitchen", "Patio"],
    images: ["https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800"],
    status: "active",
  },
  {
    address: "654 Cedar Court",
    city: "Miami",
    state: "Florida",
    zipCode: "33101",
    price: "1250000",
    propertyType: "single_family",
    bedrooms: 5,
    bathrooms: "4",
    squareFeet: 3200,
    yearBuilt: 2022,
    description: "Stunning waterfront property with pool, boat dock, and hurricane-resistant construction.",
    features: ["Waterfront", "Pool", "Boat Dock", "Hurricane Resistant"],
    images: ["https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800"],
    status: "active",
  },
  {
    address: "987 Elm Street",
    city: "Portland",
    state: "Oregon",
    zipCode: "97201",
    price: "575000",
    propertyType: "single_family",
    bedrooms: 3,
    bathrooms: "2",
    squareFeet: 1900,
    yearBuilt: 2015,
    description: "Charming craftsman home with original details, updated systems, and lovely garden.",
    features: ["Craftsman Style", "Updated Systems", "Garden", "Covered Porch"],
    images: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800"],
    status: "active",
  },
];

export async function seedDatabase() {
  try {
    const existingProperties = await db.select({ id: properties.id }).from(properties).limit(1);
    
    if (existingProperties.length === 0) {
      console.log("Seeding properties...");
      for (const property of sampleProperties) {
        await db.insert(properties).values(property);
      }
      console.log(`Seeded ${sampleProperties.length} properties`);
    }

    const existingAdmin = await db.select({ id: users.id }).from(users).where(sql`id = 'admin-user-1'`).limit(1);
    
    if (existingAdmin.length === 0) {
      console.log("Creating admin user...");
      await db.insert(users).values({
        id: "admin-user-1",
        email: "admin@mortgageai.com",
        firstName: "Admin",
        lastName: "User",
        role: "admin",
      });
      console.log("Admin user created");
    } else {
      console.log("Admin user already exists, skipping seed");
    }

    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Seed error:", error);
  }
}
