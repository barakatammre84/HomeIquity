import { db } from "./db";
import { properties, users, contentCategories, articles, faqs } from "@shared/schema";
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

    // Seed Learning Center content
    const existingCategories = await db.select({ id: contentCategories.id }).from(contentCategories).limit(1);
    
    if (existingCategories.length === 0) {
      console.log("Seeding Learning Center content...");
      
      // Create categories
      const categoryData = [
        { id: "cat-getting-started", name: "Getting Started", slug: "getting-started", description: "Essential guides for first-time homebuyers", icon: "home", color: "#22c55e", displayOrder: 1 },
        { id: "cat-mortgage-basics", name: "Mortgage Basics", slug: "mortgage-basics", description: "Understanding different loan types and terms", icon: "book-open", color: "#3b82f6", displayOrder: 2 },
        { id: "cat-credit-finance", name: "Credit & Finance", slug: "credit-finance", description: "Tips for improving your financial profile", icon: "dollar-sign", color: "#f59e0b", displayOrder: 3 },
        { id: "cat-home-buying", name: "Home Buying Process", slug: "home-buying", description: "Step-by-step guide to purchasing your home", icon: "file-text", color: "#8b5cf6", displayOrder: 4 },
      ];
      
      for (const cat of categoryData) {
        await db.insert(contentCategories).values(cat);
      }
      console.log("Seeded content categories");
      
      // Create articles
      const articleData = [
        {
          title: "First-Time Homebuyer's Complete Guide",
          slug: "first-time-homebuyer-guide",
          excerpt: "Everything you need to know about buying your first home, from pre-approval to closing.",
          content: `Buying your first home is an exciting milestone. This comprehensive guide will walk you through every step of the process.

## Getting Started

Before you start looking at homes, you'll want to get your finances in order. This means:

- Checking your credit score
- Saving for a down payment
- Getting pre-approved for a mortgage

## The Pre-Approval Process

A pre-approval letter shows sellers you're a serious buyer. To get pre-approved, you'll need:

- Proof of income (pay stubs, W-2s, tax returns)
- Proof of assets (bank statements)
- Good credit history
- Employment verification

## Finding the Right Home

Work with a real estate agent to find homes in your budget. Consider factors like:

- Location and commute times
- School districts
- Future resale value
- Home condition and age

## Making an Offer

Once you find the right home, your agent will help you make a competitive offer. Be prepared to negotiate on price, closing costs, and contingencies.

## Closing the Deal

The closing process typically takes 30-45 days. During this time, you'll complete a home inspection, finalize your mortgage, and sign lots of paperwork!`,
          categoryId: "cat-getting-started",
          tags: ["first-time buyer", "guide", "pre-approval"],
          status: "published",
          authorId: "admin-user-1",
          publishedAt: new Date(),
        },
        {
          title: "Understanding Mortgage Types: Fixed vs. Adjustable",
          slug: "fixed-vs-adjustable-rate-mortgages",
          excerpt: "Learn the differences between fixed-rate and adjustable-rate mortgages to make an informed decision.",
          content: `When choosing a mortgage, one of the most important decisions is whether to go with a fixed-rate or adjustable-rate mortgage (ARM).

## Fixed-Rate Mortgages

A fixed-rate mortgage locks in your interest rate for the entire loan term. This means your monthly payment stays the same.

### Pros
- Predictable monthly payments
- Protection from rising interest rates
- Easier to budget

### Cons
- Usually higher initial rates than ARMs
- Less flexibility if rates drop

## Adjustable-Rate Mortgages (ARMs)

ARMs start with a lower fixed rate for an initial period, then adjust periodically based on market conditions.

### Common ARM Types
- 5/1 ARM: Fixed for 5 years, then adjusts annually
- 7/1 ARM: Fixed for 7 years, then adjusts annually
- 10/1 ARM: Fixed for 10 years, then adjusts annually

### Pros
- Lower initial rates
- Good if you plan to sell or refinance before adjustment

### Cons
- Payments can increase significantly
- More complex to understand

## Which Should You Choose?

Choose a fixed-rate mortgage if you plan to stay in your home long-term and want payment stability. Consider an ARM if you plan to move or refinance within the initial fixed period.`,
          categoryId: "cat-mortgage-basics",
          tags: ["mortgage types", "fixed-rate", "adjustable-rate", "ARM"],
          status: "published",
          authorId: "admin-user-1",
          publishedAt: new Date(),
        },
        {
          title: "How to Improve Your Credit Score for a Better Mortgage Rate",
          slug: "improve-credit-score-mortgage",
          excerpt: "Practical tips to boost your credit score and qualify for the best mortgage rates.",
          content: `Your credit score is one of the most important factors in determining your mortgage rate. Here's how to improve it.

## Understanding Credit Scores

Credit scores range from 300 to 850. For the best mortgage rates, aim for 740 or higher.

- Excellent: 750+
- Good: 700-749
- Fair: 650-699
- Poor: Below 650

## Quick Wins to Boost Your Score

### 1. Pay Bills On Time
Payment history is 35% of your score. Set up autopay to never miss a payment.

### 2. Reduce Credit Utilization
Keep your credit card balances below 30% of your limits. Below 10% is even better.

### 3. Don't Close Old Accounts
Length of credit history matters. Keep old accounts open even if you don't use them.

### 4. Limit New Credit Applications
Each hard inquiry can temporarily lower your score. Avoid opening new accounts before applying for a mortgage.

## Long-Term Strategies

- Become an authorized user on someone's good credit account
- Dispute any errors on your credit reports
- Pay down debt rather than moving it around

## How Long Does It Take?

Most improvements take 30-60 days to show on your credit report. Start working on your credit at least 6 months before applying for a mortgage.`,
          categoryId: "cat-credit-finance",
          tags: ["credit score", "credit", "rates", "tips"],
          status: "published",
          authorId: "admin-user-1",
          publishedAt: new Date(),
        },
      ];
      
      for (const article of articleData) {
        await db.insert(articles).values(article);
      }
      console.log("Seeded articles");
      
      // Create FAQs
      const faqData = [
        {
          question: "How much house can I afford?",
          answer: "A general rule is that your monthly housing costs (including mortgage, insurance, and taxes) should not exceed 28% of your gross monthly income. Use our affordability calculator to get a personalized estimate based on your income, debts, and down payment.",
          categoryId: "cat-getting-started",
          searchKeywords: ["afford", "budget", "income", "how much"],
          displayOrder: 1,
          isPopular: true,
          status: "published",
          authorId: "admin-user-1",
        },
        {
          question: "What credit score do I need to buy a house?",
          answer: "While you can get a conventional loan with a credit score as low as 620, you'll get the best rates with a score of 740 or higher. FHA loans are available with scores as low as 580. The higher your score, the lower your interest rate will be.",
          categoryId: "cat-credit-finance",
          searchKeywords: ["credit score", "credit", "minimum", "requirement"],
          displayOrder: 2,
          isPopular: true,
          status: "published",
          authorId: "admin-user-1",
        },
        {
          question: "How much should I save for a down payment?",
          answer: "While 20% down is traditional, many loans allow for much less. Conventional loans may require as little as 3%, FHA loans 3.5%, and VA/USDA loans can be 0% down. However, putting less than 20% down typically requires private mortgage insurance (PMI).",
          categoryId: "cat-getting-started",
          searchKeywords: ["down payment", "save", "20 percent", "PMI"],
          displayOrder: 3,
          isPopular: true,
          status: "published",
          authorId: "admin-user-1",
        },
        {
          question: "What documents do I need to apply for a mortgage?",
          answer: "You'll typically need: proof of income (pay stubs, W-2s, tax returns for 2 years), bank statements (2-3 months), identification (driver's license, Social Security card), employment verification, and proof of assets. Self-employed borrowers may need additional documentation.",
          categoryId: "cat-home-buying",
          searchKeywords: ["documents", "paperwork", "requirements", "apply"],
          displayOrder: 4,
          status: "published",
          authorId: "admin-user-1",
        },
        {
          question: "How long does the mortgage process take?",
          answer: "The typical mortgage process takes 30-45 days from application to closing. Getting pre-approved can take 1-3 days. Factors that can affect timing include document collection, appraisal scheduling, and title search completion.",
          categoryId: "cat-home-buying",
          searchKeywords: ["timeline", "how long", "closing", "process"],
          displayOrder: 5,
          isPopular: true,
          status: "published",
          authorId: "admin-user-1",
        },
        {
          question: "What is PMI and how can I avoid it?",
          answer: "Private Mortgage Insurance (PMI) protects the lender if you default on your loan. It's required when you put less than 20% down on a conventional loan. To avoid PMI, you can: put 20% or more down, get a VA loan (if eligible), or use a piggyback loan structure.",
          categoryId: "cat-mortgage-basics",
          searchKeywords: ["PMI", "private mortgage insurance", "avoid", "20 percent"],
          displayOrder: 6,
          status: "published",
          authorId: "admin-user-1",
        },
        {
          question: "Should I get a 15-year or 30-year mortgage?",
          answer: "A 30-year mortgage has lower monthly payments but you pay more interest over time. A 15-year mortgage has higher payments but saves significantly on interest and builds equity faster. Choose based on your budget, financial goals, and how long you plan to stay in the home.",
          categoryId: "cat-mortgage-basics",
          searchKeywords: ["15 year", "30 year", "term", "loan length"],
          displayOrder: 7,
          status: "published",
          authorId: "admin-user-1",
        },
        {
          question: "What is an escrow account?",
          answer: "An escrow account holds funds for property taxes and homeowner's insurance. Your lender collects a portion with each mortgage payment and pays these bills on your behalf. This spreads out these large expenses and ensures they're always paid on time.",
          categoryId: "cat-mortgage-basics",
          searchKeywords: ["escrow", "taxes", "insurance", "payments"],
          displayOrder: 8,
          status: "published",
          authorId: "admin-user-1",
        },
      ];
      
      for (const faq of faqData) {
        await db.insert(faqs).values(faq);
      }
      console.log("Seeded FAQs");
    }

    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Seed error:", error);
  }
}
