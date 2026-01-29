"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Clock, TrendingUp, Sparkles } from "lucide-react"

export function ROICalculator() {
  const [numStudents, setNumStudents] = useState([150])
  const [assessmentsPerWeek, setAssessmentsPerWeek] = useState([10])

  // Calculate time saved
  const timePerAssessmentManual = 3 // minutes to manually record and track
  const timePerAssessmentWithTool = 0.5 // minutes with automated tracking
  const timeSavedPerAssessment = timePerAssessmentManual - timePerAssessmentWithTool
  const totalAssessmentsPerWeek = assessmentsPerWeek[0]
  const weeklyTimeSaved = (totalAssessmentsPerWeek * timeSavedPerAssessment) / 60 // convert to hours
  const yearlyTimeSaved = weeklyTimeSaved * 36 // 36 weeks in school year
  const dollarValue = yearlyTimeSaved * 45 // average teacher hourly rate in Ontario

  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-background to-accent shadow-xl">
      <CardHeader className="pb-4">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          ROI calculator
        </div>
        <CardTitle className="text-2xl">See how much time you'll save</CardTitle>
        <CardDescription className="text-base">Adjust the sliders to see the impact on your school</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Number of Students Slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Number of students</label>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              {numStudents[0]}
            </span>
          </div>
          <Slider
            value={numStudents}
            onValueChange={setNumStudents}
            min={20}
            max={500}
            step={10}
            className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-4 [&_[role=slider]]:border-primary [&_[role=slider]]:bg-background [&_[role=slider]]:shadow-lg"
            aria-label="Number of students"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>20</span>
            <span>500</span>
          </div>
        </div>

        {/* Assessments Per Week Slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Assessments per week</label>
            <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
              {assessmentsPerWeek[0]}
            </span>
          </div>
          <Slider
            value={assessmentsPerWeek}
            onValueChange={setAssessmentsPerWeek}
            min={5}
            max={50}
            step={1}
            className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-4 [&_[role=slider]]:border-primary [&_[role=slider]]:bg-background [&_[role=slider]]:shadow-lg"
            aria-label="Assessments per week"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5</span>
            <span>50</span>
          </div>
        </div>

        {/* Results Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 text-primary-foreground shadow-2xl">
          <div className="absolute inset-0 opacity-10"></div>
          <div className="relative">
            <div className="mb-2 flex items-center gap-2 text-primary-foreground/80">
              <Clock className="h-5 w-5" />
              <span className="text-sm font-medium">Your school could save</span>
            </div>
            <div className="mb-6 text-5xl font-bold">{weeklyTimeSaved.toFixed(1)} hours</div>
            <div className="space-y-3 border-t border-primary-foreground/20 pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-primary-foreground/80">Per week</span>
                <span className="font-semibold">{weeklyTimeSaved.toFixed(1)} hours</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-primary-foreground/80">Per school year</span>
                <span className="font-semibold">{yearlyTimeSaved.toFixed(0)} hours</span>
              </div>
              <div className="flex items-center justify-between border-t border-primary-foreground/20 pt-3">
                <span className="text-primary-foreground/80">Value of time saved</span>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="text-lg font-bold text-success">
                    ${dollarValue.toLocaleString("en-CA", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Based on average time savings reported by Ontario educators
        </p>
      </CardContent>
    </Card>
  )
}
