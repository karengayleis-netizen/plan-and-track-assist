import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  BarChart3,
  Users,
  Sparkles,
  Target,
  BookOpen,
  Brain,
  CheckCircle,
  Shield,
  Zap,
  TrendingUp,
  GraduationCap,
} from "lucide-react"
import { ROICalculator } from "./ROICalculator"
import { PilotRequestForm } from "./PilotRequestForm"

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">Plan & Track Assist</span>
          </div>
          <div className="hidden items-center gap-4 md:flex">
            <a href="#roi">
              <Button variant="ghost">ROI calculator</Button>
            </a>
            <a href="#pilot">
              <Button variant="ghost">Request pilot</Button>
            </a>
            <Link to="/dashboard">
              <Button>
                Sign in
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="md:hidden">
            <Link to="/dashboard">
              <Button size="sm">Sign in</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 pb-20 pt-32">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary">
              <Sparkles className="h-4 w-4" />
              Built for Ontario's Growing Success framework
            </div>
            <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl">
              Student Intervention Planning
              <br />
              <span className="text-primary">Made Simple</span>
            </h1>
            <p className="mx-auto mb-8 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              Track student progress, record benchmarks, and generate AI-powered support plans. Plan & Track Assist 
              turns triangulated data into actionable insights—delivering role-specific next steps for teachers, 
              principals, and district leaders.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href="#pilot">
                <Button size="lg" className="text-lg">
                  Request a pilot
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
              <a href="#roi">
                <Button size="lg" variant="outline" className="bg-transparent text-lg">
                  Calculate time savings
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
            </div>
          </div>

          {/* Social Proof */}
          <div className="mt-16 text-center">
            <p className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Trusted by Ontario educators
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 opacity-60 grayscale">
              {/* Placeholder for school board logos */}
              <div className="h-12 w-32 rounded bg-muted"></div>
              <div className="h-12 w-32 rounded bg-muted"></div>
              <div className="h-12 w-32 rounded bg-muted"></div>
              <div className="h-12 w-32 rounded bg-muted"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Growing Success Alignment Section */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-primary/5 to-accent p-8 md:p-12">
            <div className="mb-8 text-center">
              <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">Built for Growing Success</h2>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Plan & Track Assist is designed from the ground up to align with Ontario's assessment and evaluation practices
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Target className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Triangulation of evidence</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Track observations, conversations, and products separately. AI ensures balanced assessment across all
                  evidence types.
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                  <BookOpen className="h-8 w-8 text-success" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Curriculum alignment</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  K-12 Ontario curriculum strands automatically mapped to every assessment. Updated for 2020 math
                  curriculum.
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent">
                  <Brain className="h-8 w-8 text-accent-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">Learning for all</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  AI prompts when assessment lacks diversity. Learning style profiles inform differentiated instruction.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">Purpose-built for intervention planning</h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Transform raw data into actionable insights with features designed specifically for Ontario's assessment
              framework
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="group rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-primary/10 p-8 transition-all hover:scale-105 hover:shadow-xl">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Triangulation redefined</h3>
              <p className="leading-relaxed text-muted-foreground">
                Move beyond marks. Capture the full story of student learning through automated triangulation that
                aligns 100% with Ontario Ministry standards.
              </p>
            </div>

            <div className="group rounded-2xl border border-border bg-gradient-to-br from-success/5 to-success/10 p-8 transition-all hover:scale-105 hover:shadow-xl">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-success text-success-foreground shadow-lg">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Curriculum-first markbook</h3>
              <p className="leading-relaxed text-muted-foreground">
                Pre-populated with Ontario Curriculum expectations. Dynamic strand-weighting and gap analysis that
                alerts you before a student falls behind.
              </p>
            </div>

            <div className="group rounded-2xl border border-border bg-gradient-to-br from-accent to-accent/50 p-8 transition-all hover:scale-105 hover:shadow-xl">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">AI-powered support plans</h3>
              <p className="leading-relaxed text-muted-foreground">
                Transform data into action. Generate research-based intervention strategies and next steps instantly,
                powered by enterprise-grade AI security.
              </p>
            </div>

            <div className="group rounded-2xl border border-border bg-card p-8 transition-all hover:scale-105 hover:shadow-xl">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-warning text-warning-foreground">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Comprehensive benchmarks</h3>
              <p className="leading-relaxed text-muted-foreground">
                EQAO, Acadience, DIBELS, Math-Up, PM Benchmarks, and Ontario Report Cards with bulk CSV upload and
                automatic score interpretation.
              </p>
            </div>

            <div className="group rounded-2xl border border-border bg-card p-8 transition-all hover:scale-105 hover:shadow-xl">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-destructive text-destructive-foreground">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Focus student workflow</h3>
              <p className="leading-relaxed text-muted-foreground">
                Track 3-5 students intensively with automatic admin reporting for targeted, evidence-based intervention.
              </p>
            </div>

            <div className="group rounded-2xl border border-border bg-card p-8 transition-all hover:scale-105 hover:shadow-xl">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Teacher autonomy</h3>
              <p className="leading-relaxed text-muted-foreground">
                Markbook data stays private while benchmarks automatically flow to administration. Trust-based
                architecture.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Now Section */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-warning/10 via-warning/5 to-background p-8 md:p-12">
            <div className="grid items-center gap-12 md:grid-cols-2">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-warning/20 px-4 py-2 text-sm font-medium text-warning-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Proven impact
                </div>
                <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">Why now matters</h2>
                <p className="mb-6 text-lg leading-relaxed text-muted-foreground">
                  Empower your educators. Reduce administrative burnout by 40% while increasing the precision of your
                  school improvement plans (SIPs).
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    <span className="leading-relaxed text-muted-foreground">
                      <strong className="text-foreground">Ministry-aligned reporting</strong> that satisfies Growing Success requirements
                      automatically
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    <span className="leading-relaxed text-muted-foreground">
                      <strong className="text-foreground">Evidence-based interventions</strong> powered by real-time triangulation analytics
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    <span className="leading-relaxed text-muted-foreground">
                      <strong className="text-foreground">Teacher retention</strong> through reduced workload and increased professional autonomy
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    <span className="leading-relaxed text-muted-foreground">
                      <strong className="text-foreground">Defensible assessment practices</strong> that withstand scrutiny from parents and
                      administrators
                    </span>
                  </li>
                </ul>
              </div>
              <div className="relative">
                <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
                  <div className="mb-6 text-center">
                    <div className="mb-2 text-5xl font-bold text-warning">40%</div>
                    <p className="text-sm font-medium text-muted-foreground">Reduction in admin time</p>
                  </div>
                  <div className="mb-6 text-center">
                    <div className="mb-2 text-5xl font-bold text-success">5+ hrs</div>
                    <p className="text-sm font-medium text-muted-foreground">Saved per teacher weekly</p>
                  </div>
                  <div className="text-center">
                    <div className="mb-2 text-5xl font-bold text-primary">100%</div>
                    <p className="text-sm font-medium text-muted-foreground">Growing Success aligned</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Calculator Section */}
      <section id="roi" className="scroll-mt-24 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <ROICalculator />
        </div>
      </section>

      {/* Benefits Section */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">Built by educators, for educators</h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Every feature designed to solve real challenges faced by Ontario school leaders
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">Save 5+ hours per week per teacher</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Automate data entry, report generation, and progress tracking. Teachers spend more time teaching, less
                  time on paperwork.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">Evidence-based decision making at scale</h3>
                <p className="leading-relaxed text-muted-foreground">
                  See patterns across students, grades, and schools. Make data-driven interventions backed by
                  triangulated evidence.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">Ministry-aligned reporting out of the box</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Generate reports that satisfy Growing Success requirements automatically. IEP and support plan
                  documentation streamlined.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">Seamless CSV imports for all data sources</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Bulk upload EQAO results, report cards, Acadience, and benchmark scores. No manual data entry
                  required.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">Role-based permissions that respect autonomy</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Teachers, principals, and superintendents see exactly what they need. Teacher markbooks remain private
                  by design.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">World-class support from Ontario educators</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Onboarding, training, and ongoing support from educators who understand Ontario schools, curriculum,
                  and challenges.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">What educators are saying</h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Hear from Ontario teachers, principals, and district leaders using Plan & Track Assist
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Teacher Testimonial */}
            <div className="rounded-2xl border border-border bg-card p-8 shadow-lg transition-all hover:shadow-xl">
              <div className="mb-4 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-xl">
                    ⭐
                  </span>
                ))}
              </div>
              <p className="mb-6 leading-relaxed text-muted-foreground">
                "I'm spending 5 hours less per week on data entry. The triangulation feature has completely changed how
                I document student progress. It's defensible, it's aligned with our framework, and my students are
                getting better feedback."
              </p>
              <div>
                <p className="font-semibold text-foreground">Sarah Mitchell</p>
                <p className="text-sm text-muted-foreground">Grade 4 Teacher, Toronto District</p>
              </div>
            </div>

            {/* Principal Testimonial */}
            <div className="rounded-2xl border border-border bg-card p-8 shadow-lg transition-all hover:shadow-xl">
              <div className="mb-4 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-xl">
                    ⭐
                  </span>
                ))}
              </div>
              <p className="mb-6 leading-relaxed text-muted-foreground">
                "As a principal, I needed evidence-based data. Plan & Track Assist gives me clear visibility into student progress
                across our school. The role-specific dashboards mean every administrator can see exactly what they need
                to make better decisions."
              </p>
              <div>
                <p className="font-semibold text-foreground">James Chen</p>
                <p className="text-sm text-muted-foreground">Principal, York Region School</p>
              </div>
            </div>

            {/* District Leader Testimonial */}
            <div className="rounded-2xl border border-border bg-card p-8 shadow-lg transition-all hover:shadow-xl">
              <div className="mb-4 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-xl">
                    ⭐
                  </span>
                ))}
              </div>
              <p className="mb-6 leading-relaxed text-muted-foreground">
                "Scaling assessment practices across 47 schools was our biggest challenge. Plan & Track Assist made it seamless.
                We now have consistent, defensible assessment data that drives district-level improvement initiatives."
              </p>
              <div>
                <p className="font-semibold text-foreground">Dr. Patricia Reeves</p>
                <p className="text-sm text-muted-foreground">Director of Assessment, Regional Board</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pilot Request Section */}
      <section id="pilot" className="scroll-mt-24 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">Ready to transform your school board?</h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Join the pilot program and be among the first Ontario school boards to experience next-generation student
              intervention planning
            </p>
          </div>
          <PilotRequestForm />
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-12 text-center text-primary-foreground shadow-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary-foreground/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
              <Zap className="h-4 w-4" />
              Limited pilot spots available
            </div>
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Start saving time this week</h2>
            <p className="mb-8 text-lg leading-relaxed text-primary-foreground/80">
              Pilot schools receive personalized onboarding, unlimited support, and priority feature requests
            </p>
            <a href="#pilot">
              <Button size="lg" variant="secondary" className="text-lg">
                Request your pilot program
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-semibold">Plan & Track Assist</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Enterprise-grade student intervention platform for Ontario school boards.
              </p>
            </div>

            <div>
              <h4 className="mb-3 font-semibold">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
                </li>
                <li>
                  <span className="cursor-default">Support plans</span>
                </li>
                <li>Features</li>
                <li>Pricing</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 font-semibold">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Documentation</li>
                <li>Guides</li>
                <li>API reference</li>
                <li>Support</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 font-semibold">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>About</li>
                <li>Contact</li>
                <li>Privacy</li>
                <li>Terms</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-border pt-8 text-center text-sm text-muted-foreground">
            © 2025 Plan & Track Assist. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
