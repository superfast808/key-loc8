import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Building2, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import keylocateLogo from "@assets/ChatGPT Image Oct 30, 2025, 10_58_13 AM_1761821897470.png";

const CompanySetup = () => {
  const [step, setStep] = useState(1);
  const [companyData, setCompanyData] = useState({
    name: "",
    slug: "",
    planType: "basic",
    description: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-generate slug from company name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (name: string) => {
    setCompanyData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };

  const createCompanyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/companies/setup", {
        name: companyData.name,
        slug: companyData.slug,
        planType: companyData.planType,
        email: companyData.email,
        firstName: companyData.firstName,
        lastName: companyData.lastName,
        password: companyData.password,
        settings: {
          description: companyData.description,
        }
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Company Created Successfully",
        description: `Welcome to keylocate! Your company "${companyData.name}" has been set up.`,
      });
      
      // Refresh user data to get the new company association
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies/current"] });
      
      // Show success state and redirect to dashboard
      setStep(3); // Move to success step
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    },
    onError: (error: any) => {
      console.error("Company creation error:", error);
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to create company. Please try again.",
        variant: "destructive",
      });
      setIsCreating(false);
    },
  });

  const handleNext = () => {
    if (step === 1) {
      // Validate required fields
      if (!companyData.firstName.trim() || !companyData.email.trim() || !companyData.password.trim() || !companyData.name.trim()) {
        toast({
          title: "Required Fields Missing",
          description: "Please fill in all required fields to continue.",
          variant: "destructive",
        });
        return;
      }
      
      if (companyData.password !== companyData.confirmPassword) {
        toast({
          title: "Password Mismatch",
          description: "Passwords do not match. Please check and try again.",
          variant: "destructive",
        });
        return;
      }
      
      if (companyData.password.length < 6) {
        toast({
          title: "Password Too Short",
          description: "Password must be at least 6 characters long.",
          variant: "destructive",
        });
        return;
      }
      
      setStep(2);
    }
  };

  const handleSubmit = () => {
    setIsCreating(true);
    createCompanyMutation.mutate();
  };

  if (isCreating || createCompanyMutation.isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {createCompanyMutation.isPending ? "Setting Up..." : "Welcome to keylocate!"}
            </h2>
            <p className="text-gray-600 mb-4">
              {createCompanyMutation.isPending 
                ? "Creating your company and setting up your key management system..."
                : "Your company has been created successfully. Redirecting to dashboard..."
              }
            </p>
            {createCompanyMutation.isPending && (
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-between items-start mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="p-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex justify-center flex-1">
              <img src={keylocateLogo} alt="keylocate" className="h-36 sm:h-48 w-auto" />
            </div>
            <div className="w-10"></div> {/* Spacer for balance */}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to keylocate</h1>
          <p className="text-gray-600">Set up your company's key management system</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              1
            </div>
            <div className={`w-16 h-1 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              2
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 ? "Account & Company Setup" : step === 2 ? "Plan Selection" : "Setup Complete"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 1 && (
              <>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Your Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={companyData.firstName}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="Enter your first name"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={companyData.lastName}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Enter your last name"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={companyData.email}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter your email address"
                      className="mt-2"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={companyData.password}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Create a password"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirmPassword">Confirm Password *</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={companyData.confirmPassword}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirm your password"
                        className="mt-2"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Company Information</h3>
                  
                  <div>
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      value={companyData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Enter your company name"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="companySlug">Company URL Identifier</Label>
                    <div className="mt-2 flex items-center">
                      <span className="text-sm text-gray-500 mr-2">keylocate.app/</span>
                      <Input
                        id="companySlug"
                        value={companyData.slug}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, slug: e.target.value }))}
                        placeholder="company-name"
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      This will be your unique company identifier in the URL
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Company Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={companyData.description}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of your company..."
                    className="mt-2"
                    rows={3}
                  />
                </div>

                <Button onClick={handleNext} className="w-full" size="lg">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <Label htmlFor="planType">Select Your Plan</Label>
                  <Select value={companyData.planType} onValueChange={(value) => setCompanyData(prev => ({ ...prev, planType: value }))}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">
                        <div className="py-2">
                          <div className="font-medium">Basic Plan</div>
                          <div className="text-sm text-gray-500">Up to 100 keys, 5 locations, 10 users</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="professional">
                        <div className="py-2">
                          <div className="font-medium">Professional Plan</div>
                          <div className="text-sm text-gray-500">Up to 500 keys, 15 locations, 25 users</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="enterprise">
                        <div className="py-2">
                          <div className="font-medium">Enterprise Plan</div>
                          <div className="text-sm text-gray-500">Unlimited keys, locations, and users</div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Plan Summary */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Setup Summary</h3>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div><strong>Company:</strong> {companyData.name}</div>
                    <div><strong>URL:</strong> keylocate.app/{companyData.slug}</div>
                    <div><strong>Plan:</strong> {companyData.planType.charAt(0).toUpperCase() + companyData.planType.slice(1)}</div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    Back
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={createCompanyMutation.isPending}
                    className="flex-1"
                    size="lg"
                  >
                    {createCompanyMutation.isPending ? "Creating..." : "Create Company"}
                  </Button>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Company Created Successfully!
                </h3>
                <p className="text-gray-600 mb-6">
                  Welcome to keylocate! Your company "{companyData.name}" has been set up and you've been logged in as an administrator.
                </p>
                <div className="bg-blue-50 p-4 rounded-lg text-left max-w-md mx-auto">
                  <h4 className="font-medium text-blue-900 mb-2">What's Next?</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Your dashboard will load automatically</li>
                    <li>• Start by adding your key bunches</li>
                    <li>• Configure additional locations as needed</li>
                    <li>• Invite team members to join your company</li>
                  </ul>
                </div>
                <div className="mt-6">
                  <p className="text-sm text-gray-500">
                    Redirecting to your dashboard in a few seconds...
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Demo Notice */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            The demo company data will remain available for reference and testing
          </p>
        </div>
      </div>
    </div>
  );
};

export default CompanySetup;