import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Key, 
  Shield, 
  Users, 
  MapPin, 
  Smartphone, 
  BarChart3, 
  CheckCircle, 
  ArrowRight,
  Building2,
  Clock,
  Search
} from "lucide-react";
import keylocateLogo from "@assets/ChatGPT Image Oct 30, 2025, 10_58_13 AM_1761821897470.png";

const Landing = () => {
  const [activeTab, setActiveTab] = useState("overview");

  const handleGetStarted = () => {
    // Go directly to company setup for new users
    window.location.href = "/signup";
  };

  const handleLogin = () => {
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src={keylocateLogo} alt="keylocate" className="h-24 sm:h-32 w-auto" />
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={handleLogin}>
              Sign In
            </Button>
            <Button onClick={handleGetStarted}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <Badge variant="secondary" className="mb-4">
            Professional Key Management
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Professional Key Management
            <span className="text-blue-600 block">For Every Business</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Complete visibility and control over your physical key inventory. Perfect for estate agents, car dealers, housing associations, managing agents, mechanics, and any business managing keys on behalf of clients.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8" onClick={handleGetStarted}>
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Watch Demo
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            No credit card required • 14-day free trial • Setup in 5 minutes
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need for Key Management
            </h2>
            <p className="text-lg text-gray-600">
              Comprehensive tools for tracking, auditing, and securing your key inventory
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Key className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Real-Time Tracking</CardTitle>
                <CardDescription>
                  Monitor key location, status, and movement history in real-time across all your business locations
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Smart Auditing</CardTitle>
                <CardDescription>
                  Automated audit workflows with NFC scanning and comprehensive reporting for accountability
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>Multi-User Access</CardTitle>
                <CardDescription>
                  Role-based permissions with location-specific access controls for your entire team
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <MapPin className="h-6 w-6 text-orange-600" />
                </div>
                <CardTitle>Multi-Location Support</CardTitle>
                <CardDescription>
                  Manage keys across offices, vehicles, and remote locations from a single dashboard
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <Smartphone className="h-6 w-6 text-indigo-600" />
                </div>
                <CardTitle>Mobile Optimized</CardTitle>
                <CardDescription>
                  Native mobile experience with offline capabilities for on-site work and client visits
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-red-600" />
                </div>
                <CardTitle>Advanced Analytics</CardTitle>
                <CardDescription>
                  Detailed insights into key usage patterns, accountability metrics, and business efficiency
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Perfect for Every Industry
            </h2>
            <p className="text-lg text-gray-600">
              From estate agents to car dealers, housing associations to mechanics - keylocate scales with your business
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle>Property Professionals</CardTitle>
                <CardDescription>
                  Estate agents, letting agents, and property managers tracking client property keys with full audit trails
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Key className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle>Automotive & Services</CardTitle>
                <CardDescription>
                  Car dealers, mechanics, and service centers managing customer vehicle keys and workshop access
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
                <CardTitle>Housing & Facilities</CardTitle>
                <CardDescription>
                  Housing associations, managing agents, and facility management companies with multiple locations
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600">
              Choose the plan that fits your business size and needs
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-xl">Basic</CardTitle>
                <div className="text-3xl font-bold">£29<span className="text-lg font-normal text-gray-600">/month</span></div>
                <CardDescription>Perfect for small teams</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />Up to 100 keys</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />5 locations</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />10 users</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />Basic reporting</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />Email support</li>
                </ul>
                <Button className="w-full mt-6" variant="outline" onClick={handleGetStarted}>
                  Start Free Trial
                </Button>
              </CardContent>
            </Card>

            <Card className="relative border-blue-500 border-2">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-blue-500 text-white">Most Popular</Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-xl">Professional</CardTitle>
                <div className="text-3xl font-bold">£89<span className="text-lg font-normal text-gray-600">/month</span></div>
                <CardDescription>For growing organizations</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />Up to 500 keys</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />15 locations</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />25 users</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />Advanced analytics</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />NFC scanning</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />Priority support</li>
                </ul>
                <Button className="w-full mt-6" onClick={handleGetStarted}>
                  Start Free Trial
                </Button>
              </CardContent>
            </Card>

            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-xl">Enterprise</CardTitle>
                <div className="text-3xl font-bold">Custom</div>
                <CardDescription>For large organizations</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />Unlimited keys</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />Unlimited locations</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />Unlimited users</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />Custom integrations</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />Dedicated support</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-3" />SLA guarantee</li>
                </ul>
                <Button className="w-full mt-6" variant="outline">
                  Contact Sales
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-blue-600 text-white">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Secure Your Keys?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join hundreds of businesses across all industries that trust keylocate for professional key management
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="text-lg px-8" onClick={handleGetStarted}>
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 border-blue-200 text-blue-100 bg-blue-700/30 hover:bg-white hover:text-blue-600 hover:border-blue-600">
              Schedule Demo
            </Button>
          </div>
          <p className="text-sm text-blue-200 mt-4">
            14-day free trial • No setup fees • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src={keylocateLogo} alt="keylocate" className="h-20 sm:h-24 w-auto" />
              </div>
              <p className="text-gray-400 text-sm">
                Professional key management and security tracking for modern organizations.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
                <li><a href="#" className="hover:text-white">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
                <li><a href="#" className="hover:text-white">Support</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2025 keylocate. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;