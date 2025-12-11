import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize AI clients
let groqClient = null;
let openaiClient = null;
let googleAI = null;

if (process.env.GROQ_API_KEY) {
  groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

if (process.env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

if (process.env.GOOGLE_AI_API_KEY) {
  googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
}

export const chatWithGroq = async (prompt, language = 'en-IN', maxTokens = 3000) => {
  if (!groqClient) {
    throw new Error('Groq API key not configured');
  }

  try {
    const completion = await groqClient.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: maxTokens
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Groq API error:', error);
    throw error;
  }
};

export const generateBusinessIdeas = async (name, location, interests, language = 'en-IN', budget = 10000) => {
  const languageInstruction = language === 'hi-IN' ? 'हिंदी में उत्तर दें। Respond in HINDI only.' 
    : language === 'mr-IN' ? 'मराठी मध्ये उत्तर द्या। Respond in MARATHI only.' 
    : 'Respond in ENGLISH only.';

  const prompt = `You are an experienced business consultant analyzing ${location}, India for ${name}.

**CRITICAL REQUIREMENTS:**

1. **MUST MATCH INTEREST: ${interests}**
   - ALL 5 ideas MUST be directly related to: ${interests}
   - DO NOT suggest ideas from other categories
   - If interest is "Farming & Agriculture", suggest ONLY farming/agricultural businesses
   - If interest is "Cooking & Food", suggest ONLY food-related businesses
   - Stay strictly within the chosen category

2. **LOCATION ANALYSIS FOR ${location.toUpperCase()}:**
   - Consider local culture, festivals, and buying power
   - Identify market gaps and opportunities
   - Suggest businesses suitable for the location

3. **REALISTIC BUDGET ANALYSIS (Available: ₹${budget}):**
   - If budget is LESS than ₹15,000: Suggest ONLY home-based, zero-infrastructure businesses
   - If budget is ₹15,000-₹50,000: Suggest small setup businesses
   - If budget is ₹50,000+: Suggest standard businesses
   
   **IMPORTANT:** If their budget is LOW but business needs MORE money:
   - Be HONEST about actual costs
   - Mention government schemes and MUDRA loans
   - Provide phased approach: "Start with X using ₹${budget}, scale to Y with loan"

4. **COMPETITION ANALYSIS:**
   - Check if similar businesses are oversaturated in ${location}
   - Suggest differentiation strategies
   - Warn about high-competition markets

**INTEREST:** ${interests}

Generate 5 businesses STRICTLY matching the interest "${interests}". For EACH provide JSON with:
- title: Business name
- description: 2-3 sentence description
- investment_min: Minimum investment in rupees
- investment_max: Maximum investment in rupees
- actual_realistic_cost: Real cost estimate
- funding_suggestion: How to fund if budget is low
- why_this_location: Why this works in ${location}
- home_based: true/false
- competition_level: "Low", "Medium", or "High"
- skills: Required skills
- success_probability: Percentage (e.g., "75%")
- profitability: Monthly profit estimate
- icon: Single emoji representing the business

**CRITICAL:** Be BRUTALLY HONEST about costs and competition.
Format as JSON array ONLY. No markdown, no explanation.

${languageInstruction}`;

  // Try Gemini FIRST (like Flask does)
  if (googleAI) {
    try {
      console.log('🤖 Calling Google Gemini API to generate business ideas...');
      const model = googleAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const result = await model.generateContent(prompt);
      let ideasText = result.response.text();
      console.log('✅ Gemini API response received, length:', ideasText.length);
      console.log('📝 First 200 chars:', ideasText.substring(0, 200));

      // Remove markdown code blocks if present
      if (ideasText.includes('```json')) {
        ideasText = ideasText.split('```json')[1].split('```')[0].trim();
      } else if (ideasText.includes('```')) {
        ideasText = ideasText.split('```')[1].split('```')[0].trim();
      }

      const ideas = JSON.parse(ideasText);
      console.log('✅ Successfully parsed', Array.isArray(ideas) ? ideas.length : 1, 'ideas from Gemini');
      return Array.isArray(ideas) ? ideas : [ideas];
    } catch (geminiError) {
      console.error('❌ Gemini API failed:', geminiError.message);
      console.log('🔄 Falling back to Groq...');
    }
  }

  // Fallback to Groq if Gemini fails
  if (groqClient) {
    try {
      console.log('🤖 Calling Groq API to generate business ideas...');
      
      const response = await groqClient.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are an experienced business advisor for rural women entrepreneurs in India. You provide practical, location-specific advice. Always respond in valid JSON format. ${languageInstruction}`
          },
          { role: 'user', content: prompt }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.8,
        max_tokens: 3500
      });

      let ideasText = response.choices[0]?.message?.content || '';
      console.log('✅ Groq API response received, length:', ideasText.length);

      // Try to parse as JSON
      try {
        // Remove markdown code blocks if present
        if (ideasText.includes('```json')) {
          ideasText = ideasText.split('```json')[1].split('```')[0].trim();
        } else if (ideasText.includes('```')) {
          ideasText = ideasText.split('```')[1].split('```')[0].trim();
        }

        const ideas = JSON.parse(ideasText);
        console.log('✅ Successfully parsed', Array.isArray(ideas) ? ideas.length : 1, 'ideas from Groq');
        return Array.isArray(ideas) ? ideas : [ideas];
      } catch (jsonErr) {
        console.error('❌ JSON parsing failed:', jsonErr);
        console.log('📝 Raw response:', ideasText.substring(0, 500));
      }
    } catch (error) {
      console.error('❌ Groq API also failed:', error.message);
    }
  }

  // Fallback: return realistic mock data based on location and interests
  return [
    {
      title: "Home-Based Catering Service",
      description: `Start a tiffin/catering service from your home kitchen in ${location}. Provide fresh, homemade meals to working professionals, students, or local events.`,
      investment_min: 5000,
      investment_max: 15000,
      actual_realistic_cost: 10000,
      funding_suggestion: "Start with own savings. Scale with MUDRA Shishu loan",
      why_this_location: `Growing demand for home-cooked meals in ${location}`,
      home_based: true,
      competition_level: "Medium",
      skills: "Cooking, time management, hygiene",
      success_probability: "75%",
      profitability: "₹8,000 - ₹20,000/month",
      icon: "🍳"
    },
    {
      title: "Tailoring & Alterations",
      description: `Offer custom stitching, blouse making, alterations, and embroidery services from home. Accept orders via WhatsApp/Instagram.`,
      investment_min: 15000,
      investment_max: 30000,
      actual_realistic_cost: 20000,
      funding_suggestion: "MUDRA Shishu loan or Stand-Up India scheme",
      why_this_location: `Steady demand for tailoring in ${location}`,
      home_based: true,
      competition_level: "Medium",
      skills: "Sewing, design, customer service",
      success_probability: "70%",
      profitability: "₹10,000 - ₹25,000/month",
      icon: "🧵"
    },
    {
      title: "Homemade Pickles & Snacks",
      description: `Prepare and sell traditional pickles, papads, snacks in local markets or online. Low investment, high demand during festivals.`,
      investment_min: 3000,
      investment_max: 10000,
      actual_realistic_cost: 5000,
      funding_suggestion: "Self-funded, very low investment needed",
      why_this_location: `Local festivals and demand for authentic products in ${location}`,
      home_based: true,
      competition_level: "Low",
      skills: "Cooking, food preservation, packaging",
      success_probability: "80%",
      profitability: "₹5,000 - ₹15,000/month",
      icon: "🥘"
    }
  ];
};

export const generateBusinessPlan = async (businessIdea, location, language = 'en-IN') => {
  const prompt = `Create a comprehensive business plan for: ${businessIdea} in ${location}.

Include these sections:
1. Executive Summary
2. Business Description
3. Market Analysis
4. Products/Services
5. Marketing Strategy
6. Operations Plan
7. Organization & Management
8. Financial Plan
9. Implementation Timeline
10. Appendices

Make it practical for a woman entrepreneur in rural/semi-urban India.

Respond in ${language === 'hi-IN' ? 'Hindi' : language === 'mr-IN' ? 'Marathi' : 'English'}.`;

  const response = await chatWithGroq(prompt, language);
  
  return {
    title: businessIdea,
    content: response,
    sections: parsePlanSections(response)
  };
};

export const findGovernmentSchemes = async (businessType, location, language = 'en-IN') => {
  const languageInstruction = language === 'hi-IN' ? 'हिंदी में जवाब दें। Respond in HINDI only.' 
    : language === 'mr-IN' ? 'मराठी मध्ये उत्तर द्या। Respond in MARATHI only.' 
    : 'Respond in ENGLISH only.';

  const prompt = `You are a government schemes expert for women entrepreneurs in India.

**TASK:** Find ALL applicable government schemes and funding options for "${businessType}" business in ${location}, India.

**CRITICAL REQUIREMENTS:**

1. **MUST INCLUDE THESE MAJOR SCHEMES** (if applicable):
   - MUDRA Loan (Shishu, Kishor, Tarun categories)
   - PM SVANidhi Scheme (for street vendors)
   - Stand-Up India Scheme (for SC/ST/Women)
   - Startup India Seed Fund Scheme
   - PMEGP (Prime Minister's Employment Generation Programme)
   - CGTMSE (Credit Guarantee Scheme)
   - Mahila Udyam Nidhi Scheme
   - State-specific schemes for ${location}
   - National Small Industries Corporation (NSIC) schemes
   - Women Entrepreneurship Platform (WEP)

2. **FOR EACH SCHEME PROVIDE:**
   - **Scheme Name** in local language
   - **Loan/Grant Amount** - specific numbers (e.g., "₹50,000 to ₹10 lakhs")
   - **Interest Rate** - exact percentage
   - **Eligibility Criteria** - clear requirements
   - **How to Apply** - step-by-step process with website/contact
   - **Processing Time** - estimated duration
   - **Success Rate** - high/medium/low
   - **Why Suitable** - explain why this fits "${businessType}"

3. **PRIORITIZE BY RELEVANCE:**
   - List most relevant schemes FIRST
   - Schemes specifically for women entrepreneurs
   - Schemes matching the business category
   - Low-interest or subsidy schemes

4. **ADD PRACTICAL TIPS:**
   - Which bank to approach in ${location}
   - Required documents checklist
   - Common mistakes to avoid
   - Success tips for approval

**BUSINESS TYPE:** ${businessType}
**LOCATION:** ${location}

${languageInstruction}

Provide detailed, actionable information with specific numbers and steps.`;

  const response = await chatWithGroq(prompt, language, 4000);
  return response;
};

export const analyzeLocation = async (location, businessType, language = 'en-IN') => {
  const languageInstruction = language === 'hi-IN' ? 'हिंदी में जवाब दें। Respond in HINDI only.' 
    : language === 'mr-IN' ? 'मराठी मध्ये उत्तर द्या। Respond in MARATHI only.' 
    : 'Respond in ENGLISH only.';

  const prompt = `You are a location analytics expert analyzing ${location}, India for starting "${businessType}" business.

**CRITICAL TASK:** Provide DETAILED location analysis with SPECIFIC DATA and PERCENTAGES.

**REQUIRED ANALYSIS:**

1. **DEMOGRAPHIC PROFILE:**
   - Total population in ${location}
   - Age distribution (% in 18-30, 30-50, 50+ age groups)
   - Income levels (% in different income brackets)
   - Gender distribution
   - Education levels

2. **TARGET CUSTOMER ANALYSIS WITH PERCENTAGES:**
   - **Potential customer base size** - exact number or estimate
   - **Market penetration potential** - "X% of population could be customers"
   - **Customer segments** - who will buy and what % each segment represents
   
   Example: "For handicrafts training center in Nashik:
   - 15-20% of women aged 18-40 (approx 50,000 women) are potential students
   - 25% of households with income >₹30,000 would pay for training
   - College students near XYZ College (5km away) represent 30% of potential customers"

3. **NEARBY RESOURCES & INSTITUTIONS (WITH EXACT LOCATIONS):**
   - **Educational Institutions:** Name all colleges/schools within 5km with student count
   - **Commercial Areas:** Markets, malls, business districts with distance
   - **Transport Hubs:** Railway stations, bus stands with distance
   - **Banks & Financial:** List banks in area for loans
   - **Raw Material Suppliers:** Specific shops/markets for business needs
   - **Competition:** List 3-5 similar businesses with their locations

4. **INFRASTRUCTURE ASSESSMENT:**
   - Road connectivity (quality rating /10)
   - Public transport availability
   - Electricity reliability (hours/day)
   - Internet speed average
   - Water supply status
   - Parking availability

5. **MARKET DEMAND ANALYSIS:**
   - **Current demand level** - High/Medium/Low with reasoning
   - **Growth potential** - % growth expected in next 2 years
   - **Peak seasons** - When demand is highest
   - **Competition saturation** - % of market already served

6. **CUSTOMER ACQUISITION POTENTIAL:**
   For each nearby location/institution, estimate:
   - "ABC College (2km): 2000 students, 10-15% conversion potential = 200-300 customers"
   - "XYZ Market (1km): 5000 daily footfall, 5% interest = 250 potential customers/day"
   - "Residential Area (500m): 1000 households, 20% awareness possible = 200 families"

7. **BUSINESS OPPORTUNITIES:**
   - Specific gaps in ${location} market
   - Untapped customer segments
   - Unique advantages of this location

8. **CHALLENGES & SOLUTIONS:**
   - Main obstacles in ${location}
   - How to overcome each challenge
   - Success strategies for this location

9. **REVENUE POTENTIAL:**
   - Estimated monthly customer count based on location analysis
   - Average ticket size
   - Monthly revenue projection
   - Break-even analysis for ${location}

**BUSINESS TYPE:** ${businessType}
**LOCATION:** ${location}

${languageInstruction}

BE SPECIFIC: Use real place names, actual distances, percentage estimates, and numbers. Don't give generic advice.`;

  const response = await chatWithGroq(prompt, language, 5000);
  return response;
};

const parsePlanSections = (content) => {
  const sections = [];
  const lines = content.split('\n');
  let currentSection = null;

  for (const line of lines) {
    // Check if line is a section heading (starts with number or ##)
    if (/^\d+\.|^##/.test(line.trim())) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        title: line.replace(/^\d+\.|^##/, '').trim(),
        content: ''
      };
    } else if (currentSection && line.trim()) {
      currentSection.content += line + '\n';
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
};

export const generateDetailedPlanSection = async (sectionNumber, businessIdea, location, budget = 50000, name = 'entrepreneur', language = 'en-IN') => {
  const sectionTitles = {
    1: '🧭 Executive Summary',
    2: '💡 Business Description',
    3: '📊 Market Analysis',
    4: '🛒 Products & Services',
    5: '📣 Marketing Strategy',
    6: '⚙️ Operations Plan',
    7: '👥 Organization & Management',
    8: '💰 Financial Plan',
    9: '📅 Implementation Timeline',
    10: '📎 Resources & Support'
  };

  const sectionPrompts = {
    1: `Create a comprehensive Executive Summary for ${businessIdea} in ${location} with budget ₹${budget}.

Include:
- Business overview (what it does, why it's good for ${location})
- Mission statement
- Business goals with specific numbers (Year 1: 5 goals, 3-5 Year: 3 goals)
- Products/services list with unique features
- Key success factors for ${location}
- Detailed financial snapshot (month-by-month revenue, profit margin, investment breakdown, break-even timeline, funding sources)

Make it extremely detailed (800-1000 words) with specific numbers and actionable insights.`,

    2: `Create a detailed Business Description for ${businessIdea} in ${location}.

Include:
- What problem does this business solve?
- Why is ${location} the right place for this?
- Detailed product/service descriptions
- Unique value proposition
- Business model and operations
- Growth potential

Provide 700-900 words with local market insights.`,

    3: `Create a comprehensive Market Analysis for ${businessIdea} in ${location}.

Include:
- Target market size and demographics
- Customer segments with specific profiles
- Competition analysis (local competitors, their strengths/weaknesses)
- Market trends and opportunities
- Pricing analysis
- Customer acquisition strategy

Provide 800-1000 words with data and specifics about ${location}.`,

    4: `Create a detailed Products & Services section for ${businessIdea}.

Include:
- Complete product/service list (at least 5 items)
- Detailed description of each with pricing
- Product mix strategy (high-volume low-margin vs low-volume high-margin)
- Product lifecycle strategy
- Quality standards and certifications needed
- Unique features and differentiation

Provide 700-900 words with specific pricing and profit margins.`,

    5: `Create a comprehensive Marketing Strategy for ${businessIdea} in ${location}.

Include:
- Branding strategy (name, logo, tagline ideas)
- Digital marketing (social media, WhatsApp Business, Google My Business)
- Local marketing (flyers, word-of-mouth, local partnerships)
- Customer acquisition tactics with costs
- Retention strategies
- Budget breakdown for first 6 months

Provide 800-1000 words with specific tactics and budgets.`,

    6: `Create a detailed Operations Plan for ${businessIdea} in ${location}.

Include:
- Daily operations workflow (hour-by-hour for typical day)
- Required equipment and supplies with costs
- Supplier identification and management
- Quality control processes
- Space requirements (home-based vs rented space)
- Production capacity planning

Provide 700-900 words with specific operational details.`,

    7: `Create a comprehensive Organization & Management plan for ${businessIdea}.

Include:
- Organizational structure (owner, helpers, roles)
- Staffing plan (how many people, what roles, salaries)
- Hiring process and criteria
- Training and development
- Work schedules and shifts
- Legal structure (sole proprietorship, partnership, etc.)

Provide 600-800 words with specific roles and responsibilities.`,

    8: `Create an extremely detailed Financial Plan for ${businessIdea} with budget ₹${budget}.

Include:
- Complete startup cost breakdown (10-15 items with exact costs totaling ₹${budget})
- Monthly operating expenses (rent, utilities, supplies, salaries, marketing)
- Revenue projections (month-by-month for Year 1)
- Profit and loss forecast
- Break-even analysis with timeline
- Funding requirements and sources (personal savings, loans, schemes)
- Cash flow projections

Provide 900-1100 words with detailed numbers and calculations.`,

    9: `Create a detailed Implementation Timeline for ${businessIdea}.

Include:
- Month-by-month plan for first 6 months
- Each month should have 5-7 specific tasks
- Milestones and checkpoints
- Resource requirements for each phase
- Risk mitigation at each stage
- Success metrics to track

Provide 700-900 words with actionable month-by-month breakdown.`,

    10: `Create a comprehensive Resources & Support guide for ${businessIdea} in ${location}.

Include:
- Government schemes for women entrepreneurs (MUDRA, Stand-Up India, etc.)
- Local resources in ${location} (training centers, business incubators, women's groups)
- Financial support options (banks, microfinance, crowd-funding)
- Mentorship and networking opportunities
- Online resources and tools
- Application process for key schemes

Provide 800-1000 words with specific names, contact info, and application steps.`
  };

  const prompt = sectionPrompts[sectionNumber];
  const title = sectionTitles[sectionNumber];

  if (!prompt) {
    return `Invalid section number. Please select 1-10.`;
  }

  const languageInstruction = language === 'hi-IN' ? 'Respond in HINDI only.' 
    : language === 'mr-IN' ? 'Respond in MARATHI only.' 
    : 'Respond in ENGLISH only.';

  const fullPrompt = `${prompt}\n\n${languageInstruction}`;

  try {
    const response = await chatWithGroq(fullPrompt, language);
    return `${title}\n\n${response}`;
  } catch (error) {
    console.error('Error generating detailed section:', error);
    throw error;
  }
};

export const answerBusinessQuestion = async (question, context = {}, language = 'en-IN') => {
  const languageInstruction = language === 'hi-IN' ? 'Respond in HINDI only.' 
    : language === 'mr-IN' ? 'Respond in MARATHI only.' 
    : 'Respond in ENGLISH only.';

  const contextInfo = context.name ? `\n\nUser context:\n- Name: ${context.name}\n- Location: ${context.location || 'Not specified'}\n- Interests: ${context.interests || 'Not specified'}\n- Budget: ₹${context.budget || 'Not specified'}` : '';

  const prompt = `You are an experienced business consultant for women entrepreneurs in India.

User's question: ${question}${contextInfo}

Provide a detailed, practical answer with:
- Clear explanation
- Specific examples for Indian market
- Action steps if applicable
- Relevant government schemes or resources if applicable

Be encouraging and supportive.

${languageInstruction}`;

  try {
    const response = await chatWithGroq(prompt, language);
    return response;
  } catch (error) {
    console.error('Error answering business question:', error);
    throw error;
  }
};

export const pratibhaCoFounderResponse = async (userMessage, context = {}, language = 'en-IN') => {
  // Check if PDF content exists - if so, use PDF-specific answering
  if (context.uploaded_pdf_content) {
    return await answerWithPDFContext(userMessage, context.uploaded_pdf_content, language);
  }

  const languageInstruction = language === 'hi-IN' ? 'Respond in HINDI only.' 
    : language === 'mr-IN' ? 'Respond in MARATHI only.' 
    : 'Respond in ENGLISH only.';

  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  // Build context string from user data
  let contextString = '';
  if (context.name) contextString += `Name: ${context.name}\n`;
  if (context.location) contextString += `Location: ${context.location}\n`;
  if (context.interests) contextString += `Interests: ${context.interests}\n`;
  if (context.budget) contextString += `Budget: ₹${context.budget}\n`;
  if (context.selected_idea) contextString += `Selected Business: ${context.selected_idea.title}\n`;

  const systemPrompt = `You are Startup Sathi, a friendly, knowledgeable business advisor for rural women entrepreneurs in India with access to REAL-TIME market data and current trends.

**Current Date: ${currentDate}**

Your role:
- Help women discover and start small businesses using CURRENT 2025 market data
- Provide practical, step-by-step guidance with COMPLETE, DETAILED, UP-TO-DATE information
- Answer questions about business ideas, resources, government schemes, financing, marketing
- Use REAL data when available (market trends, location data, scheme details)
- Be encouraging and supportive
- Use simple, clear language (English, Hindi, or Marathi as per user preference)
- Give SPECIFIC, ACTIONABLE, COMPREHENSIVE answers with numbers, examples, and detailed steps
- Reference CURRENT trends and opportunities in India

**FORMATTING INSTRUCTIONS - VERY IMPORTANT:**
- Start with 1-2 sentences introducing the topic warmly
- Use **bullet points (*)** for lists of items, equipment, materials
- Use **numbered lists (1., 2., 3.)** for step-by-step processes and instructions
- Include specific costs in ₹ within parentheses, e.g., (approx. ₹5,000 - ₹7,000)
- Break down complex information into clear sections
- Use line breaks between different sections for readability
- End with an encouraging question or next step suggestion

When answering:
- If asked about a SPECIFIC BUSINESS (like "pickling", "mushroom cultivation", "millet products", "soap making"), provide:
  * Start with 1-2 sentences explaining WHY this business is relevant in 2024-2025
  * CURRENT market demand and trends for this business
  * **Required Investment Breakdown:** Use bullet points with costs in parentheses:
    - Equipment needed (approx. ₹X - ₹Y)
    - Raw materials for initial stock (approx. ₹X - ₹Y)
    - Packaging materials (approx. ₹X - ₹Y)
    - Other essentials (approx. ₹X - ₹Y)
  * **Step-by-step process to start:** Use numbered list (minimum 8-12 steps):
    1. First step with clear action
    2. Second step with clear action
    3. Continue...
  * Skills required (technical + business + digital)
  * Expected profit margins and monthly revenue with realistic numbers
  * **Where to sell:** Mention physical markets + online platforms (Meesho, ONDC, WhatsApp Business, Instagram)
  * **Marketing strategies:** Social media, local networking, digital tools
  * **Government schemes applicable:** Name schemes with loan amounts and subsidy percentages
  * **Licenses needed:** FSSAI, GST, Udyam, etc. (only if relevant)
  * End with an encouraging question about their next step
  
- If asked about PACKAGING or DESIGN questions, provide:
  * Start with 1-2 friendly sentences
  * **Step-by-step packaging guide:** Use numbered list:
    1. Choose a theme (explain with examples)
    2. Select material (list options with costs in parentheses)
    3. Design your packaging (mention tools like Canva, cost ranges)
    4. Add personal touches (explain what and why)
  * Include specific cost estimates for each element
  * Mention government schemes if relevant (MSME packaging support)
  * End with encouraging words and offer to help further
  
- If asked about government schemes, provide:
  * Scheme name and managing authority
  * Loan amounts and subsidy percentages (e.g., 35% for women in PMEGP)
  * Interest rates (current 2025 rates)
  * **Eligibility criteria:** Use bullet points
  * **Step-by-step application process:** Use numbered list
  * Portal URLs (kviconline.gov.in, udyamimitra.in, etc.)
  * Contact helplines
  * Documents needed (as bullet points)
  * Processing time estimate
  
- If asked about business prerequisites/requirements, list EVERYTHING with clear structure:
  * **Equipment:** Bullet points with brand suggestions and prices in parentheses
  * **Raw materials:** Bullet points with current market rates
  * **Licenses:** List only if relevant (FSSAI for food, etc.)
  * **Skills and training:** What's needed
  * **Space requirements:** Square feet/meters needed
  * **Initial working capital:** Estimated amount
  
- If asked "HOW" questions, give detailed numbered step-by-step instructions (minimum 8-10 actionable steps)
- If asked "WHERE" questions, give specific suggestions using bullet points (markets, suppliers, banks, training centers)
- If asked about "LOCATION" or "NEARBY", suggest using Google Maps and local market visits
- Always be positive, motivating, and THOROUGH

**EXAMPLE FORMAT FOR "HOW TO" QUESTIONS:**

[1-2 friendly introductory sentences explaining why this is a good idea]

**Investment Breakdown:**
* Equipment needed (approx. ₹X - ₹Y)
* Raw materials (approx. ₹X - ₹Y)  
* Packaging (approx. ₹X - ₹Y)

**Step-by-step Process:**
1. [First clear action step]
2. [Second clear action step]
3. [Continue with detailed steps...]

**Marketing and Sales:**
[2-3 sentences about where to sell - online platforms, local markets]

**Government Support:**
[Mention relevant schemes with specific benefits]

[End with encouraging question about next steps]

**IMPORTANT GUIDELINES:**
1. When user asks for "puri jankari" (complete information) or "detail information" or "sab batao", provide EXTENSIVE, COMPREHENSIVE details covering ALL aspects
2. Use REAL data provided in context (market trends, scheme details, location info)
3. Give CURRENT 2024-2025 information, not outdated data
4. Be SPECIFIC with numbers (₹ amounts, percentages, distances, timelines)
5. Provide ACTIONABLE next steps, not vague advice
6. Include digital/online opportunities (WhatsApp Business, Meesho, Instagram, ONDC)
7. Mention trending sectors: organic/health foods, eco-friendly products, digital services, traditional with modern marketing

Don't give short answers - be thorough and detailed. Think of yourself as a complete business consultant.

${languageInstruction}`;

  try {
    // Check if this needs extended response
    const needsExtendedResponse = /comprehensive|detailed|complete|extensive|thorough|puri jankari|detail information|sab batao/i.test(userMessage);
    const maxTokens = needsExtendedResponse ? 3500 : 1500;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add context if available
    if (contextString) {
      messages.push({ role: 'system', content: `Current Context:\n${contextString}` });
    }

    // Add user message
    messages.push({ role: 'user', content: userMessage });

    const completion = await groqClient.chat.completions.create({
      messages: messages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: maxTokens
    });

    const response = completion.choices[0]?.message?.content || '';
    return response;
  } catch (error) {
    console.error('Error in Pratibha co-founder response:', error);
    throw error;
  }
};

export const analyzeLocationForBusiness = async (location, language = 'en-IN') => {
  const languageInstruction = language === 'hi-IN' ? 'Respond in HINDI only.' 
    : language === 'mr-IN' ? 'Respond in MARATHI only.' 
    : 'Respond in ENGLISH only.';

  const prompt = `Analyze ${location}, India for business opportunities for women entrepreneurs.

Provide a comprehensive analysis including:
- Economic profile and business environment
- Key industries and employment sectors
- Market gaps and opportunities
- Competition landscape
- Infrastructure (transport, internet, markets)
- Target customer demographics
- Best business types for this location
- Local challenges and how to overcome them
- Specific recommendations with reasoning

Make it detailed (800-1000 words) with actionable insights.

${languageInstruction}`;

  try {
    const response = await chatWithGroq(prompt, language);
    return response;
  } catch (error) {
    console.error('Error analyzing location:', error);
    throw error;
  }
};

export const generateDetailedResourceTopic = async (topicNumber, businessIdea, location, language = 'en-IN') => {
  const languageInstruction = language === 'hi-IN' ? 'Respond in HINDI only.' 
    : language === 'mr-IN' ? 'Respond in MARATHI only.' 
    : 'Respond in ENGLISH only.';

  const topics = {
    1: {
      title: "🗺️ Basic Location Details",
      prompt: `Provide EXTREMELY DETAILED basic location information for ${businessIdea} in ${location}.

Create a comprehensive 600-800 word analysis covering:

**1. GEOGRAPHIC COORDINATES (100 words)**
- Explain location's geographic positioning in India
- Nearest major landmarks or reference points
- Distance from city center or main market
- GPS accessibility and navigation ease

**2. ADMINISTRATIVE INFORMATION (150 words)**
- City/Town: ${location}
- District, State identification
- Postal Code/PIN ranges in ${location}
- Municipal Corporation/Panchayat details
- Police Station Jurisdiction
- Tehsil/Taluka information

**3. LAND ZONING & USAGE TYPE (150 words)**
- Current zoning classification (Residential/Commercial/Industrial/Mixed-use)
- Permitted business activities
- Is ${businessIdea} permitted under current zoning?
- Zoning benefits for ${businessIdea}
- Future zoning changes

**4. AREA SIZE & BOUNDARIES (120 words)**
- Typical plot sizes available
- Recommended size for ${businessIdea}
- Street frontage and visibility
- Corner plot advantages if applicable

**5. LOCATION ADVANTAGES FOR ${businessIdea.toUpperCase()} (150 words)**
- Strategic positioning
- 5 specific advantages with examples
- Proximity to key areas (market, residential, schools, hospitals)
- Accessibility score out of 10

**6. LOCATION CHALLENGES (80 words)**
- Potential issues (traffic, parking, access)
- Mitigation strategies
- Cost implications

Be specific to ${location} with real details. ${languageInstruction}`
    },
    2: {
      title: "🏙️ Demographics & Market Profile",
      prompt: `Provide detailed demographic analysis for ${businessIdea} in ${location}.

Include:
- Population density and total population
- Age distribution (0-18, 19-35, 36-60, 60+) with percentages
- Income levels (₹X-Y per month) and economic classes
- Occupation mix (agriculture, services, business, etc.)
- Education levels and literacy rate
- Consumer spending patterns
- Family structure (joint vs nuclear)
- Gender ratio and women's economic participation
- Religious and cultural composition
- Migration patterns (incoming/outgoing)

Explain how these demographics favor or challenge ${businessIdea}. Give specific numbers and percentages where possible.

(700-900 words) ${languageInstruction}`
    },
    3: {
      title: "🧭 Competitors & Market Density",
      prompt: `Analyze competition for ${businessIdea} in ${location}.

Provide:
- List 5-7 direct competitors with:
  * Names (real or typical examples)
  * Locations and distances from main market
  * Estimated customer base
  * Strengths and weaknesses
  * Approximate ratings/reputation
- Market saturation assessment (low/medium/high) with reasoning
- 3-5 market gaps or underserved segments
- Competitive advantages you can leverage
- Price comparison analysis
- Market share distribution
- Customer loyalty patterns
- Barriers to entry

(700-900 words) ${languageInstruction}`
    },
    4: {
      title: "🚗 Transportation & Accessibility",
      prompt: `Analyze transportation and accessibility for ${businessIdea} in ${location}.

Cover:
- Road infrastructure (main roads, condition, width)
- Public transport availability (buses, auto-rickshaws, metro/train)
- Parking facilities (availability, cost, nearby options)
- Supplier access and delivery logistics
- Customer accessibility (how customers reach you)
- Peak traffic hours and congestion patterns
- Distance to major transport hubs (railway, bus stand)
- Last-mile connectivity
- Accessibility for differently-abled customers
- Delivery services coverage (courier, logistics)
- Cost analysis for transport needs

(600-800 words) ${languageInstruction}`
    },
    5: {
      title: "🏢 Infrastructure & Utilities",
      prompt: `Analyze infrastructure and utilities for ${businessIdea} in ${location}.

Detail:
- Electricity supply (reliability, voltage, power cuts, backup needs)
- Water supply (municipal, borewell, quality, availability)
- Internet connectivity (fiber, broadband, mobile data, speeds)
- Building types and commercial spaces available
- Rent/lease costs per sq ft
- Construction quality standards
- Drainage and sewage systems
- Waste management facilities
- Safety and security infrastructure
- Backup utility requirements (inverter, generator, water storage)
- Monthly utility costs estimation

(600-800 words) ${languageInstruction}`
    },
    6: {
      title: "💼 Labor & Workforce Availability",
      prompt: `Analyze labor and workforce for ${businessIdea} in ${location}.

Provide:
- Availability of skilled workers for your business type
- Typical wage rates (daily/monthly) for different roles
- Training facilities and skill development centers
- Hiring ease and labor market conditions
- Work culture and employee retention
- Language skills of workforce
- Technical skills availability
- Labor laws and compliance requirements
- Working hours expectations
- Staff accommodation needs if applicable
- Seasonal labor variations

(600-800 words) ${languageInstruction}`
    },
    7: {
      title: "📜 Legal & Regulatory Environment",
      prompt: `Analyze legal and regulatory requirements for ${businessIdea} in ${location}.

Cover:
- Business licenses needed (Shop Act, GST, etc.)
- Permits required (fire, health, environmental)
- Registration process and timeline
- Compliance requirements (labor, tax, safety)
- Local laws specific to your business type
- Tax structure (GST, income tax, property tax)
- Inspection and audit processes
- Legal documentation needed
- Estimated cost for licenses/permits
- Renewal timelines
- Penalties for non-compliance
- Professional help needed (CA, lawyer)

(600-800 words) ${languageInstruction}`
    },
    8: {
      title: "🌐 Digital & Technology Infrastructure",
      prompt: `Analyze digital and technology infrastructure for ${businessIdea} in ${location}.

Detail:
- Internet speed and reliability (4G/5G coverage)
- E-commerce readiness (online payment acceptance)
- Digital payment systems (UPI, card readers, wallets)
- POS systems availability
- Computer/laptop service centers
- Tech support availability
- Digital marketing reach (social media penetration)
- Online delivery platform coverage (Swiggy, Zomato, etc.)
- Cloud services and backup solutions
- Cybersecurity considerations
- Digital literacy of target customers

(600-800 words) ${languageInstruction}`
    },
    9: {
      title: "💰 Financial & Banking Services",
      prompt: `Analyze financial and banking services for ${businessIdea} in ${location}.

Provide:
- Banks with branches in ${location} (list major ones)
- ATM availability and locations
- Loan facilities (business loans, MUDRA, etc.)
- Credit access and approval rates
- Interest rates for business loans
- Collateral requirements
- Processing time for loans
- Financial advisors and CA availability
- Microfinance institutions
- Insurance services
- Government financial schemes access
- Digital banking services
- Monthly banking costs

(600-800 words) ${languageInstruction}`
    },
    10: {
      title: "🤝 Community & Support Networks",
      prompt: `Analyze community and support networks for ${businessIdea} in ${location}.

Cover:
- Business associations and chambers of commerce
- Women entrepreneur groups/networks
- Mentorship programs available
- Networking events and business meets
- Local support from community
- Government support offices (DIC, KVIC, etc.)
- Incubators and accelerators nearby
- Training programs and workshops
- Industry-specific associations
- Social capital and trust in community
- Collaboration opportunities
- Success stories from ${location}

(600-800 words) ${languageInstruction}`
    }
  };

  const topicData = topics[topicNumber];
  if (!topicData) {
    throw new Error(`Invalid topic number: ${topicNumber}`);
  }

  try {
    const completion = await groqClient.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a detailed business resource analyst providing comprehensive location-based information for women entrepreneurs in India.'
        },
        {
          role: 'user',
          content: topicData.prompt
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 2500
    });

    const content = completion.choices[0]?.message?.content || '';
    return `# ${topicData.title}\n\n${content}`;
  } catch (error) {
    console.error('Error generating resource topic:', error);
    throw error;
  }
};

// Analyze PDF content and provide summary
export const analyzePDFContent = async (pdfText, language = 'en-IN') => {
  const languageInstruction = language === 'hi-IN' ? 'Respond in HINDI only.' 
    : language === 'mr-IN' ? 'Respond in MARATHI only.' 
    : 'Respond in ENGLISH only.';

  // Limit PDF text to first 8000 characters to avoid token limits
  const truncatedText = pdfText.substring(0, 8000);

  const prompt = `You are analyzing a PDF document uploaded by a woman entrepreneur. Read the document and provide a brief, friendly summary.

**PDF CONTENT:**
${truncatedText}

**YOUR TASK:**
Provide a warm, encouraging summary in 3-4 sentences explaining:
1. What type of document this is (legal document, business guide, scheme details, etc.)
2. Main topics covered
3. How it might be useful for their business

Use simple, clear language. Be encouraging and mention that they can now ask specific questions about the document.

${languageInstruction}`;

  try {
    const response = await chatWithGroq(prompt, language, 800);
    return response;
  } catch (error) {
    console.error('Error analyzing PDF:', error);
    throw error;
  }
};

// Answer questions using PDF context
export const answerWithPDFContext = async (question, pdfContent, language = 'en-IN') => {
  const languageInstruction = language === 'hi-IN' ? 'Respond in HINDI only.' 
    : language === 'mr-IN' ? 'Respond in MARATHI only.' 
    : 'Respond in ENGLISH only.';

  // Limit PDF content to avoid token limits
  const truncatedPDF = pdfContent.substring(0, 6000);

  const prompt = `You are helping a woman entrepreneur understand a business document. Answer their question based on the PDF content provided.

**PDF DOCUMENT CONTENT:**
${truncatedPDF}

**USER QUESTION:**
${question}

**YOUR TASK:**
Answer the question in simple, clear language using ONLY information from the PDF. Structure your answer as:

**Main Answer:** [2-3 sentences explaining the key point]

**Key Details:**
* [Point 1 from PDF]
* [Point 2 from PDF]
* [Point 3 from PDF]

**In Simple Words:**
[Explain any complex legal/technical terms in everyday language]

If the PDF doesn't contain information to answer the question, politely say: "I don't see information about that in the uploaded document. However, I can help you with general business advice if you'd like!"

${languageInstruction}`;

  try {
    const response = await chatWithGroq(prompt, language, 2000);
    return response;
  } catch (error) {
    console.error('Error answering with PDF context:', error);
    throw error;
  }
};
