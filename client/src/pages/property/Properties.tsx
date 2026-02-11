import { useState, useEffect, useRef, useCallback } from "react";
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
  Sparkles,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import familyImage from "@assets/stock_images/happy_family_new_hom_d488bf67.jpg";

const PROPERTY_TYPES = [
  { value: "all", label: "All Types" },
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
];

interface AutoCompleteSuggestion {
  id: string;
  type: string;
  label: string;
  city: string | null;
  stateCode: string | null;
  slug: string | null;
}

type SearchMode = "buy" | "sold";

interface LiveProperty {
  property_id: string;
  status: string;
  price: number;
  soldPrice?: number | null;
  soldDate?: string | null;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  zipcode: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  propertyType: string;
  photo: string | null;
  photos: string[];
  listDate: string | null;
  priceReduced: number | null;
  isNewConstruction: boolean;
  isForeclosure: boolean;
  isPending: boolean;
  href: string | null;
}

interface LiveSearchResponse {
  properties: LiveProperty[];
  total: number;
  source: string;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function Properties() {
  const [searchQuery, setSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("buy");
  const [propertyType, setPropertyType] = useState("all");
  const [priceRange, setPriceRange] = useState([0, 2000000]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { localStorage.setItem("baranest_browsed_properties", "true"); } catch {}
  }, []);

  const debouncedInput = useDebounce(inputValue, 300);

  const autoCompleteUrl = debouncedInput.length >= 2
    ? `/api/properties/auto-complete?input=${encodeURIComponent(debouncedInput)}`
    : null;

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery<AutoCompleteSuggestion[]>({
    queryKey: [autoCompleteUrl],
    enabled: !!autoCompleteUrl,
  });

  const buildLiveSearchUrl = () => {
    if (!selectedLocation) return null;
    const params = new URLSearchParams();
    params.set("location", selectedLocation);
    if (propertyType && propertyType !== "all") params.set("type", propertyType);
    if (priceRange[0] > 0) params.set("minPrice", priceRange[0].toString());
    if (priceRange[1] < 2000000) params.set("maxPrice", priceRange[1].toString());
    const endpoint = searchMode === "sold" ? "/api/properties/search-sold" : "/api/properties/search-live";
    return `${endpoint}?${params.toString()}`;
  };

  const liveSearchUrl = buildLiveSearchUrl();

  const { data: liveResults, isLoading: liveLoading } = useQuery<LiveSearchResponse>({
    queryKey: [liveSearchUrl],
    enabled: !!liveSearchUrl,
  });

  useEffect(() => {
    if (suggestions && suggestions.length > 0 && debouncedInput.length >= 2) {
      setShowSuggestions(true);
    }
  }, [suggestions, debouncedInput]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = useCallback((suggestion: AutoCompleteSuggestion) => {
    setInputValue(suggestion.label);
    setSearchQuery(suggestion.label);
    setSelectedLocation(suggestion.id);
    setSelectedLocationLabel(suggestion.label);
    setShowSuggestions(false);
  }, []);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    if (!value) {
      setSearchQuery("");
      setSelectedLocation(null);
      setSelectedLocationLabel("");
      setShowSuggestions(false);
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setSearchQuery(inputValue);
      setShowSuggestions(false);
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }, [inputValue]);

  const handleClearSearch = useCallback(() => {
    setInputValue("");
    setSearchQuery("");
    setSelectedLocation(null);
    setSelectedLocationLabel("");
  }, []);

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
    enabled: !selectedLocation,
  });

  const filteredProperties = properties?.filter((property) => {
    const matchesType = propertyType === "all" || property.propertyType === propertyType;
    const matchesPrice = 
      parseFloat(property.price) >= priceRange[0] && 
      parseFloat(property.price) <= priceRange[1];
    const matchesSearch = 
      !searchQuery || 
      property.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.state?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesPrice && matchesSearch;
  }) || [];

  const isLiveMode = !!selectedLocation;
  const liveProperties = liveResults?.properties || [];
  const liveTotal = liveResults?.total || 0;
  const currentLoading = isLiveMode ? liveLoading : isLoading;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Browse Properties - Find Your Dream Home" description="Search homes for sale with live MLS listings. Get instant mortgage estimates and pre-approval for properties across the US." />
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
              <div className="relative flex-1">
                <label className="mb-2 block text-sm font-medium">Search Location</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    placeholder="City, address, or ZIP code"
                    className="pl-10"
                    value={inputValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      if (suggestions && suggestions.length > 0 && inputValue.length >= 2) {
                        setShowSuggestions(true);
                      }
                    }}
                    data-testid="input-property-search"
                  />
                </div>
                {showSuggestions && inputValue.length >= 2 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md"
                    data-testid="autocomplete-dropdown"
                  >
                    {suggestionsLoading ? (
                      <div className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
                        <Search className="h-4 w-4 animate-pulse" />
                        <span>Searching locations...</span>
                      </div>
                    ) : suggestions && suggestions.length > 0 ? (
                      suggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover-elevate"
                          onClick={() => handleSelectSuggestion(suggestion)}
                          data-testid={`autocomplete-item-${suggestion.id}`}
                        >
                          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{suggestion.label}</p>
                            <p className="text-xs capitalize text-muted-foreground">{suggestion.type.replace("_", " ")}</p>
                          </div>
                          {suggestion.stateCode && (
                            <Badge variant="secondary" className="shrink-0">{suggestion.stateCode}</Badge>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-muted-foreground">
                        No locations found
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="w-full lg:w-auto">
                <label className="mb-2 block text-sm font-medium">Search Mode</label>
                <div className="flex gap-1 rounded-md border p-1">
                  <Button
                    variant={searchMode === "buy" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSearchMode("buy")}
                    className="toggle-elevate"
                    data-testid="button-mode-buy"
                  >
                    For Sale
                  </Button>
                  <Button
                    variant={searchMode === "sold" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSearchMode("sold")}
                    className="toggle-elevate"
                    data-testid="button-mode-sold"
                  >
                    Recently Sold
                  </Button>
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

        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground" data-testid="text-results-count">
              {isLiveMode
                ? `${liveProperties.length} of ${liveTotal.toLocaleString()} listings`
                : `${filteredProperties.length} properties found`
              }
            </p>
            {isLiveMode && (
              <Badge variant="secondary" data-testid="badge-live-results">
                {searchMode === "sold" ? "Recently Sold" : "Live MLS Data"}
              </Badge>
            )}
          </div>
          {isLiveMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearSearch}
              data-testid="button-clear-search"
            >
              Clear Search
            </Button>
          )}
        </div>

        {currentLoading ? (
          <div className={`grid gap-6 ${viewMode === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        ) : isLiveMode ? (
          liveProperties.length === 0 ? (
            <div className="py-16 text-center">
              <Home className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No listings found in {selectedLocationLabel}</h3>
              <p className="mt-2 text-muted-foreground">
                Try adjusting your filters or searching a different location
              </p>
            </div>
          ) : (
            <div className={`grid gap-6 ${viewMode === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}>
              {liveProperties.map((property) => (
                <LivePropertyCard key={property.property_id} property={property} viewMode={viewMode} />
              ))}
            </div>
          )
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
          className="absolute right-3 top-3 bg-white/80"
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

function LivePropertyCard({ property, viewMode }: { property: LiveProperty; viewMode: "grid" | "list" }) {
  const mainImage = property.photo || "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800";
  const isSold = !!property.soldDate || property.status === "sold" || property.status === "recently_sold";
  const statusLabel = isSold ? "Sold" : property.isPending ? "Pending" : property.isNewConstruction ? "New Build" : property.isForeclosure ? "Foreclosure" : "For Sale";
  const displayPrice = isSold && property.soldPrice ? property.soldPrice : property.price;
  const formattedSoldDate = property.soldDate ? new Date(property.soldDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  if (viewMode === "list") {
    return (
      <Card className="overflow-hidden hover-elevate" data-testid={`card-live-property-${property.property_id}`}>
        <div className="flex flex-col sm:flex-row">
          <div className="relative h-48 w-full sm:h-auto sm:w-64">
            <img
              src={mainImage}
              alt={property.address}
              className="h-full w-full object-cover"
            />
            <Badge className="absolute left-3 top-3">
              {statusLabel}
            </Badge>
          </div>
          <CardContent className="flex flex-1 flex-col justify-between p-6">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(displayPrice)}
                  </p>
                  {isSold && formattedSoldDate && (
                    <p className="text-xs text-muted-foreground">Sold {formattedSoldDate}</p>
                  )}
                  <div className="mt-1 flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{property.address}, {property.city}, {property.stateCode} {property.zipcode}</span>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 capitalize">{property.propertyType.replace("_", " ")}</Badge>
              </div>

              <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
                {property.beds !== null && (
                  <div className="flex items-center gap-1">
                    <Bed className="h-4 w-4" />
                    <span>{property.beds} beds</span>
                  </div>
                )}
                {property.baths !== null && (
                  <div className="flex items-center gap-1">
                    <Bath className="h-4 w-4" />
                    <span>{property.baths} baths</span>
                  </div>
                )}
                {property.sqft !== null && (
                  <div className="flex items-center gap-1">
                    <Square className="h-4 w-4" />
                    <span>{property.sqft.toLocaleString()} sqft</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Link href={`/properties/live?propertyId=${property.property_id}`} className="flex-1">
                <Button variant="outline" className="w-full gap-2">
                  <Home className="h-4 w-4" />
                  Details
                </Button>
              </Link>
              <Link href={`/pre-approval?price=${displayPrice}&address=${encodeURIComponent(property.address + ', ' + property.city + ', ' + property.stateCode)}`} className="flex-1">
                <Button className="w-full gap-2">
                  <DollarSign className="h-4 w-4" />
                  {isSold ? "Get Estimate" : "Pre-Approve"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden hover-elevate" data-testid={`card-live-property-${property.property_id}`}>
      <div className="relative aspect-[16/10]">
        <img
          src={mainImage}
          alt={property.address}
          className="h-full w-full object-cover"
        />
        <Badge className="absolute left-3 top-3">
          {statusLabel}
        </Badge>
        {property.isNewConstruction && (
          <Badge variant="secondary" className="absolute right-3 top-3">
            <Sparkles className="mr-1 h-3 w-3" />
            New
          </Badge>
        )}
      </div>
      <CardContent className="p-4">
        <p className="text-2xl font-bold text-primary">
          {formatCurrency(displayPrice)}
        </p>
        {isSold && formattedSoldDate && (
          <p className="text-xs text-muted-foreground">Sold {formattedSoldDate}</p>
        )}
        <div className="mt-1 flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="text-sm truncate">
            {property.address}, {property.city}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          {property.beds !== null && (
            <div className="flex items-center gap-1">
              <Bed className="h-4 w-4" />
              <span>{property.beds}</span>
            </div>
          )}
          {property.baths !== null && (
            <div className="flex items-center gap-1">
              <Bath className="h-4 w-4" />
              <span>{property.baths}</span>
            </div>
          )}
          {property.sqft !== null && (
            <div className="flex items-center gap-1">
              <Square className="h-4 w-4" />
              <span>{property.sqft.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Link href={`/properties/live?propertyId=${property.property_id}`} className="flex-1">
            <Button variant="outline" className="w-full gap-2">
              <Home className="h-4 w-4" />
              Details
            </Button>
          </Link>
          <Link href={`/pre-approval?price=${displayPrice}&address=${encodeURIComponent(property.address + ', ' + property.city + ', ' + property.stateCode)}`} className="flex-1">
            <Button className="w-full gap-2">
              <DollarSign className="h-4 w-4" />
              {isSold ? "Get Estimate" : "Pre-Approve"}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
