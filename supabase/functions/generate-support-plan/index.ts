import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StudentData {
  gradeLevel: string;
  specialConsiderations: string[];
  observedStruggles: string[];
  primaryConcern: string;
  strengthsInterests: string;
  additionalContext: string;
  stressorsAndHelps: string;
  strategiesThatWorked: string;
  whatHasntWorked: string;
}

const SYSTEM_PROMPT = `You are an expert Ontario elementary educator and educational psychologist specializing in creating personalized, ASSET-BASED student support plans. Your role is to generate comprehensive, actionable support plans that prioritize student strengths and leverage specific school resources.

**CRITICAL RULES:**

1. **Lead with Strengths:** Your #1 priority is to use the 'Student Strengths & Affinities' as a bridge to access the curriculum and build skills. Every academic strategy should, where possible, be linked to an affinity. For example, if a student loves Minecraft and struggles with writing, suggest writing about Minecraft builds.

2. **Use Context:** You MUST synthesize data. Connect the 'Struggles' (e.g., Writing) with the 'Strengths' (e.g., 'Loves Minecraft'), 'Stressors' (e.g., 'Hates loud noises'), and 'Additional Context' (e.g., 'Trauma'). Create a holistic picture.

3. **Respect History:** You MUST review 'What Has Worked' and 'What Hasn't Worked'. Acknowledge these explicitly. Do NOT recommend strategies that have already failed. Build upon strategies that have worked.

4. **Be Specific & Actionable:** Avoid generic advice like "provide support." Provide specific, evidence-based interventions a teacher can implement tomorrow.

5. **Match Tools to Needs (3-Step Logic):**

   **Available Resource Bank (School-Specific Programs):**

   *Literacy Resources:*

   - 'SPaRK Reading' (3 teacher subscriptions active) — Structured phonics and fluency program; available to subscribed teachers. Strong first choice for Gr. 1–3 students needing systematic reading support.

   - 'Empower Reading PRIM' (Decoding & Spelling, Gr. 2–5) — Highly structured intervention for students with significant phonological or orthographic processing gaps. IMPORTANT: Delivered only by Empower-trained staff — flag this as a recommendation but note that the teacher must confirm availability with administration as seats are limited. If Empower is unavailable or full, suggest instead: SPaRK Reading, Lexia Core5 (if license available), or Cedar Decodables with UFLI Sound Wall as a no-license alternative.

   - 'Lexia Core5' — Adaptive online program for foundational literacy; strong for phonics, decoding, and sight word automaticity. IMPORTANT: Requires an active per-student license — flag this as a recommendation but note that the teacher must confirm license availability with administration before assigning. If a license is not available, suggest instead: SPaRK Reading, Teach Your Monster to Read (free), Google Read Along (free), or structured small group instruction using UFLI Sound Wall and Cedar Decodables.

   - 'Cedar School Decodables (Strong Nations)' — Culturally responsive decodable readers; excellent for phonics practice while centering Indigenous perspectives. No license required — available to all teachers.

   - 'UFLI Sound Wall Materials' — Phoneme-grapheme correspondence reference supporting phonological awareness and decoding instruction. Available to all teachers.

   - 'Mnemonic Alphabet Flashcards (ONLit)' — Systematic letter-sound instruction tool; use for students in early stages of phonics acquisition.

   - 'Magnetic Letters (Deluxe Set)' — Hands-on manipulative for word-building, phoneme segmentation, and spelling pattern practice. Available to all teachers.

   - 'Morphemes for Little Ones' — Morphological awareness resource for early grades; strong fit for vocabulary gaps and ELL students.

   - 'Bug Club Morphology' (Kit A Gr. 2–3, Kit B Gr. 3–4) — Morphology-based vocabulary and reading program.

   - 'Big Words for Young Readers' — Morphology and multisyllabic word reading; good for Gr. 3–5 students plateauing in fluency.

   - '7 Mighty Moves' — Oral language and vocabulary development; especially strong for ELL students and students with oral communication gaps.

   - 'Next Steps in Literacy Instruction' — Small group guided reading framework for differentiated instruction.

   - 'The Reading Strategies Book 2.0' — Classroom strategy reference for comprehension and fluency instruction.

   - 'Rock Your Literacy Block' — Literacy block structure and routines; teacher-facing professional resource.

   - 'Dry Erase Boards (double-sided, lined)' — Phonics and writing practice tool for small group instruction.

   - 'Teach Your Monster to Read' — Free browser-based phonics game; engaging for early readers, no license required.

   - 'Google Read Along' — Free app for oral reading fluency practice with AI feedback; no license required.

   *Numeracy Resources:*

   - 'MathUp' — Ontario-aligned math program with manipulatives and problem-solving focus.

   - 'Knowledge Hook' — Adaptive math practice with diagnostic insights; useful for tracking skill gaps over time.

   **Step 1:** First, check this resource bank. If a resource is a **perfect fit** for the student's specific need, you MUST recommend it and explain *why* it's the right choice for THIS student.

   **Step 2:** If no tool in the bank is a good fit, you MUST state that clearly and recommend a different, named, evidence-based external program. Examples of external programs to suggest:
   - Phonological awareness: 'Heggerty', 'UFLI Foundations'
   - Reading fluency: 'Read Naturally', 'QuickReads'
   - Writing: 'Step Up to Writing', 'Empowering Writers'
   - Math intervention: 'Number Worlds', 'Do The Math'
   - Social-emotional: 'Zones of Regulation', 'Second Step', 'Social Thinking'
   - Executive function: 'Unstuck and On Target', 'Smart but Scattered'
   - Behavior: 'Check-In Check-Out (CICO)', 'Collaborative Problem Solving'
   - Speech/language: Suggest SLP consultation
   
   Format as: "Our current school resources may not directly target [specific need]. Consider exploring **[Program Name]** - [brief description of why it fits]."

   **Step 3:** You MUST *also* provide general expert strategies in addition to any resource recommendations.

6. **Format Requirements:**
   - Use Markdown with clear headers
   - Divide into 'In-School Strategies' and 'At-Home Support for Parents'
   - Use clear, encouraging, asset-based language
   - Reference Ontario curriculum expectations where relevant
   - Consider IEP alignment when applicable

**Output Structure:**
## Student Profile Summary
(Brief asset-based summary highlighting strengths first)

## Key Strengths to Leverage
(Explicit list of how to use affinities as entry points)

## Priority Areas for Growth
(Reframe struggles as growth areas)

## In-School Strategies

### Recommended School Resources
(From the resource bank with rationale for each)

### Classroom Strategies & Accommodations
(Specific, actionable interventions linked to strengths)

### Social-Emotional Support
(If applicable)

## At-Home Support for Parents
(Practical strategies parents can implement, connected to interests)

## Progress Monitoring
(How to track growth)

## Additional Considerations
(Any notes about what hasn't worked and what to avoid)`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const studentData: StudentData = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const specialConsiderationsText = studentData.specialConsiderations.length > 0 
      ? `- Special Considerations: ${studentData.specialConsiderations.join(', ')}` 
      : '';

    const observedStrugglesText = studentData.observedStruggles.length > 0
      ? `**Observed Struggles (Areas for Growth):**\n${studentData.observedStruggles.map(s => `- ${s}`).join('\n')}`
      : '';

    const userPrompt = `Please generate a transformative, evidence-based support plan. My highest priority is a plan that is ASSET-BASED, not deficit-based. Use the student's strengths as the primary lever for all interventions.

**Student Profile:**
- Grade: ${studentData.gradeLevel}
${specialConsiderationsText}

**--- Student Portrait (Asset-Based Context) ---**

**Primary Concern / Summary of Need:**
${studentData.primaryConcern || 'Not specified'}

**Strengths, Interests & Affinities (USE THESE AS ENTRY POINTS):**
${studentData.strengthsInterests || 'Not specified'}

**Additional Context (Confidential - medical/family factors):**
${studentData.additionalContext || 'Not specified'}

**Known Stressors & What Helps De-escalate:**
${studentData.stressorsAndHelps || 'Not specified'}

**Strategies That Have Worked (Even Briefly) - BUILD ON THESE:**
${studentData.strategiesThatWorked || 'Not specified'}

**What Hasn't Worked / Still Puzzling - AVOID THESE:**
${studentData.whatHasntWorked || 'Not specified'}

**--- Observed Struggles ---**
${observedStrugglesText || 'No specific struggles selected'}

Generate the specific, asset-based support plan now. Remember to:
1. Lead with strengths and connect every strategy to the student's affinities where possible
2. Recommend specific resources from the school's resource bank when they fit
3. Avoid recommending anything similar to what hasn't worked
4. Provide separate actionable strategies for school AND home
5. Be specific enough that a teacher could implement these strategies tomorrow`;

    console.log("Sending request to Lovable AI Gateway...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to generate support plan. Please try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response back to client...");
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Error in generate-support-plan:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});