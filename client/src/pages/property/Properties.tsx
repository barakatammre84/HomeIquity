import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/authUtils";
import type { Property } from "@shared/schema";
import {
  Search,
  MapPin,
  Bed,
  Bath,
  Square,
  Heart,
  DollarSign,
  Filter,
  Grid,
  List,
  Home,
} from "lucide-react";
import familyImage from "@assets/stock_images/happy_family_new_hom_d488bf67.jpg";

const PROPERTY_TYPES = [
  { value: "all", label: "All Types" },
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
];

export default function Properties() {
  const [searchQuery, setSearchQuery] = useState("");
  const [propertyType, setPropertyType] = useState("all");
  const [priceRange, setPriceRange] = useState([0, 2000000]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (propertyType && propertyType !== "all") params.set("type", propertyType);
    if (priceRange[0] > 0) params.set("minPrice", priceRange[0].toString());
    if (priceRange[1] < 2000000) params.set("maxPrice", priceRange[1].toString());
    const qs = params.toString();
    return qs ? `/api/properties?${qs}` : "/api/properties";
  };

  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: [buildQueryString()],
  });

  const filteredProperties = properties?.filter((property) => {
    const matchesType = propertyType === "all" || property.propertyType === propertyType;
    const matchesPrice = 
      parseFloat(property.price) >= priceRange[0] && 
      parseFloat(property.price) <= priceRange[1];
    const matchesSearch = 
      !searchQuery || 
      property.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.city.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesPrice && matchesSearch;
  }) || [];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="relative h-64 bg-gradient-to-r from-primary/90 to-primary">
        <img
          src={familyImage}
          alt="Happy family in new home"
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
        <div className="relative mx-auto flex h-full max-w-7xl flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Find Your Dream Home
          </h1>
          <p className="mt-4 text-lg text-white/80">
            Browse properties and see instant loan options for each listing
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="mb-2 block text-sm font-medium">Search Location</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="City, address, or ZIP code"
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-property-search"
                  />
                </div>
              </div>

              <div className="w-full lg:w-48">
                <label className="mb-2 block text-sm font-medium">Property Type</label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger data-testid="select-property-type">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full lg:w-64">
                <label className="mb-2 block text-sm font-medium">
                  Price Range: {formatCurrency(priceRange[0])} - {formatCurrency(priceRange[1])}
                </label>
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  min={0}
                  max={2000000}
                  step={50000}
                  className="py-2"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-6 flex items-center justify-between">
          <p className="text-muted-foreground">
            {filteredProperties.length} properties found
          </p>
        </div>

        {isLoading ? (
          <div className={`grid gap-6 ${viewMode === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="py-16 text-center">
            <Home className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No properties found</h3>
            <p className="mt-2 text-muted-foreground">
              Try adjusting your filters or search query
            </p>
          </div>
        ) : (
          <div className={`grid gap-6 ${viewMode === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}>
            {filteredProperties.map((property) => (
              <PropertyCard key={property.id} property={property} viewMode={viewMode} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

function PropertyCard({ property, viewMode }: { property: Property; viewMode: "grid" | "list" }) {
  const mainImage = property.images?.[0] || "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800";

  if (viewMode === "list") {
    return (
      <Card className="overflow-hidden hover-elevate" data-testid={`card-property-${property.id}`}>
        <div className="flex flex-col sm:flex-row">
          <div className="relative h-48 w-full sm:h-auto sm:w-64">
            <img
              src={mainImage}
              alt={property.address}
              className="h-full w-full object-cover"
            />
            <Badge className="absolute left-3 top-3 capitalize">
              {property.status}
            </Badge>
          </div>
          <CardContent className="flex flex-1 flex-col justify-between p-6">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(property.price)}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{property.address}, {property.city}, {property.state}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <Heart className="h-5 w-5" />
                </Button>
              </div>

              <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Bed className="h-4 w-4" />
                  <span>{property.bedrooms} beds</span>
                </div>
                <div className="flex items-center gap-1">
                  <Bath className="h-4 w-4" />
                  <span>{property.bathrooms} baths</span>
                </div>
                <div className="flex items-center gap-1">
                  <Square className="h-4 w-4" />
                  <span>{property.squareFeet?.toLocaleString()} sqft</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Link href={`/properties/${property.id}`} className="flex-1" data-testid={`link-detail-${property.id}`}>
                <Button variant="outline" className="w-full gap-2">
                  <Home className="h-4 w-4" />
                  View Details
                </Button>
              </Link>
              <Link href={`/apply?propertyId=${property.id}`} className="flex-1">
                <Button className="w-full gap-2">
                  <DollarSign className="h-4 w-4" />
                  See Loan Options
                </Button>
              </Link>
            </div>
          </CardContent>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden hover-elevate" data-testid={`card-property-${property.id}`}>
      <div className="relative aspect-[16/10]">
        <img
          src={mainImage}
          alt={property.address}
          className="h-full w-full object-cover"
        />
        <Badge className="absolute left-3 top-3 capitalize">
          {property.status}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 bg-white/80 hover:bg-white"
        >
          <Heart className="h-5 w-5" />
        </Button>
      </div>
      <CardContent className="p-4">
        <p className="text-2xl font-bold text-primary">
          {formatCurrency(property.price)}
        </p>
        <div className="mt-1 flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="text-sm truncate">
            {property.address}, {property.city}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Bed className="h-4 w-4" />
            <span>{property.bedrooms}</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="h-4 w-4" />
            <span>{property.bathrooms}</span>
          </div>
          <div className="flex items-center gap-1">
            <Square className="h-4 w-4" />
            <span>{property.squareFeet?.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Link href={`/properties/${property.id}`} className="flex-1" data-testid={`link-detail-grid-${property.id}`}>
            <Button variant="outline" className="w-full gap-2">
              <Home className="h-4 w-4" />
              Details
            </Button>
          </Link>
          <Link href={`/apply?propertyId=${property.id}`} className="flex-1">
            <Button className="w-full gap-2">
              <DollarSign className="h-4 w-4" />
              Loan Options
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
