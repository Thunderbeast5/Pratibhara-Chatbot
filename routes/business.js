import express from 'express';
import { chatWithGroq } from '../services/llmService.js';
import sessionManager from '../utils/sessionManager.js';

const router = express.Router();

router.post('/qa', async (req, res) => {
  try {
    const { question, session_id, language = 'en-IN' } = req.body;

    if (!question || !session_id) {
      return res.status(400).json({ 
        error: 'question and session_id are required' 
      });
    }

    const session = sessionManager.getSession(session_id);
    const context = session.context;

    // Build context-aware prompt
    let prompt = `You are a business consultant for women entrepreneurs in rural India.\n\n`;
    
    if (context.name) prompt += `User: ${context.name}\n`;
    if (context.location) prompt += `Location: ${context.location}\n`;
    if (context.interests) prompt += `Interests: ${context.interests}\n`;
    if (context.selected_idea) prompt += `Current Business Idea: ${context.selected_idea.title}\n`;
    
    prompt += `\nQuestion: ${question}\n\nProvide a helpful, practical answer in ${language === 'hi-IN' ? 'Hindi' : language === 'mr-IN' ? 'Marathi' : 'English'}.`;

    const answer = await chatWithGroq(prompt, language);

    // Add to history
    sessionManager.addToHistory(session_id, {
      type: 'qa',
      question,
      answer
    });

    res.json({
      question,
      answer,
      context: context
    });
  } catch (error) {
    console.error('Business Q&A error:', error);
    res.status(500).json({ 
      error: 'Failed to answer question',
      message: error.message 
    });
  }
});

export default router;
