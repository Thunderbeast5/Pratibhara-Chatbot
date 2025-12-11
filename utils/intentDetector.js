import natural from 'natural';
import compromise from 'compromise';

const tokenizer = new natural.WordTokenizer();

// Intent patterns
const INTENT_PATTERNS = {
  greeting: ['hi', 'hello', 'hey', 'start', 'namaste', 'namaskar'],
  generate_business: ['business', 'idea', 'start', 'entrepreneur', 'plan', 'startup'],
  ask_question: ['question', 'ask', 'help', 'tell', 'how'],
  location: ['location', 'place', 'city', 'area', 'village', 'near'],
  funding: ['fund', 'money', 'loan', 'scheme', 'grant', 'investment'],
  interest: ['cooking', 'sewing', 'dairy', 'farming', 'beauty', 'handicraft', 'teaching', 'retail']
};

export const detectIntent = (message) => {
  const lowerMessage = message.toLowerCase();
  const tokens = tokenizer.tokenize(lowerMessage);

  // Check for greeting
  if (INTENT_PATTERNS.greeting.some(word => tokens.includes(word))) {
    return 'greeting';
  }

  // Check for business generation
  if (INTENT_PATTERNS.generate_business.some(word => lowerMessage.includes(word))) {
    return 'generate_business';
  }

  // Check for questions
  if (INTENT_PATTERNS.ask_question.some(word => tokens.includes(word))) {
    return 'ask_question';
  }

  // Check for location
  if (INTENT_PATTERNS.location.some(word => tokens.includes(word))) {
    return 'location';
  }

  // Check for funding
  if (INTENT_PATTERNS.funding.some(word => tokens.includes(word))) {
    return 'funding';
  }

  return 'general';
};

export const extractEntities = (message) => {
  const doc = compromise(message);
  const entities = {};

  // Extract places
  const places = doc.places().out('array');
  if (places.length > 0) {
    entities.location = places[0];
  }

  // Extract names
  const names = doc.people().out('array');
  if (names.length > 0) {
    entities.name = names[0];
  }

  // Extract numbers (could be budget/investment)
  const numbers = doc.numbers().out('array');
  if (numbers.length > 0) {
    entities.budget = numbers[0];
  }

  // Extract interests based on keywords
  const interests = [];
  const messageText = message.toLowerCase();
  
  if (messageText.includes('cook') || messageText.includes('food')) interests.push('cooking');
  if (messageText.includes('sew') || messageText.includes('tailor')) interests.push('sewing');
  if (messageText.includes('dairy') || messageText.includes('milk')) interests.push('dairy');
  if (messageText.includes('farm') || messageText.includes('agriculture')) interests.push('farming');
  if (messageText.includes('beauty') || messageText.includes('salon')) interests.push('beauty');
  if (messageText.includes('craft') || messageText.includes('art')) interests.push('handicrafts');
  if (messageText.includes('teach') || messageText.includes('tutor')) interests.push('teaching');
  if (messageText.includes('shop') || messageText.includes('retail')) interests.push('retail');

  if (interests.length > 0) {
    entities.interests = interests.join(', ');
  }

  return entities;
};

export const categorizeInterest = (interest) => {
  const categories = {
    'cooking': 'food',
    'sewing': 'textile',
    'dairy': 'agriculture',
    'farming': 'agriculture',
    'beauty': 'service',
    'handicrafts': 'craft',
    'teaching': 'education',
    'retail': 'commerce'
  };

  return categories[interest?.toLowerCase()] || 'general';
};
