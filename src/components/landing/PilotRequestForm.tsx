"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Send } from "lucide-react"

export function PilotRequestForm() {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In production, this would send to your backend
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <Card className="border-0 bg-gradient-to-br from-success/10 to-success/5 shadow-xl">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h3 className="mb-2 text-2xl font-bold text-foreground">Request received!</h3>
          <p className="mb-6 max-w-md text-muted-foreground">
            We'll be in touch within 24 hours to schedule your personalized demo and discuss pilot options for your
            school board.
          </p>
          <Button onClick={() => setSubmitted(false)} variant="outline">
            Submit another request
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 bg-card shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Request a pilot program</CardTitle>
        <CardDescription className="text-base">
          Join forward-thinking Ontario school boards already transforming their intervention planning
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name *</Label>
              <Input id="firstName" placeholder="John" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name *</Label>
              <Input id="lastName" placeholder="Smith" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Work email *</Label>
            <Input id="email" type="email" placeholder="john.smith@schoolboard.ca" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input id="phone" type="tel" placeholder="(416) 555-0123" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Your role *</Label>
            <Select required>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="superintendent">Superintendent</SelectItem>
                <SelectItem value="principal">Principal</SelectItem>
                <SelectItem value="vice-principal">Vice Principal</SelectItem>
                <SelectItem value="curriculum-coordinator">Curriculum Coordinator</SelectItem>
                <SelectItem value="technology-director">Technology Director</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schoolBoard">School board *</Label>
            <Input id="schoolBoard" placeholder="Peel District School Board" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schoolName">School name (if applicable)</Label>
            <Input id="schoolName" placeholder="Greenwood Elementary" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="numStudents">Approximate number of students</Label>
            <Select>
              <SelectTrigger id="numStudents">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0-200">Under 200</SelectItem>
                <SelectItem value="200-500">200-500</SelectItem>
                <SelectItem value="500-1000">500-1,000</SelectItem>
                <SelectItem value="1000-2000">1,000-2,000</SelectItem>
                <SelectItem value="2000+">2,000+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">What challenges are you looking to solve? *</Label>
            <Textarea
              id="message"
              placeholder="Tell us about your current student tracking challenges, intervention planning needs, or what drew you to Plan & Track Assist..."
              className="min-h-32 resize-none"
              required
            />
          </div>

          <Button type="submit" size="lg" className="w-full text-base">
            <Send className="mr-2 h-5 w-5" />
            Request pilot program
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            By submitting this form, you agree to be contacted about Plan & Track Assist. We respect your privacy and never share
            your information.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
