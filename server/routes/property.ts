import type { Express } from "express";
import type { IStorage } from "../storage";
import { checkPropertyEligibility } from "../underwriting";

export function registerPropertyRoutes(
  app: Express,
  storage: IStorage,
  isAuthenticated: any,
  isAdmin: any,
) {
  app.get("/api/properties/auto-complete", async (req, res) => {
    try {
      const { input } = req.query;
      if (!input || typeof input !== "string" || input.trim().length < 2) {
        return res.json([]);
      }

      const apiKey = process.env.RAPIDAPI_KEY;
      if (!apiKey) {
        return res.json([]);
      }

      const response = await fetch(
        `https://realty-us.p.rapidapi.com/properties/auto-complete?input=${encodeURIComponent(input.trim())}`,
        {
          headers: {
            "x-rapidapi-host": "realty-us.p.rapidapi.com",
            "x-rapidapi-key": apiKey,
          },
        }
      );

      if (!response.ok) {
        console.error("Auto-complete API error:", response.status);
        return res.json([]);
      }

      const data = await response.json();
      const suggestions = (data?.data?.autocomplete || [])
        .filter((item: any) => item.area_type === "city" || item.area_type === "state" || item.area_type === "address" || item.area_type === "postal_code" || item.area_type === "neighborhood")
        .slice(0, 8)
        .map((item: any) => ({
          id: item._id,
          type: item.area_type,
          label: item.full_address || item.city || item.state || "",
          city: item.city || null,
          stateCode: item.state_code || null,
          slug: item.slug_id || null,
        }));

      res.json(suggestions);
    } catch (error) {
      console.error("Auto-complete error:", error);
      res.json([]);
    }
  });

  app.get("/api/properties/search-live", async (req, res) => {
    try {
      const { location, sortBy, minPrice, maxPrice, type, page } = req.query;
      if (!location || typeof location !== "string") {
        return res.json({ properties: [], total: 0, source: "empty" });
      }

      const apiKey = process.env.RAPIDAPI_KEY;
      if (!apiKey) {
        return res.json({ properties: [], total: 0, source: "no_key" });
      }

      const params = new URLSearchParams();
      params.set("location", location);
      params.set("sortBy", (sortBy as string) || "relevance");
      if (minPrice) params.set("priceMin", minPrice as string);
      if (maxPrice) params.set("priceMax", maxPrice as string);
      if (type && type !== "all") {
        const typeMap: Record<string, string> = {
          single_family: "single_family",
          condo: "condo",
          townhouse: "townhomes",
          multi_family: "multi_family",
        };
        if (typeMap[type as string]) params.set("home_type", typeMap[type as string]);
      }
      if (page) params.set("offset", String((parseInt(page as string) - 1) * 20));

      const response = await fetch(
        `https://realty-us.p.rapidapi.com/properties/search-buy?${params.toString()}`,
        {
          headers: {
            "x-rapidapi-host": "realty-us.p.rapidapi.com",
            "x-rapidapi-key": apiKey,
          },
        }
      );

      if (!response.ok) {
        console.error("Search-buy API error:", response.status);
        return res.json({ properties: [], total: 0, source: "api_error" });
      }

      const data = await response.json();
      const results = data?.data?.results || [];
      const total = data?.data?.total || results.length;

      const properties = results.map((item: any) => {
        const addr = item.location?.address || {};
        const desc = item.description || {};
        const baths = desc.baths ?? desc.baths_full_calc ?? null;
        return {
          property_id: item.property_id,
          status: item.status || "for_sale",
          price: item.list_price || item.list_price_min || 0,
          address: addr.line || "",
          city: addr.city || "",
          state: addr.state || "",
          stateCode: addr.state_code || "",
          zipcode: addr.postal_code || "",
          beds: desc.beds ?? desc.beds_min ?? null,
          baths: baths,
          sqft: desc.sqft ?? desc.sqft_min ?? null,
          lotSqft: desc.lot_sqft || null,
          propertyType: desc.type || "single_family",
          photo: item.primary_photo?.href || null,
          photos: (item.photos || []).slice(0, 6).map((p: any) => p.href),
          listDate: item.list_date || null,
          priceReduced: item.price_reduced_amount || null,
          isNewConstruction: item.flags?.is_new_construction || false,
          isForeclosure: item.flags?.is_foreclosure || false,
          isPending: item.flags?.is_pending || false,
          href: item.href || null,
        };
      });

      res.json({ properties, total, source: "live" });
    } catch (error) {
      console.error("Search-buy error:", error);
      res.json({ properties: [], total: 0, source: "error" });
    }
  });

  app.get("/api/properties", async (req, res) => {
    try {
      const { search, type, minPrice, maxPrice } = req.query;
      
      const properties = await storage.getAllProperties({
        search: search as string,
        type: type as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
      });
      
      res.json(properties);
    } catch (error) {
      console.error("Get properties error:", error);
      res.status(500).json({ error: "Failed to get properties" });
    }
  });

  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Get property error:", error);
      res.status(500).json({ error: "Failed to get property" });
    }
  });

  // Affordability check API - Uses underwriting engine to determine if buyer qualifies
  app.post("/api/properties/:id/affordability", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const property = await storage.getProperty(req.params.id);
      
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // Get user's latest pre-approved loan application
      const applications = await storage.getLoanApplicationsByUser(userId);
      const preApproval = applications.find(
        app => app.status === "pre_approved" || app.status === "approved"
      ) || applications[0];

      if (!preApproval) {
        return res.status(400).json({ 
          error: "No loan application found",
          message: "Please complete a pre-approval application first"
        });
      }

      // Validate required financial data exists
      const annualIncome = preApproval.annualIncome ? parseFloat(String(preApproval.annualIncome)) : 0;
      if (annualIncome <= 0) {
        return res.status(400).json({ 
          error: "Incomplete application",
          message: "Your loan application is missing income information"
        });
      }

      const preApprovalAmount = preApproval.preApprovalAmount 
        ? parseFloat(String(preApproval.preApprovalAmount))
        : 0;
      const monthlyIncome = annualIncome / 12;
      const monthlyDebts = preApproval.monthlyDebts 
        ? parseFloat(String(preApproval.monthlyDebts))
        : 0;
      const creditScore = preApproval.creditScore || 720;

      const price = parseFloat(property.price);
      const downPaymentPercent = req.body.downPaymentPercent || 5;
      
      // Use underwriting engine to check property eligibility
      const eligibility = checkPropertyEligibility(
        preApprovalAmount * 0.2, // Estimate assets as 20% of pre-approval for down payment capacity
        monthlyIncome,
        monthlyDebts,
        price,
        property.propertyType || "single_family",
        undefined, // property tax - will use default estimate
        undefined, // HOA
        Math.max(100, price * 0.003 / 12), // insurance estimate based on property value
        100 - downPaymentPercent // max LTV
      );

      // Determine status using GSE-aligned thresholds
      let status: "qualified" | "stretch" | "not_qualified" = "qualified";
      
      // Check price vs pre-approval
      if (price > preApprovalAmount) {
        status = "not_qualified";
      }
      
      // Check DTI
      if (!eligibility.canBuyProperty || eligibility.finalDTI > 50) {
        status = "not_qualified";
      } else if (eligibility.finalDTI > 43) {
        if (status !== "not_qualified") status = "stretch";
      }

      res.json({
        canAfford: status !== "not_qualified",
        status,
        estimatedPayment: eligibility.estimatedPITI,
        dtiWithProperty: eligibility.finalDTI,
        requiredDownPayment: eligibility.requiredDownPayment,
        loanAmount: eligibility.maxLoanAmount,
        ltvRatio: eligibility.ltvRatio,
        reasons: eligibility.reasons,
        preApprovalAmount,
        monthlyIncome,
        creditScore,
      });
    } catch (error) {
      console.error("Affordability check error:", error);
      res.status(500).json({ error: "Failed to check affordability" });
    }
  });

  // Property CRUD for agents
  app.post("/api/properties", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const agentProfile = await storage.getAgentProfileByUserId(userId);
      
      if (!agentProfile) {
        return res.status(403).json({ error: "Agent profile required to create listings" });
      }

      const propertyData = {
        ...req.body,
        agentId: agentProfile.id,
        listedAt: new Date(),
      };

      const property = await storage.createProperty(propertyData);
      
      await storage.updateAgentProfile(agentProfile.id, {
        activeListings: (agentProfile.activeListings || 0) + 1,
      });

      res.status(201).json(property);
    } catch (error) {
      console.error("Create property error:", error);
      res.status(500).json({ error: "Failed to create property" });
    }
  });

  app.patch("/api/properties/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const property = await storage.getProperty(req.params.id);
      
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      const agentProfile = await storage.getAgentProfileByUserId(userId);
      if (!agentProfile || property.agentId !== agentProfile.id) {
        return res.status(403).json({ error: "Not authorized to update this property" });
      }

      const updated = await storage.updateProperty(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Update property error:", error);
      res.status(500).json({ error: "Failed to update property" });
    }
  });

  app.delete("/api/properties/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const property = await storage.getProperty(req.params.id);
      
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      const agentProfile = await storage.getAgentProfileByUserId(userId);
      if (!agentProfile || property.agentId !== agentProfile.id) {
        return res.status(403).json({ error: "Not authorized to delete this property" });
      }

      await storage.deleteProperty(req.params.id);
      
      if (property.status === "active") {
        await storage.updateAgentProfile(agentProfile.id, {
          activeListings: Math.max((agentProfile.activeListings || 1) - 1, 0),
        });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Delete property error:", error);
      res.status(500).json({ error: "Failed to delete property" });
    }
  });
}
