import express from 'express';
import multer from 'multer';
import sessionManager from '../utils/sessionManager.js';
import { detectIntent, extractEntities } from '../utils/intentDetector.js';
import { getText } from '../utils/translations.js';
import * as llmService from '../services/llmService.js';

const router = express.Router();

// Configure multer for file uploads (in-memory storage)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { message, session_id, language = 'en-IN' } = req.body;

    if (!message || !session_id) {
      return res.status(400).json({ error: 'Message and session_id are required' });
    }

    // Get or create session
    let session = sessionManager.getSession(session_id);
    session.language = language;

    // Detect intent and extract entities
    const intent = detectIntent(message);
    const entities = extractEntities(message);

    // Update context with entities
    if (Object.keys(entities).length > 0) {
      sessionManager.updateContext(session_id, entities);
      session = sessionManager.getSession(session_id);
    }

    // Add to history
    sessionManager.addToHistory(session_id, {
      message,
      intent,
      entities
    });

    // Handle different conversation states
    const response = await handleConversation(session, message, intent, entities, language);

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      reply: getText('errorMessage', req.body.language || 'en-IN')
    });
  }
});

router.post('/button_click', async (req, res) => {
  try {
    const { button_value, session_id, language = 'en-IN' } = req.body;

    if (!button_value || !session_id) {
      return res.status(400).json({ error: 'button_value and session_id are required' });
    }

    const session = sessionManager.getSession(session_id);
    session.language = language;

    const response = await handleButtonClick(session, button_value, language);

    res.json(response);
  } catch (error) {
    console.error('Button click error:', error);
    res.status(500).json({ 
      error: 'Failed to process button click',
      reply: getText('errorMessage', req.body.language || 'en-IN')
    });
  }
});

router.post('/select_idea', async (req, res) => {
  try {
    const { idea_id, session_id, language = 'en-IN' } = req.body;

    if (idea_id === undefined || !session_id) {
      return res.status(400).json({ error: 'idea_id and session_id are required' });
    }

    const session = sessionManager.getSession(session_id);
    const ideas = session.context.generated_ideas;

    if (!ideas || !ideas[idea_id]) {
      return res.status(400).json({ error: 'Invalid idea index' });
    }

    const selectedIdea = ideas[idea_id];
    sessionManager.updateContext(session_id, { 
      selected_idea: selectedIdea,
      selected_idea_index: idea_id
    });

    const response = {
      reply: getText('idea_selected', language).replace('{ideaTitle}', selectedIdea.title),
      buttons: [
        { text: getText('btn_create_plan', language), value: "create_plan" },
        { text: getText('btn_find_funding', language), value: "find_funding" },
        { text: getText('btn_find_resources', language), value: "find_resources" },
        { text: getText('btn_analyze_location', language), value: "analyze_location" }
      ],
      context: session.context
    };

    res.json(response);
  } catch (error) {
    console.error('Idea selection error:', error);
    res.status(500).json({ 
      error: 'Failed to select idea',
      reply: getText('errorMessage', req.body.language || 'en-IN')
    });
  }
});

async function handleConversation(session, message, intent, entities, language) {
  const { currentStep, context, detailed_plan_mode, detailed_resource_mode } = session;

  // Handle 'end' command - Exit session gracefully
  const endCommands = ['end', 'exit', 'quit', 'bye', 'goodbye', 'stop'];
  if (endCommands.includes(message.toLowerCase().trim())) {
    const userName = context.name || 'friend';
    return {
      reply: getText('goodbye_message', language).replace('{name}', userName),
      buttons: [
        { text: getText('btn_restart_session', language), value: 'restart_session' }
      ],
      type: 'button_choice',
      context: context
    };
  }

  // Check if user is in detailed plan mode and typed a number 1-10
  if (detailed_plan_mode && /^[1-9]$|^10$/.test(message.trim())) {
    const sectionNumber = parseInt(message.trim());
    const { selected_idea, location, budget, name } = context;
    
    if (!selected_idea) {
      return {
        reply: "Please select a business idea first.",
        type: 'text',
        context: context
      };
    }

    // Generate detailed section content
    try {
      const sectionContent = await llmService.generateDetailedPlanSection(
        sectionNumber,
        selected_idea.title,
        location,
        budget,
        name,
        language
      );

      return {
        reply: sectionContent,
        type: 'detailed_section',
        buttons: [
          { text: getText('btn_back_to_menu', language), value: "detailed_business_plan" },
          { text: getText('btn_find_resources', language), value: "find_resources" },
          { text: getText('btn_view_schemes', language), value: "find_funding" }
        ],
        context: context
      };
    } catch (error) {
      console.error('Error generating detailed section:', error);
      return {
        reply: getText('errorMessage', language),
        type: 'text',
        context: context
      };
    }
  }

  // Check if user is in detailed resource mode and typed a number 1-10
  if (detailed_resource_mode && /^[1-9]$|^10$/.test(message.trim())) {
    const topicNumber = parseInt(message.trim());
    const { selected_idea, location } = context;
    
    if (!selected_idea || !location) {
      return {
        reply: "Please select a business idea and provide your location first.",
        type: 'text',
        context: context
      };
    }

    // Generate detailed resource topic content
    try {
      const topicContent = await llmService.generateDetailedResourceTopic(
        topicNumber,
        selected_idea.title,
        location,
        language
      );

      return {
        reply: topicContent,
        type: 'detailed_resource',
        buttons: [
          { text: getText('btn_back_to_resource_menu', language), value: "find_resources" },
          { text: getText('btn_view_business_plan', language), value: "detailed_business_plan" },
          { text: getText('btn_view_schemes', language), value: "find_funding" }
        ],
        context: context
      };
    } catch (error) {
      console.error('Error generating resource topic:', error);
      return {
        reply: getText('errorMessage', language),
        type: 'text',
        context: context
      };
    }
  }

  // Initial state - waiting for "Hi"
  if (currentStep === 'initial') {
    if (['hi', 'hello', 'hey', 'start'].some(word => message.toLowerCase().includes(word))) {
      sessionManager.updateSession(session.sessionId, { currentStep: 'mode_selection' });
      
      return {
        reply: getText('greeting', language),
        buttons: [
          { text: getText('generate_business_btn', language), value: 'generate_business' },
          { text: getText('ask_question_btn', language), value: 'ask_question' },
          { text: getText('location_analysis_btn', language), value: 'location_analysis' }
        ],
        type: 'button_choice',
        context: context
      };
    } else {
      return {
        reply: getText('type_hi', language),
        type: 'text',
        context: context
      };
    }
  }

  // Collecting name
  if (currentStep === 'collecting_name') {
    const name = message.trim();
    sessionManager.updateContext(session.sessionId, { name });
    sessionManager.updateSession(session.sessionId, { currentStep: 'collecting_location' });

    return {
      reply: getText('ask_for_city', language).replace('{name}', name),
      type: 'text',
      current_step: 'collecting_location',
      context: sessionManager.getSession(session.sessionId).context
    };
  }

  // Collecting location
  if (currentStep === 'collecting_location') {
    const location = message.trim();
    sessionManager.updateContext(session.sessionId, { location });
    sessionManager.updateSession(session.sessionId, { currentStep: 'collecting_interests' });

    return {
      reply: getText('ask_for_interests', language).replace('{location}', location),
      buttons: [
        { text: getText('btn_cooking', language), value: 'cooking' },
        { text: getText('btn_sewing', language), value: 'sewing' },
        { text: getText('btn_dairy', language), value: 'dairy' },
        { text: getText('btn_farming', language), value: 'farming' },
        { text: getText('btn_beauty', language), value: 'beauty' },
        { text: getText('btn_handicrafts', language), value: 'handicrafts' },
        { text: getText('btn_teaching', language), value: 'teaching' },
        { text: getText('btn_retail', language), value: 'retail' }
      ],
      type: 'button_choice',
      context: sessionManager.getSession(session.sessionId).context
    };
  }

  // Question mode - user asks a business question
  if (currentStep === 'question_mode' || currentStep === 'pratibha_journey_start') {
    try {
      const answer = await llmService.pratibhaCoFounderResponse(message, context, language);
      
      // Update context with conversation history
      sessionManager.updateContext(session.sessionId, context);
      
      return {
        reply: answer,
        type: 'text',
        buttons: [
          { text: '💡 Continue Shaping Idea', value: 'ask_question' },
          { text: '🔙 Back to Menu', value: 'back_to_menu' }
        ],
        context: sessionManager.getSession(session.sessionId).context
      };
    } catch (error) {
      console.error('Error in Pratibha journey:', error);
      return {
        reply: getText('errorMessage', language),
        type: 'text',
        context: context
      };
    }
  }

  // Location analysis mode
  if (currentStep === 'location_analysis_mode') {
    const location = message.trim();
    sessionManager.updateContext(session.sessionId, { location });
    
    try {
      const analysis = await llmService.analyzeLocationForBusiness(location, language);
      
      return {
        reply: analysis,
        type: 'text',
        buttons: [
          { text: '🔍 Analyze Another Location', value: 'location_analysis' },
          { text: '🔙 Back to Menu', value: 'back_to_menu' }
        ],
        context: sessionManager.getSession(session.sessionId).context
      };
    } catch (error) {
      console.error('Error analyzing location:', error);
      return {
        reply: getText('errorMessage', language),
        type: 'text',
        context: context
      };
    }
  }

  // Default response
  return {
    reply: "I'm here to help you with your business journey! How can I assist you today?",
    type: 'text',
    context: context
  };
}

async function handleButtonClick(session, buttonValue, language) {
  const { context } = session;

  // Mode selection
  if (buttonValue === 'generate_business') {
    sessionManager.updateSession(session.sessionId, { 
      currentStep: 'collecting_name',
      mode: 'generate_business'
    });

    return {
      reply: getText('generate_business_intro', language),
      type: 'text',
      context: context
    };
  }

  // Ask question mode
  if (buttonValue === 'ask_question') {
    sessionManager.updateSession(session.sessionId, { 
      currentStep: 'question_mode',
      mode: 'ask_question'
    });

    return {
      reply: getText('pratibha_intro', language),
      type: 'text',
      context: context
    };
  }

  // Location analysis mode
  if (buttonValue === 'location_analysis') {
    sessionManager.updateSession(session.sessionId, { 
      currentStep: 'location_analysis_mode',
      mode: 'location_analysis'
    });

    return {
      reply: getText('location_analysis_prompt', language),
      type: 'text',
      context: context
    };
  }

  // Back to menu
  if (buttonValue === 'back_to_menu') {
    sessionManager.updateSession(session.sessionId, { 
      currentStep: 'mode_selection',
      mode: null
    });

    return {
      reply: getText('greeting', language),
      buttons: [
        { text: getText('generate_business_btn', language), value: 'generate_business' },
        { text: getText('ask_question_btn', language), value: 'ask_question' },
        { text: getText('location_analysis_btn', language), value: 'location_analysis' }
      ],
      type: 'button_choice',
      context: context
    };
  }

  // Restart session - Clear all data and start fresh
  if (buttonValue === 'restart_session') {
    // Clear session data
    sessionManager.updateSession(session.sessionId, {
      currentStep: 'initial',
      mode: null,
      detailed_plan_mode: false
    });
    sessionManager.updateContext(session.sessionId, {});

    return {
      reply: "Welcome back! 👋\n\nType 'Hi' to start a new session.",
      type: 'text',
      context: {}
    };
  }

  // Interest selection
  if (['cooking', 'sewing', 'dairy', 'farming', 'beauty', 'handicrafts', 'teaching', 'retail'].includes(buttonValue)) {
    sessionManager.updateContext(session.sessionId, { 
      interests: buttonValue,
      categories: [buttonValue]
    });
    sessionManager.updateSession(session.sessionId, { currentStep: 'asking_budget' });

    return {
      reply: getText('ask_budget', language),
      buttons: [
        { text: 'Under ₹10,000', value: 'budget_10000' },
        { text: '₹10,000 - ₹50,000', value: 'budget_50000' },
        { text: '₹50,000 - ₹1,00,000', value: 'budget_100000' },
        { text: 'Above ₹1,00,000', value: 'budget_200000' }
      ],
      type: 'button_choice',
      context: sessionManager.getSession(session.sessionId).context
    };
  }

  // Budget selection
  if (buttonValue.startsWith('budget_')) {
    const budgetAmount = parseInt(buttonValue.replace('budget_', ''));
    sessionManager.updateContext(session.sessionId, { budget: budgetAmount });
    sessionManager.updateSession(session.sessionId, { currentStep: 'ready_to_generate' });

    return {
      reply: getText('have_all_info', language),
      buttons: [
        { text: getText('btn_show_ideas', language), value: 'show_ideas' }
      ],
      type: 'button_choice',
      context: sessionManager.getSession(session.sessionId).context
    };
  }

  // Generate business ideas
  if (buttonValue === 'show_ideas') {
    const { name, location, interests, budget } = context;
    
    try {
      const ideas = await llmService.generateBusinessIdeas(name, location, interests, language, budget || 10000);
      sessionManager.updateContext(session.sessionId, { generated_ideas: ideas });

      return {
        reply: `Here are some great business ideas for you based on your profile! 🎉\n\nClick on any idea to learn more:`,
        ideas: ideas,
        type: 'ideas',
        context: sessionManager.getSession(session.sessionId).context
      };
    } catch (error) {
      console.error('Error generating ideas:', error);
      return {
        reply: getText('errorMessage', language),
        type: 'text',
        context: context
      };
    }
  }

  // Create business plan
  if (buttonValue === 'create_plan') {
    const { selected_idea, location, name, budget } = context;
    
    if (!selected_idea) {
      return {
        reply: "Please select a business idea first.",
        type: 'text',
        context: context
      };
    }

    try {
      const plan = await llmService.generateBusinessPlan(selected_idea.title, location, language);
      sessionManager.updateContext(session.sessionId, { generated_plan: plan });

      // Store that plan was generated and enable detailed plan mode  
      sessionManager.updateSession(session.sessionId, { detailed_plan_mode: true });

      const businessName = selected_idea.title;

      return {
        reply: `${getText('plan_created', language).replace('{businessName}', businessName)}\n\n${plan.content}\n\n---\n\n${getText('next_steps', language)}`,
        buttons: [
          { text: getText('btn_view_detailed_sections', language), value: "detailed_business_plan" },
          { text: getText('btn_find_resources', language), value: "find_resources" },
          { text: getText('btn_view_schemes', language), value: "find_funding" }
        ],
        type: 'text',
        context: sessionManager.getSession(session.sessionId).context
      };
    } catch (error) {
      console.error('Error generating plan:', error);
      return {
        reply: getText('errorMessage', language),
        type: 'text',
        context: context
      };
    }
  }

  // Show detailed business plan menu (10 sections)
  if (buttonValue === 'detailed_business_plan') {
    const { selected_idea } = context;
    
    if (!selected_idea) {
      return {
        reply: "Please select a business idea first.",
        type: 'text',
        context: context
      };
    }

    const businessName = selected_idea.title;
    const menuText = `${getText('detailed_plan_title', language).replace('{businessName}', businessName)}

${getText('select_section_prompt', language)}

**1. ${getText('section_1_title', language)}**
${getText('section_1_desc', language)}

**2. ${getText('section_2_title', language)}**
${getText('section_2_desc', language)}

**3. ${getText('section_3_title', language)}**
${getText('section_3_desc', language)}

**4. ${getText('section_4_title', language)}**
${getText('section_4_desc', language)}

**5. ${getText('section_5_title', language)}**
${getText('section_5_desc', language)}

**6. ${getText('section_6_title', language)}**
${getText('section_6_desc', language)}

**7. ${getText('section_7_title', language)}**
${getText('section_7_desc', language)}

**8. ${getText('section_8_title', language)}**
${getText('section_8_desc', language)}

**9. ${getText('section_9_title', language)}**
${getText('section_9_desc', language)}

**10. ${getText('section_10_title', language)}**
${getText('section_10_desc', language)}

**${getText('type_number_prompt', language)}**`;

    // Enable detailed plan mode
    sessionManager.updateSession(session.sessionId, { detailed_plan_mode: true });

    return {
      reply: menuText,
      buttons: [
        { text: getText('btn_find_resources', language), value: "find_resources" },
        { text: getText('btn_view_schemes', language), value: "find_funding" }
      ],
      type: 'detailed_plan_menu',
      context: sessionManager.getSession(session.sessionId).context
    };
  }

  // Find resources
  if (buttonValue === 'find_resources') {
    const { selected_idea, location } = context;
    
    if (!location) {
      return {
        reply: getText('need_location_for_resources', language),
        type: 'text',
        context: context
      };
    }

    if (!selected_idea) {
      return {
        reply: getText('need_business_idea', language),
        type: 'text',
        context: context
      };
    }

    const businessName = selected_idea.title;
    const resourceMenuText = getText('detailed_resource_title', language).replace('{businessName}', businessName) + `\n\n` +
      getText('resource_topic_prompt', language) + `\n\n` +
      `**1. ${getText('resource_topic_1_title', language)}**\n` +
      `${getText('resource_topic_1_desc', language)}\n\n` +
      `**2. ${getText('resource_topic_2_title', language)}**\n` +
      `${getText('resource_topic_2_desc', language)}\n\n` +
      `**3. ${getText('resource_topic_3_title', language)}**\n` +
      `${getText('resource_topic_3_desc', language)}\n\n` +
      `**4. ${getText('resource_topic_4_title', language)}**\n` +
      `${getText('resource_topic_4_desc', language)}\n\n` +
      `**5. ${getText('resource_topic_5_title', language)}**\n` +
      `${getText('resource_topic_5_desc', language)}\n\n` +
      `**6. ${getText('resource_topic_6_title', language)}**\n` +
      `${getText('resource_topic_6_desc', language)}\n\n` +
      `**7. ${getText('resource_topic_7_title', language)}**\n` +
      `${getText('resource_topic_7_desc', language)}\n\n` +
      `**8. ${getText('resource_topic_8_title', language)}**\n` +
      `${getText('resource_topic_8_desc', language)}\n\n` +
      `**9. ${getText('resource_topic_9_title', language)}**\n` +
      `${getText('resource_topic_9_desc', language)}\n\n` +
      `**10. ${getText('resource_topic_10_title', language)}**\n` +
      `${getText('resource_topic_10_desc', language)}\n\n` +
      `---\n\n` +
      `**${getText('type_resource_number_prompt', language)}**`;

    // Enable detailed resource mode
    sessionManager.updateSession(session.sessionId, { detailed_resource_mode: true });

    return {
      reply: resourceMenuText,
      type: 'detailed_resource_menu',
      context: sessionManager.getSession(session.sessionId).context
    };
  }

  // Find funding
  if (buttonValue === 'find_funding') {
    const { selected_idea, location } = context;
    
    if (!selected_idea) {
      return {
        reply: "Please select a business idea first.",
        type: 'text',
        context: context
      };
    }

    try {
      const schemes = await llmService.findGovernmentSchemes(selected_idea.title, location, language);
      
      return {
        reply: getText('funding_intro', language).replace('{businessName}', `**${selected_idea.title}**`).replace('{location}', location) + '\n\n' + schemes,
        type: 'schemes',
        context: context
      };
    } catch (error) {
      console.error('Error finding schemes:', error);
      return {
        reply: getText('errorMessage', language),
        type: 'text',
        context: context
      };
    }
  }

  // Analyze location for selected business
  if (buttonValue === 'analyze_location') {
    const { selected_idea, location } = context;
    
    if (!selected_idea) {
      return {
        reply: getText('need_business_idea', language),
        type: 'text',
        context: context
      };
    }

    if (!location) {
      return {
        reply: getText('need_location_for_resources', language),
        type: 'text',
        context: context
      };
    }

    try {
      const analysis = await llmService.analyzeLocation(location, selected_idea.title, language);
      
      return {
        reply: analysis,
        type: 'location_analysis',
        buttons: [
          { text: getText('btn_create_plan', language), value: "create_plan" },
          { text: getText('btn_find_funding', language), value: "find_funding" },
          { text: getText('btn_find_resources', language), value: "find_resources" }
        ],
        context: context
      };
    } catch (error) {
      console.error('Error analyzing location:', error);
      return {
        reply: getText('errorMessage', language),
        type: 'text',
        context: context
      };
    }
  }

  return {
    reply: getText('processing_request', language),
    type: 'text',
    context: context
  };
}

// PDF Upload endpoint for question mode
router.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    const { session_id, language = 'en-IN' } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    // Get session and verify user is in question mode
    const session = sessionManager.getSession(session_id);
    if (!session || (session.currentStep !== 'question_mode' && session.currentStep !== 'pratibha_journey_start')) {
      return res.status(400).json({ 
        error: 'PDF upload is only available in Ask Business Question mode',
        message: 'Please select "Ask Business Question" mode first to upload PDFs'
      });
    }

    // Extract text from PDF using dynamic import
    let pdfData;
    try {
      const { default: pdfParse } = await import('pdf-parse');
      pdfData = await pdfParse(req.file.buffer);
    } catch (parseError) {
      console.error('PDF parsing error:', parseError);
      return res.status(400).json({ 
        error: 'Failed to parse PDF',
        message: 'Could not read the PDF file. Please make sure it is a valid PDF.'
      });
    }

    const pdfText = pdfData.text;

    if (!pdfText || pdfText.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Could not extract text from PDF',
        message: 'The PDF appears to be empty or contains only images'
      });
    }

    // Store PDF content in session context
    sessionManager.updateContext(session_id, { 
      uploaded_pdf_content: pdfText,
      uploaded_pdf_name: req.file.originalname,
      uploaded_pdf_pages: pdfData.numpages
    });

    // Generate initial summary
    const summary = await llmService.analyzePDFContent(pdfText, language);

    res.json({
      success: true,
      message: getText('pdf_uploaded_successfully', language) || `PDF "${req.file.originalname}" uploaded successfully! You can now ask questions about it.`,
      filename: req.file.originalname,
      pages: pdfData.numpages,
      summary: summary,
      context: sessionManager.getSession(session_id).context
    });

  } catch (error) {
    console.error('PDF upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process PDF',
      message: error.message
    });
  }
});

export default router;
