import { Link } from "wouter";
import { ShieldCheck, Clock, MapPin, Phone, Bell, Users, ArrowRight, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Clock,
    title: "Check-in / Check-out",
    description: "Workers check in at the start of a shift and check out when finished. Missed check-outs trigger automatic alerts.",
  },
  {
    icon: MapPin,
    title: "Location Tracking",
    description: "Optional GPS check-in captures location at the time of each check-in so managers know where staff are working.",
  },
  {
    icon: Phone,
    title: "Welfare Calls",
    description: "Scheduled welfare check prompts sent directly to workers. Non-response automatically escalates to a supervisor.",
  },
  {
    icon: Bell,
    title: "Escalation Alerts",
    description: "Configurable escalation chains ensure the right people are notified when a worker doesn't respond.",
  },
  {
    icon: Users,
    title: "Team Overview",
    description: "Supervisors see a live dashboard of all lone workers — who's checked in, overdue, or hasn't responded.",
  },
  {
    icon: ShieldCheck,
    title: "Audit Trail",
    description: "Full history of all check-ins, welfare calls, and escalations, linked to your keylocate data for a complete picture.",
  },
];

export default function LoneWorking() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3 pt-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900">Lone Working</h1>
          <Badge className="bg-green-100 text-green-700 border-green-200">
            Coming Soon
          </Badge>
        </div>
        <p className="text-gray-500 max-w-xl mx-auto">
          Keep your lone workers safe with automated check-ins, welfare calls, and escalation
          alerts — fully integrated with your keylocate data.
        </p>
      </div>

      {/* Features grid */}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {features.map((feature) => (
          <Card key={feature.title} className="border border-gray-100">
            <CardHeader className="pb-2">
              <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center mb-2">
                <feature.icon className="h-5 w-5 text-green-600" />
              </div>
              <CardTitle className="text-base">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-500">
              {feature.description}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Integration callout */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-green-900">Fully integrated with keylocate</h3>
              <p className="text-sm text-green-700 mt-1">
                Lone working records will link directly to key issue/return events — so you can see
                which keys a worker had when they checked in, and whether they were returned before
                going missing.
              </p>
            </div>
            <div className="flex gap-2 items-center text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Shared data layer</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="text-center py-4 space-y-3">
        <p className="text-gray-500 text-sm">
          This module is in development. It will appear here automatically once your subscription
          includes it.
        </p>
        <p className="text-xs text-gray-400">
          Interested in early access? Contact us to be added to the waitlist.
        </p>
      </div>
    </div>
  );
}
