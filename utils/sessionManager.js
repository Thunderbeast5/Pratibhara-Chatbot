import NodeCache from 'node-cache';

// Session storage (TTL: 1 hour)
const sessionCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

class SessionManager {
  getSession(sessionId) {
    const session = sessionCache.get(sessionId);
    if (!session) {
      return this.createSession(sessionId);
    }
    return session;
  }

  createSession(sessionId) {
    const newSession = {
      sessionId,
      userId: null,
      currentStep: 'initial',
      context: {},
      history: [],
      mode: null,
      language: 'en-IN',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };
    sessionCache.set(sessionId, newSession);
    return newSession;
  }

  updateSession(sessionId, updates) {
    const session = this.getSession(sessionId);
    const updatedSession = {
      ...session,
      ...updates,
      lastActivity: new Date().toISOString()
    };
    sessionCache.set(sessionId, updatedSession);
    return updatedSession;
  }

  deleteSession(sessionId) {
    sessionCache.del(sessionId);
  }

  addToHistory(sessionId, entry) {
    const session = this.getSession(sessionId);
    session.history.push({
      ...entry,
      timestamp: new Date().toISOString()
    });
    sessionCache.set(sessionId, session);
  }

  updateContext(sessionId, contextUpdates) {
    const session = this.getSession(sessionId);
    session.context = {
      ...session.context,
      ...contextUpdates
    };
    sessionCache.set(sessionId, session);
    return session.context;
  }
}

export default new SessionManager();
